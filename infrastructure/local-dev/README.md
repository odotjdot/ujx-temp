# UJX Local Dev

Dynamic-port reverse-proxy setup for `https://ujx.test`. Each launch picks a free port; the Caddy fragment is rendered fresh with that port and dropped into the shared conf.d.

## How it works

```
infrastructure/local-dev/
  ujx.caddy.template     ← {{PORT}} placeholder (committed)
  certs/                 ← mkcert-minted (gitignored)

scripts/
  dev-up.sh              ← pick free port → render template → start next dev → reload Caddy
  dev-down.sh            ← kill process → remove fragment → reload Caddy
```

The shared infrastructure lives at `/Users/odotjdot/APPS/local-dev/`:

```
bin/find-free-port.sh    ← scans BASE..BASE+99 for a free TCP port
conf.d/                  ← rendered fragments, one per RUNNING app (gitignored)
```

The FMOSV2 Caddyfile imports everything in `conf.d/*.caddy`, so dropping a rendered fragment there is enough — Caddy reload picks it up.

## First-time setup

### 1. Mint TLS certs on your Mac

```bash
mkcert -cert-file /tmp/ujx.test.pem -key-file /tmp/ujx.test-key.pem ujx.test "*.ujx.test"
scp /tmp/ujx.test*.pem 100.73.90.42:/Users/odotjdot/APPS/ujx-temp/infrastructure/local-dev/certs/
rm /tmp/ujx.test*.pem
```

### 2. Map ujx.test on your Mac

```
100.73.90.42  ujx.test
```

(Append to `/etc/hosts`. `100.73.90.42` is the VPS Tailscale IP.)

### 3. Start UJX dev on the VPS

```bash
cd /Users/odotjdot/APPS/ujx-temp
bash scripts/dev-up.sh
```

The script prints which port was chosen. `https://ujx.test` always proxies there.

### 4. Stop UJX dev

```bash
bash scripts/dev-down.sh
```

## Adding a new app on this VPS

Copy the pattern. Each app owns:

- `infrastructure/local-dev/<app>.caddy.template` (with `{{PORT}}` placeholder, hostname hardcoded)
- `infrastructure/local-dev/certs/` (mkcert-minted, gitignored)
- `scripts/dev-up.sh` + `scripts/dev-down.sh` (copy + change `APP_SLUG` and the launch command)

No FMOSV2 edits needed — the import glob in FMOSV2's Caddyfile picks up any `*.caddy` dropped into `/Users/odotjdot/APPS/local-dev/conf.d/`.

## Troubleshooting

- **Browser shows cert warning**: cert was minted by a different CA than the one your Mac trusts. Re-mint on the Mac that has the trusted mkcert root.
- **`https://ujx.test` times out from Mac**: confirm `tailscale status` shows the VPS online and `/etc/hosts` has `100.73.90.42 ujx.test`.
- **502 / Bad Gateway**: dev process died. `tail .dev.log` and re-run `dev-up.sh`.
- **"This site is being set up"**: app fallback when WP returns no front page. Check `app/page.tsx`'s `WP_GRAPHQL` URL and that `https://hq.funkmedia.net/<tenant_id>/graphql` is reachable.
- **Caddy reload silently no-ops**: `sudo journalctl -u caddy -n 30` for errors. The rendered fragment must be valid Caddyfile syntax.
