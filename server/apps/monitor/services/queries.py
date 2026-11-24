from collections import Counter, defaultdict

from apps.core.exceptions import AppError
from apps.core.responses import page_result

from ..models import ErrorEvent, ErrorIssue, Event, EventType, IpRule, ServerLog
from ..serializers import (
    ErrorEventSerializer,
    ErrorIssueSerializer,
    EventSerializer,
    ServerLogSerializer,
)
from ..utils import TimeWindow, floor_to_bucket, iso_utc, iter_buckets


def _filter_project(qs, project_id: str | None):
    return qs.filter(project_id=project_id) if project_id else qs


def list_events(project_id: str | None, window: TimeWindow, params, page: int, limit: int) -> dict:
    qs = _filter_project(
        Event.objects.filter(created_at__gte=window.start, created_at__lte=window.end), project_id
    )
    for field, key in (
        ("type", "type"),
        ("name", "name"),
        ("visitor_id", "visitorId"),
        ("user_id", "userId"),
        ("ip", "ip"),
    ):
        val = params.get(key)
        if val:
            qs = qs.filter(**{field: val})
    if params.get("path"):
        qs = qs.filter(path__icontains=params["path"])

    total = qs.count()
    offset = (page - 1) * limit
    items = EventSerializer(qs[offset : offset + limit], many=True).data
    return page_result(items, total, page, limit)


def get_events_summary(project_id: str | None, window: TimeWindow) -> list[dict]:
    qs = _filter_project(
        Event.objects.filter(
            type=EventType.TRACK, created_at__gte=window.start, created_at__lte=window.end
        ),
        project_id,
    )
    counts: Counter[str] = Counter()
    visitors: dict[str, set[str]] = defaultdict(set)
    last_seen: dict[str, object] = {}
    for row in qs.only("name", "visitor_id", "created_at"):
        counts[row.name] += 1
        visitors[row.name].add(row.visitor_id)
        if row.name not in last_seen or row.created_at > last_seen[row.name]:
            last_seen[row.name] = row.created_at

    return [
        {
            "name": name,
            "count": count,
            "visitors": len(visitors[name]),
            "lastSeen": iso_utc(last_seen[name]),
        }
        for name, count in counts.most_common(50)
    ]


def list_issues(project_id: str | None, window: TimeWindow, params, page: int, limit: int) -> dict:
    ev_qs = _filter_project(
        ErrorEvent.objects.filter(created_at__gte=window.start, created_at__lte=window.end),
        project_id,
    )
    issue_counts: Counter = Counter()
    issue_users: dict = defaultdict(set)
    for row in ev_qs.only("issue_id", "visitor_id"):
        issue_counts[row.issue_id] += 1
        issue_users[row.issue_id].add(row.visitor_id)

    qs = _filter_project(ErrorIssue.objects.filter(id__in=issue_counts.keys()), project_id)
    if params.get("status"):
        qs = qs.filter(status=params["status"])
    if params.get("type"):
        qs = qs.filter(type=params["type"])
    if params.get("q"):
        qs = qs.filter(message__icontains=params["q"])

    issues = list(qs)
    sort_by = params.get("sort", "recent")
    if sort_by == "frequent":
        issues.sort(key=lambda i: (-issue_counts[i.id], -i.last_seen.timestamp()))
    else:
        issues.sort(key=lambda i: -i.last_seen.timestamp())

    total = len(issues)
    offset = (page - 1) * limit
    paged = issues[offset : offset + limit]
    serialized = []
    for issue in paged:
        data = ErrorIssueSerializer(issue).data
        data["rangeCount"] = issue_counts[issue.id]
        data["users"] = len(issue_users[issue.id])
        serialized.append(data)
    return page_result(serialized, total, page, limit)


def get_issue_detail(issue_id: str, window: TimeWindow) -> dict:
    issue = ErrorIssue.objects.filter(pk=issue_id).first()
    if issue is None:
        raise AppError.not_found("ISSUE_NOT_FOUND", "Issue not found")

    buckets = iter_buckets(window)
    trend_map = {b: 0 for b in buckets}
    users: set[str] = set()
    browsers: Counter[str] = Counter()
    systems: Counter[str] = Counter()

    for row in ErrorEvent.objects.filter(
        issue=issue, created_at__gte=window.start, created_at__lte=window.end
    ).only("created_at", "visitor_id", "browser", "os"):
        b = floor_to_bucket(row.created_at, window.bucket, window.tz)
        if b in trend_map:
            trend_map[b] += 1
        users.add(row.visitor_id)
        browsers[row.browser or "Other"] += 1
        systems[row.os or "Other"] += 1

    data = ErrorIssueSerializer(issue).data
    data["users"] = len(users)
    data["trend"] = [{"bucket": iso_utc(b), "count": trend_map[b]} for b in buckets]
    data["browsers"] = [{"name": n, "count": c} for n, c in browsers.most_common(10)]
    data["systems"] = [{"name": n, "count": c} for n, c in systems.most_common(10)]
    return data


