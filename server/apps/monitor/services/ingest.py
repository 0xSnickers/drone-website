from datetime import UTC, datetime, timedelta
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.db.models import F

from apps.core.exceptions import AppError

from ..models import (
    ErrorEvent,
    ErrorIssue,
    ErrorType,
    Event,
    EventType,
    IngestReceipt,
    IpRule,
    IssueStatus,
    LogLevel,
    Project,
    ServerLog,
)
from ..utils import (
    check_ingest_rate_limit,
    compute_error_fingerprint,
    extract_path,
    parse_user_agent,
    safe_json_payload,
    truncate_str,
)
from .queue import enqueue_ingest_job
from .resilience import (
    EVENTS_QUEUE_KEY,
    LOGS_QUEUE_KEY,
    filter_degraded_events,
)

_VALID_EVENT_TYPES = {EventType.PAGEVIEW, EventType.TRACK, EventType.PERFORMANCE, "error"}
_VALID_ERROR_TYPES = {c.value for c in ErrorType}
_VALID_LOG_LEVELS = {c.value for c in LogLevel}


def _resolve_ingest_project(app_key: str | None, client_ip: str) -> Project:
    if not check_ingest_rate_limit(client_ip):
        raise AppError("RATE_LIMITED", "Too many requests", 429)
    if not app_key or not isinstance(app_key, str):
        raise AppError("INVALID_APP_KEY", "Invalid app key", 401)
    project = Project.objects.filter(app_key=app_key.strip()).first()
    if project is None:
        raise AppError("INVALID_APP_KEY", "Invalid app key", 401)
    if IpRule.objects.filter(ip=client_ip).exists():
        raise AppError("IP_BLOCKED", "This IP is blocked", 403)
    return project


def _parse_client_ts(ts_val: object, now: datetime) -> datetime:
    if isinstance(ts_val, (int, float)) and not isinstance(ts_val, bool):
        try:
            dt = datetime.fromtimestamp(ts_val / 1000.0, tz=UTC)
            if now - timedelta(days=1) <= dt <= now:
                return dt
        except (OverflowError, OSError, ValueError):
            pass
    return now


def _bad_param(field: str, msg: str) -> AppError:
    return AppError("VALIDATION_ERROR", "Invalid request parameters", 400, {field: [msg]})


def _validate_events(raw_events: object) -> list[dict]:
    if not isinstance(raw_events, list) or not (1 <= len(raw_events) <= 100):
        raise _bad_param("events", "must be a list of 1 to 100 items")
    for idx, item in enumerate(raw_events):
        if not isinstance(item, dict):
            raise _bad_param(f"events.{idx}", "must be an object")
        if not isinstance(item.get("type"), str) or item["type"] not in _VALID_EVENT_TYPES:
            raise _bad_param(f"events.{idx}.type", "invalid event type")
    return raw_events


@transaction.atomic
def persist_events_batch(
    project: Project, raw_events: list[dict], client_ip: str, user_agent: str
) -> int:
    if not raw_events:
        return 0
    now = datetime.now(UTC)
    browser, os_name, device = parse_user_agent(user_agent)
    events_to_create: list[Event] = []
    accepted = 0

    for item in raw_events:
        ev_type = item.get("type")
        url = truncate_str(str(item.get("url") or "/"), 2048)
        path = extract_path(url)
        visitor_id = truncate_str(str(item.get("visitorId") or "anon"), 64)
        session_id = truncate_str(str(item.get("sessionId") or visitor_id), 64)
        user_id = truncate_str(str(item["userId"]), 64) if item.get("userId") else None
        release = truncate_str(str(item["release"]), 64) if item.get("release") else None

        if ev_type == "error":
            err = item.get("error") if isinstance(item.get("error"), dict) else {}
            err_type = err.get("type")
            if not isinstance(err_type, str) or err_type not in _VALID_ERROR_TYPES:
                err_type = ErrorType.JS
            err_msg = truncate_str(str(err.get("message") or item.get("name") or "Error"), 1000)
            err_stack = truncate_str(str(err.get("stack") or ""), 8000)
            err_source = truncate_str(str(err.get("source") or ""), 512)
            fp = compute_error_fingerprint(err_type, err_msg, err_stack)

            issue, created = ErrorIssue.objects.get_or_create(
                project=project,
                fingerprint=fp,
                defaults={
                    "type": err_type,
                    "message": err_msg,
                    "source": err_source,
                    "status": IssueStatus.OPEN,
                    "count": 1,
                    "first_seen": now,
                    "last_seen": now,
                },
            )
            if not created:
                next_status = (
                    IssueStatus.OPEN if issue.status == IssueStatus.RESOLVED else issue.status
                )
                ErrorIssue.objects.filter(pk=issue.pk).update(
                    count=F("count") + 1,
                    last_seen=now,
                    status=next_status,
                )

            breadcrumbs = safe_json_payload(item.get("breadcrumbs") or [])
            extra = safe_json_payload(item.get("properties") or {})
            ErrorEvent.objects.create(
                project=project,
                issue=issue,
                message=err_msg,
                stack=err_stack,
                url=url,
                path=path,
                visitor_id=visitor_id,
                session_id=session_id,
                user_id=user_id,
                ip=client_ip,
                browser=browser,
                os=os_name,
                device=device,
                release=release,
                breadcrumbs=breadcrumbs if isinstance(breadcrumbs, list) else [],
                extra=extra if isinstance(extra, dict) else {},
            )
            accepted += 1
            continue

        name = truncate_str(
            str(
                "pageview"
                if ev_type == EventType.PAGEVIEW
                else "page_load"
                if ev_type == EventType.PERFORMANCE
                else (item.get("name") or "event")
            ),
            100,
        )
        props = safe_json_payload(item.get("properties") or {})
        events_to_create.append(
            Event(
                project=project,
                type=ev_type,
                name=name,
                url=url,
                path=path,
                referrer=truncate_str(str(item.get("referrer") or ""), 2048),
                visitor_id=visitor_id,
                session_id=session_id,
                user_id=user_id,
                ip=client_ip,
                browser=browser,
                os=os_name,
                device=device,
                release=release,
                properties=props if isinstance(props, dict) else {},
                occurred_at=_parse_client_ts(item.get("ts"), now),
            )
        )
        accepted += 1

    if events_to_create:
        Event.objects.bulk_create(events_to_create)
    return accepted


