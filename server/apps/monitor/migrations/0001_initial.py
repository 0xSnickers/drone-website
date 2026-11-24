import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="IpRule",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("ip", models.CharField(max_length=64, unique=True)),
                ("note", models.CharField(blank=True, default="", max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": "ip_rules", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Project",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("name", models.CharField(max_length=50)),
                ("app_key", models.CharField(max_length=64, unique=True)),
                ("description", models.CharField(blank=True, default="", max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "projects", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ErrorIssue",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("fingerprint", models.CharField(max_length=64)),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("js", "Js"),
                            ("promise", "Promise"),
                            ("resource", "Resource"),
                            ("api", "Api"),
                            ("custom", "Custom"),
                        ],
                        max_length=20,
                    ),
                ),
                ("message", models.CharField(max_length=1000)),
                ("source", models.CharField(blank=True, default="", max_length=512)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("resolved", "Resolved"),
                            ("ignored", "Ignored"),
                        ],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("count", models.IntegerField(default=0)),
                ("first_seen", models.DateTimeField()),
                ("last_seen", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="error_issues",
                        to="monitor.project",
                    ),
                ),
            ],
            options={"db_table": "error_issues", "ordering": ["-last_seen"]},
        ),
        migrations.CreateModel(
            name="ErrorEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("message", models.CharField(max_length=1000)),
                ("stack", models.TextField(blank=True, default="")),
                ("url", models.CharField(max_length=2048)),
                ("path", models.CharField(max_length=512)),
                ("visitor_id", models.CharField(max_length=64)),
                ("session_id", models.CharField(max_length=64)),
                ("user_id", models.CharField(blank=True, max_length=64, null=True)),
                ("ip", models.CharField(max_length=64)),
                ("browser", models.CharField(max_length=30)),
                ("os", models.CharField(max_length=30)),
                ("device", models.CharField(max_length=20)),
                ("release", models.CharField(blank=True, max_length=64, null=True)),
                ("breadcrumbs", models.JSONField(default=list)),
                ("extra", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "issue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="monitor.errorissue",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="error_events",
                        to="monitor.project",
                    ),
                ),
            ],
            options={"db_table": "error_events", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Event",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("pageview", "Pageview"),
                            ("track", "Track"),
                            ("performance", "Performance"),
                        ],
                        max_length=20,
                    ),
                ),
                ("name", models.CharField(max_length=100)),
                ("url", models.CharField(max_length=2048)),
                ("path", models.CharField(max_length=512)),
                ("referrer", models.CharField(blank=True, default="", max_length=2048)),
                ("visitor_id", models.CharField(max_length=64)),
                ("session_id", models.CharField(max_length=64)),
                ("user_id", models.CharField(blank=True, max_length=64, null=True)),
                ("ip", models.CharField(max_length=64)),
                ("browser", models.CharField(max_length=30)),
                ("os", models.CharField(max_length=30)),
                ("device", models.CharField(max_length=20)),
                ("release", models.CharField(blank=True, max_length=64, null=True)),
                ("properties", models.JSONField(default=dict)),
                ("occurred_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="monitor.project",
                    ),
                ),
            ],
            options={"db_table": "events", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ServerLog",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("service", models.CharField(max_length=50)),
                (
                    "level",
                    models.CharField(
                        choices=[
                            ("debug", "Debug"),
                            ("info", "Info"),
                            ("warn", "Warn"),
                            ("error", "Error"),
                        ],
                        default="info",
                        max_length=10,
                    ),
                ),
                ("message", models.CharField(max_length=2000)),
                ("request_id", models.CharField(blank=True, max_length=64, null=True)),
                ("method", models.CharField(blank=True, max_length=10, null=True)),
                ("path", models.CharField(blank=True, max_length=512, null=True)),
                ("status", models.IntegerField(blank=True, null=True)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
                ("ip", models.CharField(blank=True, max_length=64, null=True)),
                ("user_agent", models.CharField(blank=True, max_length=512, null=True)),
                ("meta", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "project",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="server_logs",
                        to="monitor.project",
                    ),
                ),
            ],
            options={"db_table": "server_logs", "ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="errorissue",
            constraint=models.UniqueConstraint(
                fields=("project", "fingerprint"), name="uniq_project_error_fingerprint"
            ),
        ),
        migrations.AddIndex(
            model_name="errorissue",
            index=models.Index(fields=["project", "last_seen"], name="error_issue_proj_last_idx"),
        ),
        migrations.AddIndex(
            model_name="errorevent",
            index=models.Index(fields=["issue", "created_at"], name="error_event_issue_at_idx"),
        ),
        migrations.AddIndex(
            model_name="errorevent",
            index=models.Index(fields=["project", "created_at"], name="error_event_proj_at_idx"),
        ),
        migrations.AddIndex(
            model_name="errorevent",
            index=models.Index(fields=["ip"], name="error_event_ip_idx"),
        ),
        migrations.AddIndex(
            model_name="event",
            index=models.Index(
                fields=["project", "type", "created_at"], name="event_proj_type_at_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="event",
            index=models.Index(fields=["created_at"], name="event_created_at_idx"),
        ),
        migrations.AddIndex(
            model_name="event",
            index=models.Index(fields=["ip"], name="event_ip_idx"),
        ),
        migrations.AddIndex(
            model_name="serverlog",
            index=models.Index(fields=["created_at"], name="server_log_at_idx"),
        ),
        migrations.AddIndex(
            model_name="serverlog",
            index=models.Index(fields=["project", "created_at"], name="server_log_proj_at_idx"),
        ),
        migrations.AddIndex(
            model_name="serverlog",
            index=models.Index(fields=["service", "created_at"], name="server_log_svc_at_idx"),
        ),
        migrations.AddIndex(
            model_name="serverlog",
            index=models.Index(fields=["ip"], name="server_log_ip_idx"),
        ),
    ]