def list_issue_events(issue_id: str, window: TimeWindow, page: int, limit: int) -> dict:
    if not ErrorIssue.objects.filter(pk=issue_id).exists():
        raise AppError.not_found("ISSUE_NOT_FOUND", "Issue not found")
    qs = ErrorEvent.objects.filter(
        issue_id=issue_id, created_at__gte=window.start, created_at__lte=window.end
    )
    total = qs.count()
    offset = (page - 1) * limit
    items = ErrorEventSerializer(qs[offset : offset + limit], many=True).data
    return page_result(items, total, page, limit)


def list_logs(project_id: str | None, window: TimeWindow, params, page: int, limit: int) -> dict:
    qs = _filter_project(
        ServerLog.objects.filter(created_at__gte=window.start, created_at__lte=window.end),
        project_id,
    )
    for field, key in (
        ("service", "service"),
        ("level", "level"),
        ("request_id", "requestId"),
        ("ip", "ip"),
    ):
        if params.get(key):
            qs = qs.filter(**{field: params[key]})
    status_cls = params.get("statusClass")
    if status_cls and len(status_cls) == 3 and status_cls[0].isdigit():
        base = int(status_cls[0]) * 100
        qs = qs.filter(status__gte=base, status__lt=base + 100)
    if params.get("q"):
        qs = qs.filter(message__icontains=params["q"])

    total = qs.count()
    offset = (page - 1) * limit
    items = ServerLogSerializer(qs[offset : offset + limit], many=True).data
    return page_result(items, total, page, limit)


def get_logs_stats(project_id: str | None, window: TimeWindow, service: str | None) -> dict:
    qs = _filter_project(
        ServerLog.objects.filter(created_at__gte=window.start, created_at__lte=window.end),
        project_id,
    )
    if service:
        qs = qs.filter(service=service)

    levels: Counter[str] = Counter()
    statuses: Counter[str] = Counter()
    buckets = iter_buckets(window)
    trend = {b: {"requests": 0, "serverErrors": 0, "errors": 0, "durs": []} for b in buckets}
    endpoints: dict[tuple[str, str], dict] = {}

    for row in qs.only("level", "status", "duration_ms", "method", "path", "created_at"):
        levels[row.level] += 1
        b = floor_to_bucket(row.created_at, window.bucket, window.tz)
        if b in trend and row.level == "error":
            trend[b]["errors"] += 1
        if row.status is not None:
            cls = f"{row.status // 100}xx"
            statuses[cls] += 1
            if b in trend:
                trend[b]["requests"] += 1
                if row.status >= 500:
                    trend[b]["serverErrors"] += 1
                if row.duration_ms is not None:
                    trend[b]["durs"].append(row.duration_ms)
            if row.method and row.path:
                ep = endpoints.setdefault(
                    (row.method, row.path), {"durs": [], "count": 0, "serverErrors": 0}
                )
                ep["count"] += 1
                if row.status >= 500:
                    ep["serverErrors"] += 1
                if row.duration_ms is not None:
                    ep["durs"].append(row.duration_ms)

    slowest = []
    for (method, path), stat in endpoints.items():
        durs = sorted(stat["durs"])
        p95 = durs[int(len(durs) * 0.95) - 1] if durs else 0
        avg = round(sum(durs) / len(durs)) if durs else 0
        slowest.append(
            {
                "method": method,
                "path": path,
                "count": stat["count"],
                "avgMs": avg,
                "p95Ms": p95,
                "serverErrors": stat["serverErrors"],
            }
        )
    slowest.sort(key=lambda r: -r["p95Ms"])

    return {
        "levels": [{"name": k, "count": v} for k, v in levels.most_common()],
        "statuses": [{"name": k, "count": v} for k, v in statuses.most_common()],
        "trend": [
            {
                "bucket": iso_utc(b),
                "requests": trend[b]["requests"],
                "serverErrors": trend[b]["serverErrors"],
                "errors": trend[b]["errors"],
                "avgMs": round(sum(trend[b]["durs"]) / len(trend[b]["durs"]))
                if trend[b]["durs"]
                else 0,
            }
            for b in buckets
        ],
        "slowest": slowest[:15],
    }


def list_log_services(project_id: str | None) -> list[dict]:
    qs = _filter_project(ServerLog.objects.all(), project_id)
    seen: dict[tuple[str, str | None], object] = {}
    for row in qs.only("service", "project_id", "created_at")[:2000]:
        key = (row.service, str(row.project_id) if row.project_id else None)
        if key not in seen or row.created_at > seen[key]:
            seen[key] = row.created_at
    return [
        {"service": svc, "projectId": pid, "lastSeen": iso_utc(ts)}
        for (svc, pid), ts in sorted(seen.items(), key=lambda x: x[1], reverse=True)
    ]


