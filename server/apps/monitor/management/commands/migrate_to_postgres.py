"""Stream-copy all application data from SQLite to PostgreSQL with verification."""

from pathlib import Path

import dj_database_url
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections

from apps.auth.models import RefreshToken
from apps.monitor.models import (
    ErrorEvent,
    ErrorIssue,
    Event,
    IngestReceipt,
    IpRule,
    Project,
    ReleaseRecord,
    ServerLog,
    StressRunRecord,
)
from apps.users.models import User

CORE_MODELS = (
    User,
    RefreshToken,
    Project,
    IpRule,
    ReleaseRecord,
    StressRunRecord,
)

TELEMETRY_MODELS = (
    ErrorIssue,
    ErrorEvent,
    Event,
    ServerLog,
    IngestReceipt,
)


def _clone_instance(model, obj):
    return model(**{f.attname: getattr(obj, f.attname) for f in model._meta.concrete_fields})


def _register_db_alias(alias: str, url: str) -> dict:
    cfg = dj_database_url.parse(url, conn_max_age=0)
    cfg.setdefault("ATOMIC_REQUESTS", False)
    cfg.setdefault("AUTOCOMMIT", True)
    cfg.setdefault("TIME_ZONE", settings.TIME_ZONE)
    cfg.setdefault("CONN_HEALTH_CHECKS", False)
    cfg.setdefault("OPTIONS", {})
    settings.DATABASES[alias] = cfg
    connections.databases[alias] = cfg
    return cfg


def _cleanup_alias(alias: str) -> None:
    try:
        connections[alias].close()
    except Exception:
        pass
    connections.databases.pop(alias, None)
    settings.DATABASES.pop(alias, None)


class Command(BaseCommand):
    help = "Migrate schema and data from SQLite to PostgreSQL with row-count verification."

    def add_arguments(self, parser):
        default_sqlite = f"sqlite:///{Path(settings.BASE_DIR) / 'db.sqlite3'}"
        parser.add_argument(
            "--source",
            default=default_sqlite,
            help="Source database URL (default: local server/db.sqlite3)",
        )
        parser.add_argument(
            "--target",
            required=True,
            help="Target PostgreSQL URL (e.g. postgresql://app:password@localhost:5432/drone_website_server)",
        )
        parser.add_argument(
            "--batch-size", type=int, default=1000, help="Batch size for bulk_create"
        )
        parser.add_argument(
            "--skip-telemetry",
            action="store_true",
            help="Migrate core tables only; skip high-volume events/logs/error_events",
        )
        parser.add_argument(
            "--skip-migrate",
            action="store_true",
            help="Skip running Django migrations on the target database",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Inspect source & target row counts without writing any data",
        )
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Clear existing rows in target tables before copying",
        )
        parser.add_argument(
            "--upsert",
            action="store_true",
            help="Allow non-empty target DB and skip conflicting primary keys (idempotent resume)",
        )
        parser.add_argument(
            "--allow-any-target",
            action="store_true",
            help="Allow non-PostgreSQL target URL (primarily for automated tests)",
        )

    def handle(self, *args, **options):
        src_url: str = options["source"].strip()
        dst_url: str = options["target"].strip()
        batch_size: int = max(50, int(options["batch_size"]))
        skip_telemetry: bool = bool(options["skip_telemetry"])
        skip_migrate: bool = bool(options["skip_migrate"])
        dry_run: bool = bool(options["dry_run"])
        truncate: bool = bool(options["truncate"])
        upsert: bool = bool(options["upsert"])
        allow_any: bool = bool(options["allow_any_target"])

        if src_url == dst_url:
            raise CommandError("Source and target database URLs must be different.")

        src_alias = "_pg_mig_src"
        dst_alias = "_pg_mig_dst"
        try:
            _register_db_alias(src_alias, src_url)
            dst_cfg = _register_db_alias(dst_alias, dst_url)

            if not allow_any and "postgresql" not in str(dst_cfg.get("ENGINE", "")):
                raise CommandError(
                    "Target must be a PostgreSQL URL (or pass --allow-any-target for testing)."
                )

            # Verify connectivity on both databases
            for label, alias in (("source", src_alias), ("target", dst_alias)):
                try:
                    with connections[alias].cursor() as cursor:
                        cursor.execute("SELECT 1")
                except Exception as exc:
                    raise CommandError(f"Cannot connect to {label} database: {exc}") from exc

            if not skip_migrate and not dry_run:
                self.stdout.write("Applying Django migrations on target database...")
                call_command("migrate", database=dst_alias, interactive=False, verbosity=1)

            models = CORE_MODELS if skip_telemetry else (*CORE_MODELS, *TELEMETRY_MODELS)

            # Pre-flight counts & safety check
            source_counts: dict[str, int] = {}
            target_counts: dict[str, int] = {}
            for model in models:
                table = model._meta.db_table
                source_counts[table] = model.objects.using(src_alias).count()
                try:
                    target_counts[table] = model.objects.using(dst_alias).count()
                except Exception:
                    target_counts[table] = 0

            self.stdout.write("\nTable migration plan:")
            for model in models:
                table = model._meta.db_table
                src_n = source_counts[table]
                dst_n = target_counts[table]
                self.stdout.write(f"  - {table:<20} source={src_n:>8}  target={dst_n:>8}")

            if dry_run:
                self.stdout.write(self.style.SUCCESS("\nDry-run completed. No data was modified."))
                return

            non_empty = [t for t, c in target_counts.items() if c > 0]
            if non_empty and not (truncate or upsert):
                raise CommandError(
                    f"Target tables are not empty ({', '.join(non_empty)}). "
                    "Pass --upsert to merge/resume safely or --truncate to overwrite."
                )

            if truncate:
                self.stdout.write("Truncating target tables in reverse FK order...")
                for model in reversed(models):
                    model.objects.using(dst_alias).all().delete()

            # Stream copy in strict FK order
            for model in models:
                table = model._meta.db_table
                total = source_counts[table]
                if total == 0:
                    continue
                copied = 0
                batch: list = []
                qs = model.objects.using(src_alias).all().iterator(chunk_size=batch_size)
                for obj in qs:
                    batch.append(_clone_instance(model, obj))
                    if len(batch) >= batch_size:
                        model.objects.using(dst_alias).bulk_create(
                            batch, batch_size=batch_size, ignore_conflicts=upsert
                        )
                        copied += len(batch)
                        batch.clear()
                if batch:
                    model.objects.using(dst_alias).bulk_create(
                        batch, batch_size=batch_size, ignore_conflicts=upsert
                    )
                    copied += len(batch)
                self.stdout.write(f"  ✓ {table:<20} copied {copied} rows")

            # Verify post-migration counts
            mismatches: list[str] = []
            self.stdout.write("\nVerification:")
            for model in models:
                table = model._meta.db_table
                src_n = source_counts[table]
                dst_n = model.objects.using(dst_alias).count()
                ok_row = dst_n >= src_n if upsert else dst_n == src_n
                mark = "✓" if ok_row else "✗"
                self.stdout.write(f"  {mark} {table:<20} source={src_n:>8}  target={dst_n:>8}")
                if not ok_row:
                    mismatches.append(f"{table} (src={src_n}, dst={dst_n})")

            if mismatches:
                raise CommandError(f"Row count mismatch after migration: {', '.join(mismatches)}")

            self.stdout.write(
                self.style.SUCCESS(
                    "\nPostgreSQL migration completed and verified! "
                    "Update DATABASE_URL in server/.env and restart the server."
                )
            )
        finally:
            _cleanup_alias(src_alias)
            _cleanup_alias(dst_alias)
