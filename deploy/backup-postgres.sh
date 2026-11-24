#!/usr/bin/env bash
# PostgreSQL 异地加密备份与灾难恢复脚本
# 定时备份（crontab）：0 3 * * * BACKUP_PASSPHRASE='***' /srv/drone-website/work/deploy/backup-postgres.sh
# 灾难恢复：BACKUP_PASSPHRASE='***' ./deploy/backup-postgres.sh --restore /srv/drone-website/backups/pg_xxx.sql.gz.enc
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/srv/drone-website/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-drone_website_server}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE environment variable is required}"
REMOTE_DEST="${RCLONE_REMOTE_DEST:-}"

mkdir -p "$BACKUP_DIR"

if [ "${1:-}" = "--restore" ]; then
  ARCHIVE="${2:?Usage: $0 --restore <backup_file.sql.gz.enc>}"
  [ -s "$ARCHIVE" ] || { echo "!!! 备份文件不存在或为空: ${ARCHIVE}" >&2; exit 1; }
  echo "===> 正在解密并恢复备份 ${ARCHIVE} 到数据库 ${POSTGRES_DB} ..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$ARCHIVE" \
    | gunzip \
    | docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  echo "===> 数据库恢复完成！"
  exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/pg_${POSTGRES_DB}_${STAMP}.sql.gz.enc"
TMP_FILE="${OUT_FILE}.tmp"
trap 'rm -f "$TMP_FILE"' EXIT

echo "===> 开始导出并加密数据库 ${POSTGRES_DB} ..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_PASSPHRASE -out "$TMP_FILE"

# 校验加密产物可正常解密且解压内容非空，防止空流污染备份目录
BYTE_COUNT="$(openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$TMP_FILE" | gunzip | wc -c)"
if [ "$BYTE_COUNT" -le 0 ]; then
  echo "!!! 导出内容为空，放弃生成备份文件" >&2
  exit 1
fi

chmod 600 "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"
echo "===> 本地加密备份已生成并校验通过 (${BYTE_COUNT} bytes SQL): ${OUT_FILE}"

if [ -n "$REMOTE_DEST" ] && command -v rclone >/dev/null 2>&1; then
  echo "===> 正在同步备份至异地对象存储 (${REMOTE_DEST}) ..."
  rclone copy "$OUT_FILE" "$REMOTE_DEST"
fi

find "$BACKUP_DIR" -name "pg_${POSTGRES_DB}_*.sql.gz.enc" -mtime +"$RETENTION_DAYS" -delete
echo "===> 已清理超过 ${RETENTION_DAYS} 天的历史本地备份。"
