"""Non-blocking host CPU/memory/load sampling, stress heartbeat reader, and bottleneck evaluator."""

import json
import os
import threading
import time
from pathlib import Path

from django.conf import settings

_CPU_LOCK = threading.Lock()
_PREV_CPU_TICKS: tuple[int, int] | None = None
_LAST_CPU_PCT: float = 0.0
_LAST_CPU_TS: float = 0.0


def _read_proc_cpu_ticks() -> tuple[int, int] | None:
    try:
        with open("/proc/stat", encoding="utf-8") as fp:
            first = fp.readline()
        parts = first.split()
        if not parts or parts[0] != "cpu":
            return None
        nums = [int(v) for v in parts[1:]]
        idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
        total = sum(nums)
        return idle, total
    except OSError:
        return None


def sample_host_resources() -> dict:
    global _PREV_CPU_TICKS, _LAST_CPU_PCT, _LAST_CPU_TS
    cores = os.cpu_count() or 1
    try:
        load_1m = round(os.getloadavg()[0], 2)
    except OSError:
        load_1m = 0.0
    load_ratio = round(load_1m / max(1, cores), 2)

    now = time.monotonic()
    ticks = _read_proc_cpu_ticks()
    with _CPU_LOCK:
        if ticks is not None:
            if _PREV_CPU_TICKS is not None and (now - _LAST_CPU_TS) >= 0.25:
                idle_delta = ticks[0] - _PREV_CPU_TICKS[0]
                total_delta = ticks[1] - _PREV_CPU_TICKS[1]
                if total_delta > 0:
                    _LAST_CPU_PCT = round(
                        max(0.0, min(100.0, (1.0 - idle_delta / total_delta) * 100.0)), 1
                    )
                _PREV_CPU_TICKS = ticks
                _LAST_CPU_TS = now
            elif _PREV_CPU_TICKS is None:
                _PREV_CPU_TICKS = ticks
                _LAST_CPU_TS = now
                _LAST_CPU_PCT = round(min(100.0, load_ratio * 100.0), 1)
            cpu_pct = _LAST_CPU_PCT
        else:
            cpu_pct = round(min(100.0, load_ratio * 100.0), 1)

    mem_total_gb, mem_used_gb, mem_pct = _read_memory_info()
    return {
        "cpuCores": cores,
        "cpuPercent": cpu_pct,
        "loadAvg1m": load_1m,
        "loadRatio": load_ratio,
        "memUsedGb": mem_used_gb,
        "memTotalGb": mem_total_gb,
        "memPercent": mem_pct,
    }


def _read_memory_info() -> tuple[float, float, float]:
    try:
        info: dict[str, int] = {}
        with open("/proc/meminfo", encoding="utf-8") as fp:
            for line in fp:
                if ":" not in line:
                    continue
                k, v = line.split(":", 1)
                parts = v.strip().split()
                if parts and parts[0].isdigit():
                    info[k] = int(parts[0])
        total_kb = info.get("MemTotal", 0)
        avail_kb = info.get("MemAvailable", info.get("MemFree", 0))
        if total_kb > 0:
            used_kb = max(0, total_kb - avail_kb)
            total_gb = round(total_kb / (1024 * 1024), 2)
            used_gb = round(used_kb / (1024 * 1024), 2)
            pct = round((used_kb / total_kb) * 100.0, 1)
            return total_gb, used_gb, pct
    except OSError:
        pass
    return 0.0, 0.0, 0.0


def read_stress_test_state(stress_traffic_active: bool) -> dict:
    repo_root = Path(settings.BASE_DIR).parent
    reports_dir = repo_root / "stress-test" / "reports"
    active_file = reports_dir / ".active-run.json"

    active_payload: dict | None = None
    if active_file.is_file():
        try:
            raw = json.loads(active_file.read_text(encoding="utf-8"))
            updated_ms = float(raw.get("updatedAtMs", 0))
            if raw.get("active") is True and (time.time() * 1000 - updated_ms) <= 20_000:
                active_payload = raw
        except (OSError, ValueError, TypeError):
            active_payload = None

    last_report = _read_latest_report_summary(reports_dir)
    is_active = bool(active_payload) or stress_traffic_active

    return {
        "active": is_active,
        "runId": active_payload.get("runId") if active_payload else None,
        "profile": active_payload.get("profile") if active_payload else None,
        "suite": active_payload.get("suite") if active_payload else None,
        "currentScenario": active_payload.get("currentScenario") if active_payload else None,
        "concurrency": int(active_payload.get("concurrency", 0)) if active_payload else 0,
        "startedAt": active_payload.get("startedAt") if active_payload else None,
        "lastReport": last_report,
    }


