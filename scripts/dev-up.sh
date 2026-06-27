#!/usr/bin/env bash
# UJX dev launcher — picks a free port at startup, renders the Caddy
# fragment with that port, starts Next.js, and reloads Caddy. Re-runnable.
#
# The Caddy port-binding lives ONLY in the rendered fragment at
# /Users/odotjdot/APPS/local-dev/conf.d/ujx.caddy. The template at
# infrastructure/local-dev/ujx.caddy.template is the source of truth.

set -euo pipefail

# Source nvm so npx is on PATH in non-interactive SSH sessions
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_SLUG="ujx"
PORT_BASE=3010
CERT_DIR="${REPO_ROOT}/infrastructure/local-dev/certs"
TEMPLATE="${REPO_ROOT}/infrastructure/local-dev/${APP_SLUG}.caddy.template"
LOCAL_DEV_ROOT="/Users/odotjdot/APPS/local-dev"
CONF_D="${LOCAL_DEV_ROOT}/conf.d"
FIND_PORT="${LOCAL_DEV_ROOT}/bin/find-free-port.sh"
FMOS_CADDYFILE="/Users/odotjdot/wpserver-local/FM/FMOSV2/infrastructure/local-dev/Caddyfile"
FMOS_CERT_DIR="/Users/odotjdot/wpserver-local/FM/FMOSV2/infrastructure/local-dev/certs"
CADDY_ADMIN="http://localhost:2019"
PID_FILE="${REPO_ROOT}/.dev-pid"
PORT_FILE="${REPO_ROOT}/.dev-port"

cd "${REPO_ROOT}"

# ─── Sanity: certs in place ──────────────────────────────────────────────
if [[ ! -f "${CERT_DIR}/ujx.test.pem" || ! -f "${CERT_DIR}/ujx.test-key.pem" ]]; then
	rm -f "${CONF_D}/${APP_SLUG}.caddy"
	cat <<EOF >&2
❌ Missing TLS certs at ${CERT_DIR}/ujx.test{.pem,-key.pem}.

On your Mac, run:
  mkcert -cert-file /tmp/ujx.test.pem -key-file /tmp/ujx.test-key.pem ujx.test "*.ujx.test"
  scp /tmp/ujx.test*.pem 100.73.90.42:${CERT_DIR}/

Then re-run this script.
EOF
	exit 1
fi

# ─── Sanity: template in place ───────────────────────────────────────────
if [[ ! -f "${TEMPLATE}" ]]; then
	echo "❌ Missing template ${TEMPLATE}" >&2
	exit 1
fi

# ─── Kill prior dev (use recorded port if we know it) ────────────────────
if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
	OLD_PID="$(cat "${PID_FILE}")"
	echo "→ Killing prior dev (pid ${OLD_PID})"
	kill "${OLD_PID}" 2>/dev/null || true
	# Give it a moment to release the port
	for _ in 1 2 3 4 5; do
		kill -0 "${OLD_PID}" 2>/dev/null || break
		sleep 1
	done
	kill -9 "${OLD_PID}" 2>/dev/null || true
fi
# Drop the stale conf.d entry so its old port doesn't linger across restarts
rm -f "${CONF_D}/${APP_SLUG}.caddy"

# ─── Pick a free port ────────────────────────────────────────────────────
PORT="$(bash "${FIND_PORT}" "${PORT_BASE}")"
echo "${PORT}" > "${PORT_FILE}"
echo "→ Picked port ${PORT}"

# ─── Render Caddy fragment with chosen port ──────────────────────────────
mkdir -p "${CONF_D}"
sed "s/{{PORT}}/${PORT}/g" "${TEMPLATE}" > "${CONF_D}/${APP_SLUG}.caddy"

# ─── Start Next.js dev (background) ──────────────────────────────────────
echo "→ Starting next dev on 0.0.0.0:${PORT}"
nohup npx next dev -H 0.0.0.0 -p "${PORT}" \
	> "${REPO_ROOT}/.dev.log" 2>&1 &
DEV_PID=$!
echo "${DEV_PID}" > "${PID_FILE}"
echo "  pid=${DEV_PID} log=${REPO_ROOT}/.dev.log"

# ─── Wait for Next to bind ───────────────────────────────────────────────
for i in $(seq 1 30); do
	if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
		echo "✓ Next.js up on :${PORT}"
		break
	fi
	sleep 1
	if [[ "${i}" == "30" ]]; then
		echo "❌ Next.js did not bind within 30s — check .dev.log" >&2
		exit 1
	fi
done

# ─── Reload Caddy (admin API or sudo fallback) ───────────────────────────
if curl -fsS "${CADDY_ADMIN}/config/" >/dev/null 2>&1; then
	echo "→ Reloading Caddy"
	export FMOS_CERT_DIR
	sudo -E caddy reload --config "${FMOS_CADDYFILE}"
	echo "✓ Caddy reloaded"
else
	echo "⚠️  Caddy admin API unreachable at ${CADDY_ADMIN} — start FMOSV2 dev stack first." >&2
fi

# ─── Smoke test via Caddy ────────────────────────────────────────────────
if curl -fsS -k --resolve ujx.test:443:127.0.0.1 https://ujx.test/ -o /dev/null; then
	echo "✓ https://ujx.test → :${PORT} via Caddy reachable from VPS"
else
	echo "⚠️  Smoke test failed — check ${REPO_ROOT}/.dev.log and caddy.log" >&2
fi

cat <<EOF

────────────────────────────────────────────────────────────────
UJX dev is up:
  Port:          ${PORT}  (recorded in ${PORT_FILE})
  Local (VPS):   http://127.0.0.1:${PORT}
  Via Caddy:     https://ujx.test  (from your Mac, after /etc/hosts)

To reach it from your Mac, ensure /etc/hosts has:
  100.73.90.42  ujx.test

Logs:  tail -f ${REPO_ROOT}/.dev.log
Stop:  bash ${REPO_ROOT}/scripts/dev-down.sh
────────────────────────────────────────────────────────────────
EOF
