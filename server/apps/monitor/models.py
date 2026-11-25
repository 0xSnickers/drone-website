import uuid

from django.db import models


class EventType(models.TextChoices):
    PAGEVIEW = "pageview"
    TRACK = "track"
    PERFORMANCE = "performance"


class ErrorType(models.TextChoices):
    JS = "js"
    PROMISE = "promise"
    RESOURCE = "resource"
    API = "api"
    CUSTOM = "custom"


class IssueStatus(models.TextChoices):
    OPEN = "open"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class LogLevel(models.TextChoices):
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


class Project(models.Model):
    """Monitored project (frontend app or backend service); app_key is public ingest token."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    app_key = models.CharField(max_length=64, unique=True)
    description = models.CharField(max_length=200, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class Event(models.Model):
    """Frontend behavioral / performance event: pageview, track, performance."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="events")
    type = models.CharField(max_length=20, choices=EventType.choices)
    name = models.CharField(max_length=100)
    url = models.CharField(max_length=2048)
    path = models.CharField(max_length=512)
    referrer = models.CharField(max_length=2048, default="", blank=True)
    visitor_id = models.CharField(max_length=64)
    session_id = models.CharField(max_length=64)
    user_id = models.CharField(max_length=64, null=True, blank=True)
    ip = models.CharField(max_length=64)
    browser = models.CharField(max_length=30)
    os = models.CharField(max_length=30)
    device = models.CharField(max_length=20)
    release = models.CharField(max_length=64, null=True, blank=True)
    properties = models.JSONField(default=dict)
    occurred_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "type", "created_at"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["ip"]),
        ]


class ErrorIssue(models.Model):
    """Fingerprint-aggregated frontend error issue."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="error_issues")
    fingerprint = models.CharField(max_length=64)
    type = models.CharField(max_length=20, choices=ErrorType.choices)
    message = models.CharField(max_length=1000)
    source = models.CharField(max_length=512, default="", blank=True)
    status = models.CharField(max_length=20, choices=IssueStatus.choices, default=IssueStatus.OPEN)
    count = models.IntegerField(default=0)
    first_seen = models.DateTimeField()
    last_seen = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "error_issues"
        ordering = ["-last_seen"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "fingerprint"], name="uniq_project_error_fingerprint"
            )
        ]
        indexes = [models.Index(fields=["project", "last_seen"])]


class ErrorEvent(models.Model):
    """Individual occurrence of an ErrorIssue."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="error_events")
    issue = models.ForeignKey(ErrorIssue, on_delete=models.CASCADE, related_name="events")
    message = models.CharField(max_length=1000)
    stack = models.TextField(default="", blank=True)
    url = models.CharField(max_length=2048)
    path = models.CharField(max_length=512)
    visitor_id = models.CharField(max_length=64)
    session_id = models.CharField(max_length=64)
    user_id = models.CharField(max_length=64, null=True, blank=True)
    ip = models.CharField(max_length=64)
    browser = models.CharField(max_length=30)
    os = models.CharField(max_length=30)
    device = models.CharField(max_length=20)
    release = models.CharField(max_length=64, null=True, blank=True)
    breadcrumbs = models.JSONField(default=list)
    extra = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "error_events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["issue", "created_at"]),
            models.Index(fields=["project", "created_at"]),
            models.Index(fields=["ip"]),
        ]


class ServerLog(models.Model):
    """Backend request/application log (project is null for self-logs)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="server_logs", null=True, blank=True
    )
    service = models.CharField(max_length=50)
    level = models.CharField(max_length=10, choices=LogLevel.choices, default=LogLevel.INFO)
    message = models.CharField(max_length=2000)
    request_id = models.CharField(max_length=64, null=True, blank=True)
    method = models.CharField(max_length=10, null=True, blank=True)
    path = models.CharField(max_length=512, null=True, blank=True)
    status = models.IntegerField(null=True, blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)
    ip = models.CharField(max_length=64, null=True, blank=True)
    user_agent = models.CharField(max_length=512, null=True, blank=True)
    meta = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "server_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["project", "created_at"]),
            models.Index(fields=["service", "created_at"]),
            models.Index(fields=["ip"]),
        ]


class IpRule(models.Model):
    """IP blacklist rule blocking ingest requests from matched IPs."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ip = models.CharField(max_length=64, unique=True)
    note = models.CharField(max_length=200, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ip_rules"
        ordering = ["-created_at"]


class IngestReceipt(models.Model):
    """Durable idempotency record for queued batches; committed with their rows."""

    id = models.UUIDField(primary_key=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ingest_receipts"


class ReleaseRecord(models.Model):
    """Release / deployment record displayed in the admin Releases & Stress center."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=64, db_index=True)
    environment = models.CharField(max_length=32, default="production")
    commit_sha = models.CharField(max_length=64, default="", blank=True)
    branch = models.CharField(max_length=64, default="main", blank=True)
    status = models.CharField(max_length=24, default="success")
    triggered_by = models.CharField(max_length=64, default="", blank=True)
    notes = models.TextField(default="", blank=True)
    ci_summary = models.JSONField(default=dict, blank=True)
    deployed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "release_records"
        ordering = ["-deployed_at"]


class StressRunRecord(models.Model):
    """Structured summary of each stress-test run for visual inspection in admin."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_id = models.CharField(max_length=80, unique=True)
    release_version = models.CharField(max_length=64, default="", blank=True)
    profile = models.CharField(max_length=40, default="l1-baseline")
    profile_label = models.CharField(max_length=80, default="")
    suite = models.CharField(max_length=32, default="all")
    passed = models.BooleanField(default=False)
    duration_sec = models.FloatField(default=0.0)
    total_requests = models.IntegerField(default=0)
    overall_rps = models.FloatField(default=0.0)
    error_rate = models.FloatField(default=0.0)
    passed_scenarios = models.IntegerField(default=0)
    total_scenarios = models.IntegerField(default=0)
    http_scenarios = models.JSONField(default=list, blank=True)
    browser_scenarios = models.JSONField(default=list, blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    environment = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stress_run_records"
        ordering = ["-started_at"]
