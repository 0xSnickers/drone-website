import logging
import signal
import time

from django.core.management.base import BaseCommand

from apps.monitor.models import Project
from apps.monitor.services.ingest import persist_events_batch, persist_logs_batch
from apps.monitor.services.resilience import (
    EVENTS_QUEUE_KEY,
    LOGS_QUEUE_KEY,
    pop_ingest_jobs,
    requeue_ingest_jobs,
)

logger = logging.getLogger(__name__)


def drain_once(batch_size: int = 50) -> tuple[int, int]:
    """Drain one batch of events and logs from Redis queues into PostgreSQL.

    If PostgreSQL raises during persistence (e.g. primary DB failover), any remaining
    unpersisted jobs are pushed back to the head of the Redis queue so zero data is lost.
    """
    events_processed = 0
    logs_processed = 0
    projects_cache: dict[str, Project | None] = {}

    def get_project(pid: str) -> Project | None:
        if pid not in projects_cache:
            projects_cache[pid] = Project.objects.filter(pk=pid).first()
        return projects_cache[pid]

    event_jobs = pop_ingest_jobs(EVENTS_QUEUE_KEY, batch_size=batch_size)
    for idx, job in enumerate(event_jobs):
        try:
            project = get_project(str(job.get("project_id") or ""))
            if project is None:
                continue
            raw_events = job.get("events")
            if isinstance(raw_events, list):
                events_processed += persist_events_batch(
                    project,
                    raw_events,
                    str(job.get("client_ip") or "127.0.0.1"),
                    str(job.get("user_agent") or ""),
                )
        except Exception:
            requeue_ingest_jobs(EVENTS_QUEUE_KEY, event_jobs[idx:])
            raise

    log_jobs = pop_ingest_jobs(LOGS_QUEUE_KEY, batch_size=batch_size)
    for idx, job in enumerate(log_jobs):
        try:
            project = get_project(str(job.get("project_id") or ""))
            if project is None:
                continue
            raw_logs = job.get("logs")
            service = str(job.get("service") or "")
            if service and isinstance(raw_logs, list):
                logs_processed += persist_logs_batch(
                    project,
                    service,
                    raw_logs,
                    str(job.get("client_ip") or "127.0.0.1"),
                )
        except Exception:
            requeue_ingest_jobs(LOGS_QUEUE_KEY, log_jobs[idx:])
            raise

    return events_processed, logs_processed


class Command(BaseCommand):
    help = "Consume queued monitor ingest batches from Redis and persist to PostgreSQL."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Drain once and exit.")
        parser.add_argument("--batch-size", type=int, default=50)
        parser.add_argument("--poll-interval", type=float, default=1.0)

    def handle(self, *args, **options):
        once = options["once"]
        batch_size = options["batch_size"]
        poll_interval = options["poll_interval"]
        running = True

        def _stop(_signum, _frame):
            nonlocal running
            running = False

        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)

        self.stdout.write("Starting monitor ingest worker...")
        while running:
            try:
                ev_cnt, log_cnt = drain_once(batch_size=batch_size)
                if once:
                    break
                if ev_cnt == 0 and log_cnt == 0:
                    time.sleep(poll_interval)
            except Exception as exc:
                logger.warning("Ingest worker iteration failed: %s", exc)
                if once:
                    raise
                time.sleep(min(5.0, poll_interval * 2))
        self.stdout.write("Monitor ingest worker stopped gracefully.")
