"""Pluggable Redis / local-fallback rate limiter and ingest queue with circuit breaker.

Uses a lightweight stdlib RESP2 socket client so single-node deployments require zero extra
packages, while setting REDIS_URL enables distributed rate limiting and async queue buffering
with automatic 200ms circuit-breaker degradation back to local memory / sampled DB writes.
"""

import json
import logging
import random
import socket
import threading
import time
from collections import deque
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from django.conf import settings

logger = logging.getLogger(__name__)

_STATE_LOCK = threading.Lock()
_LOCAL_RATE_WINDOWS: dict[str, deque[float]] = {}
_MAX_LOCAL_IPS = 10_000
_CIRCUIT_OPEN_UNTIL: float = 0.0
_CIRCUIT_COOLDOWN_SEC = 30.0

EVENTS_QUEUE_KEY = "monitor:ingest:events"
LOGS_QUEUE_KEY = "monitor:ingest:logs"


@dataclass(frozen=True)
class RedisEndpoint:
    host: str
    port: int
    db: int
    username: str | None
    password: str | None


def parse_redis_url(url: str) -> RedisEndpoint | None:
    raw = (url or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in {"redis"} or not parsed.hostname:
        return None
    db_path = (parsed.path or "/0").lstrip("/")
    db = int(db_path) if db_path.isdigit() else 0
    return RedisEndpoint(
        host=parsed.hostname,
        port=parsed.port or 6379,
        db=db,
        username=unquote(parsed.username) if parsed.username else None,
        password=unquote(parsed.password) if parsed.password is not None else None,
    )


def is_circuit_open() -> bool:
    with _STATE_LOCK:
        return time.monotonic() < _CIRCUIT_OPEN_UNTIL


def get_circuit_remaining_sec() -> int:
    with _STATE_LOCK:
        rem = _CIRCUIT_OPEN_UNTIL - time.monotonic()
        return max(0, int(rem)) if rem > 0 else 0


def get_local_tracked_ips() -> int:
    with _STATE_LOCK:
        return len(_LOCAL_RATE_WINDOWS)


def reset_resilience_state() -> None:
    """Reset in-memory windows and circuit breaker (used in tests)."""
    global _CIRCUIT_OPEN_UNTIL
    with _STATE_LOCK:
        _LOCAL_RATE_WINDOWS.clear()
        _CIRCUIT_OPEN_UNTIL = 0.0


def _trip_circuit(exc: Exception) -> None:
    global _CIRCUIT_OPEN_UNTIL
    with _STATE_LOCK:
        _CIRCUIT_OPEN_UNTIL = time.monotonic() + _CIRCUIT_COOLDOWN_SEC
    logger.warning("Redis degraded (%s); opening circuit breaker for 30s", exc)


def _encode_resp(parts: list[str]) -> bytes:
    buf = [f"*{len(parts)}\r\n".encode()]
    for part in parts:
        encoded = part.encode("utf-8")
        buf.append(f"${len(encoded)}\r\n".encode())
        buf.append(encoded + b"\r\n")
    return b"".join(buf)


def _read_line(fp) -> bytes:
    line = fp.readline()
    if not line or not line.endswith(b"\r\n"):
        raise OSError("Unexpected EOF from Redis")
    return line[:-2]


def _read_resp(fp):
    line = _read_line(fp)
    prefix, payload = line[:1], line[1:]
    if prefix == b"+":
        return payload.decode("utf-8", errors="replace")
    if prefix == b"-":
        raise OSError(f"Redis error: {payload.decode('utf-8', errors='replace')}")
    if prefix == b":":
        return int(payload)
    if prefix == b"$":
        length = int(payload)
        if length < 0:
            return None
        data = fp.read(length + 2)
        if len(data) < length + 2:
            raise OSError("Incomplete bulk string from Redis")
        return data[:-2].decode("utf-8", errors="replace")
    if prefix == b"*":
        count = int(payload)
        if count < 0:
            return None
        return [_read_resp(fp) for _ in range(count)]
    raise OSError(f"Unsupported RESP prefix: {prefix!r}")


def execute_redis_commands(commands: list[list[str]], timeout_sec: float | None = None) -> list:
    endpoint = parse_redis_url(getattr(settings, "REDIS_URL", ""))
    if endpoint is None:
        raise OSError("REDIS_URL is not configured")

    timeout = (
        timeout_sec
        if timeout_sec is not None
        else max(0.05, getattr(settings, "REDIS_TIMEOUT_MS", 200) / 1000.0)
    )
    setup_cmds: list[list[str]] = []
    if endpoint.password is not None:
        if endpoint.username:
            setup_cmds.append(["AUTH", endpoint.username, endpoint.password])
        else:
            setup_cmds.append(["AUTH", endpoint.password])
    if endpoint.db:
        setup_cmds.append(["SELECT", str(endpoint.db)])

    all_cmds = setup_cmds + commands
    raw_request = b"".join(_encode_resp(cmd) for cmd in all_cmds)

    with socket.create_connection((endpoint.host, endpoint.port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(raw_request)
        with sock.makefile("rb") as fp:
            responses = [_read_resp(fp) for _ in all_cmds]
    return responses[len(setup_cmds) :]


def check_local_rate_limit(ip: str, limit: int) -> bool:
    now = time.monotonic()
    with _STATE_LOCK:
        if ip not in _LOCAL_RATE_WINDOWS and len(_LOCAL_RATE_WINDOWS) >= _MAX_LOCAL_IPS:
            oldest_ip = next(iter(_LOCAL_RATE_WINDOWS))
            _LOCAL_RATE_WINDOWS.pop(oldest_ip, None)

        window = _LOCAL_RATE_WINDOWS.setdefault(ip, deque())
        cutoff = now - 60.0
        while window and window[0] < cutoff:
            window.popleft()
        if len(window) >= limit:
            return False
        window.append(now)
        return True


def check_rate_limit_resilient(ip: str) -> bool:
    limit = getattr(settings, "INGEST_RATE_LIMIT", 600)
    if limit <= 0:
        return True

    has_redis = bool(getattr(settings, "REDIS_URL", "").strip())
    if has_redis and not is_circuit_open():
        bucket = int(time.time() // 60)
        key = f"monitor:rl:{ip}:{bucket}"
        try:
            count, _ = execute_redis_commands([["INCR", key], ["EXPIRE", key, "65"]])
            return int(count) <= limit
        except Exception as exc:
            _trip_circuit(exc)

    return check_local_rate_limit(ip, limit)


def enqueue_ingest_job(queue_key: str, job: dict) -> bool:
    """Push validated ingest batch to Redis queue when INGEST_MODE=redis_queue."""
    mode = getattr(settings, "INGEST_MODE", "direct")
    if mode != "redis_queue" or not getattr(settings, "REDIS_URL", "").strip():
        return False
    if is_circuit_open():
        return False

    max_len = getattr(settings, "INGEST_QUEUE_MAXLEN", 50_000)
    serialized = json.dumps(job, ensure_ascii=False)
    try:
        length, _ = execute_redis_commands(
            [["RPUSH", queue_key, serialized], ["LTRIM", queue_key, str(-max_len), "-1"]]
        )
        return int(length) >= 1
    except Exception as exc:
        _trip_circuit(exc)
        return False


def requeue_ingest_jobs(queue_key: str, jobs: list[dict]) -> None:
    """Push unpersisted jobs back to the head of Redis queue if DB write fails."""
    if not jobs:
        return
    cmds = [["LPUSH", queue_key, json.dumps(job, ensure_ascii=False)] for job in reversed(jobs)]
    try:
        execute_redis_commands(cmds, timeout_sec=2.0)
    except Exception as exc:
        logger.error("Failed to requeue %d jobs back to %s: %s", len(jobs), queue_key, exc)


def filter_degraded_events(raw_events: list[dict]) -> list[dict]:
    """When Redis queue degrades to direct DB writes, keep 100% errors and sample others."""
    if not is_circuit_open() or getattr(settings, "INGEST_MODE", "direct") != "redis_queue":
        return raw_events

    sample_rate = float(getattr(settings, "INGEST_FALLBACK_SAMPLE_RATE", 0.2))
    kept: list[dict] = []
    for item in raw_events:
        if item.get("type") == "error" or random.random() < sample_rate:
            kept.append(item)
    return kept


def pop_ingest_jobs(queue_key: str, batch_size: int = 50) -> list[dict]:
    """Pop up to batch_size queued jobs from Redis (used by run_ingest_worker)."""
    cmds = [["LPOP", queue_key] for _ in range(max(1, batch_size))]
    results = execute_redis_commands(cmds, timeout_sec=2.0)
    jobs: list[dict] = []
    for raw in results:
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                jobs.append(parsed)
        except json.JSONDecodeError:
            logger.warning("Dropped malformed queued payload from %s", queue_key)
    return jobs
