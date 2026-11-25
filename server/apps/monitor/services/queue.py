"""Redis 7 Streams: bounded enqueue, recoverable delivery and post-commit acknowledgement.

Jobs remain in the stream until PostgreSQL commits. Legacy lists are atomically migrated.
The JSON payload is intentionally a dict: it is the validated ingest wire representation.
"""

import json
import logging
from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid4, uuid5

from django.conf import settings

from apps.core.exceptions import AppError

from .resilience import _trip_circuit, execute_redis_commands, is_circuit_open

logger = logging.getLogger(__name__)
GROUP = "persist"
ENQUEUE = """-- bounded enqueue (do not evict accepted jobs)
if redis.call('XLEN', KEYS[1]) >= tonumber(ARGV[1]) then return false end
return redis.call('XADD', KEYS[1], '*', 'payload', ARGV[2])
"""
MIGRATE = """-- migrate legacy list atomically, retaining every queued payload
for i=1,tonumber(ARGV[1]) do
  local payload = redis.call('LINDEX', KEYS[1], 0)
  if not payload then break end
  redis.call('XADD', KEYS[2], '*', 'payload', payload)
  redis.call('LPOP', KEYS[1])
end
return 1
"""
ACK = """-- acknowledge and remove atomically after database commit
redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
return redis.call('XDEL', KEYS[1], ARGV[2])
"""


def stream_key(queue_key: str) -> str:
    return f"{queue_key}:v2"


def enqueue_ingest_job(queue_key: str, job: dict) -> bool:
    if settings.INGEST_MODE != "redis_queue" or not settings.REDIS_URL or is_circuit_open():
        return False
    try:
        result = execute_redis_commands(
            [
                [
                    "EVAL",
                    ENQUEUE,
                    "1",
                    stream_key(queue_key),
                    str(settings.INGEST_QUEUE_MAXLEN),
                    json.dumps(job, ensure_ascii=False),
                ]
            ]
        )[0]
    except Exception as exc:
        _trip_circuit(exc)
        return False
    if not result:
        raise AppError("RATE_LIMITED", "Ingest queue is full; retry later", 429)
    return True


@dataclass(frozen=True)
class Delivery:
    id: str
    payload: dict


class IngestQueue:
    def __init__(self, consumer: str | None = None):
        self.consumer = consumer or str(uuid4())
        self.cursors: dict[str, str] = {}

    def claim(self, queue_key: str, batch_size: int) -> list[Delivery]:
        key = stream_key(queue_key)
        execute_redis_commands([["EVAL", MIGRATE, "2", queue_key, key, str(batch_size)]])
        try:
            execute_redis_commands([["XGROUP", "CREATE", key, GROUP, "0", "MKSTREAM"]])
        except OSError as exc:
            if "BUSYGROUP" not in str(exc):
                raise
        cursor, reclaimed, *_ = execute_redis_commands(
            [
                [
                    "XAUTOCLAIM",
                    key,
                    GROUP,
                    self.consumer,
                    str(settings.INGEST_VISIBILITY_TIMEOUT_MS),
                    self.cursors.get(key, "0-0"),
                    "COUNT",
                    str(batch_size),
                ]
            ],
            timeout_sec=2.0,
        )[0]
        self.cursors[key] = cursor
        entries = reclaimed or []
        if len(entries) < batch_size:
            response = execute_redis_commands(
                [
                    [
                        "XREADGROUP",
                        "GROUP",
                        GROUP,
                        self.consumer,
                        "COUNT",
                        str(batch_size - len(entries)),
                        "STREAMS",
                        key,
                        ">",
                    ]
                ],
                timeout_sec=2.0,
            )[0]
            if response:
                entries.extend(response[0][1])
        deliveries = []
        for entry_id, fields in entries:
            try:
                payload = json.loads(dict(zip(fields[::2], fields[1::2], strict=True))["payload"])
                if not isinstance(payload, dict):
                    raise ValueError("Expected object")
                # Stable IDs also protect batches migrated from the old list queue.
                payload.setdefault("job_id", str(uuid5(NAMESPACE_URL, f"{key}:{entry_id}")))
                deliveries.append(Delivery(entry_id, payload))
            except (KeyError, ValueError, TypeError):
                # Keep malformed payloads pending for inspection instead of silently deleting them.
                logger.error("Malformed ingest job retained: stream=%s id=%s", key, entry_id)
        return deliveries

    def acknowledge(self, queue_key: str, delivery: Delivery) -> None:
        execute_redis_commands(
            [
                [
                    "EVAL",
                    ACK,
                    "1",
                    stream_key(queue_key),
                    GROUP,
                    delivery.id,
                ]
            ],
            timeout_sec=2.0,
        )
