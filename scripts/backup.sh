#!/bin/sh
# Logical backup of the Virtual Company database.
#   DATABASE_URL=postgres://... ./scripts/backup.sh [output-dir]
# Restore: pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>.dump
set -eu
OUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/virtual_company_$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$FILE"
echo "[backup] wrote $FILE ($(du -h "$FILE" | cut -f1))"
find "$OUT_DIR" -name 'virtual_company_*.dump' -type f -mtime +"$RETENTION_DAYS" -delete
