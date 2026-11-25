"""Runtime health, live traffic sliding window, resilience mode, and bottleneck inspection."""

import math
import threading
import time
from collections import deque
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.db import connection

from ..models import Event
from .bottleneck import evaluate_bottleneck, read_stress_test_state, sample_host_resources
from .queue import stream_key
from .resilience import (
    EVENTS_QUEUE_KEY,
    LOGS_QUEUE_KEY,
    execute_redis_commands,
    get_circuit_remaining_sec,
    get_local_tracked_ips,
    is_circuit_open,
)

_WINDOW_LOCK = threading.Lock()
_SAMPLES: deque[tuple[float, float, int, bool]] = deque(maxlen=25_000)
_WINDOW_60S = 60.0
_WINDOW_10S = 10.0


def record_request_sample(
    duration_ms: float,
    status_code: int,
    is_stress: bool = False,
) -> None:
    now = time.monotonic()
    with _WINDOW_LOCK:
        _SAMPLES.append((now, round(duration_ms, 2), int(status_code), bool(is_stress)))
        cutoff = now - _WINDOW_60S
        while _SAMPLES and _SAMPLES[0][0] < cutoff:
            _SAMPLES.popleft()


def reset_traffic_window() -> None:
    with _WINDOW_LOCK:
        _SAMPLES.clear()


def _percentile(sorted_vals: list[float], p: int) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return round(sorted_vals[0], 2)
    rank = (p / 100.0) * (sorted_vals.__len__() - 1)
    low = math.floor(rank)
    high = math.ceil(rank)
    weight = rank - low
    return round(sorted_vals[low] + (sorted_vals[high] - sorted_vals[low]) * weight, 2)


def get_realtime_traffic_snapshot() -> dict:
    now = time.monotonic()
    cutoff_60 = now - _WINDOW_60S
    cutoff_10 = now - _WINDOW_10S

    with _WINDOW_LOCK:
        while _SAMPLES and _SAMPLES[0][0] < cutoff_60:
            _SAMPLES.popleft()
        snapshot = list(_SAMPLES)

    if not snapshot:
        return {
            "currentRps": 0.0,
            "requests1m": 0,
            "p95LatencyMs": 0.0,
            "error5xx1m": 0,
            "rateLimited4291m": 0,
            "stressTrafficActive": False,
        }

    recent_10s = [s for s in snapshot if s[0] >= cutoff_10]
    current_rps = round(len(recent_10s) / _WINDOW_10S, 2)
    stress_active = any(s[3] for s in recent_10s)
    latencies = sorted(s[1] for s in (recent_10s if len(recent_10s) >= 5 else snapshot))

    return {
        "currentRps": current_rps,
        "requests1m": len(snapshot),
        "p95LatencyMs": _percentile(latencies, 95),
        "error5xx1m": sum(1 for s in snapshot if s[2] >= 500),
        "rateLimited4291m": sum(1 for s in snapshot if s[2] == 429),
        "stressTrafficActive": stress_active,
    }


def get_system_status() -> dict:
    db_engine_raw = str(settings.DATABASES["default"].get("ENGINE", ""))
    db_engine = "postgresql" if "postgresql" in db_engine_raw else "sqlite"
    db_ok = True
    t0 = time.monotonic()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        db_ok = False
    db_latency_ms = round((time.monotonic() - t0) * 1000.0, 2)

    ingest_mode = getattr(settings, "INGEST_MODE", "direct")
    redis_configured = bool(getattr(settings, "REDIS_URL", "").strip())
    circuit_open = is_circuit_open()
    circuit_rem = get_circuit_remaining_sec()

    redis_ok = False
    events_depth = 0
    logs_depth = 0
    if redis_configured and not circuit_open:
        try:
            pong, ev_legacy, ev_stream, log_legacy, log_stream = execute_redis_commands(
                [
                    ["PING"],
                    ["LLEN", EVENTS_QUEUE_KEY],
                    ["XLEN", stream_key(EVENTS_QUEUE_KEY)],
                    ["LLEN", LOGS_QUEUE_KEY],
                    ["XLEN", stream_key(LOGS_QUEUE_KEY)],
                ]
            )
            redis_ok = str(pong).upper() == "PONG"
            events_depth = int(ev_legacy or 0) + int(ev_stream or 0)
            logs_depth = int(log_legacy or 0) + int(log_stream or 0)
        except Exception:
            redis_ok = False
            circuit_open = True
            circuit_rem = 30

    if ingest_mode == "redis_queue" and redis_configured:
        effective_mode = "redis_queue" if (redis_ok and not circuit_open) else "degraded_fallback"
    else:
        effective_mode = "direct"

    host = sample_host_resources()
    traffic = get_realtime_traffic_snapshot()
    stress_test = read_stress_test_state(bool(traffic["stressTrafficActive"]))
    bottleneck = evaluate_bottleneck(
        db_engine=db_engine,
        db_ok=db_ok,
        db_latency_ms=db_latency_ms,
        queue_backlog=events_depth + logs_depth,
        host=host,
        traffic=traffic,
    )

    online_window_min = 5
    online_users = 0
    active_sessions = 0
    if db_ok:
        try:
            cutoff = datetime.now(UTC) - timedelta(minutes=online_window_min)
            recent_qs = Event.objects.filter(occurred_at__gte=cutoff)
            online_users = recent_qs.exclude(visitor_id="").values("visitor_id").distinct().count()
            active_sessions = (
                recent_qs.exclude(session_id="").values("session_id").distinct().count()
            )
        except Exception:
            online_users = 0
            active_sessions = 0

    safe_rps = float(bottleneck.get("safeRpsBaseline") or 45.0)
    estimated_max_online = max(50, int(round(safe_rps * 8)))
    usage_pct = round(min(100.0, (online_users / estimated_max_online) * 100.0), 1)
    if bottleneck["level"] == "critical" or usage_pct >= 85.0:
        risk_level = "high"
    elif bottleneck["level"] == "approaching" or usage_pct >= 65.0:
        risk_level = "busy"
    else:
        risk_level = "safe"

    return {
        "service": getattr(settings, "SERVICE_NAME", "drone-website-server"),
        "ingestMode": ingest_mode,
        "effectiveMode": effective_mode,
        "database": {"engine": db_engine, "ok": db_ok, "latencyMs": db_latency_ms},
        "redis": {
            "configured": redis_configured,
            "ok": redis_ok,
            "circuitOpen": circuit_open,
            "circuitRemainingSec": circuit_rem,
            "eventsQueueDepth": events_depth,
            "logsQueueDepth": logs_depth,
        },
        "protection": {
            "ingestRateLimit": getattr(settings, "INGEST_RATE_LIMIT", 600),
            "localTrackedIps": get_local_tracked_ips(),
            "fallbackSampleRate": float(getattr(settings, "INGEST_FALLBACK_SAMPLE_RATE", 0.2)),
            "selfLogEnabled": bool(getattr(settings, "SELF_LOG_ENABLED", False)),
            "trustProxy": bool(getattr(settings, "TRUST_PROXY", False)),
        },
        "host": host,
        "traffic": traffic,
        "bottleneck": bottleneck,
        "stressTest": stress_test,
        "onlineCapacity": {
            "onlineUsers": online_users,
            "activeSessions": active_sessions,
            "estimatedMaxOnline": estimated_max_online,
            "usagePercent": usage_pct,
            "riskLevel": risk_level,
            "windowMinutes": online_window_min,
        },
    }
