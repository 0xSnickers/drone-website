#!/usr/bin/env bash
# Called by post-receive with an immutable source directory and exported production env.
set -euo pipefail
BASE_DIR="${1:?base directory required}"
SOURCE_DIR="${2:?immutable source directory required}"
REVISION="${3:?revision required}"
: "${DATABASE_URL:?local releases require an explicit persistent DATABASE_URL}"

echo '===> Install locked dependencies and run all five module checks'
(cd "$SOURCE_DIR/server" && uv sync --frozen && ./scripts/test.sh)
for module in sdk web admin stress-test; do
  (cd "$SOURCE_DIR/$module" && npm ci && npm run check)
done

RUN_DIR="$BASE_DIR/run"
mkdir -p "$RUN_DIR" "$BASE_DIR/assets/web" "$BASE_DIR/assets/admin"
BASE_PORT="${PORT:-19100}"
ACTIVE_PORT="$BASE_PORT"
if [ -s "$RUN_DIR/active-port" ]; then ACTIVE_PORT="$(cat "$RUN_DIR/active-port")"; fi
NEXT_PORT="$BASE_PORT"
if [ "$ACTIVE_PORT" = "$BASE_PORT" ]; then NEXT_PORT="$((BASE_PORT + 1))"; fi
NEXT_PID="$RUN_DIR/gunicorn-$NEXT_PORT.pid"
NGINX_BIN="${NGINX_BIN:-/usr/sbin/nginx}"
WEB_PORT="${WEB_HOST_PORT:-18080}"
ADMIN_PORT="${ADMIN_HOST_PORT:-18081}"
BIND_HOST="${BIND_HOST:-0.0.0.0}"
SWITCHED=false
COMMITTED=false
STARTED_NGINX=false
STARTED_CANDIDATE=false
PREVIOUS_REVISION=""
if [ -s "$RUN_DIR/active-revision" ]; then PREVIOUS_REVISION="$(cat "$RUN_DIR/active-revision")"; fi

cleanup() {
  if [ "$COMMITTED" = true ]; then return; fi
  if [ "$SWITCHED" = true ]; then
    if [ -f "$RUN_DIR/nginx.previous.conf" ]; then
      cp "$RUN_DIR/nginx.previous.conf" "$RUN_DIR/nginx.rollback.conf"
      mv "$RUN_DIR/nginx.rollback.conf" "$RUN_DIR/nginx.conf"
      restored=false
      # Nginx reload is asynchronous; consecutive HUPs can coalesce. Verify actual cutover.
      for _ in $(seq 1 20); do
        "$NGINX_BIN" -c "$RUN_DIR/nginx.conf" -p "$BASE_DIR" -s reload || true
        sleep 0.1
        current="$(curl -fsS "http://127.0.0.1:$WEB_PORT/__release" 2>/dev/null || true)"
        admin_current="$(curl -fsS "http://127.0.0.1:$ADMIN_PORT/__release" 2>/dev/null || true)"
        if { [ -n "$PREVIOUS_REVISION" ] && [ "$current" = "$PREVIOUS_REVISION" ] \
             && [ "$admin_current" = "$PREVIOUS_REVISION" ]; } \
          || { [ -z "$PREVIOUS_REVISION" ] && [ "$current" != "$REVISION" ] \
               && [ "$admin_current" != "$REVISION" ] \
               && curl -fsS "http://127.0.0.1:$WEB_PORT/api/ready" >/dev/null 2>&1; }; then
          restored=true; break
        fi
      done
      if [ "$restored" != true ]; then
        echo 'Rollback could not be confirmed; retaining candidate to avoid breaking gateway traffic' >&2
        return
      fi
    elif [ "$STARTED_NGINX" = true ]; then
      "$NGINX_BIN" -c "$RUN_DIR/nginx.conf" -p "$BASE_DIR" -s quit || true
    fi
  fi
  if [ "$STARTED_CANDIDATE" = true ] && [ -s "$NEXT_PID" ]; then
    kill -TERM "$(cat "$NEXT_PID")" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ -s "$NEXT_PID" ] && kill -0 "$(cat "$NEXT_PID")" 2>/dev/null; then
  echo "Inactive port still has a process: $NEXT_PORT; refusing to replace it" >&2
  exit 1
fi
rm -f "$NEXT_PID"
(cd "$SOURCE_DIR/server" && .venv/bin/python manage.py migrate --noinput)
STARTED_CANDIDATE=true
(cd "$SOURCE_DIR/server" && .venv/bin/gunicorn config.wsgi:application \
  --bind "127.0.0.1:$NEXT_PORT" --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-2}" --timeout "${GUNICORN_TIMEOUT:-30}" \
  --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-15}" --pid "$NEXT_PID" \
  --daemon </dev/null >/dev/null 2>&1 9>&-)

ready=false
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$NEXT_PORT/api/ready" >/dev/null; then ready=true; break; fi
  sleep 1
done
[ "$ready" = true ] || { echo 'Candidate failed readiness; old gateway unchanged' >&2; exit 1; }

