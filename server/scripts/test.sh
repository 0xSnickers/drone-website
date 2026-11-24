#!/usr/bin/env bash
# Lint + 格式检查 + 测试（测试使用内存 sqlite，不需要数据库）
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v uv >/dev/null 2>&1; then
  uv run ruff check .
  uv run ruff format --check .
  uv run pytest
else
  .venv/bin/ruff check .
  .venv/bin/ruff format --check .
  .venv/bin/pytest
fi
