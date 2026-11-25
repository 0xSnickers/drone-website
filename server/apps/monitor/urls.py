from django.urls import path

from .views.analytics import AudienceView, OverviewView, PagesView, SystemStatusView, TrendView
from .views.ingest import IngestEventsView, IngestLogsView
from .views.ops_history import (
    ReleaseDetailView,
    ReleaseListCreateView,
    StressRunDetailView,
    StressRunListCreateView,
)
from .views.projects import (
    IpRuleDeleteView,
    IpRuleListCreateView,
    ProjectDetailView,
    ProjectListCreateView,
    ProjectRotateKeyView,
)
from .views.queries import (
    ErrorIssueDetailView,
    ErrorIssueEventsView,
    ErrorIssueListView,
    EventListView,
    EventSummaryView,
    IpDetailView,
    IpListView,
    LogListView,
    LogServicesView,
    LogStatsView,
)

urlpatterns = [
    path("ingest/events", IngestEventsView.as_view()),
    path("ingest/logs", IngestLogsView.as_view()),
    path("system/status", SystemStatusView.as_view()),
    path("projects", ProjectListCreateView.as_view()),
    path("projects/<uuid:project_id>", ProjectDetailView.as_view()),
    path("projects/<uuid:project_id>/rotate-key", ProjectRotateKeyView.as_view()),
    path("analytics/overview", OverviewView.as_view()),
    path("analytics/trend", TrendView.as_view()),
    path("analytics/pages", PagesView.as_view()),
    path("analytics/audience", AudienceView.as_view()),
    path("events", EventListView.as_view()),
    path("events/summary", EventSummaryView.as_view()),
    path("errors/issues", ErrorIssueListView.as_view()),
    path("errors/issues/<uuid:issue_id>", ErrorIssueDetailView.as_view()),
    path("errors/issues/<uuid:issue_id>/events", ErrorIssueEventsView.as_view()),
    path("logs", LogListView.as_view()),
    path("logs/stats", LogStatsView.as_view()),
    path("logs/services", LogServicesView.as_view()),
    path("ips", IpListView.as_view()),
    path("ips/<str:ip>", IpDetailView.as_view()),
    path("ip-rules", IpRuleListCreateView.as_view()),
    path("ip-rules/<uuid:rule_id>", IpRuleDeleteView.as_view()),
    path("releases", ReleaseListCreateView.as_view()),
    path("releases/<uuid:release_id>", ReleaseDetailView.as_view()),
    path("stress-runs", StressRunListCreateView.as_view()),
    path("stress-runs/<str:run_id>", StressRunDetailView.as_view()),
]
