#!/usr/bin/env bash
# 一键无痛迁移本地 SQLite 数据到 PostgreSQL（含自动备份 + 建表 + 批量迁移 + 行数核验）
# 用法：
#   ./scripts/migrate-to-pg.sh postgresql://app:password@localhost:5432/drone_website_server
#   ./scripts/migrate-to-pg.sh postgresql://... --dry-run
#   ./scripts/migrate-to-pg.sh postgresql://... --skip-telemetry
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET_URL="${1:-${TARGET_DATABASE_URL:-}}"
if [ -z "$TARGET_URL" ]; then
  echo "Usage: $0 <postgresql://user:pass@host:5432/dbname> [extra manage.py flags]" >&2
  exit 1
fi
shift || true

run_py() {
  if command -v uv >/dev/null 2>&1; then
    uv run python "$@"
  else
    .venv/bin/python "$@"
  fi
}

SQLITE_FILE="$(pwd)/db.sqlite3"
if [ ! -f "$SQLITE_FILE" ]; then
  echo "Source SQLite file not found: $SQLITE_FILE" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups

if [[ " $* " != *" --dry-run "* ]]; then
  cp "$SQLITE_FILE" "backups/db.sqlite3.${STAMP}.bak"
  echo "Backed up SQLite -> backups/db.sqlite3.${STAMP}.bak"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$TARGET_URL" > "backups/pg-pre-migrate.${STAMP}.sql" 2>/dev/null || rm -f "backups/pg-pre-migrate.${STAMP}.sql"
  fi
fi

run_py manage.py migrate_to_postgres \
  --source "sqlite:///${SQLITE_FILE}" \
  --target "$TARGET_URL" \
  "$@"
