from concurrent.futures import ThreadPoolExecutor

import pytest

from apps.monitor.models import ErrorIssue, Event
from apps.monitor.services import resilience


@pytest.fixture(autouse=True)
def _clean_resilience():
    resilience.reset_resilience_state()
    yield
    resilience.reset_resilience_state()


def test_parse_redis_url_acl_and_special_chars():
    ep = resilience.parse_redis_url("redis://acl_user:p%40ss%2Fword@127.0.0.1:6380/3")
    assert ep is not None
    assert ep.host == "127.0.0.1"
    assert ep.port == 6380
    assert ep.db == 3
    assert ep.username == "acl_user"
    assert ep.password == "p@ss/word"


def test_local_rate_limit_multithreaded_eviction_safety():
    # Stress > _MAX_LOCAL_IPS (10,000) across 16 concurrent threads to ensure zero dict race errors
    def worker(offset: int) -> int:
        allowed = 0
        for i in range(700):
            if resilience.check_local_rate_limit(f"10.{offset}.{i // 256}.{i % 256}", limit=2):
                allowed += 1
        return allowed

    with ThreadPoolExecutor(max_workers=16) as pool:
        totals = list(pool.map(worker, range(16)))

    assert sum(totals) == 16 * 700
    assert len(resilience._LOCAL_RATE_WINDOWS) <= resilience._MAX_LOCAL_IPS


@pytest.mark.django_db
def test_circuit_breaker_degradation_and_recovery(client, admin_token, settings):
    # 1. Unreachable Redis -> trips circuit breaker, preserves 100% errors, drops sampled PV
    settings.REDIS_URL = "redis://127.0.0.1:1/0"
    settings.REDIS_TIMEOUT_MS = 50
    settings.INGEST_MODE = "redis_queue"
    settings.INGEST_FALLBACK_SAMPLE_RATE = 0.0

    created = client.post(
        "/api/v1/projects",
        {"name": "Circuit Recovery Project"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin_token}",
    ).json()["data"]
    app_key = created["appKey"]

    res = client.post(
        "/api/v1/ingest/events",
        {
            "appKey": app_key,
            "events": [
                {"type": "pageview", "url": "https://drone.test/"},
                {
                    "type": "error",
                    "url": "https://drone.test/",
                    "error": {"type": "js", "message": "Gimbal calibration fault"},
                },
            ],
        },
        content_type="application/json",
    )
    assert res.status_code == 200
    assert resilience.is_circuit_open() is True
    assert Event.objects.filter(project_id=created["id"]).count() == 0
    assert ErrorIssue.objects.filter(project_id=created["id"]).count() == 1

    resilience.reset_resilience_state()
    assert resilience.is_circuit_open() is False


@pytest.mark.django_db
def test_realtime_stress_detection_and_bottleneck_evaluation(client, admin_token):
    from apps.monitor.services.bottleneck import evaluate_bottleneck
    from apps.monitor.services.system import reset_traffic_window

    reset_traffic_window()
    client.get("/api/health", HTTP_X_STRESS_RUN="1")

    res = client.get("/api/v1/system/status", HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["host"]["cpuCores"] >= 1
    assert data["traffic"]["stressTrafficActive"] is True
    assert data["stressTest"]["active"] is True
    assert data["bottleneck"]["level"] in {"healthy", "approaching", "critical"}

    cpu_warn = evaluate_bottleneck(
        db_engine="postgresql",
        db_ok=True,
        db_latency_ms=2.0,
        queue_backlog=0,
        host={"cpuPercent": 78.0, "loadRatio": 0.82, "memPercent": 50.0},
        traffic={"currentRps": 120.0, "p95LatencyMs": 180.0, "error5xx1m": 0},
    )
    assert cpu_warn["level"] == "approaching"
    assert cpu_warn["primaryFactor"] == "cpu"

    sqlite_crit = evaluate_bottleneck(
        db_engine="sqlite",
        db_ok=True,
        db_latency_ms=5.0,
        queue_backlog=0,
        host={"cpuPercent": 30.0, "loadRatio": 0.3, "memPercent": 40.0},
        traffic={"currentRps": 40.0, "p95LatencyMs": 320.0, "error5xx1m": 3},
    )
    assert sqlite_crit["level"] == "critical"
    assert sqlite_crit["primaryFactor"] == "database_lock"
    reset_traffic_window()


@pytest.mark.django_db
def test_system_status_combines_legacy_list_and_stream_queue_depths(settings, monkeypatch):
    from apps.monitor.services import system

    settings.REDIS_URL = "redis://127.0.0.1:6379/0"
    settings.INGEST_MODE = "redis_queue"
    captured: list[list[str]] = []

    def fake_execute(commands, **_kwargs):
        captured.extend(commands)
        return ["PONG", 2, 5, 1, 4]

    monkeypatch.setattr(system, "execute_redis_commands", fake_execute)
    status = system.get_system_status()

    assert ["XLEN", "monitor:ingest:events:v2"] in captured
    assert ["XLEN", "monitor:ingest:logs:v2"] in captured
    assert status["redis"]["eventsQueueDepth"] == 7
    assert status["redis"]["logsQueueDepth"] == 5
