import threading
import time

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auth.authentication import CanReadMonitor
from apps.core.responses import ok

from ..services.analytics import get_audience, get_overview, get_top_pages, get_trend
from ..services.system import get_system_status
from .query_params import query_context

_CACHE_LOCK = threading.Lock()
_CACHE: dict[tuple, tuple[float, object]] = {}
_KEY_LOCKS: dict[tuple, threading.Lock] = {}
_CACHE_MAX_ENTRIES = 256


def cached_monitor_query(key: tuple, compute):
    ttl = getattr(settings, "ANALYTICS_CACHE_TTL_SEC", 0)
    if ttl <= 0:
        return compute()
    now = time.monotonic()
    with _CACHE_LOCK:
        hit = _CACHE.get(key)
        if hit is not None and hit[0] > now:
            return hit[1]
        key_lock = _KEY_LOCKS.get(key)
        if key_lock is None:
            if len(_KEY_LOCKS) >= _CACHE_MAX_ENTRIES:
                _KEY_LOCKS.clear()
            key_lock = threading.Lock()
            _KEY_LOCKS[key] = key_lock
    with key_lock:
        now = time.monotonic()
        with _CACHE_LOCK:
            hit = _CACHE.get(key)
            if hit is not None and hit[0] > now:
                return hit[1]
        result = compute()
        with _CACHE_LOCK:
            if len(_CACHE) >= _CACHE_MAX_ENTRIES:
                _CACHE.clear()
            _CACHE[key] = (time.monotonic() + ttl, result)
        return result


class SystemStatusView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor]

    def get(self, request):
        return ok(get_system_status())


class _AnalyticsBaseView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor]

    def _query_context(self, request):
        return query_context(request.query_params)

    def _cached(self, endpoint: str, request, fn):
        project_id, window = self._query_context(request)
        key = (
            endpoint,
            project_id,
            request.query_params.get("range", "24h"),
            request.query_params.get("from", ""),
            request.query_params.get("to", ""),
            request.query_params.get("tz", "UTC"),
        )
        return ok(cached_monitor_query(key, lambda: fn(project_id, window)))


class OverviewView(_AnalyticsBaseView):
    def get(self, request):
        return self._cached("overview", request, get_overview)


class TrendView(_AnalyticsBaseView):
    def get(self, request):
        return self._cached("trend", request, get_trend)


class PagesView(_AnalyticsBaseView):
    def get(self, request):
        return self._cached("pages", request, get_top_pages)


class AudienceView(_AnalyticsBaseView):
    def get(self, request):
        return self._cached("audience", request, get_audience)
