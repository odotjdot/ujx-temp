#!/usr/bin/env bash
# UJX dev launcher — starts Next.js on 0.0.0.0:3010 and reloads Caddy so
# https://ujx.test routes to it. Re-runnable; kills any prior instance on 3010.
#
# Caddy and the FMOSV2 Caddyfile are owned by FMOSV2 — this script only
# touches UJX's own fragment + reloads Caddy after FMOSV2's main config has
# imported the fragment.

set -euo pipefail
# Source nvm so npx is on PATH in non-interactive SSH sessions
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"


REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3010
CERT_DIR="${REPO_ROOT}/infrastructure/local-dev/certs"
CADDY_ADMIN="http://localhost:2019"
FMOS_CADDYFILE="/Users/odotjdot/wpserver-local/FM/FMOSV2/infrastructure/local-dev/Caddyfile"
FMOS_CERT_DIR="/Users/odotjdot/wpserver-local/FM/FMOSV2/infrastructure/local-dev/certs"
PID_FILE="${REPO_ROOT}/.dev-pid"

cd "${REPO_ROOT}"

CONF_D="/Users/odotjdot/APPS/local-dev/conf.d"

# ─── Sanity: certs in place ──────────────────────────────────────────────
# Symlinking ujx.caddy into conf.d BEFORE the cert exists would break the
# next FMOSV2 Caddy reload (TLS load fails). So we gate the symlink on
# certs being present.
if [[ ! -f "${CERT_DIR}/ujx.test.pem" || ! -f "${CERT_DIR}/ujx.test-key.pem" ]]; then
	# Defensive: remove any stale symlink to avoid breaking other reloads.
	rm -f "${CONF_D}/ujx.caddy"
	cat <<EOF >&2
❌ Missing TLS certs at ${CERT_DIR}/ujx.test{.pem,-key.pem}.

On your Mac, run:
  mkcert -cert-file /tmp/ujx.test.pem -key-file /tmp/ujx.test-key.pem ujx.test "*.ujx.test"
  scp /tmp/ujx.test*.pem 100.73.90.42:${CERT_DIR}/

Then re-run this script.
EOF
	exit 1
fi

# ─── Register fragment with Caddy (idempotent symlink) ────────────────────
mkdir -p "${CONF_D}"
ln -sfn "${REPO_ROOT}/infrastructure/local-dev/ujx.caddy" "${CONF_D}/ujx.caddy"

# ─── Kill prior dev on PORT ──────────────────────────────────────────────
if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
	echo "→ Killing prior dev (pid $(cat "${PID_FILE}"))"
	kill "$(cat "${PID_FILE}")" 2>/dev/null || true
	sleep 1
fi
# Also clear anyone else squatting on PORT (e.g. orphaned next-server)
if PIDS="$(ss -tlnp "( sport = :${PORT} )" 2>/dev/null | awk -F'pid=' 'NR>1 {split($2, a, ","); print a[1]}' | sort -u)"; then
	for p in ${PIDS}; do
		echo "→ Killing squatter on :${PORT} (pid ${p})"
		kill "${p}" 2>/dev/null || true
	done
fi

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

# ─── Reload Caddy so it picks up the imported ujx.test fragment ──────────
if curl -fsS "${CADDY_ADMIN}/config/" >/dev/null 2>&1; then
	echo "→ Reloading Caddy"
	export FMOS_CERT_DIR
	sudo -E caddy reload --config "${FMOS_CADDYFILE}"
	echo "✓ Caddy reloaded"
else
	echo "⚠️  Caddy admin API unreachable at ${CADDY_ADMIN} — start FMOSV2 dev stack first." >&2
fi

# ─── Smoke test ──────────────────────────────────────────────────────────
if curl -fsS -k -H 'Host: ujx.test' https://127.0.0.1/ -o /dev/null; then
	echo "✓ https://ujx.test → :${PORT} via Caddy reachable from VPS"
else
	echo "⚠️  Smoke test failed — Caddy may not have reloaded; check caddy.log" >&2
fi

cat <<EOF

────────────────────────────────────────────────────────────────
UJX dev is up:
  Local (VPS):   http://127.0.0.1:${PORT}
  Via Caddy:     https://ujx.test  (from the Mac, after /etc/hosts)

To reach it from your Mac, ensure /etc/hosts has:
  100.73.90.42  ujx.test

Logs:  tail -f ${REPO_ROOT}/.dev.log
Stop:  kill \$(cat ${PID_FILE})
────────────────────────────────────────────────────────────────
EOF