def list_ips(project_id: str | None, window: TimeWindow, q: str | None, page: int, limit: int):
    blocked_ips = set(IpRule.objects.values_list("ip", flat=True))
    stats: dict[str, dict] = {}

    def _touch(ip: str, dt):
        entry = stats.setdefault(
            ip,
            {
                "ip": ip,
                "total": 0,
                "pageviews": 0,
                "events": 0,
                "errors": 0,
                "requests": 0,
                "visitors": set(),
                "first": dt,
                "last": dt,
            },
        )
        entry["total"] += 1
        if dt < entry["first"]:
            entry["first"] = dt
        if dt > entry["last"]:
            entry["last"] = dt
        return entry

    for row in _filter_project(
        Event.objects.filter(created_at__gte=window.start, created_at__lte=window.end), project_id
    ).only("ip", "type", "visitor_id", "created_at"):
        if q and not row.ip.startswith(q):
            continue
        e = _touch(row.ip, row.created_at)
        e["visitors"].add(row.visitor_id)
        if row.type == EventType.PAGEVIEW:
            e["pageviews"] += 1
        elif row.type == EventType.TRACK:
            e["events"] += 1

    for row in _filter_project(
        ErrorEvent.objects.filter(created_at__gte=window.start, created_at__lte=window.end),
        project_id,
    ).only("ip", "visitor_id", "created_at"):
        if q and not row.ip.startswith(q):
            continue
        e = _touch(row.ip, row.created_at)
        e["errors"] += 1
        e["visitors"].add(row.visitor_id)

    for row in _filter_project(
        ServerLog.objects.filter(
            ip__isnull=False, created_at__gte=window.start, created_at__lte=window.end
        ),
        project_id,
    ).only("ip", "created_at"):
        if not row.ip or (q and not row.ip.startswith(q)):
            continue
        e = _touch(row.ip, row.created_at)
        e["requests"] += 1

    rows = sorted(stats.values(), key=lambda x: -x["total"])
    total = len(rows)
    offset = (page - 1) * limit
    items = [
        {
            "ip": r["ip"],
            "total": r["total"],
            "pageviews": r["pageviews"],
            "events": r["events"],
            "errors": r["errors"],
            "requests": r["requests"],
            "visitors": len(r["visitors"]),
            "firstSeen": iso_utc(r["first"]),
            "lastSeen": iso_utc(r["last"]),
            "blocked": r["ip"] in blocked_ips,
        }
        for r in rows[offset : offset + limit]
    ]
    return page_result(items, total, page, limit)


def get_ip_detail(ip: str, project_id: str | None, window: TimeWindow) -> dict:
    summary_page = list_ips(project_id, window, ip, 1, 50)
    summary = next((item for item in summary_page["items"] if item["ip"] == ip), None)
    buckets = iter_buckets(window)
    trend_map = {b: 0 for b in buckets}
    pages: Counter[str] = Counter()
    agents: Counter[str] = Counter()
    visitors: Counter[str] = Counter()

    for row in _filter_project(
        Event.objects.filter(ip=ip, created_at__gte=window.start, created_at__lte=window.end),
        project_id,
    ).only("path", "browser", "os", "visitor_id", "created_at"):
        b = floor_to_bucket(row.created_at, window.bucket, window.tz)
        if b in trend_map:
            trend_map[b] += 1
        pages[row.path] += 1
        agents[f"{row.browser} / {row.os}"] += 1
        visitors[row.visitor_id] += 1

    recent_errors = [
        {
            "id": str(row.id),
            "issueId": str(row.issue_id),
            "message": row.message,
            "path": row.path,
            "createdAt": iso_utc(row.created_at),
        }
        for row in _filter_project(
            ErrorEvent.objects.filter(
                ip=ip, created_at__gte=window.start, created_at__lte=window.end
            ),
            project_id,
        )[:20]
    ]
    recent_requests = [
        {
            "id": str(row.id),
            "service": row.service,
            "method": row.method,
            "path": row.path,
            "status": row.status,
            "durationMs": row.duration_ms,
            "createdAt": iso_utc(row.created_at),
        }
        for row in _filter_project(
            ServerLog.objects.filter(
                ip=ip, created_at__gte=window.start, created_at__lte=window.end
            ),
            project_id,
        )[:20]
    ]
    return {
        "summary": summary,
        "trend": [{"bucket": iso_utc(b), "count": trend_map[b]} for b in buckets],
        "pages": [{"name": n, "count": c} for n, c in pages.most_common(10)],
        "agents": [{"name": n, "count": c} for n, c in agents.most_common(10)],
        "visitors": [{"name": n, "count": c} for n, c in visitors.most_common(10)],
        "errors": recent_errors,
        "requests": recent_requests,
    }
