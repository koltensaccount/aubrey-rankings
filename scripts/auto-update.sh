#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/koltensaccount/aubrey-rankings}"
cd "$APP_DIR"

# Ensure docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
  exit 0
fi

# Get current container image ID
OLD_IMAGE=$(docker image inspect --format="{{.Id}}" ghcr.io/koltensaccount/aubrey-rankings:latest 2>/dev/null || echo "none")

# Pull latest image silently
if ! docker compose pull -q aubrey-web > /dev/null 2>&1; then
  exit 0
fi

NEW_IMAGE=$(docker image inspect --format="{{.Id}}" ghcr.io/koltensaccount/aubrey-rankings:latest 2>/dev/null || echo "none")

# Check if container is running
IS_RUNNING=$(docker ps -q -f name=aubrey-web)

if [ "$OLD_IMAGE" != "$NEW_IMAGE" ] || [ -z "$IS_RUNNING" ]; then
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Update detected! Deploying new image ($NEW_IMAGE)..."

  # Restart web container with new image
  docker compose up -d aubrey-web

  # Wait for container startup
  sleep 4

  # Run Drizzle schema push / migrations
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Running database migrations..."
  docker compose exec -T aubrey-web npx drizzle-kit push || echo "Warning: Migration command exited with non-zero status"

  # Run local health check
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3200/ || echo "000")
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Healthcheck completed (HTTP $HTTP_STATUS). Deployment finished!"
fi
