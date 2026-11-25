"""Runtime health, resilience mode, circuit-breaker, and queue depth inspection."""

import time

from django.conf import settings
from django.db import connection

from .resilience import (
    EVENTS_QUEUE_KEY,
    LOGS_QUEUE_KEY,
    execute_redis_commands,
    get_circuit_remaining_sec,
    get_local_tracked_ips,
    is_circuit_open,
)


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
            pong, ev_len, log_len = execute_redis_commands(
                [
                    ["PING"],
                    ["LLEN", EVENTS_QUEUE_KEY],
                    ["LLEN", LOGS_QUEUE_KEY],
                ]
            )
            redis_ok = str(pong).upper() == "PONG"
            events_depth = int(ev_len or 0)
            logs_depth = int(log_len or 0)
        except Exception:
            redis_ok = False
            circuit_open = True
            circuit_rem = 30

    if ingest_mode == "redis_queue" and redis_configured:
        effective_mode = "redis_queue" if (redis_ok and not circuit_open) else "degraded_fallback"
    else:
        effective_mode = "direct"

    return {
        "service": getattr(settings, "SERVICE_NAME", "drone-website-server"),
        "ingestMode": ingest_mode,
        "effectiveMode": effective_mode,
        "database": {
            "engine": db_engine,
            "ok": db_ok,
            "latencyMs": db_latency_ms,
        },
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
    }
