#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-/Users/odotjdot/APPS/.env.fmos.local}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }
source <(grep -E '^(FMBH_RDS_|REMOTE_DEV_1_)' "$ENV_FILE" | sed 's/^/export /')

LOCAL_PORT="${LOCAL_PORT:-13306}"

existing=$(lsof -ti :"$LOCAL_PORT" 2>/dev/null || true)
[ -n "$existing" ] && kill "$existing" 2>/dev/null || true

ssh -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=no \
  -L "${LOCAL_PORT}:${FMBH_RDS_HOST}:${FMBH_RDS_PORT}" \
  -N -f \
  "${REMOTE_DEV_1_USER}@${REMOTE_DEV_1_HOST}"

echo "Tunnel up on 127.0.0.1:${LOCAL_PORT}"

if ! command -v mysql >/dev/null; then
  echo "mysql client not found. Tunnel left open. Connect manually: mysql -h 127.0.0.1 -P ${LOCAL_PORT} -u ${FMBH_RDS_USER} -p"
  exit 0
fi

mysql -h 127.0.0.1 -P "$LOCAL_PORT" -u "$FMBH_RDS_USER" -p"$FMBH_RDS_PASSWORD" "$@"
