from datetime import UTC, datetime, timedelta

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connections

from apps.auth.models import RefreshToken
from apps.monitor.models import (
    ErrorEvent,
    ErrorIssue,
    ErrorType,
    Event,
    EventType,
    IpRule,
    LogLevel,
    Project,
    ReleaseRecord,
    ServerLog,
    StressRunRecord,
)
from apps.users.models import Role, User


def _seed_source_db(alias: str) -> None:
    user = User.objects.using(alias).create(
        email="mig-admin@example.com",
        name="Mig Admin",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    RefreshToken.objects.using(alias).create(
        user=user,
        token_hash="a" * 64,
        audience="admin",
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    project = Project.objects.using(alias).create(
        name="AeroApex Prod",
        description="Migration test project",
        app_key="pk_mig_test_001",
    )
    IpRule.objects.using(alias).create(ip="198.51.100.7", note="blocked")
    now = datetime.now(UTC)
    issue = ErrorIssue.objects.using(alias).create(
        project=project,
        fingerprint="fp_mig_1",
        type=ErrorType.JS,
        message="Boom",
        count=1,
        first_seen=now,
        last_seen=now,
    )
    ErrorEvent.objects.using(alias).create(
        project=project,
        issue=issue,
        message="Boom",
    )
    Event.objects.using(alias).create(
        project=project,
        type=EventType.PAGEVIEW,
        name="pageview",
        url="https://aeroapex.example.com/",
        path="/",
        visitor_id="vis_mig_1",
        session_id="ses_mig_1",
        properties={"env": "prod"},
        occurred_at=now,
    )
    ServerLog.objects.using(alias).create(
        project=project,
        service="drone-website-server",
        level=LogLevel.INFO,
        message="ok",
    )
    ReleaseRecord.objects.using(alias).create(
        version="v2.0.0",
        environment="production",
        branch="main",
        commit_sha="deadbeef",
        notes="PG migration test",
    )
    StressRunRecord.objects.using(alias).create(
        run_id="stress-mig-001",
        profile="l1-baseline",
        suite="all",
        passed=True,
        started_at=now,
    )


def test_migrate_to_postgres_full_and_idempotent(tmp_path, django_db_blocker):
    src_file = tmp_path / "src.sqlite3"
    dst_file = tmp_path / "dst.sqlite3"
    src_url = f"sqlite:///{src_file}"
    dst_url = f"sqlite:///{dst_file}"

    # Prepare source DB schema and sample records
    from apps.monitor.management.commands.migrate_to_postgres import (
        _cleanup_alias,
        _register_db_alias,
    )

    with django_db_blocker.unblock():
        _register_db_alias("_test_src", src_url)
        try:
            call_command("migrate", database="_test_src", interactive=False, verbosity=0)
            _seed_source_db("_test_src")
        finally:
            _cleanup_alias("_test_src")

        # Dry-run should not fail and should not create rows in target
        call_command(
            "migrate_to_postgres",
            source=src_url,
            target=dst_url,
            dry_run=True,
            allow_any_target=True,
        )

        # Full migration (schema + all 11 tables + verification)
        call_command(
            "migrate_to_postgres",
            source=src_url,
            target=dst_url,
            batch_size=2,
            allow_any_target=True,
        )

        # Re-running without --upsert or --truncate must be blocked
        with pytest.raises(CommandError, match="not empty"):
            call_command(
                "migrate_to_postgres",
                source=src_url,
                target=dst_url,
                allow_any_target=True,
            )

        # Re-running with --upsert succeeds idempotently
        call_command(
            "migrate_to_postgres",
            source=src_url,
            target=dst_url,
            upsert=True,
            allow_any_target=True,
        )

        # Verify target contents directly
        _register_db_alias("_test_verify", dst_url)
        try:
            assert User.objects.using("_test_verify").filter(email="mig-admin@example.com").exists()
            assert Project.objects.using("_test_verify").filter(app_key="pk_mig_test_001").exists()
            assert Event.objects.using("_test_verify").count() == 1
            assert ReleaseRecord.objects.using("_test_verify").filter(version="v2.0.0").exists()
            assert (
                StressRunRecord.objects.using("_test_verify")
                .filter(run_id="stress-mig-001")
                .exists()
            )
            connections["_test_verify"].close()
        finally:
            _cleanup_alias("_test_verify")


@pytest.mark.django_db
def test_prune_monitor_data_removes_only_expired_rows():
    project = Project.objects.create(name="Prune Test", app_key="pk_prune_001")
    old_ts = datetime.now(UTC) - timedelta(days=45)
    new_ts = datetime.now(UTC) - timedelta(days=2)

    Event.objects.create(
        project=project,
        type=EventType.PAGEVIEW,
        name="old",
        url="http://localhost/",
        path="/",
        occurred_at=old_ts,
    )
    Event.objects.create(
        project=project,
        type=EventType.PAGEVIEW,
        name="recent",
        url="http://localhost/",
        path="/",
        occurred_at=new_ts,
    )

    call_command("prune_monitor_data", days=30, dry_run=True)
    assert Event.objects.count() == 2

    call_command("prune_monitor_data", days=30)
    assert Event.objects.count() == 1
    assert Event.objects.first().name == "recent"
