import time

from django.conf import settings

from .models import LogLevel, ServerLog
from .utils import extract_client_ip, truncate_str


class SelfLogMiddleware:
    """Records API request logs into server_logs when SELF_LOG_ENABLED=true."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, "SELF_LOG_ENABLED", False):
            return self.get_response(request)

        start = time.monotonic()
        response = self.get_response(request)
        path = request.path or "/"
        if path in {"/api/health", "/api/ready"}:
            return response
        if path.startswith("/api/v1/ingest/") and response.status_code < 400:
            return response

        duration_ms = int((time.monotonic() - start) * 1000)
        level = (
            LogLevel.ERROR
            if response.status_code >= 500
            else LogLevel.WARN
            if response.status_code >= 400
            else LogLevel.INFO
        )
        try:
            ServerLog.objects.create(
                project=None,
                service=getattr(settings, "SERVICE_NAME", "drone-website-server"),
                level=level,
                message=f"{request.method} {path} -> {response.status_code}",
                request_id=getattr(request, "request_id", None),
                method=truncate_str(request.method, 10),
                path=truncate_str(path, 512),
                status=response.status_code,
                duration_ms=duration_ms,
                ip=extract_client_ip(request),
                user_agent=truncate_str(request.headers.get("User-Agent"), 512),
            )
        except Exception:
            pass
        return response
