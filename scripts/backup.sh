#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/home/koltensaccount/backups/aubrey-rankings}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "=== [Aubrey Rankings] Starting Backup at ${TIMESTAMP} ==="

# 1. PostgreSQL Database Dump (using -i without pseudo-tty to prevent stream corruption)
echo "-> Dumping PostgreSQL database..."
docker exec -i aubrey-db pg_dump -U aubrey --clean --if-exists aubrey_rankings | gzip > "${BACKUP_DIR}/aubrey_db_${TIMESTAMP}.sql.gz"

# Validate DB dump gzip integrity
gzip -t "${BACKUP_DIR}/aubrey_db_${TIMESTAMP}.sql.gz"

# 2. Uploaded Artwork Volume Backup
echo "-> Backing up uploaded artwork volume..."
# Stream to a host-owned file, rather than letting container root create it.
docker run --rm -v aubrey_uploads:/volume:ro alpine tar -czf - -C /volume . > "${BACKUP_DIR}/aubrey_uploads_${TIMESTAMP}.tar.gz"

# Validate artwork tarball gzip integrity
gzip -t "${BACKUP_DIR}/aubrey_uploads_${TIMESTAMP}.tar.gz"

# Restrict permissions to owner only
chmod 600 "${BACKUP_DIR}/aubrey_db_${TIMESTAMP}.sql.gz" "${BACKUP_DIR}/aubrey_uploads_${TIMESTAMP}.tar.gz"

# 3. Retain last 14 days of backups
echo "-> Cleaning backups older than 14 days..."
find "$BACKUP_DIR" -type f -name "aubrey_*" -mtime +14 -delete

# 4. Optional Off-Server Sync via rclone
if command -v rclone &>/dev/null && rclone listremotes | grep -q "^gdrive:"; then
  echo "-> Syncing backups off-server to Google Drive (gdrive:Backups/aubrey-rankings)..."
  rclone copy "$BACKUP_DIR" gdrive:Backups/aubrey-rankings --fast-list || echo "Warning: Off-server rclone backup failed"
fi

echo "=== Backup completed successfully! Output stored in ${BACKUP_DIR} ==="

