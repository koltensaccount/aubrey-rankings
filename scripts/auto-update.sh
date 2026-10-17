#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/koltensaccount/aubrey-rankings}"
cd "$APP_DIR"

# Ensure docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
  exit 0
fi

# Prevent concurrent update script executions
exec 200>/tmp/aubrey-autoupdate.lock
if ! flock -n 200; then
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Update already in progress, exiting."
  exit 0
fi

# Get currently running container image ID (not just mutable latest tag)
RUNNING_CONTAINER_ID=$(docker ps -q -f name=aubrey-web || true)
if [ -n "$RUNNING_CONTAINER_ID" ]; then
  CURRENT_RUNNING_IMAGE=$(docker inspect --format="{{.Image}}" "$RUNNING_CONTAINER_ID" 2>/dev/null || echo "none")
else
  CURRENT_RUNNING_IMAGE="none"
fi

# Pull latest image silently
if ! docker compose pull -q aubrey-web > /dev/null 2>&1; then
  exit 0
fi

PULLED_IMAGE=$(docker image inspect --format="{{.Id}}" ghcr.io/koltensaccount/aubrey-rankings:latest 2>/dev/null || echo "none")

# Deploy if pulled image differs from currently running image or container is not running
if [ "$CURRENT_RUNNING_IMAGE" != "$PULLED_IMAGE" ] || [ -z "$RUNNING_CONTAINER_ID" ]; then
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Update detected! Running: $CURRENT_RUNNING_IMAGE -> Pulled: $PULLED_IMAGE"

  # 1. Take a safety snapshot backup before applying update
  if [ -f "scripts/backup.sh" ]; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Creating pre-update safety backup..."
    if ! ./scripts/backup.sh; then
      echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] ERROR: Pre-update safety backup failed! Aborting update to protect data."
      exit 1
    fi
  fi

  # 2. Tag old running image for safe rollback if available
  if [ "$CURRENT_RUNNING_IMAGE" != "none" ] && [ "$CURRENT_RUNNING_IMAGE" != "$PULLED_IMAGE" ]; then
    docker tag "$CURRENT_RUNNING_IMAGE" ghcr.io/koltensaccount/aubrey-rankings:rollback-backup 2>/dev/null || true
  fi

  # 3. Apply any pending database migrations before restarting web
  if [ -d "src/db/migrations" ]; then
    for sql in src/db/migrations/*.sql; do
      [ -f "$sql" ] || continue
      docker exec -i aubrey-db psql -U aubrey -d aubrey_rankings -X -v ON_ERROR_STOP=1 < "$sql" > /dev/null 2>&1 || true
    done
  fi

  # 4. Restart web container with new image
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Launching updated aubrey-web container..."
  docker compose up -d aubrey-web

  # 5. Bounded health check retries
  HEALTHY=false
  for i in {1..6}; do
    sleep 3
    HTTP_STATUS=$(curl -s --connect-timeout 3 -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3200/ || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
      HEALTHY=true
      break
    fi
    echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Health check attempt $i received HTTP $HTTP_STATUS, retrying..."
  done

  if [ "$HEALTHY" = true ]; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Healthcheck passed (HTTP 200). Deployment successful!"
  else
    echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] ERROR: Healthcheck failed after retries! Initiating safe rollback..."
    if docker image inspect ghcr.io/koltensaccount/aubrey-rankings:rollback-backup > /dev/null 2>&1; then
      docker tag ghcr.io/koltensaccount/aubrey-rankings:rollback-backup ghcr.io/koltensaccount/aubrey-rankings:latest
      docker compose up -d aubrey-web
      echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Rollback executed. Inspect logs for cause of failure."
    fi
    exit 1
  fi
fi
