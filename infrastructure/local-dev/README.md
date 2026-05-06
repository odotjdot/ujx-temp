# UJX Local Dev

This directory holds the Caddy reverse-proxy fragment + TLS certs for `https://ujx.test`.

The fragment is auto-imported by the FMOSV2 Caddyfile via the shared conf.d drop-in:

```
import /Users/odotjdot/APPS/local-dev/conf.d/*.caddy
```

UJX's `ujx.caddy` is symlinked into that directory:

```
/Users/odotjdot/APPS/local-dev/conf.d/ujx.caddy
  → /Users/odotjdot/APPS/ujx-temp/infrastructure/local-dev/ujx.caddy
```

## Files

- `ujx.caddy` — Caddy site block (`ujx.test, *.ujx.test` → `127.0.0.1:3010`).
- `certs/ujx.test.pem`, `certs/ujx.test-key.pem` — mkcert-minted, **not** committed (gitignored).

The `dev-up.sh` script makes/refreshes the symlink in `/Users/odotjdot/APPS/local-dev/conf.d/` if it's missing.

## First-time setup

### 1. Mint TLS certs on your Mac

mkcert's root CA lives on your Mac (already trusted by your browser, since `funkmedia.test` works). Mint the cert there and ship it to the VPS:

```bash
# On your Mac:
mkcert -cert-file /tmp/ujx.test.pem -key-file /tmp/ujx.test-key.pem ujx.test "*.ujx.test"
scp /tmp/ujx.test*.pem 100.73.90.42:/Users/odotjdot/APPS/ujx-temp/infrastructure/local-dev/certs/
rm /tmp/ujx.test*.pem
```

### 2. Map ujx.test on your Mac

Add to `/etc/hosts` on your Mac (one time):

```
100.73.90.42  ujx.test
```

(`100.73.90.42` is the VPS Tailscale IP — run `tailscale status` to confirm.)

### 3. Start UJX dev on the VPS

```bash
# On the VPS:
cd /Users/odotjdot/APPS/ujx-temp
bash scripts/dev-up.sh
```

This starts `next dev` on `0.0.0.0:3010` and reloads Caddy. After a few seconds, `https://ujx.test` should load in your Mac browser.

## How it stays decoupled from FMOSV2

- `ujx.caddy` lives in this repo, not in FMOSV2.
- FMOSV2's `regen-local-dev.sh` writes one `import` glob that picks up any `*.caddy` fragment in `/Users/odotjdot/APPS/<app>/infrastructure/local-dev/`. Future apps drop a fragment and they're auto-included.
- Re-running FMOSV2's regen does not touch this fragment or these certs.

## Troubleshooting

- **Browser shows cert warning**: the cert was minted by a different CA than the one your Mac trusts. Re-mint per step 1 from the Mac that already has its mkcert root installed.
- **`https://ujx.test` times out**: confirm `tailscale status` shows the VPS online and `/etc/hosts` has `100.73.90.42 ujx.test`.
- **502 / Bad Gateway**: `next dev` isn't on 3010. `tail -f .dev.log` and `bash scripts/dev-up.sh` again.
- **Caddy reload silently no-ops**: `sudo journalctl -u caddy -n 30` for errors. The fragment must be valid Caddyfile syntax.
