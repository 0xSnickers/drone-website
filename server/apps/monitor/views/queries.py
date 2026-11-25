from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auth.authentication import CanReadMonitor, IsAdminForWrites
from apps.core.exceptions import AppError
from apps.core.responses import ok

from ..models import ErrorIssue
from ..serializers import ErrorIssueSerializer, IssueStatusUpdateSerializer
from ..services.queries import (
    get_events_summary,
    get_ip_detail,
    get_issue_detail,
    get_logs_stats,
    list_events,
    list_ips,
    list_issue_events,
    list_issues,
    list_log_services,
    list_logs,
)
from ..utils import parse_pagination
from .analytics import cached_monitor_query
from .query_params import query_context


class _QueryBaseView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor]

    def _ctx(self, request):
        return query_context(request.query_params)


class EventListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_events(project_id, window, request.query_params, page, limit))


class EventSummaryView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        key = (
            "events_summary",
            project_id,
            request.query_params.get("range", "24h"),
            request.query_params.get("from", ""),
            request.query_params.get("to", ""),
        )
        return ok(cached_monitor_query(key, lambda: get_events_summary(project_id, window)))


class ErrorIssueListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_issues(project_id, window, request.query_params, page, limit))


class ErrorIssueDetailView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdminForWrites]

    def get(self, request, issue_id: str):
        _, window = query_context(request.query_params)
        return ok(get_issue_detail(issue_id, window))

    def put(self, request, issue_id: str):
        issue = ErrorIssue.objects.filter(pk=issue_id).first()
        if issue is None:
            raise AppError.not_found("ISSUE_NOT_FOUND", "Issue not found")
        ser = IssueStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        issue.status = ser.validated_data["status"]
        issue.save(update_fields=["status", "updated_at"])
        return ok(ErrorIssueSerializer(issue).data)


class ErrorIssueEventsView(_QueryBaseView):
    def get(self, request, issue_id: str):
        _, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_issue_events(issue_id, window, page, limit))


class LogListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_logs(project_id, window, request.query_params, page, limit))


class LogStatsView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        service = request.query_params.get("service")
        key = (
            "logs_stats",
            project_id,
            service or "",
            request.query_params.get("range", "24h"),
            request.query_params.get("from", ""),
            request.query_params.get("to", ""),
        )
        return ok(cached_monitor_query(key, lambda: get_logs_stats(project_id, window, service)))


class LogServicesView(_QueryBaseView):
    def get(self, request):
        project_id, _ = self._ctx(request)
        return ok(list_log_services(project_id))


class IpListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        q = request.query_params.get("q")
        key = (
            "ips_list",
            project_id,
            q or "",
            page,
            limit,
            request.query_params.get("range", "24h"),
            request.query_params.get("from", ""),
            request.query_params.get("to", ""),
        )
        return ok(cached_monitor_query(key, lambda: list_ips(project_id, window, q, page, limit)))


class IpDetailView(_QueryBaseView):
    def get(self, request, ip: str):
        project_id, window = self._ctx(request)
        return ok(get_ip_detail(ip, project_id, window))
