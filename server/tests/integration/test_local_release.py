"""Exercise real Nginx/Gunicorn cutover with disposable sources and stubbed package checks."""

import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

import pytest

ROOT = Path(__file__).resolve().parents[3]
GUNICORN = ROOT / "server/.venv/bin/gunicorn"


def executable(path, source):
    path.write_text(source)
    path.chmod(0o755)


def port_pair():
    for _ in range(20):
        with socket.socket() as first, socket.socket() as second:
            first.bind(("127.0.0.1", 0))
            port = first.getsockname()[1]
            try:
                second.bind(("127.0.0.1", port + 1))
                return port
            except OSError:
                continue
    raise RuntimeError("Cannot reserve consecutive candidate ports")


def make_source(directory, revision):
    directory.mkdir()
    for module in ["sdk", "web", "admin", "stress-test", "server"]:
        (directory / module).mkdir()
    server = directory / "server"
    (server / ".venv/bin").mkdir(parents=True)
    (server / ".venv/bin/python").symlink_to(sys.executable)
    (server / ".venv/bin/gunicorn").symlink_to(GUNICORN)
    (server / "scripts").mkdir()
    executable(server / "scripts/test.sh", "#!/bin/sh\nexit 0\n")
    (server / "manage.py").write_text("# No schema changes in this release harness.\n")
    (server / "config").mkdir()
    (server / "config/__init__.py").touch()
    (server / "config/wsgi.py").write_text(
        "def application(environ, start_response):\n"
        "    start_response('200 OK', [('Content-Type', 'application/json')])\n"
        f'    return [b\'{{"status":"ready","revision":"{revision}"}}\']\n'
    )
    for frontend in ["web", "admin"]:
        dist = directory / frontend / "dist"
        (dist / "assets").mkdir(parents=True)
        (dist / "index.html").write_text(f"<html>{revision}</html>")
        (dist / "assets" / f"app-{revision}.js").write_text(revision)


def test_cutover_retains_assets_and_rolls_back_failed_gateway_probe(tmp_path):
    nginx = shutil.which("nginx")
    curl = shutil.which("curl")
    if not nginx or not curl or not GUNICORN.exists():
        pytest.skip("Requires local Nginx, curl and server virtualenv Gunicorn")
    base = tmp_path / "deployment"
    base.mkdir()
    tools = tmp_path / "tools"
    tools.mkdir()
    for name in ["uv", "npm"]:
        executable(tools / name, "#!/bin/sh\nexit 0\n")
    failed_probe = tmp_path / "fail-probe"
    port = port_pair()
    web_port, admin_port = port_pair(), port_pair()
    executable(
        tools / "curl",
        f'#!/bin/sh\nif [ -f "{failed_probe}" ]; then\n'
        f'  case "$*" in *":{web_port}/api/ready"*) exit 22;; esac\nfi\n'
        f'exec "{curl}" "$@"\n',
    )
    env = {
        **os.environ,
        "PATH": f"{tools}:{os.environ['PATH']}",
        "DATABASE_URL": "sqlite://:memory:",
        "PORT": str(port),
        "WEB_HOST_PORT": str(web_port),
        "ADMIN_HOST_PORT": str(admin_port),
        "BIND_HOST": "127.0.0.1",
        "NGINX_BIN": nginx,
        "GUNICORN_WORKERS": "1",
        "GUNICORN_THREADS": "1",
    }

    def publish(revision):
        source = tmp_path / revision
        make_source(source, revision)
        return subprocess.run(
            ["bash", str(ROOT / "deploy/local-release.sh"), str(base), str(source), revision],
            env=env,
            capture_output=True,
            text=True,
            timeout=40,
        )

    def read(path):
        for _ in range(40):
            try:
                with urlopen(f"http://127.0.0.1:{web_port}{path}", timeout=2) as response:
                    return response.read().decode()
            except OSError:
                time.sleep(0.05)
        raise AssertionError("Gateway did not respond")

    try:
        first = publish("v1")
        assert first.returncode == 0, first.stdout + first.stderr
        assert "v1" in read("/")
        assert json.loads(read("/api/ready"))["revision"] == "v1"
        second = publish("v2")
        assert second.returncode == 0, second.stdout + second.stderr
        for _ in range(40):
            if "v2" in read("/"):
                break
            time.sleep(0.05)
        assert "v2" in read("/")
        assert read("/assets/app-v1.js") == "v1"
        assert json.loads(read("/api/v1/auth/me"))["revision"] == "v2"
        assert json.loads(read("/api/admin/auth/me"))["revision"] == "v2"
        failed_probe.touch()
        third = publish("v3")
        assert third.returncode != 0
        failed_probe.unlink()
        assert (base / "run/active-source").read_text().strip() == str(tmp_path / "v2")
        for _ in range(40):
            if "v2" in read("/"):
                break
            time.sleep(0.05)
        assert "v2" in read("/")
        assert json.loads(read("/api/ready"))["revision"] == "v2"
    finally:
        for pid_file in (base / "run").glob("*.pid"):
            try:
                os.kill(int(pid_file.read_text()), signal.SIGTERM)
            except (OSError, ValueError):
                pass
