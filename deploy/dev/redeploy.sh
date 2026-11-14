#!/usr/bin/env bash
# Redeploy the working tree to dev.andacity.com.
#
#   deploy/dev/redeploy.sh             # sync code, rebuild + restart the app
#   deploy/dev/redeploy.sh --migrate   # ...and run pending DB migrations first
#   deploy/dev/redeploy.sh --seed      # ...and migrate + reseed the 120-day horizon (slow, ~1h)
#
# Env: DEPLOY_HOST (ssh alias, default andacity-dev), REMOTE_DIR (default /opt/andacity/src),
#      ACCESS_TOKEN_FILE (default ~/.config/andacity/access-service-token) for the smoke check.
set -euo pipefail

HOST="${DEPLOY_HOST:-andacity-dev}"
# Keep the session alive through long silent steps (the seed runs ~50 min without output).
SSH_OPTS=(-o ServerAliveInterval=30 -o ServerAliveCountMax=10)
REMOTE_DIR="${REMOTE_DIR:-/opt/andacity/src}"
TOKEN_FILE="${ACCESS_TOKEN_FILE:-$HOME/.config/andacity/access-service-token}"
URL="${DEV_URL:-https://dev.andacity.com}"
MIGRATE=0 SEED=0
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=1 ;;
    --seed) MIGRATE=1 SEED=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
echo "→ syncing $(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo '+dirty') to $HOST:$REMOTE_DIR"
# .dockerignore doubles as the rsync exclude list; patterns are root-anchored on purpose.
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" --exclude-from=.dockerignore ./ "$HOST:$REMOTE_DIR/"

ssh "${SSH_OPTS[@]}" "$HOST" MIGRATE=$MIGRATE SEED=$SEED REMOTE_DIR="$REMOTE_DIR" bash -s <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
dc() { docker compose -f deploy/dev/docker-compose.yml --env-file /opt/andacity/dev.env "$@"; }
if [[ $MIGRATE == 1 ]]; then
  echo "→ building tools image"
  dc --profile tools build -q tools
  dc up -d --wait postgres
  # Migrations assume the schema already exists.
  dc exec -T postgres psql -qU andacity -d andacity -c 'CREATE SCHEMA IF NOT EXISTS andacity_app'
  echo "→ migrating"
  dc run --rm tools pnpm db:migrate
  if [[ $SEED == 1 ]]; then
    echo "→ reseeding (120-day horizon)"
    dc run --rm tools pnpm db:seed:120
    dc exec -T postgres psql -qU andacity -d andacity -c ANALYZE
  fi
fi
echo "→ building + restarting app"
dc build -q app
dc up -d --wait app cloudflared
docker image prune -f >/dev/null
dc ps --format 'table {{.Service}}\t{{.Status}}'
REMOTE

if [[ -r "$TOKEN_FILE" ]]; then
  set -a; . "$TOKEN_FILE"; set +a
  for p in /healthz / /hotels/; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
      -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" "$URL$p")
    echo "smoke $p → $code"
    [[ $code == 200 ]] || { echo "smoke check failed" >&2; exit 1; }
  done
else
  echo "(no $TOKEN_FILE; skipping smoke check)"
fi
echo "✓ deployed to $URL"
