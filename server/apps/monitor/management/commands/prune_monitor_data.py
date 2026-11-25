"""Prune aged high-volume monitor telemetry rows to keep DB migrations and queries fast."""

from datetime import UTC, datetime, timedelta

from django.core.management.base import BaseCommand

from apps.monitor.models import ErrorEvent, Event, IngestReceipt, ServerLog


class Command(BaseCommand):
    help = "Delete events, server logs, error events, and ingest receipts older than N days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Retention window in days (default: 30)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many rows would be deleted without deleting them",
        )

    def handle(self, *args, **options):
        days = max(1, int(options["days"]))
        dry_run = bool(options["dry_run"])
        cutoff = datetime.now(UTC) - timedelta(days=days)

        targets = [
            ("events", Event.objects.filter(occurred_at__lt=cutoff)),
            ("server_logs", ServerLog.objects.filter(created_at__lt=cutoff)),
            ("error_events", ErrorEvent.objects.filter(created_at__lt=cutoff)),
            ("ingest_receipts", IngestReceipt.objects.filter(created_at__lt=cutoff)),
        ]

        total = 0
        for name, qs in targets:
            count = qs.count()
            total += count
            if dry_run:
                self.stdout.write(
                    f"[dry-run] {name:<18} would delete {count} rows (< {cutoff.isoformat()})"
                )
            else:
                deleted, _ = qs.delete()
                self.stdout.write(f"pruned {name:<18} deleted {deleted} rows")

        mode = "Dry-run" if dry_run else "Done"
        self.stdout.write(
            self.style.SUCCESS(f"{mode}: {total} telemetry rows matched (retention={days}d).")
        )
