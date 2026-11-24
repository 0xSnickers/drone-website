#!/usr/bin/env bash
# 首次安装：复制 .env、创建 .venv 并安装依赖（优先 uv，未安装 uv 时回落 python3 -m venv + pip）
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { cp .env.example .env; echo "created .env from .env.example"; }

if command -v uv >/dev/null 2>&1; then
  uv sync
else
  echo "uv not found; falling back to python3 -m venv .venv + pip"
  [ -d .venv ] || python3 -m venv .venv
  DEPS="$(python3 -c 'import tomllib; d = tomllib.load(open("pyproject.toml", "rb")); print("\n".join(d["project"]["dependencies"] + d.get("dependency-groups", {}).get("dev", [])))')"
  echo "$DEPS" | xargs -d '\n' .venv/bin/pip install --upgrade
fi