def _read_latest_report_summary(reports_dir: Path) -> dict | None:
    candidates = [
        reports_dir / "latest.json",
        reports_dir / "staging-gateway" / "latest.json",
        reports_dir / "local" / "latest.json",
    ]
    existing = [p for p in candidates if p.is_file()]
    if not existing:
        return None
    newest = max(existing, key=lambda p: p.stat().st_mtime)
    try:
        data = json.loads(newest.read_text(encoding="utf-8"))
        summary = data.get("summary") or {}
        profile = data.get("profile") or {}
        return {
            "runId": data.get("runId"),
            "generatedAt": data.get("generatedAt"),
            "profile": profile.get("name") if isinstance(profile, dict) else str(profile),
            "overallRps": float(summary.get("overallHttpRps", 0)),
            "errorRate": float(summary.get("overallHttpErrorRate", 0)),
            "overallPassed": bool(summary.get("overallPassed", False)),
        }
    except (OSError, ValueError, TypeError):
        return None


def evaluate_bottleneck(
    *,
    db_engine: str,
    db_ok: bool,
    db_latency_ms: float,
    queue_backlog: int,
    host: dict,
    traffic: dict,
) -> dict:
    # 单机经验参考水位（用于看板余量提示，非承载承诺）：PostgreSQL 220 req/s；SQLite 并发写 30 req/s
    safe_rps = 220.0 if db_engine == "postgresql" else 30.0
    current_rps = float(traffic["currentRps"])
    capacity_pct = round(min(100.0, (current_rps / safe_rps) * 100.0), 1)

    cpu_pct = float(host["cpuPercent"])
    load_ratio = float(host["loadRatio"])
    mem_pct = float(host["memPercent"])
    p95_ms = float(traffic["p95LatencyMs"])
    requests_1m = int(traffic.get("requests1m", 0))
    err_5xx = int(traffic["error5xx1m"])
    enough_latency_samples = requests_1m >= 20

    peak_saturation = max(cpu_pct, min(100.0, load_ratio * 100.0), mem_pct, capacity_pct)
    headroom_pct = round(max(0.0, 100.0 - peak_saturation), 1)

    level = "healthy"
    factor = "none"

    if not db_ok or (db_engine == "sqlite" and err_5xx > 0):
        level, factor = "critical", "database_lock"
    elif err_5xx >= 5:
        level, factor = "critical", "server_errors"
    elif cpu_pct >= 85.0 or load_ratio >= 1.0:
        level, factor = "critical", "cpu"
    elif mem_pct >= 90.0:
        level, factor = "critical", "memory"
    elif (enough_latency_samples and p95_ms >= 1000.0) or p95_ms >= 3000.0:
        level, factor = "critical", "latency"
    elif queue_backlog >= 10_000:
        level, factor = "critical", "queue_backlog"
    elif cpu_pct >= 68.0 or load_ratio >= 0.75:
        level, factor = "approaching", "cpu"
    elif mem_pct >= 80.0:
        level, factor = "approaching", "memory"
    elif db_engine == "sqlite" and current_rps >= 15.0:
        level, factor = "approaching", "sqlite_concurrency"
    elif (enough_latency_samples and p95_ms >= 400.0) or db_latency_ms >= 50.0:
        level, factor = "approaching", "latency"
    elif queue_backlog >= 1000:
        level, factor = "approaching", "queue_backlog"
    elif capacity_pct >= 75.0:
        level, factor = "approaching", "throughput"

    return {
        "level": level,
        "primaryFactor": factor,
        "safeRpsBaseline": safe_rps,
        "capacityPercent": capacity_pct,
        "headroomPercent": headroom_pct,
    }
