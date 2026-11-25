import hashlib
import json
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from ipaddress import ip_address
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings

_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
_URL_RE = re.compile(r"https?://\S+", re.I)
_QUOTE_RE = re.compile(r'(["\'])(?:(?=(\\?))\2.)*?\1')
_NUM_RE = re.compile(r"\b\d+\b")
_LINE_COL_RE = re.compile(r":\d+(?::\d+)?")


def generate_app_key() -> str:
    return f"pk_{secrets.token_hex(16)}"


def truncate_str(value: str | None, max_len: int) -> str:
    if not value:
        return ""
    return value[:max_len]


def safe_json_payload(value: object, max_bytes: int = 4096) -> object:
    if not isinstance(value, (dict, list)):
        return {} if not isinstance(value, list) else []
    try:
        raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError):
        return {"_truncated": True}
    if len(raw) > max_bytes:
        return {"_truncated": True}
    return value


def extract_client_ip(request) -> str:
    remote = request.META.get("REMOTE_ADDR", "127.0.0.1")
    if not getattr(settings, "TRUST_PROXY", False):
        return truncate_str(remote, 64)
    try:
        peer = ip_address(remote)
        trusted = getattr(settings, "TRUSTED_PROXY_CIDRS", [])
        if not any(peer in network for network in trusted):
            return str(peer)
        forwarded = request.headers.get("X-Forwarded-For", "")
        if not forwarded or len(forwarded) > 2048:
            return str(peer)
        chain = [ip_address(value.strip()) for value in forwarded.split(",")]
        for candidate in reversed(chain):
            peer = candidate
            if not any(peer in network for network in trusted):
                break
        return str(peer)
    except ValueError:
        return truncate_str(remote, 64)


def parse_user_agent(ua: str | None) -> tuple[str, str, str]:
    raw = (ua or "").lower()
    if "edg/" in raw or "edge/" in raw:
        browser = "Edge"
    elif "firefox/" in raw:
        browser = "Firefox"
    elif "chrome/" in raw and "safari/" in raw:
        browser = "Chrome"
    elif "safari/" in raw:
        browser = "Safari"
    else:
        browser = "Other"

    if "iphone" in raw or "ipad" in raw or "ios" in raw:
        os_name = "iOS"
    elif "android" in raw:
        os_name = "Android"
    elif "mac os" in raw or "macintosh" in raw:
        os_name = "macOS"
    elif "windows" in raw:
        os_name = "Windows"
    elif "linux" in raw:
        os_name = "Linux"
    else:
        os_name = "Other"

    if "ipad" in raw or "tablet" in raw:
        device = "tablet"
    elif "mobile" in raw or "iphone" in raw or "android" in raw:
        device = "mobile"
    elif not raw:
        device = "other"
    else:
        device = "desktop"

    return browser, os_name, device


def extract_path(url: str) -> str:
    try:
        parsed = urlparse(url)
        return truncate_str(parsed.path or "/", 512)
    except ValueError:
        return "/"


def extract_referrer_host(referrer: str) -> str:
    if not referrer:
        return "Direct"
    try:
        host = urlparse(referrer).netloc
        return host or "Direct"
    except ValueError:
        return "Direct"


def compute_error_fingerprint(err_type: str, message: str, stack: str) -> str:
    norm_msg = _URL_RE.sub("<url>", message)
    norm_msg = _UUID_RE.sub("<uuid>", norm_msg)
    norm_msg = _QUOTE_RE.sub('"<str>"', norm_msg)
    norm_msg = _NUM_RE.sub("<n>", norm_msg).strip()
    first_frame = ""
    for line in (stack or "").splitlines():
        cleaned = line.strip()
        if cleaned and not cleaned.startswith(err_type):
            first_frame = _LINE_COL_RE.sub("", cleaned)
            break
    digest = hashlib.sha256(f"{err_type}|{norm_msg}|{first_frame}".encode()).hexdigest()
    return digest[:32]


def check_ingest_rate_limit(ip: str) -> bool:
    from .services.resilience import check_rate_limit_resilient

    return check_rate_limit_resilient(ip)


def parse_json_body(request) -> dict:
    data = request.data
    if isinstance(data, dict):
        return data
    raw = (
        data.strip()
        if isinstance(data, str)
        else request.body.decode("utf-8", errors="replace").strip()
    )
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


@dataclass(frozen=True)
class TimeWindow:
    start: datetime
    end: datetime
    prev_start: datetime
    bucket: str  # "minute" | "hour" | "day"
    tz: ZoneInfo


def resolve_time_window(range_str: str | None, tz_name: str | None) -> TimeWindow:
    now = datetime.now(UTC)
    key = (range_str or "24h").lower()
    if key == "1h":
        delta, bucket = timedelta(hours=1), "minute"
    elif key == "7d":
        delta, bucket = timedelta(days=7), "day"
    elif key == "30d":
        delta, bucket = timedelta(days=30), "day"
    else:
        delta, bucket = timedelta(hours=24), "hour"

    try:
        tz = ZoneInfo(tz_name) if tz_name else ZoneInfo("UTC")
    except (ZoneInfoNotFoundError, KeyError, ValueError):
        tz = ZoneInfo("UTC")

    start = now - delta
    return TimeWindow(start=start, end=now, prev_start=start - delta, bucket=bucket, tz=tz)


def floor_to_bucket(dt: datetime, bucket: str, tz: ZoneInfo) -> datetime:
    local = dt.astimezone(tz)
    if bucket == "minute":
        floored = local.replace(second=0, microsecond=0)
    elif bucket == "hour":
        floored = local.replace(minute=0, second=0, microsecond=0)
    else:
        floored = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return floored.astimezone(UTC)


def iter_buckets(window: TimeWindow) -> list[datetime]:
    step = (
        timedelta(minutes=1)
        if window.bucket == "minute"
        else timedelta(hours=1)
        if window.bucket == "hour"
        else timedelta(days=1)
    )
    cursor = floor_to_bucket(window.start, window.bucket, window.tz)
    end_bucket = floor_to_bucket(window.end, window.bucket, window.tz)
    buckets: list[datetime] = []
    while cursor <= end_bucket:
        buckets.append(cursor)
        cursor += step
    return buckets


def iso_utc(dt: datetime | None) -> str:
    if dt is None:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_pagination(params, default_limit: int = 20) -> tuple[int, int]:
    from .serializers import MonitorQuerySerializer

    serializer = MonitorQuerySerializer(data={"limit": default_limit, **dict(params.items())})
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data["page"], serializer.validated_data["limit"]
