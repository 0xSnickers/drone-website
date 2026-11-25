import uuid

from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auth.authentication import CanReadMonitor, IsAdmin, IsAdminForWrites
from apps.core.exceptions import AppError
from apps.core.responses import ok, page_result

from ..services.ops_history import (
    create_release,
    delete_release,
    get_stress_run_detail,
    list_releases,
    list_stress_runs,
    serialize_stress_run,
    upsert_stress_report_payload,
)
from ..utils import parse_pagination


class ReleaseInputSerializer(serializers.Serializer):
    version = serializers.CharField(min_length=1, max_length=64)
    environment = serializers.ChoiceField(
        choices=["development", "staging", "production"], default="production"
    )
    commitSha = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    branch = serializers.CharField(max_length=64, required=False, allow_blank=True, default="main")
    status = serializers.ChoiceField(
        choices=["success", "failed", "running", "rolled_back"], default="success"
    )
    triggeredBy = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    ciSummary = serializers.DictField(required=False, default=dict)


class ReleaseListCreateView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdminForWrites]

    def get(self, request):
        page, limit = parse_pagination(request.query_params, default_limit=20)
        items, total = list_releases(page, limit)
        return ok(page_result(items, total, page, limit))

    def post(self, request):
        ser = ReleaseInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        triggered_by = getattr(request.user, "user_id", "admin")
        return ok(create_release(ser.validated_data, triggered_by=str(triggered_by)), status=201)


class ReleaseDetailView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdmin]

    def delete(self, request, release_id: str):
        try:
            rid = uuid.UUID(str(release_id))
        except ValueError as exc:
            raise ValidationError({"id": ["Must be a valid UUID."]}) from exc
        return ok(delete_release(rid))


class StressRunListCreateView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdminForWrites]

    def get(self, request):
        page, limit = parse_pagination(request.query_params, default_limit=20)
        items, total = list_stress_runs(page, limit)
        return ok(page_result(items, total, page, limit))

    def post(self, request):
        if not isinstance(request.data, dict) or not request.data.get("runId"):
            raise AppError.validation("runId is required")
        row = upsert_stress_report_payload(request.data)
        if row is None:
            raise AppError.validation("Invalid stress run payload")
        return ok(serialize_stress_run(row, include_detail=True), status=201)


class StressRunDetailView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor]

    def get(self, request, run_id: str):
        return ok(get_stress_run_detail(run_id))
