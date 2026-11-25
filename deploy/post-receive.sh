#!/usr/bin/env bash
# Git 裸仓库自动 CI/CD 钩子
# 支持两种运行模式（可在 .env.prod 中通过 DEPLOY_MODE 切换）：
#   - docker（默认生产模式）：容器化跑 5 个模块检查 + Docker Compose 独立迁移与重建
#   - local（独立隔离网关模式）：不可变源码目录 + 锁文件安装检查 + 双端口 Gunicorn / Nginx 验证切换
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
export PROD_ENV_FILE="$ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
export VITE_APP_RELEASE="$SHORT_SHA"
DEPLOY_MODE="${DEPLOY_MODE:-docker}"
ENABLE_HA_PROFILE="${ENABLE_HA_PROFILE:-false}"
if [ "$DEPLOY_MODE" = local ]; then
  mkdir -p "$BASE_DIR/sources/$NEW_REV"
  STAGED_SOURCE="$(mktemp -d "$BASE_DIR/sources/$NEW_REV/.incoming.XXXXXX")"
  git --git-dir="$REPO_DIR" archive "$NEW_REV" | tar -x -C "$STAGED_SOURCE"
  chmod 755 "$STAGED_SOURCE"
  WORK_DIR="$BASE_DIR/sources/$NEW_REV/release-${STAGED_SOURCE##*.}"
  mv "$STAGED_SOURCE" "$WORK_DIR"
else
  mkdir -p "$WORK_DIR"
  git --work-tree="$WORK_DIR" --git-dir="$REPO_DIR" checkout -f "$NEW_REV"
fi
unset GIT_DIR GIT_WORK_TREE
cd "$WORK_DIR"
echo "===> Checked out $NEW_REV (mode=$DEPLOY_MODE)"
if [ "$DEPLOY_MODE" = local ]; then
  # Keep fd 9 open here: the parent holds the deployment lock until the child exits.
  bash "$WORK_DIR/deploy/local-release.sh" "$BASE_DIR" "$WORK_DIR" "$NEW_REV"
  exit 0
fi

echo "===> [2/5] 容器化 CI 门禁检查（失败即中止，不影响线上运行容器）"
docker run --rm -v "$WORK_DIR":/src -w /src/sdk   node:26-slim sh -c "npm ci && npm run check"
docker run --rm -v "$WORK_DIR":/src -w /src/web   node:26-slim sh -c "npm ci && npm run check"
docker run --rm -v "$WORK_DIR":/src -w /src/admin node:26-slim sh -c "npm ci && npm run check"
if [ -d "$WORK_DIR/stress-test" ]; then
  docker run --rm -v "$WORK_DIR":/src -w /src/stress-test node:26-slim sh -c "npm ci && npm run check"
fi
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

echo "===> [4/5] 重建服务容器（单实例重建不保证零停机）"
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
