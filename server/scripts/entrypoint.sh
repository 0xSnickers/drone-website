#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-web}"

case "$ROLE" in
  migrate)
    exec uv run --no-dev python manage.py migrate --noinput
    ;;
  worker)
    exec uv run --no-dev python manage.py run_ingest_worker
    ;;
  web)
    if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
      uv run --no-dev python manage.py migrate --noinput
    fi
    exec uv run --no-dev gunicorn config.wsgi:application \
      --bind "0.0.0.0:${PORT:-9000}" \
      --workers "${GUNICORN_WORKERS:-2}" \
      --threads "${GUNICORN_THREADS:-2}" \
      --timeout "${GUNICORN_TIMEOUT:-30}" \
      --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-15}" \
      --access-logfile -
    ;;
  *)
    exec "$@"
    ;;
esac
