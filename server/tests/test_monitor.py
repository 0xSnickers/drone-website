import pytest


@pytest.fixture
def admin_headers(admin_token):
    return {"HTTP_AUTHORIZATION": f"Bearer {admin_token}"}


@pytest.mark.django_db
def test_project_crud_and_rotate_key(client, admin_headers):
    res = client.post(
        "/api/v1/projects",
        {"name": "AeroApex Web", "description": "Main drone site"},
        content_type="application/json",
        **admin_headers,
    )
    assert res.status_code == 201
    project = res.json()["data"]
    assert project["name"] == "AeroApex Web"
    assert project["appKey"].startswith("pk_")

    rotated = client.post(
        f"/api/v1/projects/{project['id']}/rotate-key",
        content_type="application/json",
        **admin_headers,
    )
    assert rotated.status_code == 201
    assert rotated.json()["data"]["appKey"] != project["appKey"]

    listed = client.get("/api/v1/projects", **admin_headers)
    assert listed.status_code == 200
    assert listed.json()["data"]["pagination"]["total"] >= 1


@pytest.mark.django_db
def test_ingest_events_errors_analytics_and_ip_block(client, admin_headers):
    created = client.post(
        "/api/v1/projects",
        {"name": "Telemetry Site"},
        content_type="application/json",
        **admin_headers,
    ).json()["data"]
    app_key = created["appKey"]
    project_id = created["id"]

    # Reject invalid appKey
    bad = client.post(
        "/api/v1/ingest/events",
        {"appKey": "pk_invalid", "events": [{"type": "pageview", "url": "http://localhost/"}]},
        content_type="application/json",
    )
    assert bad.status_code == 401
    assert bad.json()["code"] == "INVALID_APP_KEY"

    # Ingest pageview + track + error
    ok_res = client.post(
        "/api/v1/ingest/events",
        {
            "appKey": app_key,
            "events": [
                {
                    "type": "pageview",
                    "name": "pageview",
                    "url": "http://localhost:5173/flagship",
                    "visitorId": "v1",
                    "sessionId": "s1",
                },
                {
                    "type": "track",
                    "name": "preorder_click",
                    "url": "http://localhost:5173/flagship",
                    "visitorId": "v1",
                    "sessionId": "s1",
                },
                {
                    "type": "error",
                    "name": "TypeError",
                    "url": "http://localhost:5173/store",
                    "visitorId": "v1",
                    "sessionId": "s1",
                    "error": {
                        "type": "js",
                        "message": "Cannot read property 123",
                        "stack": "TypeError: err\n  at app.js:10:2",
                    },
                },
            ],
        },
        content_type="application/json",
    )
    assert ok_res.status_code == 200
    assert ok_res.json()["data"]["accepted"] == 3

    # Browser monitor-sdk sends JSON payload with text/plain Content-Type (sendBeacon / CORS-free)
    beacon_res = client.post(
        "/api/v1/ingest/events",
        f'{{"appKey":"{app_key}","events":[{{"type":"pageview","url":"http://localhost:5174/"}}]}}',
        content_type="text/plain;charset=UTF-8",
    )
    assert beacon_res.status_code == 200
    assert beacon_res.json()["data"]["accepted"] == 1

    overview = client.get(f"/api/v1/analytics/overview?projectId={project_id}", **admin_headers)
    assert overview.status_code == 200
    assert overview.json()["data"]["current"]["pv"] == 2
    assert overview.json()["data"]["current"]["errors"] == 1

    issues = client.get(f"/api/v1/errors/issues?projectId={project_id}", **admin_headers)
    assert issues.status_code == 200
    assert len(issues.json()["data"]["items"]) == 1

    # Block IP and verify 403 IP_BLOCKED
    rule = client.post(
        "/api/v1/ip-rules",
        {"ip": "127.0.0.1", "note": "test block"},
        content_type="application/json",
        **admin_headers,
    )
    assert rule.status_code == 201
    blocked = client.post(
        "/api/v1/ingest/events",
        {"appKey": app_key, "events": [{"type": "pageview", "url": "http://localhost/"}]},
        content_type="application/json",
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "IP_BLOCKED"


@pytest.mark.django_db
def test_releases_and_stress_runs_crud(client, admin_headers):
    rel = client.post(
        "/api/v1/releases",
        {
            "version": "v1.2.0",
            "environment": "production",
            "branch": "main",
            "commitSha": "abc12345",
            "status": "success",
            "notes": "Shipped ops center",
        },
        content_type="application/json",
        **admin_headers,
    )
    assert rel.status_code == 201
    rel_id = rel.json()["data"]["id"]

    listed = client.get("/api/v1/releases", **admin_headers)
    assert listed.status_code == 200
    assert listed.json()["data"]["items"][0]["version"] == "v1.2.0"

    run = client.post(
        "/api/v1/stress-runs",
        {
            "runId": "stress-test-001",
            "suite": "backend",
            "durationSec": 12.5,
            "profile": {"name": "l1-baseline", "label": "L1 起步期基线"},
            "summary": {
                "overallPassed": True,
                "totalHttpRequests": 1000,
                "overallRps": 80.0,
                "overallErrorRate": 0.0,
                "passedScenarios": 4,
                "totalScenarios": 4,
            },
            "httpScenarios": [
                {
                    "id": "ops",
                    "name": "Probes",
                    "totalRequests": 1000,
                    "successRequests": 1000,
                    "rps": 80.0,
                    "successRps": 80.0,
                    "latency": {"p50": 10, "p95": 20, "p99": 30},
                    "passed": True,
                }
            ],
            "recommendations": ["All healthy"],
        },
        content_type="application/json",
        **admin_headers,
    )
    assert run.status_code == 201
    detail = client.get("/api/v1/stress-runs/stress-test-001", **admin_headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["passed"] is True
    assert len(detail.json()["data"]["httpScenarios"]) == 1

    deleted = client.delete(f"/api/v1/releases/{rel_id}", **admin_headers)
    assert deleted.status_code == 200
