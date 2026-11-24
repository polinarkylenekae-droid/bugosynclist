#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Bugo Sync List - Automated MySQL Backup Script
# Usage:
#   DATABASE_URL="mysql://user:pass@host:3306/barangay_bugo_db" bash scripts/backup_mysql.sh
#   or set MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "Error: mysqldump is not installed or not on PATH." >&2
  echo "Install MySQL Client tools (e.g., sudo apt install mysql-client) and retry." >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ]; then
  # Parse mysql://user:pass@host:port/dbname safely with Node
  eval "$(node -e '
    const u = new URL(process.env.DATABASE_URL);
    console.log("MYSQL_HOST=" + JSON.stringify(u.hostname));
    console.log("MYSQL_PORT=" + JSON.stringify(u.port || "3306"));
    console.log("MYSQL_USER=" + JSON.stringify(decodeURIComponent(u.username)));
    console.log("MYSQL_PASSWORD=" + JSON.stringify(decodeURIComponent(u.password)));
    console.log("MYSQL_DATABASE=" + JSON.stringify(u.pathname.replace(/^\//, "")));
  ')"
fi

: "${MYSQL_HOST:?MYSQL_HOST or DATABASE_URL must be set}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:?MYSQL_USER or DATABASE_URL must be set}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE or DATABASE_URL must be set}"

OUT_FILE="${BACKUP_DIR}/barangay_bugo_${TIMESTAMP}.sql.gz"

export MYSQL_PWD="${MYSQL_PASSWORD:-}"
mysqldump \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "$MYSQL_DATABASE" | gzip -9 > "$OUT_FILE"
unset MYSQL_PWD

echo "Backup created: $OUT_FILE"

# Prune backups older than RETENTION_DAYS
find "$BACKUP_DIR" -type f -name "barangay_bugo_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "Retention cleanup completed (${RETENTION_DAYS} days)."
