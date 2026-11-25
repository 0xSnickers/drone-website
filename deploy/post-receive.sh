#!/usr/bin/env bash
# Git 裸仓库自动 CI/CD 钩子
# 支持两种运行模式（可在 .env.prod 中通过 DEPLOY_MODE 切换）：
#   - docker（默认生产模式）：容器化跑 4 端 CI + Docker Compose 独立迁移与滚动更新
#   - local（独立隔离网关模式）：使用工作区工具链跑 4 端 CI + Gunicorn SIGHUP 零停机热重载 + 独立进程 Nginx（不触碰 /etc/nginx）
set -euo pipefail

HOOK_REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_DIR="${DRONE_DEPLOY_BASE:-$(dirname "$HOOK_REPO_DIR")}"
REPO_DIR="${BASE_DIR}/repo.git"
WORK_DIR="${BASE_DIR}/work"
LOCK_FILE="${BASE_DIR}/deploy.lock"
ENV_FILE="${BASE_DIR}/.env.prod"
ZERO_REV="0000000000000000000000000000000000000000"

DEPLOY=false
NEW_REV=""
while read -r _oldrev newrev refname; do
  if [ "$refname" = "refs/heads/main" ] && [ "$newrev" != "$ZERO_REV" ]; then
    DEPLOY=true
    NEW_REV="$newrev"
  fi
done
[ "$DEPLOY" = true ] || exit 0

exec 9>"$LOCK_FILE"
flock 9

SHORT_SHA="${NEW_REV:0:8}"
mkdir -p "$WORK_DIR"
git --work-tree="$WORK_DIR" --git-dir="$REPO_DIR" checkout -f main
unset GIT_DIR GIT_WORK_TREE
cd "$WORK_DIR"

export VITE_APP_RELEASE="$SHORT_SHA"
export PROD_ENV_FILE="$ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DEPLOY_MODE="${DEPLOY_MODE:-docker}"
ENABLE_HA_PROFILE="${ENABLE_HA_PROFILE:-false}"
echo "===> [1/5] 已检出 main 分支代码 (${SHORT_SHA}, mode=${DEPLOY_MODE})"

if [ "$DEPLOY_MODE" = "local" ]; then
  echo "===> [2/5] 执行 4 端 CI 门禁检查（失败即中止，线上旧进程零影响）"
  (cd "$WORK_DIR/server" && ([ -d .venv ] || uv sync --frozen) && ./scripts/test.sh)
  (cd "$WORK_DIR/web" && ([ -d node_modules ] || npm ci) && npm run check)
  (cd "$WORK_DIR/admin" && ([ -d node_modules ] || npm ci) && npm run check)
  if [ -x "$WORK_DIR/sdk/node_modules/.bin/eslint" ]; then
    (cd "$WORK_DIR/sdk" && npm run check)
  else
    cat <<EOF > "${BASE_DIR}/sdk-vitest.mjs"
