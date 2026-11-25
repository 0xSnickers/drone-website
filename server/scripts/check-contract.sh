#!/usr/bin/env bash
# Start a disposable server/database; never reuse the developer's database or listener.
set -euo pipefail
cd "$(dirname "$0")/.."
TEMP_DIR="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
export DJANGO_DEBUG=true DJANGO_SECRET_KEY=contract-only-secret
export JWT_SECRET=contract-only-secret-at-least-32-characters
export DATABASE_URL="${CONTRACT_DATABASE_URL:-sqlite:///$TEMP_DIR/contracts.sqlite3}"
export SEED_DEMO_USER=true SEED_DEMO_DATA=false SELF_LOG_ENABLED=false
export COOKIE_SECURE=false REDIS_URL= INGEST_MODE=direct LOG_FILE=
CONTRACT_PORT="${CONTRACT_PORT:-$(.venv/bin/python -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')}"
.venv/bin/python manage.py migrate --noinput >/dev/null
.venv/bin/gunicorn config.wsgi:application --bind "127.0.0.1:$CONTRACT_PORT" --workers 1 >"$TEMP_DIR/server.log" 2>&1 &
SERVER_PID=$!
ready=false
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$CONTRACT_PORT/api/ready" >/dev/null 2>&1; then ready=true; break; fi
  sleep 0.2
done
if [ "$ready" != true ]; then cat "$TEMP_DIR/server.log"; exit 1; fi
BASE_URL="http://127.0.0.1:$CONTRACT_PORT" node scripts/contract-test.mjs
