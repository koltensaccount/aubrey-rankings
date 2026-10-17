#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/koltensaccount/backups/aubrey-rankings}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "=== [Aubrey Rankings] Starting Backup at ${TIMESTAMP} ==="

# 1. PostgreSQL Database Dump
echo "-> Dumping PostgreSQL database..."
docker exec -t aubrey-db pg_dump -U aubrey aubrey_rankings | gzip > "${BACKUP_DIR}/aubrey_db_${TIMESTAMP}.sql.gz"

# 2. Uploaded Artwork Volume Backup
echo "-> Backing up uploaded artwork volume..."
docker run --rm \
  -v aubrey_uploads:/volume \
  -v "${BACKUP_DIR}":/backup \
  alpine tar -czf "/backup/aubrey_uploads_${TIMESTAMP}.tar.gz" -C /volume .

# 3. Retain last 14 days of backups
echo "-> Cleaning backups older than 14 days..."
find "$BACKUP_DIR" -type f -name "aubrey_*" -mtime +14 -delete

echo "=== Backup completed successfully! Output stored in ${BACKUP_DIR} ==="