export default {
  root: '${WORK_DIR}/sdk',
  server: { fs: { allow: ['${WORK_DIR}'] } },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
};
EOF
    (cd "$WORK_DIR/admin" && npx vitest run --config "${BASE_DIR}/sdk-vitest.mjs")
    rm -f "${BASE_DIR}/sdk-vitest.mjs"
  fi

  echo "===> [3/5] 执行数据库迁移并原子切换前端静态产物"
  (cd "$WORK_DIR/server" && .venv/bin/python manage.py migrate --noinput)
  mkdir -p "${BASE_DIR}/releases/web" "${BASE_DIR}/releases/admin" "${BASE_DIR}/run" "${BASE_DIR}/nginx_tmp"
  rm -rf "${BASE_DIR}/releases/web.next" "${BASE_DIR}/releases/admin.next"
  cp -r "$WORK_DIR/web/dist" "${BASE_DIR}/releases/web.next"
  cp -r "$WORK_DIR/admin/dist" "${BASE_DIR}/releases/admin.next"
  rm -rf "${BASE_DIR}/releases/web" "${BASE_DIR}/releases/admin"
  mv "${BASE_DIR}/releases/web.next" "${BASE_DIR}/releases/web"
  mv "${BASE_DIR}/releases/admin.next" "${BASE_DIR}/releases/admin"

  echo "===> [4/5] 零停机热重载 Gunicorn 与独立 Nginx 反向代理网关"
  PORT="${PORT:-19100}"
  BIND_HOST="${BIND_HOST:-0.0.0.0}"
  WEB_PORT="${WEB_HOST_PORT:-18080}"
  ADMIN_PORT="${ADMIN_HOST_PORT:-18081}"
  GUNICORN_PID_FILE="${BASE_DIR}/run/gunicorn.pid"

  if [ -f "$GUNICORN_PID_FILE" ] && kill -0 "$(cat "$GUNICORN_PID_FILE")" 2>/dev/null; then
    kill -HUP "$(cat "$GUNICORN_PID_FILE")"
  else
    (
      cd "$WORK_DIR/server"
      .venv/bin/gunicorn config.wsgi:application \
        --bind "127.0.0.1:${PORT}" \
        --workers "${GUNICORN_WORKERS:-2}" \
        --threads "${GUNICORN_THREADS:-2}" \
        --timeout "${GUNICORN_TIMEOUT:-30}" \
        --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-15}" \
        --pid "$GUNICORN_PID_FILE" \
        --daemon </dev/null >/dev/null 2>&1 9>&-
    )
  fi

  mkdir -p "${BASE_DIR}/nginx_tmp/body" "${BASE_DIR}/nginx_tmp/proxy" \
           "${BASE_DIR}/nginx_tmp/fastcgi" "${BASE_DIR}/nginx_tmp/uwsgi" "${BASE_DIR}/nginx_tmp/scgi"
  cat <<EOF > "${BASE_DIR}/run/nginx.conf"
