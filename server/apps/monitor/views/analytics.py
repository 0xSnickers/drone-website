from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.core.responses import ok

from ..services.analytics import get_audience, get_overview, get_top_pages, get_trend
from ..utils import resolve_time_window


class _AnalyticsBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def _query_context(self, request):
        params = request.query_params
        project_id = params.get("projectId") or None
        window = resolve_time_window(params.get("range"), params.get("tz"))
        return project_id, window


class OverviewView(_AnalyticsBaseView):
    def get(self, request):
        project_id, window = self._query_context(request)
        return ok(get_overview(project_id, window))


class TrendView(_AnalyticsBaseView):
    def get(self, request):
        project_id, window = self._query_context(request)
        return ok(get_trend(project_id, window))


class PagesView(_AnalyticsBaseView):
    def get(self, request):
        project_id, window = self._query_context(request)
        return ok(get_top_pages(project_id, window))


class AudienceView(_AnalyticsBaseView):
    def get(self, request):
        project_id, window = self._query_context(request)
        return ok(get_audience(project_id, window))
