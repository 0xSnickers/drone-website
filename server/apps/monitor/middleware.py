import time

from django.conf import settings

from .models import LogLevel, ServerLog
from .services.system import record_request_sample
from .utils import extract_client_ip, truncate_str


class SelfLogMiddleware:
    """Records in-memory live traffic metrics and optional DB logs when SELF_LOG_ENABLED=true."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        duration_flt = (time.monotonic() - start) * 1000.0
        path = request.path or "/"

        if path != "/api/v1/system/status":
            ua = request.headers.get("User-Agent", "")
            is_stress = "AeroApex-StressTest" in ua or bool(request.headers.get("X-Stress-Run"))
            record_request_sample(duration_flt, response.status_code, is_stress=is_stress)

        if not getattr(settings, "SELF_LOG_ENABLED", False):
            return response
        if path in {"/api/health", "/api/ready", "/api/v1/system/status"}:
            return response
        if path.startswith("/api/v1/ingest/") and (
            response.status_code < 400 or response.status_code == 429
        ):
            return response
        if request.method == "GET" and response.status_code < 400:
            return response

        duration_ms = int(duration_flt)
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