pid ${BASE_DIR}/run/nginx.pid;
error_log ${BASE_DIR}/run/nginx-error.log;
events { worker_connections 128; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log ${BASE_DIR}/run/nginx-access.log;
  client_body_temp_path ${BASE_DIR}/nginx_tmp/body;
  proxy_temp_path ${BASE_DIR}/nginx_tmp/proxy;
  fastcgi_temp_path ${BASE_DIR}/nginx_tmp/fastcgi;
  uwsgi_temp_path ${BASE_DIR}/nginx_tmp/uwsgi;
  scgi_temp_path ${BASE_DIR}/nginx_tmp/scgi;

  gzip on;
  gzip_min_length 1024;
  gzip_types text/plain text/css application/json application/javascript image/svg+xml;

  limit_req_zone \$binary_remote_addr zone=stage_ingest_limit:10m rate=20r/s;
  upstream stage_server { server 127.0.0.1:${PORT} max_fails=2 fail_timeout=5s; keepalive 16; }

  server {
    listen ${BIND_HOST}:${WEB_PORT};
    root ${BASE_DIR}/releases/web;
    index index.html;
    location = /api/health { proxy_http_version 1.1; proxy_set_header Connection ""; proxy_set_header Host \$host; proxy_pass http://stage_server/api/health; }
    location = /api/ready  { proxy_http_version 1.1; proxy_set_header Connection ""; proxy_set_header Host \$host; proxy_pass http://stage_server/api/ready; }
    location /api/v1/ingest/ {
      limit_req zone=stage_ingest_limit burst=40 nodelay;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/ingest/;
    }
    location /api/v1/ {
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/;
    }
    location /api/ingest/  {
      limit_req zone=stage_ingest_limit burst=40 nodelay;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/ingest/;
    }
    location /api/ {
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/;
    }
    location / { try_files \$uri \$uri/ /index.html; }
  }

  server {
    listen ${BIND_HOST}:${ADMIN_PORT};
    root ${BASE_DIR}/releases/admin;
    index index.html;
    location = /api/health { proxy_http_version 1.1; proxy_set_header Connection ""; proxy_set_header Host \$host; proxy_pass http://stage_server/api/health; }
    location = /api/ready  { proxy_http_version 1.1; proxy_set_header Connection ""; proxy_set_header Host \$host; proxy_pass http://stage_server/api/ready; }
    location /api/v1/ingest/ {
      limit_req zone=stage_ingest_limit burst=40 nodelay;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/ingest/;
    }
    location /api/v1/ {
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/;
    }
    location /api/ {
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_pass http://stage_server/api/v1/;
    }
    location / { try_files \$uri \$uri/ /index.html; }
  }
}
EOF
  /usr/sbin/nginx -t -c "${BASE_DIR}/run/nginx.conf" -p "${BASE_DIR}" >/dev/null 2>&1
  if [ -f "${BASE_DIR}/run/nginx.pid" ] && kill -0 "$(cat "${BASE_DIR}/run/nginx.pid")" 2>/dev/null; then
    /usr/sbin/nginx -c "${BASE_DIR}/run/nginx.conf" -p "${BASE_DIR}" -s reload </dev/null >/dev/null 2>&1 9>&-
  else
    /usr/sbin/nginx -c "${BASE_DIR}/run/nginx.conf" -p "${BASE_DIR}" </dev/null >/dev/null 2>&1 9>&-
  fi

  echo "===> [5/5] 通过独立 Nginx 网关验证前后端就绪探针 (/api/ready)"
  for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/ready" >/dev/null 2>&1 \
      && curl -fsS "http://127.0.0.1:${ADMIN_PORT}/api/ready" >/dev/null 2>&1; then
      echo "===> 发布成功！版本: ${SHORT_SHA} | Web: http://127.0.0.1:${WEB_PORT} | Admin: http://127.0.0.1:${ADMIN_PORT}"
      exit 0
    fi
    sleep 1
  done
  echo "!!! 网关 /api/ready 探针超时"
  exit 1
fi

echo "===> [2/5] 容器化 CI 门禁检查（失败即中止，不影响线上运行容器）"
docker run --rm -v "$WORK_DIR":/src -w /src/sdk   node:26-slim sh -c "npm ci && npm run check"
docker run --rm -v "$WORK_DIR":/src -w /src/web   node:26-slim sh -c "npm ci && npm run check"
docker run --rm -v "$WORK_DIR":/src -w /src/admin node:26-slim sh -c "npm ci && npm run check"
docker run --rm -v "$WORK_DIR":/src -w /src/server python:3.12-slim sh -c \
  "pip install -q uv && uv sync --frozen && ./scripts/test.sh"

COMPOSE_ARGS=(-f docker-compose.prod.yml)
if [ "$ENABLE_HA_PROFILE" = "true" ]; then
  COMPOSE_ARGS=(--profile ha -f docker-compose.prod.yml)
fi

echo "===> [3/5] 构建生产镜像并独立执行数据库迁移"
docker compose "${COMPOSE_ARGS[@]}" build
docker compose "${COMPOSE_ARGS[@]}" up -d postgres
docker compose "${COMPOSE_ARGS[@]}" run --rm server migrate

echo "===> [4/5] 滚动更新服务容器"
docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans

echo "===> [5/5] 验证后端与数据库就绪探针 (/api/ready)"
READY_PORT="${SERVER_HOST_PORT:-9000}"
for _ in $(seq 1 25); do
  if curl -fsS "http://127.0.0.1:${READY_PORT}/api/ready" >/dev/null 2>&1; then
    echo "===> 发布完成！上线版本: ${SHORT_SHA}"
    exit 0
  fi
  sleep 2
done

echo "!!! /api/ready 探针超时，请执行 docker compose logs server 排查"
exit 1
