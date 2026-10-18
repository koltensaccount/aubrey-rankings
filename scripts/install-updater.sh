#!/usr/bin/env bash
set -euo pipefail
umask 077
APP_DIR="${APP_DIR:-/home/koltensaccount/aubrey-rankings}"
[ -f "$APP_DIR/scripts/auto-update.sh" ] || { echo 'Install auto-update.sh in APP_DIR first' >&2; exit 1; }
mkdir -p "$APP_DIR/logs" "$APP_DIR/.docker-public"
chmod 700 "$APP_DIR/logs" "$APP_DIR/.docker-public" "$APP_DIR/scripts/auto-update.sh"
# Preserve every unrelated cron entry; replace only this application's updater.
existing=$(crontab -l 2>/dev/null || true)
{ printf '%s\n' "$existing" | awk -v command="$APP_DIR/scripts/auto-update.sh" 'index($0,command)==0';
  printf '*/2 * * * * %s/scripts/auto-update.sh >> %s/logs/update.log 2>&1\n' "$APP_DIR" "$APP_DIR";
} | crontab -
echo 'Aubrey updater scheduled every two minutes; errors: logs/update.log and logs/last-deployment-error'
