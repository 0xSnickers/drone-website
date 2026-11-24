from collections import Counter, defaultdict
from datetime import datetime

from ..models import ErrorEvent, Event, EventType, ServerLog
from ..utils import TimeWindow, extract_referrer_host, floor_to_bucket, iso_utc, iter_buckets


def _filter_project(qs, project_id: str | None):
    return qs.filter(project_id=project_id) if project_id else qs


def _compute_totals(project_id: str | None, start: datetime, end: datetime) -> dict:
    events_qs = _filter_project(
        Event.objects.filter(created_at__gte=start, created_at__lt=end), project_id
    )
    errors_qs = _filter_project(
        ErrorEvent.objects.filter(created_at__gte=start, created_at__lt=end), project_id
    )
    logs_qs = _filter_project(
        ServerLog.objects.filter(created_at__gte=start, created_at__lt=end), project_id
    )

    pv_visitors: set[str] = set()
    sessions: set[str] = set()
    ips: set[str] = set()
    pv = 0
    track_events = 0
    load_samples: list[float] = []
    fcp_samples: list[float] = []

    for row in events_qs.only("type", "visitor_id", "session_id", "ip", "properties"):
        sessions.add(row.session_id)
        if row.ip:
            ips.add(row.ip)
        if row.type == EventType.PAGEVIEW:
            pv += 1
            pv_visitors.add(row.visitor_id)
        elif row.type == EventType.TRACK:
            track_events += 1
        elif row.type == EventType.PERFORMANCE and isinstance(row.properties, dict):
            load_val = row.properties.get("loadMs")
            fcp_val = row.properties.get("fcpMs")
            if isinstance(load_val, (int, float)):
                load_samples.append(float(load_val))
            if isinstance(fcp_val, (int, float)):
                fcp_samples.append(float(fcp_val))

    err_visitors: set[str] = set()
    err_count = 0
    for row in errors_qs.only("visitor_id", "ip"):
        err_count += 1
        err_visitors.add(row.visitor_id)
        if row.ip:
            ips.add(row.ip)

    requests = 0
    server_errors = 0
    durations: list[float] = []
    for row in logs_qs.only("status", "duration_ms", "ip"):
        if row.ip:
            ips.add(row.ip)
        if row.status is not None:
            requests += 1
            if row.status >= 500:
                server_errors += 1
            if row.duration_ms is not None:
                durations.append(float(row.duration_ms))

    return {
        "pv": pv,
        "uv": len(pv_visitors),
        "sessions": len(sessions),
        "ips": len(ips),
        "events": track_events,
        "errors": err_count,
        "errorVisitors": len(err_visitors),
        "requests": requests,
        "serverErrors": server_errors,
        "avgDurationMs": round(sum(durations) / len(durations)) if durations else 0,
        "avgLoadMs": round(sum(load_samples) / len(load_samples)) if load_samples else 0,
        "avgFcpMs": round(sum(fcp_samples) / len(fcp_samples)) if fcp_samples else 0,
    }


def get_overview(project_id: str | None, window: TimeWindow) -> dict:
    return {
        "range": {
            "from": iso_utc(window.start),
            "to": iso_utc(window.end),
            "bucket": window.bucket,
        },
        "current": _compute_totals(project_id, window.start, window.end),
        "previous": _compute_totals(project_id, window.prev_start, window.start),
    }


def get_trend(project_id: str | None, window: TimeWindow) -> list[dict]:
    buckets = iter_buckets(window)
    points = {
        b: {"pv": 0, "uv_set": set(), "errors": 0, "requests": 0, "serverErrors": 0}
        for b in buckets
    }

    ev_qs = _filter_project(
        Event.objects.filter(
            type=EventType.PAGEVIEW, created_at__gte=window.start, created_at__lte=window.end
        ),
        project_id,
    )
    for row in ev_qs.only("created_at", "visitor_id"):
        b = floor_to_bucket(row.created_at, window.bucket, window.tz)
        if b in points:
            points[b]["pv"] += 1
            points[b]["uv_set"].add(row.visitor_id)

    err_qs = _filter_project(
        ErrorEvent.objects.filter(created_at__gte=window.start, created_at__lte=window.end),
        project_id,
    )
    for row in err_qs.only("created_at"):
        b = floor_to_bucket(row.created_at, window.bucket, window.tz)
        if b in points:
            points[b]["errors"] += 1

    log_qs = _filter_project(
        ServerLog.objects.filter(
            status__isnull=False, created_at__gte=window.start, created_at__lte=window.end
        ),
        project_id,
    )
    for row in log_qs.only("created_at", "status"):
        b = floor_to_bucket(row.created_at, window.bucket, window.tz)
        if b in points:
            points[b]["requests"] += 1
            if row.status and row.status >= 500:
                points[b]["serverErrors"] += 1

    return [
        {
            "bucket": iso_utc(b),
            "pv": points[b]["pv"],
            "uv": len(points[b]["uv_set"]),
            "errors": points[b]["errors"],
            "requests": points[b]["requests"],
            "serverErrors": points[b]["serverErrors"],
        }
        for b in buckets
    ]


def get_top_pages(project_id: str | None, window: TimeWindow) -> list[dict]:
    ev_qs = _filter_project(
        Event.objects.filter(
            type=EventType.PAGEVIEW, created_at__gte=window.start, created_at__lte=window.end
        ),
        project_id,
    )
    pv_counter: Counter[str] = Counter()
    uv_map: dict[str, set[str]] = defaultdict(set)
    for row in ev_qs.only("path", "visitor_id"):
        pv_counter[row.path] += 1
        uv_map[row.path].add(row.visitor_id)

    return [
        {"path": path, "pv": count, "uv": len(uv_map[path])}
        for path, count in pv_counter.most_common(20)
    ]


def get_audience(project_id: str | None, window: TimeWindow) -> dict:
    ev_qs = _filter_project(
        Event.objects.filter(
            type=EventType.PAGEVIEW, created_at__gte=window.start, created_at__lte=window.end
        ),
        project_id,
    )
    ref_pv: Counter[str] = Counter()
    ref_uv: dict[str, set[str]] = defaultdict(set)
    dims = {
        "browsers": (Counter(), defaultdict(set)),
        "systems": (Counter(), defaultdict(set)),
        "devices": (Counter(), defaultdict(set)),
    }

    for row in ev_qs.only("referrer", "browser", "os", "device", "visitor_id"):
        host = extract_referrer_host(row.referrer)
        ref_pv[host] += 1
        ref_uv[host].add(row.visitor_id)
        for key, val in (
            ("browsers", row.browser or "Other"),
            ("systems", row.os or "Other"),
            ("devices", row.device or "other"),
        ):
            dims[key][0][val] += 1
            dims[key][1][val].add(row.visitor_id)

    def _serialize_dim(counter: Counter[str], visitors: dict[str, set[str]]) -> list[dict]:
        return [
            {"name": name, "pv": count, "visitors": len(visitors[name])}
            for name, count in counter.most_common(12)
        ]

    return {
        "referrers": [
            {"name": host, "pv": count, "uv": len(ref_uv[host])}
            for host, count in ref_pv.most_common(12)
        ],
        "browsers": _serialize_dim(*dims["browsers"]),
        "systems": _serialize_dim(*dims["systems"]),
        "devices": _serialize_dim(*dims["devices"]),
    }
