from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auth.authentication import IsAdminForWrites
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
from ..utils import parse_pagination, resolve_time_window


class _QueryBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def _ctx(self, request):
        params = request.query_params
        project_id = params.get("projectId") or None
        window = resolve_time_window(params.get("range"), params.get("tz"))
        return project_id, window


class EventListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_events(project_id, window, request.query_params, page, limit))


class EventSummaryView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        return ok(get_events_summary(project_id, window))


class ErrorIssueListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_issues(project_id, window, request.query_params, page, limit))


class ErrorIssueDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminForWrites]

    def get(self, request, issue_id: str):
        window = resolve_time_window(
            request.query_params.get("range"), request.query_params.get("tz")
        )
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
        return ok(get_logs_stats(project_id, window, request.query_params.get("service")))


class LogServicesView(_QueryBaseView):
    def get(self, request):
        project_id, _ = self._ctx(request)
        return ok(list_log_services(project_id))


class IpListView(_QueryBaseView):
    def get(self, request):
        project_id, window = self._ctx(request)
        page, limit = parse_pagination(request.query_params)
        return ok(list_ips(project_id, window, request.query_params.get("q"), page, limit))


class IpDetailView(_QueryBaseView):
    def get(self, request, ip: str):
        project_id, window = self._ctx(request)
        return ok(get_ip_detail(ip, project_id, window))
