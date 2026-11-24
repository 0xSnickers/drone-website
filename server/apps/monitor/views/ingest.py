from rest_framework.parsers import BaseParser, JSONParser
from rest_framework.views import APIView

from apps.core.responses import ok

from ..services.ingest import ingest_events, ingest_logs
from ..utils import extract_client_ip, parse_json_body


class PlainTextParser(BaseParser):
    """Accept text/plain payloads (for navigator.sendBeacon without CORS preflight)."""

    media_type = "text/plain"

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read().decode("utf-8", errors="replace")


class _BaseIngestView(APIView):
    authentication_classes = []
    permission_classes = []
    parser_classes = [JSONParser, PlainTextParser]

    def _app_key(self, request, body: dict) -> str | None:
        return body.get("appKey") or request.headers.get("X-App-Key")


class IngestEventsView(_BaseIngestView):
    def post(self, request):
        body = parse_json_body(request)
        accepted = ingest_events(
            self._app_key(request, body),
            body,
            extract_client_ip(request),
            request.headers.get("User-Agent", ""),
        )
        return ok({"accepted": accepted})


class IngestLogsView(_BaseIngestView):
    def post(self, request):
        body = parse_json_body(request)
        accepted = ingest_logs(
            self._app_key(request, body),
            body,
            extract_client_ip(request),
        )
        return ok({"accepted": accepted})