def ingest_events(app_key: str | None, payload: dict, client_ip: str, user_agent: str) -> int:
    project = _resolve_ingest_project(app_key, client_ip)
    raw_events = _validate_events(payload.get("events"))
    job = {
        "job_id": str(uuid4()),
        "project_id": str(project.id),
        "events": raw_events,
        "client_ip": client_ip,
        "user_agent": user_agent,
    }
    if enqueue_ingest_job(EVENTS_QUEUE_KEY, job):
        return len(raw_events)
    filtered = filter_degraded_events(raw_events)
    if settings.INGEST_MODE == "redis_queue":
        persist_job_once(project, {**job, "events": filtered})
    else:
        persist_events_batch(project, filtered, client_ip, user_agent)
    return len(raw_events)


def _validate_logs(payload: dict) -> tuple[str, list[dict]]:
    service = truncate_str(str(payload.get("service") or "").strip(), 50)
    raw_logs = payload.get("logs")
    if not service:
        raise _bad_param("service", "service is required")
    if not isinstance(raw_logs, list) or not (1 <= len(raw_logs) <= 200):
        raise _bad_param("logs", "must be a list of 1 to 200 items")
    for idx, entry in enumerate(raw_logs):
        if not isinstance(entry, dict):
            raise _bad_param(f"logs.{idx}", "must be an object")
        if (
            not isinstance(entry.get("level", LogLevel.INFO), str)
            or entry.get("level", LogLevel.INFO) not in _VALID_LOG_LEVELS
        ):
            raise _bad_param(f"logs.{idx}.level", "invalid log level")
        status_val = entry.get("status")
        if status_val is not None and (
            not isinstance(status_val, int) or not (100 <= status_val <= 599)
        ):
            raise _bad_param(f"logs.{idx}.status", "status must be 100..599")
    return service, raw_logs


def persist_logs_batch(project: Project, service: str, raw_logs: list[dict], client_ip: str) -> int:
    rows: list[ServerLog] = []
    for entry in raw_logs:
        level = entry.get("level", LogLevel.INFO)
        status_val = entry.get("status")
        duration = entry.get("durationMs")
        duration_int = int(duration) if isinstance(duration, (int, float)) else None
        meta = safe_json_payload(entry.get("meta") or {})
        rows.append(
            ServerLog(
                project=project,
                service=service,
                level=level,
                message=truncate_str(str(entry.get("message") or ""), 2000),
                request_id=truncate_str(str(entry["requestId"]), 64)
                if entry.get("requestId")
                else None,
                method=truncate_str(str(entry["method"]), 10) if entry.get("method") else None,
                path=truncate_str(str(entry["path"]), 512) if entry.get("path") else None,
                status=status_val,
                duration_ms=duration_int,
                ip=truncate_str(str(entry["ip"]), 64) if entry.get("ip") else client_ip,
                user_agent=truncate_str(str(entry["userAgent"]), 512)
                if entry.get("userAgent")
                else None,
                meta=meta if isinstance(meta, dict) else {},
            )
        )
    if rows:
        ServerLog.objects.bulk_create(rows)
    return len(rows)


def ingest_logs(app_key: str | None, payload: dict, client_ip: str) -> int:
    project = _resolve_ingest_project(app_key, client_ip)
    service, raw_logs = _validate_logs(payload)
    job = {
        "job_id": str(uuid4()),
        "project_id": str(project.id),
        "service": service,
        "logs": raw_logs,
        "client_ip": client_ip,
    }
    if enqueue_ingest_job(LOGS_QUEUE_KEY, job):
        return len(raw_logs)
    if settings.INGEST_MODE == "redis_queue":
        return persist_job_once(project, job)
    return persist_logs_batch(project, service, raw_logs, client_ip)


@transaction.atomic
def persist_job_once(project: Project, job: dict) -> int:
    """The receipt and all data commit together; redelivery after a lost ACK is harmless."""
    _, created = IngestReceipt.objects.get_or_create(id=job["job_id"])
    if not created:
        return 0
    if "events" in job:
        return persist_events_batch(project, job["events"], job["client_ip"], job["user_agent"])
    return persist_logs_batch(project, job["service"], job["logs"], job["client_ip"])
