#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-db-backup.sql.gz> [path-to-uploads-backup.tar.gz]"
  exit 1
fi

DB_BACKUP="$1"
UPLOADS_BACKUP="${2:-}"

if [ ! -f "$DB_BACKUP" ]; then
  echo "Error: Database backup file '${DB_BACKUP}' not found."
  exit 1
fi

echo "=== [Aubrey Rankings] Restoring Database from ${DB_BACKUP} ==="
gunzip -c "$DB_BACKUP" | docker exec -i aubrey-db psql -U aubrey -d aubrey_rankings

if [ -n "$UPLOADS_BACKUP" ]; then
  if [ -f "$UPLOADS_BACKUP" ]; then
    echo "=== Restoring Uploaded Artwork from ${UPLOADS_BACKUP} ==="
    docker run --rm \
      -v aubrey_uploads:/volume \
      -v "$(dirname "$UPLOADS_BACKUP")":/backup \
      alpine tar -xzf "/backup/$(basename "$UPLOADS_BACKUP")" -C /volume
  else
    echo "Warning: Uploads backup '${UPLOADS_BACKUP}' not found, skipping artwork restore."
  fi
fi

echo "=== Database restore completed successfully! ==="
