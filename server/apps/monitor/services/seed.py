import logging
from datetime import UTC, datetime, timedelta

from django.conf import settings

from ..models import (
    ErrorEvent,
    ErrorIssue,
    ErrorType,
    Event,
    EventType,
    IssueStatus,
    LogLevel,
    Project,
    ServerLog,
)
from ..utils import compute_error_fingerprint

logger = logging.getLogger(__name__)


def seed_demo_monitor_data_on_startup() -> None:
    if not getattr(settings, "SEED_DEMO_DATA", False):
        return
    try:
        project, created = Project.objects.get_or_create(
            app_key="pk_demo_web",
            defaults={
                "name": "AeroApex Web",
                "description": "AeroApex 无人机展示官网与管理中心默认监控项目",
            },
        )
        if not created and Event.objects.filter(project=project).exists():
            return

        now = datetime.now(UTC)
        paths = ["/", "/flagship", "/academy", "/community", "/store"]
        events: list[Event] = []
        logs: list[ServerLog] = []
        for idx in range(24):
            ts = now - timedelta(hours=idx)
            path = paths[idx % len(paths)]
            visitor = f"vis_{idx % 8 + 1}"
            ip = f"203.0.113.{10 + (idx % 6)}"
            events.append(
                Event(
                    project=project,
                    type=EventType.PAGEVIEW,
                    name="pageview",
                    url=f"http://localhost:5173{path}",
                    path=path,
                    referrer="https://aeroapex.example.com/" if idx % 2 == 0 else "",
                    visitor_id=visitor,
                    session_id=f"ses_{idx % 8 + 1}",
                    ip=ip,
                    browser="Chrome" if idx % 3 else "Safari",
                    os="macOS" if idx % 2 else "Windows",
                    device="desktop" if idx % 3 else "mobile",
                    properties={},
                    occurred_at=ts,
                )
            )
            if idx % 3 == 0:
                events.append(
                    Event(
                        project=project,
                        type=EventType.TRACK,
                        name="preorder_click" if idx % 2 == 0 else "course_preview_open",
                        url=f"http://localhost:5173{path}",
                        path=path,
                        visitor_id=visitor,
                        session_id=f"ses_{idx % 8 + 1}",
                        ip=ip,
                        browser="Chrome",
                        os="macOS",
                        device="desktop",
                        properties={"edition": "combo"},
                        occurred_at=ts,
                    )
                )
            logs.append(
                ServerLog(
                    project=project,
                    service="drone-website-server",
                    level=LogLevel.ERROR if idx == 2 else LogLevel.INFO,
                    message="GET /api/v1/projects" if idx != 2 else "Upstream timeout",
                    method="GET",
                    path="/api/v1/projects" if idx != 2 else "/api/v1/orders",
                    status=502 if idx == 2 else 200,
                    duration_ms=420 if idx == 2 else 28 + (idx % 5) * 9,
                    ip=ip,
                )
            )
        Event.objects.bulk_create(events)
        ServerLog.objects.bulk_create(logs)

        fp = compute_error_fingerprint(
            ErrorType.API, "POST /api/v1/orders failed", "at checkout.ts:12"
        )
        issue, _ = ErrorIssue.objects.get_or_create(
            project=project,
            fingerprint=fp,
            defaults={
                "type": ErrorType.API,
                "message": "POST /api/v1/orders failed with 502",
                "source": "checkout.ts",
                "status": IssueStatus.OPEN,
                "count": 2,
                "first_seen": now - timedelta(hours=4),
                "last_seen": now - timedelta(hours=1),
            },
        )
        ErrorEvent.objects.create(
            project=project,
            issue=issue,
            message=issue.message,
            stack="Error: POST /api/v1/orders failed\n  at checkout.ts:12:8",
            url="http://localhost:5173/store",
            path="/store",
            visitor_id="vis_2",
            session_id="ses_2",
            ip="203.0.113.12",
            browser="Chrome",
            os="macOS",
            device="desktop",
            breadcrumbs=[
                {"type": "click", "message": "button Checkout", "ts": int(now.timestamp() * 1000)}
            ],
            extra={"status": 502},
        )
        logger.info("seeded demo monitor project pk_demo_web")
    except Exception:
        logger.warning("skipping demo monitor seed (migrations may not have run yet)")
