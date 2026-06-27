#!/usr/bin/env bash
# UJX dev shutdown — kill the running next dev, remove the Caddy fragment,
# reload Caddy. Idempotent.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_SLUG="ujx"
CONF_D="/Users/odotjdot/APPS/local-dev/conf.d"
FMOS_CADDYFILE="/Users/odotjdot/wpserver-local/FM/FMOSV2/infrastructure/local-dev/Caddyfile"
FMOS_CERT_DIR="/Users/odotjdot/wpserver-local/FM/FMOSV2/infrastructure/local-dev/certs"
CADDY_ADMIN="http://localhost:2019"
PID_FILE="${REPO_ROOT}/.dev-pid"
PORT_FILE="${REPO_ROOT}/.dev-port"

# ─── Kill dev process ────────────────────────────────────────────────────
if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
	PID="$(cat "${PID_FILE}")"
	echo "→ Killing dev (pid ${PID})"
	kill "${PID}" 2>/dev/null || true
	for _ in 1 2 3 4 5; do
		kill -0 "${PID}" 2>/dev/null || break
		sleep 1
	done
	kill -9 "${PID}" 2>/dev/null || true
fi
rm -f "${PID_FILE}" "${PORT_FILE}"

# ─── Remove conf.d fragment ──────────────────────────────────────────────
if [[ -f "${CONF_D}/${APP_SLUG}.caddy" ]]; then
	rm -f "${CONF_D}/${APP_SLUG}.caddy"
	echo "→ Removed ${CONF_D}/${APP_SLUG}.caddy"
fi

# ─── Reload Caddy ────────────────────────────────────────────────────────
if curl -fsS "${CADDY_ADMIN}/config/" >/dev/null 2>&1; then
	export FMOS_CERT_DIR
	sudo -E caddy reload --config "${FMOS_CADDYFILE}" 2>&1 | tail -5
	echo "✓ Caddy reloaded — ujx.test no longer routed"
fi
