#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-db-backup.sql.gz> [path-to-uploads-backup.tar.gz]"
  exit 1
fi

DB_BACKUP="$1"
UPLOADS_BACKUP="${2:-}"

# Validate gzip integrity of DB backup
echo "-> Verifying database backup integrity..."
gzip -t "$DB_BACKUP"

if [ -n "$UPLOADS_BACKUP" ]; then
  if [ ! -f "$UPLOADS_BACKUP" ]; then
    echo "Error: Uploads backup file '${UPLOADS_BACKUP}' not found."
    exit 1
  fi
  echo "-> Verifying uploads backup integrity..."
  gzip -t "$UPLOADS_BACKUP"
fi

# Pause web traffic during restore to ensure atomic consistency
echo "-> Pausing aubrey-web to halt writes during restoration..."
docker compose stop aubrey-web 2>/dev/null || true

echo "=== [Aubrey Rankings] Restoring Database from ${DB_BACKUP} ==="
# Execute restoration inside a single transaction and halt on any error
gunzip -c "$DB_BACKUP" | docker exec -i aubrey-db psql -U aubrey -d aubrey_rankings -X -v ON_ERROR_STOP=1 --single-transaction

if [ -n "$UPLOADS_BACKUP" ]; then
  echo "=== Restoring Uploaded Artwork from ${UPLOADS_BACKUP} ==="
  # Clean old contents to avoid orphaned files from outside the snapshot
  docker run --rm \
    -v aubrey_uploads:/volume \
    -v "$(cd "$(dirname "$UPLOADS_BACKUP")" && pwd)":/backup \
    alpine sh -c "rm -rf /volume/* && tar -xzf \"/backup/$(basename "$UPLOADS_BACKUP")\" -C /volume"
fi

echo "-> Restarting aubrey-web..."
docker compose start aubrey-web

echo "=== Database and artwork restore completed successfully! ==="
