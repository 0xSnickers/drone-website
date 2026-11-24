#!/usr/bin/env bash
# 数据库：./scripts/db.sh up|down|migrate|makemigrations
set -euo pipefail
cd "$(dirname "$0")/.."

run_py() {
  if command -v uv >/dev/null 2>&1; then
    uv run python "$@"
  else
    .venv/bin/python "$@"
  fi
}

case "${1:-up}" in
  up)
    docker compose up -d --wait postgres
    run_py manage.py migrate
    ;;
  down) docker compose down ;;
  migrate) run_py manage.py migrate ;;
  makemigrations) run_py manage.py makemigrations ;;
  *) echo "usage: $0 up|down|migrate|makemigrations" >&2; exit 1 ;;
esac
