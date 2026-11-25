"""Release history and stress-test run persistence + local report auto-sync."""

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings
from django.utils.dateparse import parse_datetime

from apps.core.exceptions import AppError

from ..models import ReleaseRecord, StressRunRecord

logger = logging.getLogger(__name__)


def _reports_dir() -> Path:
    configured = os.getenv("STRESS_REPORTS_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path(settings.BASE_DIR).parent / "stress-test" / "reports"


def serialize_release(row: ReleaseRecord) -> dict:
    return {
        "id": str(row.id),
        "version": row.version,
        "environment": row.environment,
        "commitSha": row.commit_sha,
        "branch": row.branch,
        "status": row.status,
        "triggeredBy": row.triggered_by,
        "notes": row.notes,
        "ciSummary": row.ci_summary or {},
        "deployedAt": row.deployed_at.isoformat(),
    }


def serialize_stress_run(row: StressRunRecord, *, include_detail: bool = False) -> dict:
    base = {
        "id": str(row.id),
        "runId": row.run_id,
        "releaseVersion": row.release_version,
        "profile": row.profile,
        "profileLabel": row.profile_label or row.profile,
        "suite": row.suite,
        "passed": row.passed,
        "durationSec": round(row.duration_sec, 2),
        "totalRequests": row.total_requests,
        "overallRps": round(row.overall_rps, 2),
        "errorRate": round(row.error_rate, 4),
        "passedScenarios": row.passed_scenarios,
        "totalScenarios": row.total_scenarios,
        "startedAt": row.started_at.isoformat(),
    }
    if include_detail:
        base.update(
            {
                "httpScenarios": row.http_scenarios or [],
                "browserScenarios": row.browser_scenarios or [],
                "recommendations": row.recommendations or [],
                "environment": row.environment or {},
            }
        )
    return base


def _extract_http_scenario(item: dict) -> dict:
    lat = item.get("latency") or {}
    return {
        "id": str(item.get("id", "")),
        "name": str(item.get("name", "")),
        "category": str(item.get("category", "")),
        "peakConcurrency": int(item.get("peakConcurrency", 0)),
        "totalRequests": int(item.get("totalRequests", 0)),
        "successRequests": int(item.get("successRequests", 0)),
        "rateLimitedRequests": int(item.get("rateLimitedRequests", 0)),
        "failedRequests": int(item.get("failedRequests", 0)),
        "rps": round(float(item.get("rps", 0)), 2),
        "successRps": round(float(item.get("successRps", 0)), 2),
        "errorRate": round(float(item.get("errorRate", 0)), 4),
        "p50": round(float(lat.get("p50", 0)), 2),
        "p95": round(float(lat.get("p95", 0)), 2),
        "p99": round(float(lat.get("p99", 0)), 2),
        "passed": bool(item.get("passed", False)),
    }


def _extract_browser_scenario(item: dict) -> dict:
    return {
        "id": str(item.get("id", "")),
        "name": str(item.get("name", "")),
        "driver": str(item.get("driver", "")),
        "concurrency": int(item.get("concurrency", 0)),
        "navigations": int(item.get("navigations", 0)),
        "failedNavigations": int(item.get("failedNavigations", 0)),
        "fcpP95": round(float((item.get("fcp") or {}).get("p95", 0)), 2),
        "lcpP95": round(float((item.get("lcp") or {}).get("p95", 0)), 2),
        "loadP95": round(float((item.get("load") or {}).get("p95", 0)), 2),
        "jsErrors": int(item.get("jsErrors", 0)),
        "passed": bool(item.get("passed", False)),
    }


def upsert_stress_report_payload(payload: dict) -> StressRunRecord | None:
    run_id = str(payload.get("runId") or "").strip()
    if not run_id:
        return None
    profile_obj = payload.get("profile")
    if isinstance(profile_obj, dict):
        profile_name = str(profile_obj.get("name", "l1-baseline"))
        profile_label = str(profile_obj.get("label", profile_name))
    else:
        profile_name = str(profile_obj or "l1-baseline")
        profile_label = str(payload.get("profileLabel") or profile_name)

    summary = payload.get("summary") or {}
    http_raw = payload.get("httpScenarios") or []
    browser_raw = payload.get("browserScenarios") or []
    http_list = [_extract_http_scenario(s) for s in http_raw if isinstance(s, dict)]
    browser_list = [_extract_browser_scenario(s) for s in browser_raw if isinstance(s, dict)]

    passed_count = int(
        summary.get(
            "passedScenarios",
            sum(1 for s in http_list if s["passed"]) + sum(1 for s in browser_list if s["passed"]),
        )
    )
    total_count = int(summary.get("totalScenarios", len(http_list) + len(browser_list)))
    started_raw = payload.get("generatedAt") or payload.get("startedAt")
    started_at = (parse_datetime(str(started_raw)) if started_raw else None) or datetime.now(UTC)

    row, _ = StressRunRecord.objects.update_or_create(
        run_id=run_id,
        defaults={
            "release_version": str(payload.get("releaseVersion") or ""),
            "profile": profile_name[:40],
            "profile_label": profile_label[:80],
            "suite": str(payload.get("suite") or "all")[:32],
            "passed": bool(summary.get("overallPassed", payload.get("passed", False))),
            "duration_sec": float(payload.get("durationSec", 0.0)),
            "total_requests": int(
                summary.get("totalHttpRequests", payload.get("totalRequests", 0))
            ),
            "overall_rps": float(summary.get("overallRps", payload.get("overallRps", 0.0))),
            "error_rate": float(summary.get("overallErrorRate", payload.get("errorRate", 0.0))),
            "passed_scenarios": passed_count,
            "total_scenarios": total_count,
            "http_scenarios": http_list,
            "browser_scenarios": browser_list,
            "recommendations": [str(r) for r in (payload.get("recommendations") or [])[:20]],
            "environment": payload.get("environment") or {},
            "started_at": started_at,
        },
    )
    return row


def sync_local_stress_reports() -> int:
    """Import any stress-*.json reports found in stress-test/reports/ idempotently."""
    directory = _reports_dir()
    if not directory.is_dir():
        return 0
    existing = set(StressRunRecord.objects.values_list("run_id", flat=True))
    imported = 0
    for path in sorted(directory.glob("stress-*.json"))[-30:]:
        run_id = path.stem
        if run_id in existing:
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and upsert_stress_report_payload(payload) is not None:
                imported += 1
        except Exception:
            logger.debug("skipping unreadable stress report %s", path)
    return imported


def list_releases(page: int, limit: int) -> tuple[list[dict], int]:
    qs = ReleaseRecord.objects.all()
    total = qs.count()
    offset = (page - 1) * limit
    items = [serialize_release(r) for r in qs[offset : offset + limit]]
    return items, total


def create_release(data: dict, triggered_by: str) -> dict:
    row = ReleaseRecord.objects.create(
        version=str(data["version"]).strip(),
        environment=str(data.get("environment") or "production").strip(),
        commit_sha=str(data.get("commitSha") or "").strip(),
        branch=str(data.get("branch") or "main").strip(),
        status=str(data.get("status") or "success").strip(),
        triggered_by=str(data.get("triggeredBy") or triggered_by or "admin").strip(),
        notes=str(data.get("notes") or "").strip(),
        ci_summary=data.get("ciSummary") or {},
    )
    return serialize_release(row)


def delete_release(release_id) -> dict:
    row = ReleaseRecord.objects.filter(pk=release_id).first()
    if row is None:
        raise AppError.not_found("RELEASE_NOT_FOUND", "Release record not found")
    rid = str(row.id)
    row.delete()
    return {"id": rid}


def list_stress_runs(page: int, limit: int) -> tuple[list[dict], int]:
    sync_local_stress_reports()
    qs = StressRunRecord.objects.all()
    total = qs.count()
    offset = (page - 1) * limit
    items = [serialize_stress_run(r) for r in qs[offset : offset + limit]]
    return items, total


def get_stress_run_detail(run_id: str) -> dict:
    sync_local_stress_reports()
    row = StressRunRecord.objects.filter(run_id=run_id).first()
    if row is None:
        raise AppError.not_found("STRESS_RUN_NOT_FOUND", "Stress run not found")
    return serialize_stress_run(row, include_detail=True)


def seed_initial_release() -> None:
    if ReleaseRecord.objects.exists():
        return
    ReleaseRecord.objects.create(
        version="v1.0.0",
        environment="production",
        commit_sha=os.getenv("VITE_APP_RELEASE", "local-dev")[:12] or "local-dev",
        branch="main",
        status="success",
        triggered_by="demo@example.com",
        notes="双端 JWT 隔离鉴权、管理端用户管理、SQLite WAL/单飞缓存与全栈监控中心上线。",
        ci_summary={
            "sdk": "pass",
            "web": "pass",
            "admin": "pass",
            "server": "pass",
            "stressTest": "pass",
            "contract": "pass",
        },
    )
