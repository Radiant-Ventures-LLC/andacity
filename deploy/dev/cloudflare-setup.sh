#!/usr/bin/env bash
# Idempotent Cloudflare setup for dev.andacity.com:
#   1. Remotely-managed Cloudflare Tunnel "andacity-dev" -> http://app:3000
#   2. Proxied DNS CNAME dev.andacity.com -> <tunnel>.cfargotunnel.com
#   3. Access application gating dev.andacity.com with two policies:
#        - allow: ACCESS_EMAILS (one-time PIN login)
#        - service auth: service token "andacity-dev-automation" (headless screenshots)
#
# Requires: curl, jq, and an API token with
#   Account: Cloudflare Tunnel Edit, Access: Apps and Policies Edit, Access: Service Tokens Edit
#   Zone (andacity.com): DNS Edit
#
# Usage:
#   CF_API_TOKEN_FILE=~/.config/andacity/cf-token ACCESS_EMAILS=you@example.com \
#     deploy/dev/cloudflare-setup.sh
#
# Outputs (never echoed to stdout):
#   $OUT_DIR/tunnel-token         — set as TUNNEL_TOKEN in /opt/andacity/dev.env on the server
#   $OUT_DIR/access-service-token — CF-Access-Client-Id / -Secret for automation (only on first creation)
set -euo pipefail

ACCOUNT_ID="${CF_ACCOUNT_ID:-eb21d2374169330a5baab34b987393d8}"
ZONE_NAME="${CF_ZONE_NAME:-andacity.com}"
HOSTNAME="${DEV_HOSTNAME:-dev.andacity.com}"
TUNNEL_NAME="${TUNNEL_NAME:-andacity-dev}"
SERVICE_URL="${SERVICE_URL:-http://app:3000}"
ACCESS_EMAILS="${ACCESS_EMAILS:?comma-separated ACCESS_EMAILS required}"
OUT_DIR="${OUT_DIR:-$HOME/.config/andacity}"
TOKEN="$(tr -d '[:space:]' < "${CF_API_TOKEN_FILE:-$HOME/.config/andacity/cf-token}")"

API=https://api.cloudflare.com/client/v4
umask 077; mkdir -p "$OUT_DIR"

cf() { # cf METHOD PATH [JSON]
  local res
  res=$(curl -sS -X "$1" "$API$2" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" ${3:+--data "$3"})
  if [[ "$(jq -r .success <<<"$res")" != "true" ]]; then
    echo "Cloudflare API error on $1 $2: $(jq -c .errors <<<"$res")" >&2; exit 1
  fi
  jq .result <<<"$res"
}

ZONE_ID=$(cf GET "/zones?name=$ZONE_NAME" | jq -r '.[0].id')
echo "zone $ZONE_NAME: $ZONE_ID"

# ── 1. Tunnel ────────────────────────────────────────────────────────────────
TUNNEL_ID=$(cf GET "/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false" | jq -r '.[0].id // empty')
if [[ -z "$TUNNEL_ID" ]]; then
  TUNNEL_ID=$(cf POST "/accounts/$ACCOUNT_ID/cfd_tunnel" \
    "$(jq -nc --arg n "$TUNNEL_NAME" '{name:$n, config_src:"cloudflare"}')" | jq -r .id)
  echo "created tunnel $TUNNEL_NAME: $TUNNEL_ID"
else
  echo "tunnel $TUNNEL_NAME exists: $TUNNEL_ID"
fi
cf PUT "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" "$(jq -nc --arg h "$HOSTNAME" --arg s "$SERVICE_URL" \
  '{config:{ingress:[{hostname:$h, service:$s}, {service:"http_status:404"}]}}')" >/dev/null
echo "tunnel ingress: $HOSTNAME -> $SERVICE_URL"
cf GET "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token" | jq -r . > "$OUT_DIR/tunnel-token"
echo "tunnel token written to $OUT_DIR/tunnel-token"

# ── 2. DNS ───────────────────────────────────────────────────────────────────
TARGET="$TUNNEL_ID.cfargotunnel.com"
REC=$(cf GET "/zones/$ZONE_ID/dns_records?name=$HOSTNAME" | jq -c '.[0] // empty')
BODY=$(jq -nc --arg n "$HOSTNAME" --arg c "$TARGET" '{type:"CNAME", name:$n, content:$c, proxied:true, comment:"andacity dev tunnel"}')
if [[ -z "$REC" ]]; then
  cf POST "/zones/$ZONE_ID/dns_records" "$BODY" >/dev/null; echo "created DNS CNAME $HOSTNAME -> $TARGET"
else
  cf PUT "/zones/$ZONE_ID/dns_records/$(jq -r .id <<<"$REC")" "$BODY" >/dev/null; echo "updated DNS CNAME $HOSTNAME -> $TARGET"
fi

# ── 3. Access ────────────────────────────────────────────────────────────────
ST_NAME=andacity-dev-automation
ST_ID=$(cf GET "/accounts/$ACCOUNT_ID/access/service_tokens" | jq -r --arg n "$ST_NAME" '.[] | select(.name==$n) | .id' | head -1)
if [[ -z "$ST_ID" ]]; then
  ST=$(cf POST "/accounts/$ACCOUNT_ID/access/service_tokens" "$(jq -nc --arg n "$ST_NAME" '{name:$n, duration:"8760h"}')")
  ST_ID=$(jq -r .id <<<"$ST")
  jq -r '"CF_ACCESS_CLIENT_ID=\(.client_id)\nCF_ACCESS_CLIENT_SECRET=\(.client_secret)"' <<<"$ST" > "$OUT_DIR/access-service-token"
  echo "created service token $ST_NAME (credentials in $OUT_DIR/access-service-token)"
else
  echo "service token $ST_NAME exists: $ST_ID"
fi

EMAIL_INCLUDES=$(jq -nc --arg e "$ACCESS_EMAILS" '[$e | split(",")[] | gsub("\\s";"") | select(length>0) | {email:{email:.}}]')
POLICIES=$(jq -nc --argjson inc "$EMAIL_INCLUDES" --arg st "$ST_ID" '[
  {name:"Allow owners", decision:"allow", include:$inc, precedence:1},
  {name:"Automation service token", decision:"non_identity", include:[{service_token:{token_id:$st}}], precedence:2}
]')
APP_BODY=$(jq -nc --arg h "$HOSTNAME" --argjson p "$POLICIES" '{
  name:"Andacity dev", domain:$h, type:"self_hosted", session_duration:"720h",
  app_launcher_visible:false, auto_redirect_to_identity:false, policies:$p
}')
APP_ID=$(cf GET "/accounts/$ACCOUNT_ID/access/apps" | jq -r --arg h "$HOSTNAME" '.[] | select(.domain==$h) | .id' | head -1)
if [[ -z "$APP_ID" ]]; then
  APP_ID=$(cf POST "/accounts/$ACCOUNT_ID/access/apps" "$APP_BODY" | jq -r .id); echo "created Access app: $APP_ID"
else
  cf PUT "/accounts/$ACCOUNT_ID/access/apps/$APP_ID" "$APP_BODY" >/dev/null; echo "updated Access app: $APP_ID"
fi
echo "done. Next: put \$(cat $OUT_DIR/tunnel-token) into TUNNEL_TOKEN in /opt/andacity/dev.env and 'up -d cloudflared'."
