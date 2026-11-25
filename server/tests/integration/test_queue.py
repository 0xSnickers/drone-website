"""Run with TEST_REDIS_URL pointing to a disposable Redis 7 instance (also enabled in CI)."""

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from django.db import close_old_connections, connection

from apps.monitor.management.commands import run_ingest_worker as worker
from apps.monitor.models import Event, IngestReceipt, Project
from apps.monitor.services import ingest, queue, resilience, system
from apps.monitor.services.ingest import persist_job_once

pytestmark = pytest.mark.django_db


@pytest.fixture
def redis(settings, monkeypatch):
    url = os.environ.get("TEST_REDIS_URL")
    if not url:
        pytest.skip("TEST_REDIS_URL is not configured; requires disposable Redis 7")
    settings.REDIS_URL = url
    settings.INGEST_MODE = "redis_queue"
    settings.INGEST_VISIBILITY_TIMEOUT_MS = 1
    settings.INGEST_FALLBACK_SAMPLE_RATE = 1
    settings.INGEST_RATE_LIMIT = 0
    resilience.reset_resilience_state()
    prefix = f"test:{uuid4()}"
    event_key, log_key = f"{prefix}:events", f"{prefix}:logs"
    for module in [ingest, worker, system]:
        monkeypatch.setattr(module, "EVENTS_QUEUE_KEY", event_key)
        monkeypatch.setattr(module, "LOGS_QUEUE_KEY", log_key)
    monkeypatch.setattr(worker, "queue", queue.IngestQueue())
    try:
        yield event_key
    finally:
        resilience.execute_redis_commands(
            [
                ["DEL", event_key, log_key, queue.stream_key(event_key), queue.stream_key(log_key)],
            ]
        )
        resilience.reset_resilience_state()


@pytest.fixture
def project():
    return Project.objects.create(name="Queue integration", app_key="pk_queue_integration")


def job(project):
    return {
        "job_id": str(uuid4()),
        "project_id": str(project.id),
        "client_ip": "127.0.0.1",
        "user_agent": "integration",
        "events": [{"type": "track", "name": "无人机航线"}],
    }


def depth(key):
    return resilience.execute_redis_commands([["XLEN", queue.stream_key(key)]])[0]


def test_abandoned_delivery_is_reclaimed_without_loss(redis, project):
    queue.enqueue_ingest_job(redis, job(project))
    abandoned = queue.IngestQueue("terminated-worker").claim(redis, 10)
    assert len(abandoned) == 1
    assert depth(redis) == 1  # Claiming no longer deletes the payload.
    time.sleep(0.02)
    assert worker.drain_once() == (1, 0)
    assert Event.objects.count() == 1
    assert depth(redis) == 0


def test_database_rollback_keeps_delivery_and_receipt_atomic(redis, project, monkeypatch):
    queue.enqueue_ingest_job(redis, job(project))
    real_persist = ingest.persist_events_batch

    def fail_after_write(*args):
        real_persist(*args)
        raise RuntimeError("database failure before commit")

    monkeypatch.setattr(ingest, "persist_events_batch", fail_after_write)
    with pytest.raises(RuntimeError):
        worker.drain_once()
    assert Event.objects.count() == IngestReceipt.objects.count() == 0
    assert depth(redis) == 1
    monkeypatch.setattr(ingest, "persist_events_batch", real_persist)
    time.sleep(0.02)
    assert worker.drain_once() == (1, 0)


def test_lost_ack_does_not_duplicate_committed_rows(redis, project, monkeypatch):
    queue.enqueue_ingest_job(redis, job(project))
    real_ack = worker.queue.acknowledge
    monkeypatch.setattr(
        worker.queue, "acknowledge", lambda *_: (_ for _ in ()).throw(OSError("lost ACK"))
    )
    with pytest.raises(OSError):
        worker.drain_once()
    assert Event.objects.count() == IngestReceipt.objects.count() == 1
    monkeypatch.setattr(worker.queue, "acknowledge", real_ack)
    time.sleep(0.02)
    assert worker.drain_once() == (0, 0)
    assert Event.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_postgres_delivery_commits_only_one_batch(redis, project):
    if connection.vendor != "postgresql":
        pytest.skip("Concurrent unique-conflict recovery requires PostgreSQL")
    payload = job(project)

    def persist(_):
        close_old_connections()
        try:
            return persist_job_once(Project.objects.get(pk=project.id), payload)
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        counts = list(pool.map(persist, range(2)))
    assert sum(counts) == 1
    assert Event.objects.count() == IngestReceipt.objects.count() == 1
    assert depth(redis) == 0


def test_overflow_rejects_new_batches_without_trimming_accepted_jobs(redis, project, settings):
    settings.INGEST_QUEUE_MAXLEN = 1
    first = job(project)
    queue.enqueue_ingest_job(redis, first)
    with pytest.raises(Exception) as caught:
        queue.enqueue_ingest_job(redis, job(project))
    assert caught.value.code == "RATE_LIMITED"
    assert depth(redis) == 1
    delivery = worker.queue.claim(redis, 10)[0]
    assert delivery.payload["job_id"] == first["job_id"]


def test_legacy_lists_are_migrated_and_redelivery_is_idempotent(redis, project):
    payload = job(project)
    payload.pop("job_id")
    resilience.execute_redis_commands([["RPUSH", redis, json.dumps(payload)]])
    queue.enqueue_ingest_job(redis, job(project))
    assert system.get_system_status()["redis"]["eventsQueueDepth"] == 2
    abandoned = queue.IngestQueue().claim(redis, 10)
    assert len(abandoned) == 2
    assert persist_job_once(project, abandoned[0].payload) == 1
    time.sleep(0.02)
    assert worker.drain_once() == (1, 0)
    assert Event.objects.count() == 2
    assert resilience.execute_redis_commands([["LLEN", redis]]) == [0]
    assert depth(redis) == 0
    assert system.get_system_status()["redis"]["eventsQueueDepth"] == 0


def test_ambiguous_enqueue_fallback_and_worker_share_the_same_receipt(redis, project, monkeypatch):
    real_execute = queue.execute_redis_commands

    def lose_response(commands, **kwargs):
        result = real_execute(commands, **kwargs)
        if commands[0][:2] == ["EVAL", queue.ENQUEUE]:
            raise OSError("response lost after Redis accepted batch")
        return result

    monkeypatch.setattr(queue, "execute_redis_commands", lose_response)
    assert (
        ingest.ingest_events(project.app_key, {"events": job(project)["events"]}, "127.0.0.1", "")
        == 1
    )
    assert Event.objects.count() == 1
    monkeypatch.setattr(queue, "execute_redis_commands", real_execute)
    assert worker.drain_once() == (0, 0)
    assert Event.objects.count() == 1