# Retain hashed assets from older releases for pages already open in browsers.
for frontend in web admin; do cp -an "$SOURCE_DIR/$frontend/dist/assets/." "$BASE_DIR/assets/$frontend/"; done
mkdir -p "$BASE_DIR/nginx_tmp/body" "$BASE_DIR/nginx_tmp/proxy"
cat > "$RUN_DIR/nginx.next.conf" <<EOF
pid $RUN_DIR/nginx.pid;
error_log $RUN_DIR/nginx-error.log;
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log $RUN_DIR/nginx-access.log;
  client_body_temp_path $BASE_DIR/nginx_tmp/body;
  proxy_temp_path $BASE_DIR/nginx_tmp/proxy;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript image/svg+xml;
  limit_req_zone \$binary_remote_addr zone=stage_ingest_limit:10m rate=20r/s;
  limit_req_zone \$binary_remote_addr zone=stage_auth_limit:10m rate=5r/s;
  upstream stage_server { server 127.0.0.1:$NEXT_PORT; keepalive 16; }
EOF
for frontend in web admin; do
  FRONTEND_PORT="$WEB_PORT"
  if [ "$frontend" = admin ]; then FRONTEND_PORT="$ADMIN_PORT"; fi
  cat >> "$RUN_DIR/nginx.next.conf" <<EOF
  server {
    listen $BIND_HOST:$FRONTEND_PORT;
    root $SOURCE_DIR/$frontend/dist;
    index index.html;
    client_max_body_size 2m;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    location = /__release { default_type text/plain; return 200 "$REVISION"; }
    location = /api/health { proxy_pass http://stage_server/api/health; }
    location = /api/ready { proxy_pass http://stage_server/api/ready; }
    location ~ ^/api/(v1/)?ingest/ {
      limit_req zone=stage_ingest_limit burst=40 nodelay;
      limit_req_status 429;
      rewrite ^/api/(v1/)?(.*)\$ /api/v1/\$2 break;
      proxy_pass http://stage_server;
    }
    location ~ ^/api/(v1/)?(admin/)?auth/ {
      limit_req zone=stage_auth_limit burst=10 nodelay;
      limit_req_status 429;
      rewrite ^/api/(v1/)?(.*)\$ /api/v1/\$2 break;
      proxy_pass http://stage_server;
    }
    location /api/ {
      rewrite ^/api/(v1/)?(.*)\$ /api/v1/\$2 break;
      proxy_pass http://stage_server;
    }
    location /assets/ { alias $BASE_DIR/assets/$frontend/; expires 30d; }
    location / { add_header Cache-Control "no-cache"; try_files \$uri \$uri/ /index.html; }
  }
EOF
done
echo '}' >> "$RUN_DIR/nginx.next.conf"
"$NGINX_BIN" -t -c "$RUN_DIR/nginx.next.conf" -p "$BASE_DIR"
rm -f "$RUN_DIR/nginx.previous.conf"
if [ -f "$RUN_DIR/nginx.conf" ]; then cp "$RUN_DIR/nginx.conf" "$RUN_DIR/nginx.previous.conf"; fi
mv "$RUN_DIR/nginx.next.conf" "$RUN_DIR/nginx.conf"
SWITCHED=true
if [ -s "$RUN_DIR/nginx.pid" ] && kill -0 "$(cat "$RUN_DIR/nginx.pid")" 2>/dev/null; then
  "$NGINX_BIN" -c "$RUN_DIR/nginx.conf" -p "$BASE_DIR" -s reload </dev/null 9>&-
else
  STARTED_NGINX=true
  "$NGINX_BIN" -c "$RUN_DIR/nginx.conf" -p "$BASE_DIR" </dev/null 9>&-
fi
curl --retry 5 --retry-delay 1 --retry-connrefused -fsS "http://127.0.0.1:$WEB_PORT/api/ready" >/dev/null
curl --retry 5 --retry-delay 1 --retry-connrefused -fsS "http://127.0.0.1:$ADMIN_PORT/api/ready" >/dev/null
matched=false
for _ in $(seq 1 20); do
  if [ "$(curl -fsS "http://127.0.0.1:$WEB_PORT/__release")" = "$REVISION" ] \
    && [ "$(curl -fsS "http://127.0.0.1:$ADMIN_PORT/__release")" = "$REVISION" ]; then
    matched=true; break
  fi
  sleep 0.2
done
[ "$matched" = true ] || { echo 'Gateway did not switch to candidate revision' >&2; exit 1; }
printf '%s\n' "$SOURCE_DIR" > "$RUN_DIR/active-source.next"
mv "$RUN_DIR/active-source.next" "$RUN_DIR/active-source"
printf '%s\n' "$NEXT_PORT" > "$RUN_DIR/active-port.next"
mv "$RUN_DIR/active-port.next" "$RUN_DIR/active-port"
printf '%s\n' "$REVISION" > "$RUN_DIR/active-revision"
COMMITTED=true

OLD_PID="$RUN_DIR/gunicorn-$ACTIVE_PORT.pid"
if [ ! -s "$OLD_PID" ]; then OLD_PID="$RUN_DIR/gunicorn.pid"; fi
if [ -s "$OLD_PID" ]; then kill -TERM "$(cat "$OLD_PID")" 2>/dev/null || true; fi
echo "===> Published immutable release $REVISION on port $NEXT_PORT"
