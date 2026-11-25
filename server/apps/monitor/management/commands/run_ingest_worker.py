import logging
import signal
import time

from django.core.management.base import BaseCommand

from apps.monitor.models import Project
from apps.monitor.services.ingest import persist_job_once
from apps.monitor.services.queue import IngestQueue
from apps.monitor.services.resilience import EVENTS_QUEUE_KEY, LOGS_QUEUE_KEY

logger = logging.getLogger(__name__)
queue = IngestQueue()


def drain_once(batch_size: int = 50) -> tuple[int, int]:
    """Persist each delivery transactionally, then ACK; interrupted jobs remain recoverable."""
    counts = []
    for key in [EVENTS_QUEUE_KEY, LOGS_QUEUE_KEY]:
        processed = 0
        for delivery in queue.claim(key, batch_size):
            job = delivery.payload
            project = Project.objects.filter(pk=job.get("project_id")).first()
            if project is not None:
                processed += persist_job_once(project, job)
            queue.acknowledge(key, delivery)
        counts.append(processed)
    return counts[0], counts[1]


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
