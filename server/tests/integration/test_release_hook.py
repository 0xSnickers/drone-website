"""Verify exact-commit isolation, including repeated deployment of the same revision."""

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_local_hook_pins_revision_without_reusing_live_source(tmp_path):
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    base = tmp_path / "deployment"
    base.mkdir()
    bare = base / "repo.git"

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=checkout, text=True).strip()

    git("init", "-b", "main")
    (checkout / "deploy").mkdir()
    (checkout / "deploy/local-release.sh").write_text(
        '#!/bin/sh\nprintf "%s\\n" "$2" >> "$1/observed"\ncat "$2/payload" >> "$1/payloads"\n'
    )
    (checkout / "payload").write_text("first\n")
    git("add", ".")
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "first")
    first = git("rev-parse", "HEAD")
    (checkout / "payload").write_text("second\n")
    git("add", ".")
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "second")
    git("clone", "--bare", str(checkout), str(bare))
    (base / ".env.prod").write_text("DEPLOY_MODE=local\n")
    (base / "work").mkdir()
    live = base / "work/live-marker"
    live.write_text("online source must stay unchanged")
    for _ in range(2):
        result = subprocess.run(
            ["bash", str(ROOT / "deploy/post-receive.sh")],
            input=f"{'0' * 40} {first} refs/heads/main\n",
            text=True,
            env={**os.environ, "DRONE_DEPLOY_BASE": str(base)},
            capture_output=True,
            timeout=10,
        )
        assert result.returncode == 0, result.stdout + result.stderr
    sources = (base / "observed").read_text().splitlines()
    assert len(set(sources)) == 2
    assert (base / "payloads").read_text().splitlines() == ["first", "first"]
    assert all(first in source for source in sources)
    assert live.read_text() == "online source must stay unchanged"
