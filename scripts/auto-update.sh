#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
APP_DIR="${APP_DIR:-/home/koltensaccount/aubrey-rankings}"
REGISTRY_IMAGE="ghcr.io/koltensaccount/aubrey-rankings"
# Public package: deliberately ignore any expired/unscoped personal Docker credential.
export DOCKER_CONFIG="${APP_DIR}/.docker-public"
mkdir -p "$DOCKER_CONFIG" "$APP_DIR/logs"
log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }
fail() { log "ERROR: $*" >&2; printf '%s\n' "$*" > "$APP_DIR/logs/last-deployment-error"; logger -t aubrey-updater -- "$*" || :; exit 1; }
trap 'fail "Updater failed at line $LINENO (exit $?)"' ERR
cd "$APP_DIR"
[ -f docker-compose.yml ] || fail 'docker-compose.yml missing'
exec 200>"$APP_DIR/.update.lock"
flock -n 200 || { log 'Another update is already running'; exit 0; }
# DOCKER_CONFIG is dedicated to anonymous pulls; never copy credentials here.
printf '{"auths":{}}\n' > "$DOCKER_CONFIG/config.json"
log 'Checking GHCR for a new release'
docker pull "$REGISTRY_IMAGE:latest" || fail 'GHCR pull failed; production was left unchanged'
image_id=$(docker image inspect --format '{{.Id}}' "$REGISTRY_IMAGE:latest")
revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image_id")
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || fail 'Image is missing a valid revision label'
current_image=$(docker inspect --format '{{.Image}}' aubrey-web 2>/dev/null || true)
current_revision=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' aubrey-web 2>/dev/null || true)
health_url="${HEALTH_URL:-http://127.0.0.1:3200/api/health}"
healthy() {
  curl -fsS --max-time 5 "$health_url" | python3 -c 'import json,sys; s=json.load(sys.stdin); sys.exit(0 if s.get("status")=="ok" and s.get("revision")==sys.argv[1] else 1)' "$1"
}
if [ "$current_revision" = "$revision" ] && healthy "$revision"; then
  log "Already healthy on $revision"
  rm -f "$APP_DIR/logs/last-deployment-error"
  exit 0
fi
log "Updating $current_revision -> $revision ($image_id)"
# Always execute deployment helpers from the candidate image, not stale host SQL/scripts.
helper_dir=$(mktemp -d "$APP_DIR/.release.XXXXXX")
helper_container=$(docker create "$image_id")
cleanup() { docker rm "$helper_container" >/dev/null 2>&1 || :; rm -rf "$helper_dir"; }
trap cleanup EXIT
docker cp "$helper_container:/app/scripts/backup.sh" "$helper_dir/backup.sh"
docker cp "$helper_container:/app/docker-compose.yml" "$helper_dir/docker-compose.yml"
compose() { docker compose --project-directory "$APP_DIR" -f "$helper_dir/docker-compose.yml" "$@"; }
bash "$helper_dir/backup.sh" || fail 'Pre-deployment backup failed; production was left unchanged'
export AUBREY_IMAGE="$image_id"
# One-shot container inherits the existing compose database credentials/network; no secret command arguments.
compose run --rm --no-deps -T aubrey-web node scripts/migrate.cjs || fail 'Migration failed and rolled back; production was left unchanged'
if [ -n "$current_image" ]; then docker tag "$current_image" "$REGISTRY_IMAGE:rollback-backup"; fi
if compose up -d --no-deps --no-build --pull never aubrey-web; then
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if healthy "$revision"; then
      # Keep the host launcher current for subsequent cron runs.
      docker cp "$helper_container:/app/scripts/auto-update.sh" "$helper_dir/auto-update.sh"
      install -m 700 "$helper_dir/auto-update.sh" scripts/auto-update.sh
      install -m 700 "$helper_dir/backup.sh" scripts/backup.sh
      install -m 600 "$helper_dir/docker-compose.yml" docker-compose.yml
      printf '%s\n' "$revision" > logs/deployed-revision
      rm -f logs/last-deployment-error
      log "Deployment verified: $revision"
      exit 0
    fi
    sleep 3
  done
fi
log 'New release failed health verification; rolling back application image'
if [ -n "$current_image" ]; then
  export AUBREY_IMAGE="$current_image"
  compose up -d --no-deps --no-build --pull never aubrey-web || fail 'CRITICAL: application rollback failed'
fi
# Migrations are additive; never roll back or delete database data automatically.
fail "Release $revision failed health verification; previous application image restored"
