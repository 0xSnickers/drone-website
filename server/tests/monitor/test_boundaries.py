from ipaddress import ip_network

import pytest
from django.test import RequestFactory

from apps.auth.tokens import sign_access_token
from apps.monitor.models import Project
from apps.monitor.utils import extract_client_ip
from apps.users.models import Role

pytestmark = pytest.mark.django_db

READ_PATHS = [
    "/projects",
    "/analytics/overview",
    "/analytics/trend",
    "/analytics/pages",
    "/analytics/audience",
    "/events",
    "/events/summary",
    "/errors/issues",
    "/logs",
    "/logs/stats",
    "/logs/services",
    "/ips",
    "/ip-rules",
    "/system/status",
    "/projects/00000000-0000-0000-0000-000000000001",
    "/errors/issues/00000000-0000-0000-0000-000000000001/events",
    "/errors/issues/00000000-0000-0000-0000-000000000001",
    "/ips/127.0.0.1",
    "/users",
]


@pytest.mark.parametrize("path", READ_PATHS)
def test_public_members_cannot_read_operations(client, member_token, path):
    for headers, status, code in [
        ({}, 401, "UNAUTHORIZED"),
        ({"HTTP_AUTHORIZATION": f"Bearer {member_token}"}, 403, "FORBIDDEN"),
    ]:
        response = client.get(f"/api/v1{path}", **headers)
        assert (response.status_code, response.json()["code"]) == (status, code)


def test_viewers_can_read_but_cannot_write_or_read_user_directory(client, admin_token):
    # This role is only granted by admin, never by public registration.
    response = client.post(
        "/api/v1/users",
        {
            "name": "Observer",
            "email": "viewer@example.com",
            "password": "password123",
            "role": Role.MONITOR_VIEWER,
        },
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {admin_token}",
    )
    assert response.status_code == 201
    user = response.json()["data"]
    web_headers = {"HTTP_AUTHORIZATION": f"Bearer {sign_access_token(user['id'], user['role'])}"}
    assert client.get("/api/v1/projects", **web_headers).status_code == 403
    headers = {
        "HTTP_AUTHORIZATION": (
            f"Bearer {sign_access_token(user['id'], user['role'], audience='admin')}"
        )
    }
    project = Project.objects.create(name="Private", app_key="pk_private")
    for path in READ_PATHS[:14] + [f"/projects/{project.id}"]:
        assert client.get(f"/api/v1{path}", **headers).status_code == 200
    for method, path, body in [
        ("post", "/projects", {"name": "Forbidden"}),
        ("put", f"/projects/{project.id}", {"name": "Forbidden"}),
        ("delete", f"/projects/{project.id}", {}),
        ("post", f"/projects/{project.id}/rotate-key", {}),
        ("post", "/ip-rules", {"ip": "127.0.0.1"}),
    ]:
        result = getattr(client, method)(f"/api/v1{path}", body, format="json", **headers)
        assert (result.status_code, result.json()["code"]) == (403, "FORBIDDEN")
    assert client.get("/api/v1/users", **headers).status_code == 403


@pytest.mark.parametrize("role", ["admin", "monitor_viewer"])
def test_registration_never_grants_operational_roles(client, role):
    response = client.post(
        "/api/v1/auth/register",
        {"name": "Member", "email": "member@example.com", "password": "password123", "role": role},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["data"]["user"]["role"] == "user"


@pytest.mark.parametrize(
    "query",
    [
        "projectId=invalid",
        "range=forever",
        "page=0",
        "limit=101",
        "limit=nan",
        "sort=invalid",
        "status=invalid",
        "statusClass=9xx",
    ],
)
@pytest.mark.parametrize("path", ["/analytics/overview", "/events", "/logs/stats"])
def test_monitor_queries_return_validation_errors(client, admin_token, path, query):
    response = client.get(
        f"/api/v1{path}?{query}",
        HTTP_AUTHORIZATION=f"Bearer {admin_token}",
    )
    assert (response.status_code, response.json()["code"]) == (400, "VALIDATION_ERROR")


@pytest.mark.parametrize(
    "remote,forwarded,expected",
    [
        ("127.0.0.1", "198.51.100.99, 203.0.113.10", "203.0.113.10"),
        ("203.0.113.10", "198.51.100.99", "203.0.113.10"),
        ("127.0.0.1", "198.51.100.99, 10.0.0.2", "198.51.100.99"),
        ("::1", "2001:db8::1", "2001:db8::1"),
        ("127.0.0.1", "bad, 203.0.113.10", "127.0.0.1"),
        ("127.0.0.1", "", "127.0.0.1"),
    ],
)
def test_only_trusted_proxies_can_supply_client_ip(settings, remote, forwarded, expected):
    settings.TRUST_PROXY = True
    settings.TRUSTED_PROXY_CIDRS = [
        ip_network(v) for v in ["127.0.0.1/32", "::1/128", "10.0.0.0/24"]
    ]
    request = RequestFactory().get("/", REMOTE_ADDR=remote, HTTP_X_FORWARDED_FOR=forwarded)
    assert extract_client_ip(request) == expected
    settings.TRUST_PROXY = False
    assert extract_client_ip(request) == remote
