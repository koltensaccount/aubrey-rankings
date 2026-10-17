#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/home/koltensaccount/aubrey-rankings/.env"
APP_DIR="/home/koltensaccount/aubrey-rankings"

echo "=================================================="
echo " Aubrey Rankings — Secure TMDB Setup"
echo "=================================================="
echo "You can provide either a TMDB API Read Access Token (Bearer)"
echo "OR a TMDB API Key (v3 32-character hex key)."
echo "Input will be hidden for security."
echo ""

read -rsp "1. TMDB API Read Access Token (Bearer) [Press Enter to skip]: " TMDB_TOKEN
echo ""
read -rsp "2. TMDB API Key (v3 hex key) [Press Enter to skip]: " TMDB_KEY
echo ""

if [ -z "$TMDB_TOKEN" ] && [ -z "$TMDB_KEY" ]; then
  echo "Error: At least one TMDB credential must be provided."
  exit 1
fi

echo "-> Validating credentials with TMDB API..."

VALID=false

if [ -n "$TMDB_TOKEN" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TMDB_TOKEN" "https://api.themoviedb.org/3/authentication")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ TMDB Read Access Token verified successfully with TMDB API!"
    VALID=true
  else
    echo "✗ TMDB Read Access Token validation failed (HTTP $HTTP_CODE)."
  fi
fi

if [ -n "$TMDB_KEY" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://api.themoviedb.org/3/authentication?api_key=$TMDB_KEY")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ TMDB API Key verified successfully with TMDB API!"
    VALID=true
  else
    echo "✗ TMDB API Key validation failed (HTTP $HTTP_CODE)."
  fi
fi

if [ "$VALID" = false ]; then
  echo "Error: None of the provided credentials could be verified with TMDB. .env was not modified."
  exit 1
fi

echo "-> Updating $ENV_FILE..."

python3 -c "
import re

env_path = '$ENV_FILE'
with open(env_path, 'r') as f:
    content = f.read()

token = '''$TMDB_TOKEN'''.strip()
key = '''$TMDB_KEY'''.strip()

if token:
    if re.search(r'^TMDB_API_READ_ACCESS_TOKEN=.*$', content, flags=re.MULTILINE):
        content = re.sub(r'^TMDB_API_READ_ACCESS_TOKEN=.*$', f'TMDB_API_READ_ACCESS_TOKEN=\"{token}\"', content, flags=re.MULTILINE)
    else:
        content += f'\nTMDB_API_READ_ACCESS_TOKEN=\"{token}\"\n'

if key:
    if re.search(r'^TMDB_API_KEY=.*$', content, flags=re.MULTILINE):
        content = re.sub(r'^TMDB_API_KEY=.*$', f'TMDB_API_KEY=\"{key}\"', content, flags=re.MULTILINE)
    else:
        content += f'\nTMDB_API_KEY=\"{key}\"\n'

with open(env_path, 'w') as f:
    f.write(content)
"

chmod 600 "$ENV_FILE"
echo "✓ $ENV_FILE updated with chmod 600 permissions."

echo "-> Restarting only the aubrey-web container..."
cd "$APP_DIR"
docker compose up -d --force-recreate aubrey-web

echo "-> Waiting for container startup..."
sleep 4

echo "-> Verifying TMDB search query for 'Black Mirror'..."
if [ -n "$TMDB_TOKEN" ]; then
  COUNT=$(curl -s -H "Authorization: Bearer $TMDB_TOKEN" "https://api.themoviedb.org/3/search/tv?query=Black+Mirror" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('results', [])))" 2>/dev/null || echo "0")
  echo "✓ TMDB TV Search returned $COUNT matching titles for 'Black Mirror'."
elif [ -n "$TMDB_KEY" ]; then
  COUNT=$(curl -s "https://api.themoviedb.org/3/search/tv?query=Black+Mirror&api_key=$TMDB_KEY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('results', [])))" 2>/dev/null || echo "0")
  echo "✓ TMDB TV Search returned $COUNT matching titles for 'Black Mirror'."
fi

TEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3200/")

if [ "$TEST_STATUS" = "200" ]; then
  echo "✓ Web application is healthy (HTTP 200)."
else
  echo "Warning: Healthcheck returned HTTP $TEST_STATUS."
fi

echo "=================================================="
echo " TMDB configuration completed successfully!"
echo "=================================================="
