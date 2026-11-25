import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitor", "0003_ingestreceipt"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReleaseRecord",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("version", models.CharField(db_index=True, max_length=64)),
                ("environment", models.CharField(default="production", max_length=32)),
                ("commit_sha", models.CharField(blank=True, default="", max_length=64)),
                ("branch", models.CharField(blank=True, default="main", max_length=64)),
                ("status", models.CharField(default="success", max_length=24)),
                ("triggered_by", models.CharField(blank=True, default="", max_length=64)),
                ("notes", models.TextField(blank=True, default="")),
                ("ci_summary", models.JSONField(blank=True, default=dict)),
                ("deployed_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "release_records",
                "ordering": ["-deployed_at"],
            },
        ),
        migrations.CreateModel(
            name="StressRunRecord",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("run_id", models.CharField(max_length=80, unique=True)),
                ("release_version", models.CharField(blank=True, default="", max_length=64)),
                ("profile", models.CharField(default="l1-baseline", max_length=40)),
                ("profile_label", models.CharField(default="", max_length=80)),
                ("suite", models.CharField(default="all", max_length=32)),
                ("passed", models.BooleanField(default=False)),
                ("duration_sec", models.FloatField(default=0.0)),
                ("total_requests", models.IntegerField(default=0)),
                ("overall_rps", models.FloatField(default=0.0)),
                ("error_rate", models.FloatField(default=0.0)),
                ("passed_scenarios", models.IntegerField(default=0)),
                ("total_scenarios", models.IntegerField(default=0)),
                ("http_scenarios", models.JSONField(blank=True, default=list)),
                ("browser_scenarios", models.JSONField(blank=True, default=list)),
                ("recommendations", models.JSONField(blank=True, default=list)),
                ("environment", models.JSONField(blank=True, default=dict)),
                ("started_at", models.DateTimeField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "stress_run_records",
                "ordering": ["-started_at"],
            },
        ),
    ]
