import socketserver
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from apps.monitor.management.commands import run_ingest_worker
from apps.monitor.management.commands.run_ingest_worker import drain_once
from apps.monitor.models import ErrorIssue, Event
from apps.monitor.services import resilience


class _FakeRedisHandler(socketserver.StreamRequestHandler):
    """In-memory RESP2 server supporting AUTH, SELECT, INCR, EXPIRE, RPUSH, LPUSH, LTRIM, LPOP."""

    def handle(self):
        srv = self.server  # type: ignore[attr-defined]
        while True:
            header = self.rfile.readline()
            if not header:
                break
            count = int(header[1:].strip())
            args: list[str] = []
            for _ in range(count):
                length = int(self.rfile.readline()[1:].strip())
                data = self.rfile.read(length + 2)[:-2]
                args.append(data.decode("utf-8"))

            cmd = args[0].upper()
            with srv.lock:
                if cmd == "AUTH":
                    srv.auth_calls.append(args[1:])
                    self.wfile.write(b"+OK\r\n")
                elif cmd == "SELECT":
                    srv.selected_db = int(args[1])
                    self.wfile.write(b"+OK\r\n")
                elif cmd == "INCR":
                    srv.store[args[1]] = srv.store.get(args[1], 0) + 1
                    self.wfile.write(f":{srv.store[args[1]]}\r\n".encode())
                elif cmd == "EXPIRE":
                    self.wfile.write(b":1\r\n")
                elif cmd == "PING":
                    self.wfile.write(b"+PONG\r\n")
                elif cmd == "LLEN":
                    lst = srv.lists.get(args[1], [])
                    self.wfile.write(f":{len(lst)}\r\n".encode())
                elif cmd == "RPUSH":
                    lst = srv.lists.setdefault(args[1], [])
                    lst.extend(args[2:])
                    self.wfile.write(f":{len(lst)}\r\n".encode())
                elif cmd == "LPUSH":
                    lst = srv.lists.setdefault(args[1], [])
                    for val in args[2:]:
                        lst.insert(0, val)
                    self.wfile.write(f":{len(lst)}\r\n".encode())
                elif cmd == "LTRIM":
                    self.wfile.write(b"+OK\r\n")
                elif cmd == "LPOP":
                    lst = srv.lists.get(args[1], [])
                    if not lst:
                        self.wfile.write(b"$-1\r\n")
                    else:
                        raw = lst.pop(0).encode("utf-8")
                        self.wfile.write(f"${len(raw)}\r\n".encode() + raw + b"\r\n")
                else:
                    self.wfile.write(b"+OK\r\n")


class _FakeRedisServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), _FakeRedisHandler)
        self.lock = threading.Lock()
        self.store: dict[str, int] = {}
        self.lists: dict[str, list[str]] = {}
        self.auth_calls: list[list[str]] = []
        self.selected_db: int = 0


@pytest.fixture(autouse=True)
def _clean_resilience():
    resilience.reset_resilience_state()
    yield
    resilience.reset_resilience_state()


@pytest.fixture
def fake_redis():
    srv = _FakeRedisServer()
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        yield srv
    finally:
        srv.shutdown()
        srv.server_close()


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
def test_redis_queue_utf8_acl_and_db_failover_requeue(
    client, admin_token, settings, fake_redis, monkeypatch
):
    port = fake_redis.server_address[1]
    settings.REDIS_URL = f"redis://ops:s%40cret@127.0.0.1:{port}/2"
    settings.INGEST_MODE = "redis_queue"
    settings.INGEST_RATE_LIMIT = 10

    created = client.post(
        "/api/v1/projects",
        {"name": "UTF8 & Failover Project"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin_token}",
    ).json()["data"]
    app_key = created["appKey"]

    # Enqueue 3 batches containing multi-byte UTF-8 Chinese strings
    for idx in range(3):
        res = client.post(
            "/api/v1/ingest/events",
            {
                "appKey": app_key,
                "events": [
                    {
                        "type": "track",
                        "name": f"无人机航线批次_{idx}",
                        "url": "https://aeroapex.test/flight",
                    }
                ],
            },
            content_type="application/json",
        )
        assert res.status_code == 200

    assert fake_redis.auth_calls[0] == ["ops", "s@cret"]
    assert fake_redis.selected_db == 2
    assert Event.objects.filter(project_id=created["id"]).count() == 0

    # Simulate DB primary outage on the 2nd batch: batch 0 commits, batches 1 & 2 must be requeued!
    real_persist = run_ingest_worker.persist_events_batch
    calls = 0

    def flaky_persist(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("Simulated PostgreSQL primary failover")
        return real_persist(*args, **kwargs)

    monkeypatch.setattr(run_ingest_worker, "persist_events_batch", flaky_persist)
    with pytest.raises(RuntimeError, match="Simulated PostgreSQL primary failover"):
        drain_once(batch_size=10)

    assert Event.objects.filter(project_id=created["id"]).count() == 1
    queued = fake_redis.lists[resilience.EVENTS_QUEUE_KEY]
    assert len(queued) == 2
    assert '"无人机航线批次_1"' in queued[0]
    assert '"无人机航线批次_2"' in queued[1]

    # DB recovers: draining again must persist remaining 2 batches with zero loss/duplication
    monkeypatch.setattr(run_ingest_worker, "persist_events_batch", real_persist)
    ev_cnt, _ = drain_once(batch_size=10)
    assert ev_cnt == 2
    names = sorted(Event.objects.filter(project_id=created["id"]).values_list("name", flat=True))
    assert names == ["无人机航线批次_0", "无人机航线批次_1", "无人机航线批次_2"]


@pytest.mark.django_db
def test_circuit_breaker_degradation_and_recovery(client, admin_token, settings, fake_redis):
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

    # 2. Cooldown expires & Redis recovers -> resumes async queueing automatically
    resilience.reset_resilience_state()
    settings.REDIS_URL = f"redis://127.0.0.1:{fake_redis.server_address[1]}/0"
    res2 = client.post(
        "/api/v1/ingest/events",
        {"appKey": app_key, "events": [{"type": "pageview", "url": "https://drone.test/ok"}]},
        content_type="application/json",
    )
    assert res2.status_code == 200
    assert resilience.is_circuit_open() is False
    assert len(fake_redis.lists[resilience.EVENTS_QUEUE_KEY]) == 1

    status_ok = client.get(
        "/api/v1/system/status", HTTP_AUTHORIZATION=f"Bearer {admin_token}"
    ).json()["data"]
    assert status_ok["effectiveMode"] == "redis_queue"
    assert status_ok["redis"]["ok"] is True
    assert status_ok["redis"]["eventsQueueDepth"] == 1
    assert status_ok["database"]["ok"] is True
