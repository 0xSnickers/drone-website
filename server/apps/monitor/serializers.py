from rest_framework import serializers

from .models import ErrorEvent, ErrorIssue, Event, IpRule, IssueStatus, Project, ServerLog


class ProjectSerializer(serializers.ModelSerializer):
    appKey = serializers.CharField(source="app_key", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "appKey", "description", "createdAt", "updatedAt"]


class ProjectInputSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=50)
    description = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
    )


class ProjectUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=50, required=False)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)


class EventSerializer(serializers.ModelSerializer):
    projectId = serializers.UUIDField(source="project_id", read_only=True)
    visitorId = serializers.CharField(source="visitor_id", read_only=True)
    sessionId = serializers.CharField(source="session_id", read_only=True)
    userId = serializers.CharField(source="user_id", allow_null=True, read_only=True)
    occurredAt = serializers.DateTimeField(source="occurred_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Event
        fields = [
            "id",
            "projectId",
            "type",
            "name",
            "url",
            "path",
            "referrer",
            "visitorId",
            "sessionId",
            "userId",
            "ip",
            "browser",
            "os",
            "device",
            "release",
            "properties",
            "occurredAt",
            "createdAt",
        ]


class ErrorIssueSerializer(serializers.ModelSerializer):
    projectId = serializers.UUIDField(source="project_id", read_only=True)
    firstSeen = serializers.DateTimeField(source="first_seen", read_only=True)
    lastSeen = serializers.DateTimeField(source="last_seen", read_only=True)

    class Meta:
        model = ErrorIssue
        fields = [
            "id",
            "projectId",
            "fingerprint",
            "type",
            "message",
            "source",
            "status",
            "count",
            "firstSeen",
            "lastSeen",
        ]


class IssueStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=IssueStatus.choices)


class ErrorEventSerializer(serializers.ModelSerializer):
    visitorId = serializers.CharField(source="visitor_id", read_only=True)
    userId = serializers.CharField(source="user_id", allow_null=True, read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ErrorEvent
        fields = [
            "id",
            "message",
            "stack",
            "url",
            "path",
            "visitorId",
            "userId",
            "ip",
            "browser",
            "os",
            "device",
            "release",
            "breadcrumbs",
            "extra",
            "createdAt",
        ]


class ServerLogSerializer(serializers.ModelSerializer):
    projectId = serializers.UUIDField(source="project_id", allow_null=True, read_only=True)
    requestId = serializers.CharField(source="request_id", allow_null=True, read_only=True)
    durationMs = serializers.IntegerField(source="duration_ms", allow_null=True, read_only=True)
    userAgent = serializers.CharField(source="user_agent", allow_null=True, read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ServerLog
        fields = [
            "id",
            "projectId",
            "service",
            "level",
            "message",
            "requestId",
            "method",
            "path",
            "status",
            "durationMs",
            "ip",
            "userAgent",
            "meta",
            "createdAt",
        ]


class IpRuleSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = IpRule
        fields = ["id", "ip", "note", "createdAt"]


class IpRuleInputSerializer(serializers.Serializer):
    ip = serializers.CharField(min_length=3, max_length=64)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
