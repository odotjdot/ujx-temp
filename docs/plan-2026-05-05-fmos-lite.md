# FMOS-Lite Template + UJX Stable Launch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a forkable Next.js 15 App Router template ("FMOS-lite") on top of ujx-temp that delivers content + contact + WooCommerce store + customer dashboard + admin console, and ship `ujamaaexpo.com` as the first live instance.

**Architecture:** Next.js 15 App Router frontend on the existing ujx-temp base. WooCommerce on `hq.funkmedia.net` for products/cart/orders (ported from incpros-fe with bug fixes). New MySQL DB `fm_temp_sites_v1` on `fm-aurora-cluster` for lead capture (isolated from FMOS Postgres). New Cognito User Pool (separate from FMOS Cognito) with admin + customer roles. Stripe via WooCommerce gateway. Per-site forks via env config + nav surface flags.

**Tech Stack:** Next.js 15.1, React 19, TypeScript, Tailwind 3.4, MySQL2 (Node driver), `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-ses`, Stripe Node SDK + Stripe Elements, `html-react-parser` (existing), reCAPTCHA v3 (server-verified).

---

## File Structure

**New files (lib + infra):**
- `lib/db.ts` — MySQL connection pool factory (RDS via SSH tunnel in dev, RDS Proxy in prod)
- `lib/recaptcha.ts` — server-side reCAPTCHA v3 verification
- `lib/email.ts` — AWS SES sender
- `lib/cognito.ts` — Cognito SDK wrapper (sign in, sign up, refresh, get user)
- `lib/cart-total.ts` — currency-safe cart total parser (REPLACES the broken regex)
- `lib/wc-session.ts` — WooCommerce session token capture/replay (port from `faust.config.js`)
- `lib/stripe-client.ts` — Stripe SDK init + helpers
- `lib/wc-graphql.ts` — minimal WPGraphQL client (no Apollo, just typed fetch)
- `middleware.ts` — App Router auth gate for `/dashboard/*` and `/console/*`
- `sql/001-contact-submissions.sql` — initial schema
- `sql/002-cognito-wc-link.sql` — wc_user_meta extension
- `scripts/db-shell.sh` — open SSH tunnel + mysql shell for ops
- `scripts/db-migrate.sh` — apply SQL migrations
- `scripts/provision-cognito.sh` — provision the User Pool + clients
- `scripts/seed-admin.sh` — seed OJ admin user
- `.env.local.sample` — updated with all new env vars

**New files (routes — Sprint 1):**
- `app/api/contact/route.ts` — REWRITE (replaces broken FMBH call)

**New files (routes — Sprint 2):**
- `app/console/login/page.tsx` — admin login form
- `app/console/page.tsx` — admin home (lead viewer)
- `app/api/console/leads/route.ts` — paginated lead query
- `app/shop/page.tsx` — product listing
- `app/shop/[slug]/page.tsx` — single product
- `app/cart/page.tsx` — cart page
- `app/checkout/page.tsx` — checkout (FIXES bugs #1-3, #5)
- `app/order-confirmation/page.tsx` — confirmation (FIXES bug #5)
- `app/api/stripe-webhook/route.ts` — webhook handler (FIXES bug #4)
- `components/store/*` — ported storefront components
- `components/console/*` — admin UI components

**New files (routes — Sprint 3):**
- `app/login/page.tsx` — customer login
- `app/signup/page.tsx` — customer signup
- `app/forgot-password/page.tsx` — password reset
- `app/dashboard/layout.tsx` — Ncmaz chassis (sidebar + top nav)
- `app/dashboard/page.tsx` — customer home
- `app/dashboard/profile/page.tsx` — profile editor
- `app/dashboard/orders/page.tsx` — order history
- `app/console/orders/page.tsx` — admin orders
- `app/console/customers/page.tsx` — admin customers
- `app/console/products/page.tsx` — admin products
- `components/dashboard/*` — ported Ncmaz dashboard components
- `CLONE.md` — fork playbook

**Modify (existing ujx-temp files):**
- `app/layout.tsx` — wrap `getThemeCSS()` in try/catch, add nav surface awareness
- `app/page.tsx` — proper fallback when WP returns no front page; remove silent `wpforms` filter
- `app/api/contact/route.ts` — full rewrite (see Sprint 1)
- `package.json` — add new deps
- `next.config.js` — add Cognito domain, expand image patterns
- `.gitignore` — add `.env.local`, `.next/`, etc. (already present, verify)

---

## Conventions used throughout

- **TDD where bugs lurk** (cart math, recaptcha, currency parsing, idempotency, auth verification) — write failing test first, then minimal fix
- **Verification-only for infra** (Cognito provision, MySQL provision, deploys) — provision then run a verification command
- **Commits are small and frequent** — every task ends with a commit
- **All env vars referenced are added to `.env.local.sample` in the same commit** — no orphan env references
- **No silent failures** — all error paths log + surface to user (no swallowed catches)

---

# SPRINT 1 — UJX Stable Foundation

**Goal:** ujx-temp builds clean, contact form actually lands leads in MySQL, Cognito User Pool exists and OJ can authenticate against it. Eventbrite ticket link still works (we haven't built the store yet — that's Sprint 2).

**Estimated:** 2 days

---

### Task 1.1: Stability fix — theme CSS error handling

**Why:** `app/layout.tsx:31` calls `getThemeCSS()` with no try/catch. If `hq.funkmedia.net` returns 500 or times out, the root layout throws and the entire site crashes to a generic error page. Need a safe fallback.

**Files:**
- Modify: `/Users/odotjdot/wpserver-local/ujx-temp/app/layout.tsx`
- Test: `/Users/odotjdot/wpserver-local/ujx-temp/__tests__/layout-theme-fallback.test.ts`

- [ ] **Step 1: Install Vitest + Testing Library**

```bash
cd /Users/odotjdot/wpserver-local/ujx-temp
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom', globals: true, setupFiles: [] },
})
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/layout-theme-fallback.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getThemeCSS', () => {
  let originalFetch: typeof fetch
  beforeEach(() => { originalFetch = global.fetch })
  afterEach(() => { global.fetch = originalFetch })

  it('returns empty string when WP fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const { getThemeCSS } = await import('../app/layout')
    const css = await getThemeCSS()
    expect(css).toBe('')
  })

  it('returns empty string when WP returns 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' } as any)
    const { getThemeCSS } = await import('../app/layout')
    const css = await getThemeCSS()
    expect(css).toBe('')
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

```bash
npm test -- layout-theme-fallback
```
Expected: FAIL — `getThemeCSS` is not exported, or it throws on fetch failure.

- [ ] **Step 4: Refactor `app/layout.tsx` — export `getThemeCSS`, add try/catch and ok-check**

Replace the existing `getThemeCSS` in `app/layout.tsx`:
```typescript
export async function getThemeCSS(): Promise<string> {
  try {
    const res = await fetch(
      'https://hq.funkmedia.net/ujamaaexpo/wp-json/fm-styles/v1/theme.css',
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) {
      console.error('[layout] theme.css fetch failed:', res.status)
      return ''
    }
    const raw = await res.text()
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'string' ? parsed : raw
    } catch {
      return raw
    }
  } catch (err) {
    console.error('[layout] theme.css fetch threw:', err)
    return ''
  }
}
```

- [ ] **Step 5: Run test, verify it passes**

```bash
npm test -- layout-theme-fallback
```
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx __tests__/layout-theme-fallback.test.ts vitest.config.ts package.json package-lock.json
git commit -m "fix(layout): graceful fallback when WP theme CSS fetch fails

Wraps getThemeCSS in try/catch and returns empty string on any failure
(network error, 500 response, JSON parse error). Previously, any failure
crashed the entire root layout and took the whole site down."
```

---

### Task 1.2: Stability fix — homepage fallback when WP returns no front page

**Why:** `app/page.tsx:50` shows an inline-styled "Loading..." div if WP returns no front page configuration. Looks broken to users. Need a proper not-configured fallback (uses theme styling, has a real message).

**Files:**
- Modify: `/Users/odotjdot/wpserver-local/ujx-temp/app/page.tsx`
- Test: `/Users/odotjdot/wpserver-local/ujx-temp/__tests__/home-fallback.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/home-fallback.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('HomePage fallback', () => {
  let originalFetch: typeof fetch
  beforeEach(() => { originalFetch = global.fetch })
  afterEach(() => { global.fetch = originalFetch })

  it('renders a useful message when WP front page is not configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { allSettings: { readingSettingsShowOnFront: 'posts' } } }),
    } as any)
    const HomePage = (await import('../app/page')).default
    const ui = await HomePage()
    render(ui as any)
    expect(screen.getByText(/site is being set up|no front page configured/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- home-fallback
```
Expected: FAIL — current fallback says "Loading..." not the new message.

- [ ] **Step 3: Replace the fallback in `app/page.tsx`**

In `app/page.tsx`, replace lines 50-52 (the `if (!page)` branch) with:
```tsx
if (!page) {
  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>This site is being set up.</h1>
      <p style={{ color: 'var(--wp--preset--color--bone, #999)', maxWidth: '500px', margin: '0 auto' }}>
        No front page is configured yet. If you&apos;re the admin, set a static front page in WordPress &gt; Settings &gt; Reading.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- home-fallback
```
Expected: PASS.

- [ ] **Step 5: Also remove the silent `wpforms` filter (decision: drop it)**

In `app/page.tsx`, change line 67-68 from:
```tsx
if (html.includes('wpforms')) return null
const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
```
to:
```tsx
// Strip <script> tags from any WP-rendered block content (WP HTML can contain script blocks)
const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
```

(The wpforms filter silently dropped any WP page block named wpforms. We're replacing forms with our own React form at /contact, so silently dropping any wpforms block is the right behavior — but make it explicit if/when we re-introduce. For v1, just stop dropping anything silently. Forms will be wired via /contact route, not WP blocks.)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx __tests__/home-fallback.test.tsx
git commit -m "fix(home): proper fallback when WP front page not configured

Replaces inline-styled 'Loading...' with a real explanatory message that
tells admins how to fix it. Also removes silent wpforms block filter
(forms now live at /contact, not in WP block content)."
```

---

### Task 1.3: Add new dependencies

**Why:** Sprint 1+2 needs `mysql2`, AWS SDK clients, Stripe SDK. Get them installed and committed up front so subsequent tasks don't bloat their commits.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/odotjdot/wpserver-local/ujx-temp
npm install mysql2 \
  @aws-sdk/client-cognito-identity-provider \
  @aws-sdk/client-ses \
  amazon-cognito-identity-js \
  stripe \
  @stripe/stripe-js \
  @stripe/react-stripe-js
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('mysql2'); require('@aws-sdk/client-cognito-identity-provider'); require('stripe'); console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mysql2, AWS SDK, Stripe deps for FMOS-lite build"
```

---

### Task 1.4: Provision MySQL database `fm_temp_sites_v1`

**Why:** Lead submissions need a destination. Creates a new database on the existing `fm-aurora-cluster` (MySQL Aurora) — isolated from FMOS prod (which is on `fm-aurora-pg-cluster` Postgres). Same cluster, separate DB.

**Files:**
- Create: `scripts/db-shell.sh` (helper for ops)

- [ ] **Step 1: Write `scripts/db-shell.sh` — opens SSH tunnel + mysql client**

Create `scripts/db-shell.sh`:
```bash
#!/usr/bin/env bash
# Open SSH tunnel through hq EC2, then drop into mysql shell.
# Tunnel persists for the duration of the shell.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/Users/odotjdot/APPS/.env.fmos.local}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }
# shellcheck disable=SC1090
source <(grep -E '^(FMBH_RDS_|REMOTE_DEV_1_)' "$ENV_FILE" | sed 's/^/export /')

LOCAL_PORT="${LOCAL_PORT:-13306}"

# Kill any pre-existing tunnel on the port
existing=$(lsof -ti :"$LOCAL_PORT" 2>/dev/null || true)
[ -n "$existing" ] && kill "$existing" 2>/dev/null || true

ssh -o ExitOnForwardFailure=yes \
  -L "${LOCAL_PORT}:${FMBH_RDS_HOST}:${FMBH_RDS_PORT}" \
  -N -f \
  "${REMOTE_DEV_1_USER}@${REMOTE_DEV_1_HOST}"

echo "Tunnel up on 127.0.0.1:${LOCAL_PORT}"

# Drop into mysql (assumes mysql client installed; install via brew if missing)
if ! command -v mysql >/dev/null; then
  echo "mysql client not found. Install with: brew install mysql-client"
  echo "Tunnel left open. Connect manually: mysql -h 127.0.0.1 -P ${LOCAL_PORT} -u ${FMBH_RDS_USER} -p"
  exit 0
fi

mysql -h 127.0.0.1 -P "$LOCAL_PORT" -u "$FMBH_RDS_USER" -p"$FMBH_RDS_PASSWORD" "$@"
```

```bash
chmod +x scripts/db-shell.sh
```

- [ ] **Step 2: Install mysql client (one-time)**

```bash
brew install mysql-client
echo 'export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"' >> ~/.zshrc
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
mysql --version
```
Expected: prints mysql client version.

- [ ] **Step 3: Create the database**

```bash
./scripts/db-shell.sh -e "CREATE DATABASE IF NOT EXISTS fm_temp_sites_v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
./scripts/db-shell.sh -e "SHOW DATABASES LIKE 'fm_temp_sites_v1';"
```
Expected: second command prints `fm_temp_sites_v1`.

- [ ] **Step 4: Commit**

```bash
git add scripts/db-shell.sh
git commit -m "infra: db-shell.sh helper + create fm_temp_sites_v1 database

Opens SSH tunnel through hq EC2 (Aurora is VPC-only per FMOS doctrine)
and drops into mysql shell. Created the new fm_temp_sites_v1 DB on
fm-aurora-cluster (MySQL) — isolated from FMOS Postgres prod."
```

---

### Task 1.5: Create `contact_submissions` schema + apply migration

**Files:**
- Create: `sql/001-contact-submissions.sql`
- Create: `scripts/db-migrate.sh`

- [ ] **Step 1: Write the schema**

Create `sql/001-contact-submissions.sql`:
```sql
USE fm_temp_sites_v1;

CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  source_site VARCHAR(255) NOT NULL,
  form_name VARCHAR(64) NOT NULL DEFAULT 'contact',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  ip VARCHAR(45),
  user_agent VARCHAR(500),
  referrer VARCHAR(500),
  recaptcha_score DECIMAL(3,2),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_tenant_created (tenant_id, created_at DESC),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Write `scripts/db-migrate.sh`**

Create `scripts/db-migrate.sh`:
```bash
#!/usr/bin/env bash
# Apply all SQL files in sql/ in order. Idempotent (uses CREATE TABLE IF NOT EXISTS).
set -euo pipefail

ENV_FILE="${ENV_FILE:-/Users/odotjdot/APPS/.env.fmos.local}"
source <(grep -E '^(FMBH_RDS_|REMOTE_DEV_1_)' "$ENV_FILE" | sed 's/^/export /')

LOCAL_PORT="${LOCAL_PORT:-13306}"
existing=$(lsof -ti :"$LOCAL_PORT" 2>/dev/null || true)
[ -z "$existing" ] && ssh -o ExitOnForwardFailure=yes \
  -L "${LOCAL_PORT}:${FMBH_RDS_HOST}:${FMBH_RDS_PORT}" \
  -N -f "${REMOTE_DEV_1_USER}@${REMOTE_DEV_1_HOST}"

for f in sql/*.sql; do
  echo "Applying $f"
  mysql -h 127.0.0.1 -P "$LOCAL_PORT" -u "$FMBH_RDS_USER" -p"$FMBH_RDS_PASSWORD" < "$f"
done

echo "All migrations applied."
```

```bash
chmod +x scripts/db-migrate.sh
```

- [ ] **Step 3: Apply the migration**

```bash
./scripts/db-migrate.sh
```
Expected: `Applying sql/001-contact-submissions.sql` then `All migrations applied.`

- [ ] **Step 4: Verify schema**

```bash
./scripts/db-shell.sh fm_temp_sites_v1 -e "DESCRIBE contact_submissions;"
```
Expected: 13 columns matching the schema.

- [ ] **Step 5: Commit**

```bash
git add sql/001-contact-submissions.sql scripts/db-migrate.sh
git commit -m "infra: contact_submissions schema + db-migrate.sh

First migration applied to fm_temp_sites_v1. Includes idx_tenant_created
for the /console lead listing query, idx_email for dedup checks."
```

---

### Task 1.6: Provision scoped IAM user `fm_tempsites_writer` for app runtime

**Why:** App writes leads to MySQL via Aurora. Should NOT use the `fmbh_admin` superuser. Create a scoped MySQL user with INSERT/SELECT only on `fm_temp_sites_v1.*`.

**Files:**
- Create: `sql/002-runtime-user.sql`

- [ ] **Step 1: Write the user-create migration**

Create `sql/002-runtime-user.sql`:
```sql
-- Scoped runtime user for the temp sites app.
-- Password placeholder: replace via MYSQL_PWD env at apply time, or use Secrets Manager rotation later.
CREATE USER IF NOT EXISTS 'fm_tempsites_writer'@'%' IDENTIFIED BY 'PLACEHOLDER_REPLACE_AT_APPLY';
GRANT SELECT, INSERT ON fm_temp_sites_v1.* TO 'fm_tempsites_writer'@'%';
FLUSH PRIVILEGES;
```

- [ ] **Step 2: Generate a strong password and apply manually (NOT via repo file)**

```bash
NEW_PWD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
echo "Generated password (save to .env.fmos.local as TEMPSITES_DB_PASSWORD): $NEW_PWD"
./scripts/db-shell.sh -e "
CREATE USER IF NOT EXISTS 'fm_tempsites_writer'@'%' IDENTIFIED BY '$NEW_PWD';
GRANT SELECT, INSERT ON fm_temp_sites_v1.* TO 'fm_tempsites_writer'@'%';
FLUSH PRIVILEGES;
SELECT user, host FROM mysql.user WHERE user='fm_tempsites_writer';
"
```
Expected: prints the user row.

- [ ] **Step 3: Save creds to env file**

Append to `/Users/odotjdot/APPS/.env.fmos.local`:
```
TEMPSITES_DB_HOST=fm-aurora-cluster.cluster-c9uucskkubpc.us-west-1.rds.amazonaws.com
TEMPSITES_DB_PORT=3306
TEMPSITES_DB_NAME=fm_temp_sites_v1
TEMPSITES_DB_USER=fm_tempsites_writer
TEMPSITES_DB_PASSWORD=<paste from step 2>
```

- [ ] **Step 4: Verify the scoped user can connect via tunnel**

```bash
mysql -h 127.0.0.1 -P 13306 -u fm_tempsites_writer -p"$NEW_PWD" fm_temp_sites_v1 \
  -e "INSERT INTO contact_submissions (tenant_id, source_site, name, email, message) VALUES ('test','test','test','t@t.t','test'); SELECT COUNT(*) FROM contact_submissions; DELETE FROM contact_submissions WHERE tenant_id='test';"
```
Expected: insert succeeds, COUNT shows row, delete removes it.

- [ ] **Step 5: Commit (the SQL file with placeholder, not the real password)**

```bash
git add sql/002-runtime-user.sql
git commit -m "infra: scoped MySQL runtime user fm_tempsites_writer

INSERT/SELECT only on fm_temp_sites_v1. Password generated out-of-band
and stored in .env.fmos.local; rotate via Secrets Manager when needed."
```

---

### Task 1.7: `lib/db.ts` — MySQL connection wrapper

**Files:**
- Create: `lib/db.ts`
- Test: `__tests__/db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/db.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

describe('lib/db', () => {
  it('exports a getPool() that returns a pool with query method', async () => {
    process.env.TEMPSITES_DB_HOST = '127.0.0.1'
    process.env.TEMPSITES_DB_PORT = '13306'
    process.env.TEMPSITES_DB_USER = 'test'
    process.env.TEMPSITES_DB_PASSWORD = 'test'
    process.env.TEMPSITES_DB_NAME = 'fm_temp_sites_v1'
    const { getPool } = await import('../lib/db')
    const pool = getPool()
    expect(typeof pool.query).toBe('function')
    expect(typeof pool.end).toBe('function')
  })

  it('throws explicit error if any required env var is missing', async () => {
    delete process.env.TEMPSITES_DB_HOST
    vi.resetModules()
    const { getPool } = await import('../lib/db')
    expect(() => getPool()).toThrow(/TEMPSITES_DB_HOST/)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- db.test
```
Expected: FAIL — `lib/db` doesn't exist.

- [ ] **Step 3: Write `lib/db.ts`**

Create `lib/db.ts`:
```typescript
import mysql, { type Pool } from 'mysql2/promise'

let pool: Pool | null = null

const REQUIRED = ['TEMPSITES_DB_HOST', 'TEMPSITES_DB_PORT', 'TEMPSITES_DB_USER', 'TEMPSITES_DB_PASSWORD', 'TEMPSITES_DB_NAME'] as const

export function getPool(): Pool {
  if (pool) return pool

  for (const v of REQUIRED) {
    if (!process.env[v]) {
      throw new Error(`Missing required env var: ${v}`)
    }
  }

  pool = mysql.createPool({
    host: process.env.TEMPSITES_DB_HOST!,
    port: Number(process.env.TEMPSITES_DB_PORT!),
    user: process.env.TEMPSITES_DB_USER!,
    password: process.env.TEMPSITES_DB_PASSWORD!,
    database: process.env.TEMPSITES_DB_NAME!,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  })

  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- db.test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts __tests__/db.test.ts
git commit -m "feat(lib): MySQL connection pool wrapper with strict env validation"
```

---

### Task 1.8: `lib/recaptcha.ts` — server-side reCAPTCHA v3 verification

**Why:** Current `app/api/contact/route.ts` accepts a `recaptchaToken` from the client and ignores it. Bots bypass freely. Server must call Google's siteverify and reject low scores.

**Files:**
- Create: `lib/recaptcha.ts`
- Test: `__tests__/recaptcha.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/recaptcha.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('verifyRecaptcha', () => {
  let originalFetch: typeof fetch
  beforeEach(() => {
    originalFetch = global.fetch
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret'
  })
  afterEach(() => { global.fetch = originalFetch })

  it('returns score when verification succeeds with action match', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, score: 0.9, action: 'contact' }) } as any)
    const { verifyRecaptcha } = await import('../lib/recaptcha')
    const r = await verifyRecaptcha('valid-token', 'contact')
    expect(r.ok).toBe(true)
    expect(r.score).toBe(0.9)
  })

  it('rejects when score is below threshold (default 0.5)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, score: 0.3, action: 'contact' }) } as any)
    const { verifyRecaptcha } = await import('../lib/recaptcha')
    const r = await verifyRecaptcha('valid-token', 'contact')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/score/i)
  })

  it('rejects when action does not match', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, score: 0.9, action: 'spam' }) } as any)
    const { verifyRecaptcha } = await import('../lib/recaptcha')
    const r = await verifyRecaptcha('valid-token', 'contact')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/action/i)
  })

  it('rejects when Google says success=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) } as any)
    const { verifyRecaptcha } = await import('../lib/recaptcha')
    const r = await verifyRecaptcha('bad-token', 'contact')
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- recaptcha.test
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `lib/recaptcha.ts`**

Create `lib/recaptcha.ts`:
```typescript
export type RecaptchaResult =
  | { ok: true; score: number }
  | { ok: false; reason: string }

const SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify'
const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.5')

export async function verifyRecaptcha(token: string, expectedAction: string): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return { ok: false, reason: 'RECAPTCHA_SECRET_KEY not configured' }
  if (!token) return { ok: false, reason: 'no token provided' }

  const body = new URLSearchParams({ secret, response: token })
  const res = await fetch(SITEVERIFY, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  if (!res.ok) return { ok: false, reason: `siteverify HTTP ${res.status}` }

  const data = await res.json() as { success: boolean; score?: number; action?: string; 'error-codes'?: string[] }
  if (!data.success) return { ok: false, reason: `siteverify failed: ${data['error-codes']?.join(',') ?? 'unknown'}` }
  if (data.action !== expectedAction) return { ok: false, reason: `action mismatch: got ${data.action}, expected ${expectedAction}` }
  const score = data.score ?? 0
  if (score < MIN_SCORE) return { ok: false, reason: `score ${score} below threshold ${MIN_SCORE}` }

  return { ok: true, score }
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
npm test -- recaptcha.test
```
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add lib/recaptcha.ts __tests__/recaptcha.test.ts
git commit -m "feat(lib): server-side reCAPTCHA v3 verification

Verifies the token Google returned to the client, checks success/action
match, and enforces a min score (default 0.5, configurable via
RECAPTCHA_MIN_SCORE). Replaces the theatrical client-only check that
was previously in the contact route."
```

---

### Task 1.9: `lib/email.ts` — AWS SES sender

**Why:** Need to email OJ when a lead lands. Also used later for order confirmations.

**Files:**
- Create: `lib/email.ts`
- Test: `__tests__/email.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/email.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ MessageId: 'fake-id-123' }),
  })),
  SendEmailCommand: vi.fn(),
}))

describe('sendEmail', () => {
  it('returns messageId on success', async () => {
    process.env.AWS_REGION = 'us-west-1'
    process.env.SES_FROM_ADDRESS = 'noreply@funkmedia.io'
    const { sendEmail } = await import('../lib/email')
    const result = await sendEmail({ to: 'oj@example.com', subject: 'test', html: '<p>hi</p>' })
    expect(result.messageId).toBe('fake-id-123')
  })

  it('throws if SES_FROM_ADDRESS missing', async () => {
    delete process.env.SES_FROM_ADDRESS
    vi.resetModules()
    const { sendEmail } = await import('../lib/email')
    await expect(sendEmail({ to: 'a@b.c', subject: 's', html: 'h' })).rejects.toThrow(/SES_FROM_ADDRESS/)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- email.test
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `lib/email.ts`**

Create `lib/email.ts`:
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

let client: SESClient | null = null

function getClient(): SESClient {
  if (client) return client
  client = new SESClient({ region: process.env.AWS_REGION ?? 'us-west-1' })
  return client
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface SendEmailResult {
  messageId: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from ?? process.env.SES_FROM_ADDRESS
  if (!from) throw new Error('SES_FROM_ADDRESS not configured (and no `from` override provided)')

  const toAddresses = Array.isArray(input.to) ? input.to : [input.to]

  const cmd = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: toAddresses },
    ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
    Message: {
      Subject: { Data: input.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: input.html, Charset: 'UTF-8' },
        Text: input.text ? { Data: input.text, Charset: 'UTF-8' } : undefined,
      },
    },
  })

  const res = await getClient().send(cmd)
  if (!res.MessageId) throw new Error('SES returned no MessageId')
  return { messageId: res.MessageId }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- email.test
```
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts __tests__/email.test.ts
git commit -m "feat(lib): AWS SES email sender

Thin wrapper over SESClient + SendEmailCommand. Used by /api/contact for
admin notifications, later by order confirmations and password resets."
```

---

### Task 1.10: Rewrite `app/api/contact/route.ts` — MySQL writer + recaptcha + SES

**Why:** Current implementation POSTs to `api.funkmedia.io/forms/system-contact/submit` which returns 500 (TENANT_DB_NOT_FOUND). Bypass it entirely: write directly to MySQL, verify recaptcha server-side, email OJ on success.

**Files:**
- Modify: `app/api/contact/route.ts` (full rewrite)
- Test: `__tests__/api-contact.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api-contact.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecute = vi.fn()
const mockSendEmail = vi.fn()
const mockVerifyRecaptcha = vi.fn()

vi.mock('../lib/db', () => ({
  getPool: () => ({ execute: mockExecute }),
}))
vi.mock('../lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))
vi.mock('../lib/recaptcha', () => ({
  verifyRecaptcha: (...args: unknown[]) => mockVerifyRecaptcha(...args),
}))

describe('POST /api/contact', () => {
  beforeEach(() => {
    mockExecute.mockReset(); mockSendEmail.mockReset(); mockVerifyRecaptcha.mockReset()
    process.env.TENANT_ID = 'ujamaaexpo'
    process.env.SOURCE_SITE = 'ujamaaexpo.com'
    process.env.LEADS_NOTIFY_EMAIL = 'oj@example.com'
  })

  async function call(body: unknown, headers: Record<string,string> = {}) {
    const { POST } = await import('../app/api/contact/route')
    const req = new Request('http://localhost/api/contact', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
    })
    return POST(req as any)
  }

  it('400 if any required field missing', async () => {
    mockVerifyRecaptcha.mockResolvedValue({ ok: true, score: 0.9 })
    const res = await call({ name: 'A', email: '', message: '' })
    expect(res.status).toBe(400)
  })

  it('403 if recaptcha fails', async () => {
    mockVerifyRecaptcha.mockResolvedValue({ ok: false, reason: 'low score' })
    const res = await call({ name: 'A', email: 'a@b.c', message: 'm', recaptchaToken: 'x' })
    expect(res.status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('200 + writes row + sends notification on success', async () => {
    mockVerifyRecaptcha.mockResolvedValue({ ok: true, score: 0.9 })
    mockExecute.mockResolvedValue([{ insertId: 42 }])
    mockSendEmail.mockResolvedValue({ messageId: 'm1' })
    const res = await call({ name: 'A', email: 'a@b.c', message: 'hello', recaptchaToken: 'x' })
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalled()
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('still returns 200 if email send fails (lead is saved, log the email error)', async () => {
    mockVerifyRecaptcha.mockResolvedValue({ ok: true, score: 0.9 })
    mockExecute.mockResolvedValue([{ insertId: 43 }])
    mockSendEmail.mockRejectedValue(new Error('SES throttled'))
    const res = await call({ name: 'A', email: 'a@b.c', message: 'hi', recaptchaToken: 'x' })
    expect(res.status).toBe(200) // lead saved is what matters
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- api-contact
```
Expected: FAIL — current route doesn't use the mocked deps.

- [ ] **Step 3: Rewrite `app/api/contact/route.ts`**

Replace `app/api/contact/route.ts` entirely:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '../../../lib/db'
import { sendEmail } from '../../../lib/email'
import { verifyRecaptcha } from '../../../lib/recaptcha'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { name, email, message, recaptchaToken } = body ?? {}
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const captcha = await verifyRecaptcha(recaptchaToken ?? '', 'contact')
  if (!captcha.ok) {
    console.warn('[contact] recaptcha rejected:', captcha.reason)
    return NextResponse.json({ error: 'captcha verification failed' }, { status: 403 })
  }

  const tenantId = process.env.TENANT_ID
  const sourceSite = process.env.SOURCE_SITE
  if (!tenantId || !sourceSite) {
    console.error('[contact] TENANT_ID or SOURCE_SITE env missing')
    return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null
  const referrer = req.headers.get('referer')?.slice(0, 500) ?? null

  let insertId: number
  try {
    const pool = getPool()
    const [result]: any = await pool.execute(
      `INSERT INTO contact_submissions
       (tenant_id, source_site, form_name, name, email, message, ip, user_agent, referrer, recaptcha_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, sourceSite, 'contact', name.trim(), email.trim(), message.trim(), ip, userAgent, referrer, captcha.score]
    )
    insertId = result.insertId
  } catch (err: any) {
    console.error('[contact] DB insert failed:', err.message)
    return NextResponse.json({ error: 'unable to save submission' }, { status: 500 })
  }

  // Notify admin (best-effort, do not fail the request if SES errors)
  const notifyTo = process.env.LEADS_NOTIFY_EMAIL
  if (notifyTo) {
    try {
      await sendEmail({
        to: notifyTo,
        replyTo: email.trim(),
        subject: `[${tenantId}] New lead from ${name.trim()}`,
        html: `<h2>New lead</h2>
          <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
          <p><strong>Site:</strong> ${escapeHtml(sourceSite)}</p>
          <p><strong>Submission #:</strong> ${insertId}</p>
          <p><strong>Message:</strong></p>
          <pre style="background:#f4f4f4;padding:1rem;border-radius:4px;white-space:pre-wrap;">${escapeHtml(message)}</pre>`,
      })
    } catch (err: any) {
      console.error('[contact] notification email failed (lead WAS saved):', err.message)
    }
  }

  return NextResponse.json({ success: true, id: insertId })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- api-contact
```
Expected: PASS (4/4).

- [ ] **Step 5: Update `.env.local.sample`**

Create or update `.env.local.sample`:
```
# Site identity
TENANT_ID=ujamaaexpo
SOURCE_SITE=ujamaaexpo.com

# WordPress backend (content + theme)
NEXT_PUBLIC_WORDPRESS_URL=https://hq.funkmedia.net/ujamaaexpo

# MySQL (lead capture)
TEMPSITES_DB_HOST=fm-aurora-cluster.cluster-c9uucskkubpc.us-west-1.rds.amazonaws.com
TEMPSITES_DB_PORT=3306
TEMPSITES_DB_NAME=fm_temp_sites_v1
TEMPSITES_DB_USER=fm_tempsites_writer
TEMPSITES_DB_PASSWORD=<from .env.fmos.local>

# Email
AWS_REGION=us-west-1
SES_FROM_ADDRESS=noreply@funkmedia.io
LEADS_NOTIFY_EMAIL=oj@funkmedia.io

# reCAPTCHA v3
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LecXY8sAAAAANqi4AO2T2f5wb2ltOpU-KgTwPXZ
RECAPTCHA_SECRET_KEY=<get from Google reCAPTCHA admin>
RECAPTCHA_MIN_SCORE=0.5

# Cognito (Sprint 1.11+)
NEXT_PUBLIC_AWS_REGION=us-west-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID=
COGNITO_ADMIN_CLIENT_ID=
COGNITO_ADMIN_CLIENT_SECRET=

# Stripe (Sprint 2)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

- [ ] **Step 6: Commit**

```bash
git add app/api/contact/route.ts __tests__/api-contact.test.ts .env.local.sample
git commit -m "feat(contact): rewrite to MySQL + server-verified recaptcha + SES notify

Replaces broken api.funkmedia.io call (returns 500: TENANT_DB_NOT_FOUND)
with direct MySQL insert into fm_temp_sites_v1.contact_submissions.
reCAPTCHA is now server-verified with score check. Admin notification
via SES is best-effort (lead is the source of truth)."
```

---

### Task 1.11: Provision Cognito User Pool

**Files:**
- Create: `scripts/provision-cognito.sh`

- [ ] **Step 1: Write provisioning script**

Create `scripts/provision-cognito.sh`:
```bash
#!/usr/bin/env bash
# One-time: provision the fm-temp-sites Cognito User Pool + app clients.
# Idempotent: checks if pool with same name exists before creating.
set -euo pipefail

REGION="${AWS_REGION:-us-west-1}"
POOL_NAME="fm-temp-sites"

existing=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" \
  --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" --output text)

if [ "$existing" != "None" ] && [ -n "$existing" ]; then
  echo "Pool already exists: $existing"
  POOL_ID="$existing"
else
  echo "Creating user pool $POOL_NAME..."
  POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "$POOL_NAME" \
    --region "$REGION" \
    --policies '{"PasswordPolicy":{"MinimumLength":12,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false,"TemporaryPasswordValidityDays":7}}' \
    --auto-verified-attributes email \
    --username-attributes email \
    --schema \
      'Name=email,AttributeDataType=String,Required=true,Mutable=true' \
      'Name=given_name,AttributeDataType=String,Required=false,Mutable=true' \
      'Name=family_name,AttributeDataType=String,Required=false,Mutable=true' \
      'Name=role,AttributeDataType=String,Mutable=true,DeveloperOnlyAttribute=false' \
      'Name=tenant_access,AttributeDataType=String,Mutable=true,DeveloperOnlyAttribute=false' \
    --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
    --query 'UserPool.Id' --output text)
  echo "Created user pool: $POOL_ID"
fi

echo ""
echo "Save this to .env.local / .env.fmos.local:"
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID"
```

```bash
chmod +x scripts/provision-cognito.sh
```

- [ ] **Step 2: Run it**

```bash
./scripts/provision-cognito.sh
```
Expected: prints `Created user pool: us-west-1_XXXXXXXXX`. Save the ID.

- [ ] **Step 3: Verify via AWS CLI**

```bash
aws cognito-idp describe-user-pool --user-pool-id <POOL_ID> --region us-west-1 \
  --query 'UserPool.[Name,Id,SchemaAttributes[?Name==`custom:role`].Name]'
```
Expected: shows pool name + the custom:role attribute exists.

- [ ] **Step 4: Save POOL_ID to env files**

Append to `/Users/odotjdot/APPS/.env.fmos.local`:
```
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-west-1_XXXXXXXXX
NEXT_PUBLIC_AWS_REGION=us-west-1
```

- [ ] **Step 5: Commit**

```bash
git add scripts/provision-cognito.sh
git commit -m "infra: provision Cognito User Pool fm-temp-sites

Idempotent script. 12-char min password, email as username, custom
attributes for role (admin|customer) and tenant_access (CSV)."
```

---

### Task 1.12: Provision Cognito app clients

**Files:**
- Create: `scripts/provision-cognito-clients.sh`

- [ ] **Step 1: Write app clients script**

Create `scripts/provision-cognito-clients.sh`:
```bash
#!/usr/bin/env bash
# Provisions two app clients: customer (no secret, browser-friendly) and admin (with secret).
set -euo pipefail

REGION="${AWS_REGION:-us-west-1}"
POOL_ID="${1:-${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-}}"
[ -z "$POOL_ID" ] && { echo "Usage: $0 <pool-id> (or set NEXT_PUBLIC_COGNITO_USER_POOL_ID)"; exit 1; }

create_client() {
  local name="$1"; local generate_secret="$2"
  local existing
  existing=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --region "$REGION" \
    --query "UserPoolClients[?ClientName=='${name}'].ClientId | [0]" --output text)
  if [ "$existing" != "None" ] && [ -n "$existing" ]; then
    echo "$name: exists ($existing)"
    echo "$existing"
    return
  fi
  local args=(--user-pool-id "$POOL_ID" --client-name "$name" --region "$REGION"
    --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
    --refresh-token-validity 30 --access-token-validity 60 --id-token-validity 60
    --token-validity-units 'AccessToken=minutes,IdToken=minutes,RefreshToken=days'
    --read-attributes email given_name family_name 'custom:role' 'custom:tenant_access'
    --write-attributes email given_name family_name)
  [ "$generate_secret" = "yes" ] && args+=(--generate-secret)
  local cid
  cid=$(aws cognito-idp create-user-pool-client "${args[@]}" --query 'UserPoolClient.ClientId' --output text)
  echo "$name: created ($cid)"
  echo "$cid"
}

CUSTOMER_ID=$(create_client "fm-temp-sites-customer" "no" | tail -1)
ADMIN_ID=$(create_client "fm-temp-sites-admin" "yes" | tail -1)
ADMIN_SECRET=$(aws cognito-idp describe-user-pool-client --user-pool-id "$POOL_ID" --client-id "$ADMIN_ID" --region "$REGION" --query 'UserPoolClient.ClientSecret' --output text)

echo ""
echo "Save to env files:"
echo "NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID=$CUSTOMER_ID"
echo "COGNITO_ADMIN_CLIENT_ID=$ADMIN_ID"
echo "COGNITO_ADMIN_CLIENT_SECRET=$ADMIN_SECRET"
```

```bash
chmod +x scripts/provision-cognito-clients.sh
```

- [ ] **Step 2: Run it**

```bash
./scripts/provision-cognito-clients.sh
```
Expected: prints two client IDs + admin secret. Save them.

- [ ] **Step 3: Append to env**

Append to `/Users/odotjdot/APPS/.env.fmos.local`:
```
NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID=<from output>
COGNITO_ADMIN_CLIENT_ID=<from output>
COGNITO_ADMIN_CLIENT_SECRET=<from output>
```

- [ ] **Step 4: Commit**

```bash
git add scripts/provision-cognito-clients.sh
git commit -m "infra: provision Cognito app clients (customer + admin)

Customer client has no secret (browser-safe). Admin client has secret
(server-only flow). Both use USER_SRP_AUTH + REFRESH_TOKEN_AUTH.
30-day refresh, 60-min access/id tokens."
```

---

### Task 1.13: Seed OJ admin user

**Files:**
- Create: `scripts/seed-admin.sh`

- [ ] **Step 1: Write seed script**

Create `scripts/seed-admin.sh`:
```bash
#!/usr/bin/env bash
# Seeds OJ as the first admin user with all-tenant access.
set -euo pipefail

REGION="${AWS_REGION:-us-west-1}"
POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:?must be set}"
ADMIN_EMAIL="${1:-oj@funkmedia.io}"
TEMP_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c 18)Aa1!

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "$ADMIN_EMAIL" \
  --user-attributes \
    Name=email,Value="$ADMIN_EMAIL" \
    Name=email_verified,Value=true \
    Name=custom:role,Value=admin \
    Name=custom:tenant_access,Value=ujamaaexpo,functionunion,abmillerday \
  --temporary-password "$TEMP_PASSWORD" \
  --region "$REGION" \
  --message-action SUPPRESS \
  --query 'User.Username' --output text

echo ""
echo "User created. Temporary password (must be changed on first login): $TEMP_PASSWORD"
echo "Login at /console/login once that page is built."
```

```bash
chmod +x scripts/seed-admin.sh
```

- [ ] **Step 2: Run it**

```bash
source /Users/odotjdot/APPS/.env.fmos.local
./scripts/seed-admin.sh oj@funkmedia.io
```
Expected: prints the email + temp password. **Save the temp password securely.**

- [ ] **Step 3: Verify the user exists**

```bash
aws cognito-idp admin-get-user --user-pool-id "$NEXT_PUBLIC_COGNITO_USER_POOL_ID" \
  --username oj@funkmedia.io --region us-west-1 \
  --query 'UserAttributes[?Name==`custom:role` || Name==`custom:tenant_access`]'
```
Expected: shows role=admin, tenant_access=ujamaaexpo,functionunion,abmillerday.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-admin.sh
git commit -m "infra: seed-admin.sh — bootstrap OJ as first admin user

Creates user with custom:role=admin and tenant_access for all 3 sites.
SUPPRESS skips the welcome email (we manage handoff directly)."
```

---

### Task 1.14: Sprint 1 smoke test

**Why:** End-of-sprint integration verification. Confirms ujx-temp builds, contact form lands a real lead, OJ user is provisioned and visible.

**Files:**
- Create: `__tests__/sprint1-smoke.md` (manual checklist; not automated)

- [ ] **Step 1: Build and dev-run**

```bash
cd /Users/odotjdot/wpserver-local/ujx-temp
cp .env.local.sample .env.local
# Fill in .env.local with values from .env.fmos.local
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 2: Open SSH tunnel for local dev**

```bash
./scripts/db-shell.sh -e "SELECT 1" >/dev/null
# Tunnel is now up on 13306
npm run dev
```

- [ ] **Step 3: Submit a real contact form via curl**

```bash
# Note: this skips reCAPTCHA, so will return 403 unless RECAPTCHA_SECRET_KEY is unset for local
RECAPTCHA_TOKEN="test"  # will fail unless we have a real one or temporarily skip in dev
curl -sX POST http://localhost:3000/api/contact \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"smoke-test\",\"email\":\"smoke@test.local\",\"message\":\"sprint1 smoke\",\"recaptchaToken\":\"$RECAPTCHA_TOKEN\"}"
```

For local smoke, temporarily set `RECAPTCHA_MIN_SCORE=0` or skip via env. Real smoke = use the actual /contact page in browser with reCAPTCHA loaded.

- [ ] **Step 4: Verify the row landed in MySQL**

```bash
./scripts/db-shell.sh fm_temp_sites_v1 -e "SELECT id, tenant_id, name, email, created_at FROM contact_submissions ORDER BY id DESC LIMIT 3;"
```
Expected: smoke-test row visible.

- [ ] **Step 5: Verify SES notification arrived**

Check `oj@funkmedia.io` inbox for `[ujamaaexpo] New lead from smoke-test`.

- [ ] **Step 6: Verify Cognito admin user is intact**

```bash
aws cognito-idp admin-get-user --user-pool-id "$NEXT_PUBLIC_COGNITO_USER_POOL_ID" \
  --username oj@funkmedia.io --region us-west-1 --query 'UserStatus'
```
Expected: `FORCE_CHANGE_PASSWORD` (waiting for first login to set permanent password).

- [ ] **Step 7: Document results & commit smoke checklist**

Create `__tests__/sprint1-smoke.md`:
```markdown
# Sprint 1 Smoke Checklist

Run all of these before declaring Sprint 1 done:

- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts without errors
- [ ] GET / loads (or shows the proper "site is being set up" fallback if WP is empty)
- [ ] GET /contact loads with the form rendered
- [ ] POST /api/contact with valid recaptcha returns `{success: true, id: N}`
- [ ] Row visible in `fm_temp_sites_v1.contact_submissions`
- [ ] Email notification received at `LEADS_NOTIFY_EMAIL`
- [ ] OJ admin user exists in Cognito with role=admin, tenant_access set
- [ ] All Sprint 1 vitest tests pass: `npm test`

Last run: <date>, by: <name>, result: <pass/fail>
```

```bash
git add __tests__/sprint1-smoke.md
git commit -m "docs: Sprint 1 smoke test checklist

Run before declaring Sprint 1 complete. Checkpoint before Sprint 2."
```

- [ ] **Step 8: Sprint 1 review checkpoint**

Stop. Review with OJ: spec adherence, any deviations, any new info that should reshape Sprint 2/3 plans. Get explicit go-ahead before starting Sprint 2.

---

## End of Sprint 1

**At this point you have:**
- ujx-temp building cleanly with stability fixes applied
- Real lead capture: form → MySQL + admin email
- Cognito User Pool ready to gate /console + /dashboard
- Per-tenant scoping wired (TENANT_ID, custom:tenant_access)

**Next: Sprint 2 (UJX Store + Admin Console) — see plan continuation below.**

---

# SPRINT 2 — UJX Store + Admin Console

**Goal:** ujamaaexpo.com goes live with a working WooCommerce-backed store (with all 5 known ecomm bugs fixed during port) and OJ can log into `/console` to view leads. Customer-facing dashboard is Sprint 3.

**Estimated:** 2 days

---

### Task 2.1: `lib/wc-graphql.ts` — minimal WPGraphQL client (no Apollo)

**Files:** Create: `lib/wc-graphql.ts`, `__tests__/wc-graphql.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/wc-graphql.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('wcGraphQL', () => {
  let originalFetch: typeof fetch
  beforeEach(() => {
    originalFetch = global.fetch
    process.env.NEXT_PUBLIC_WORDPRESS_URL = 'https://hq.funkmedia.net/ujamaaexpo'
  })
  afterEach(() => { global.fetch = originalFetch })

  it('POSTs query+variables to /graphql and returns data', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { products: { nodes: [{ id: '1' }] } } }) } as any)
    const { wcGraphQL } = await import('../lib/wc-graphql')
    const res = await wcGraphQL<{ products: { nodes: { id: string }[] } }>('query{products{nodes{id}}}')
    expect(res.products.nodes).toHaveLength(1)
  })

  it('forwards woo session header when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), json: async () => ({ data: {} }) } as any)
    global.fetch = fetchMock
    const { wcGraphQL } = await import('../lib/wc-graphql')
    await wcGraphQL('query{viewer{id}}', undefined, { sessionToken: 'tok123' })
    const call = fetchMock.mock.calls[0]
    expect((call[1] as any).headers['woocommerce-session']).toBe('Session tok123')
  })

  it('throws on GraphQL errors array', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ errors: [{ message: 'boom' }] }) } as any)
    const { wcGraphQL } = await import('../lib/wc-graphql')
    await expect(wcGraphQL('q')).rejects.toThrow(/boom/)
  })
})
```

- [ ] **Step 2: Run, verify FAIL** — `npm test -- wc-graphql`

- [ ] **Step 3: Implement `lib/wc-graphql.ts`**

```typescript
const ENDPOINT = () => {
  const base = process.env.NEXT_PUBLIC_WORDPRESS_URL
  if (!base) throw new Error('NEXT_PUBLIC_WORDPRESS_URL not set')
  return `${base}/graphql`
}

export interface WcGraphQLOptions { sessionToken?: string; revalidate?: number }
export interface SessionAware<T> { data: T; sessionToken: string | null }

export async function wcGraphQL<T>(query: string, variables?: Record<string, unknown>, opts: WcGraphQLOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.sessionToken) headers['woocommerce-session'] = `Session ${opts.sessionToken}`
  const res = await fetch(ENDPOINT(), {
    method: 'POST', headers, body: JSON.stringify({ query, variables }),
    next: opts.revalidate !== undefined ? { revalidate: opts.revalidate } : undefined,
  })
  if (!res.ok) throw new Error(`WPGraphQL HTTP ${res.status}`)
  const json = await res.json() as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(`WPGraphQL: ${json.errors.map(e => e.message).join('; ')}`)
  if (!json.data) throw new Error('WPGraphQL: no data returned')
  return json.data
}

export async function wcGraphQLWithSession<T>(query: string, variables?: Record<string, unknown>, opts: WcGraphQLOptions = {}): Promise<SessionAware<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.sessionToken) headers['woocommerce-session'] = `Session ${opts.sessionToken}`
  const res = await fetch(ENDPOINT(), { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  if (!res.ok) throw new Error(`WPGraphQL HTTP ${res.status}`)
  const json = await res.json() as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(`WPGraphQL: ${json.errors.map(e => e.message).join('; ')}`)
  const sessionToken = res.headers.get('woocommerce-session')
  return { data: json.data!, sessionToken: sessionToken && sessionToken !== 'false' ? sessionToken : null }
}
```

- [ ] **Step 4: Run PASS, commit** — `git commit -m "feat(lib): minimal WPGraphQL client with WC session header support"`

---

### Task 2.2: `lib/wc-session.ts` — cart session token capture/replay

**Files:** Create: `lib/wc-session.ts`, `__tests__/wc-session.test.ts`

- [ ] **Step 1: Failing test (4 cases — null, roundtrip, expiry, "false" sentinel)**

```typescript
// __tests__/wc-session.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('wc-session', () => {
  beforeEach(() => { localStorage.removeItem('woo-session') })
  it('returns null when no token stored', async () => {
    const { getSessionToken } = await import('../lib/wc-session')
    expect(getSessionToken()).toBeNull()
  })
  it('round-trips token within 7 days', async () => {
    const { setSessionToken, getSessionToken } = await import('../lib/wc-session')
    setSessionToken('abc123'); expect(getSessionToken()).toBe('abc123')
  })
  it('expires token after 7 days', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    localStorage.setItem('woo-session', JSON.stringify({ token: 'old', createdTime: eightDaysAgo }))
    const { getSessionToken } = await import('../lib/wc-session')
    expect(getSessionToken()).toBeNull()
    expect(localStorage.getItem('woo-session')).toBeNull()
  })
  it('clears on "false" sentinel', async () => {
    const { setSessionToken, getSessionToken } = await import('../lib/wc-session')
    setSessionToken('abc'); setSessionToken('false'); expect(getSessionToken()).toBeNull()
  })
})
```

- [ ] **Step 2: Run FAIL → Step 3 implement → Step 4 PASS**

```typescript
// lib/wc-session.ts
const KEY = 'woo-session'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function getSessionToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null
    const data = JSON.parse(raw) as { token?: string; createdTime?: number }
    if (!data?.token || !data?.createdTime) return null
    if (Date.now() - data.createdTime > TTL_MS) { localStorage.removeItem(KEY); return null }
    return data.token
  } catch { return null }
}
export function setSessionToken(token: string): void {
  if (typeof localStorage === 'undefined') return
  if (token === 'false' || !token) { localStorage.removeItem(KEY); return }
  localStorage.setItem(KEY, JSON.stringify({ token, createdTime: Date.now() }))
}
export function clearSessionToken(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
}
```

- [ ] **Step 5: Commit** — `git commit -m "feat(lib): WC session token store with 7-day TTL (port from faust.config.js)"`

---

### Task 2.3: `lib/cart-total.ts` — currency-safe parser (FIXES BUG #1)

**Why:** incpros-fe uses `parseFloat(total.replace(/[^0-9.]/g, ''))` which turns `"$1,234.56"` into `123456` — overcharges by 100×. Brand-killer.

**Files:** Create: `lib/cart-total.ts`, `__tests__/cart-total.test.ts`

- [ ] **Step 1: Failing test (LOCKS the bug fix)**

```typescript
// __tests__/cart-total.test.ts
import { describe, it, expect } from 'vitest'

describe('parseCurrencyToCents', () => {
  it('parses simple US dollar amount', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$24.99')).toBe(2499)
  })
  it('THE BUG FIX: parses amount with thousands comma correctly', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$1,234.56')).toBe(123456)
    expect(parseCurrencyToCents('$10,000.00')).toBe(1000000)
  })
  it('handles missing decimals', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$50')).toBe(5000)
  })
  it('throws on garbage instead of silently returning wrong value', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(() => parseCurrencyToCents('')).toThrow()
    expect(() => parseCurrencyToCents('abc')).toThrow()
  })
  it('formats cents back to display string', async () => {
    const { formatCents } = await import('../lib/cart-total')
    expect(formatCents(2499)).toBe('$24.99')
    expect(formatCents(123456)).toBe('$1,234.56')
  })
})
```

- [ ] **Step 2: Implement `lib/cart-total.ts`**

```typescript
export type Locale = 'us' | 'eu'

export function parseCurrencyToCents(input: string, locale: Locale = 'us'): number {
  if (!input || typeof input !== 'string') throw new Error('parseCurrencyToCents: empty input')
  let cleaned = input.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) throw new Error(`parseCurrencyToCents: no digits in "${input}"`)
  if (locale === 'eu') cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  else cleaned = cleaned.replace(/,/g, '')
  const num = Number(cleaned)
  if (!Number.isFinite(num)) throw new Error(`parseCurrencyToCents: not a number "${input}"`)
  return Math.round(num * 100)
}

export function formatCents(cents: number, locale: Locale = 'us'): string {
  const dollars = cents / 100
  if (locale === 'eu') return `€${dollars.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  return `$${dollars.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
```

- [ ] **Step 3: PASS, commit** — `git commit -m "feat(lib): cart-total currency-safe parser FIXES BUG #1"`

---

### Task 2.4: `lib/stripe-client.ts` — Stripe SDK init helper

**Files:** Create: `lib/stripe-client.ts`

- [ ] **Step 1: Implement (no test — thin SDK wrapper)**

```typescript
import Stripe from 'stripe'
import { loadStripe, type Stripe as StripeBrowser } from '@stripe/stripe-js'

let serverClient: Stripe | null = null
export function getStripeServer(): Stripe {
  if (serverClient) return serverClient
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  serverClient = new Stripe(key, { apiVersion: '2025-10-29.clover' as any })
  return serverClient
}

let browserClientPromise: Promise<StripeBrowser | null> | null = null
export function getStripeBrowser(): Promise<StripeBrowser | null> {
  if (browserClientPromise) return browserClientPromise
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) { console.error('[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set'); return Promise.resolve(null) }
  browserClientPromise = loadStripe(key)
  return browserClientPromise
}
```

- [ ] **Step 2: Commit**

---

### Task 2.5: `app/shop/page.tsx` + `app/shop/[slug]/page.tsx` — product browsing

**Files:** Create `app/shop/page.tsx`, `app/shop/[slug]/page.tsx`, `components/store/ProductCard.tsx`, `components/store/AddToCartButton.tsx`, `__tests__/shop-product-card.test.tsx`

- [ ] **Step 1: ProductCard test**

```tsx
// __tests__/shop-product-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ProductCard', () => {
  it('renders price formatted as currency', async () => {
    const { ProductCard } = await import('../components/store/ProductCard')
    render(<ProductCard product={{ slug: 't', name: 'Ticket', priceCents: 5000, image: null }} />)
    expect(screen.getByText('$50.00')).toBeDefined()
  })
  it('links to /shop/[slug]', async () => {
    const { ProductCard } = await import('../components/store/ProductCard')
    render(<ProductCard product={{ slug: 'event-ticket', name: 'Ticket', priceCents: 5000, image: null }} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/shop/event-ticket')
  })
})
```

- [ ] **Step 2: Implement `components/store/ProductCard.tsx`**

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { formatCents } from '../../lib/cart-total'

export interface Product { slug: string; name: string; priceCents: number; image: string | null; shortDescription?: string }

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/shop/${product.slug}`} style={{ display: 'block', border: '1px solid #333', padding: '1rem', textDecoration: 'none', color: 'inherit' }}>
      {product.image && (<Image src={product.image} alt={product.name} width={400} height={300} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />)}
      <h3 style={{ marginTop: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>{product.name}</h3>
      <p style={{ marginTop: '0.5rem', fontSize: '1rem' }}>{formatCents(product.priceCents)}</p>
    </Link>
  )
}
```

- [ ] **Step 3: Implement `app/shop/page.tsx`**

```tsx
import { wcGraphQL } from '../../lib/wc-graphql'
import { ProductCard, type Product } from '../../components/store/ProductCard'
import { parseCurrencyToCents } from '../../lib/cart-total'

const PRODUCTS_QUERY = `query ShopProducts($first: Int!) { products(first: $first, where: { status: "publish" }) { nodes { ... on SimpleProduct { slug name price shortDescription image { sourceUrl altText } } } } }`

export const revalidate = 60

export default async function ShopPage() {
  let products: Product[] = []
  try {
    const data = await wcGraphQL<{ products: { nodes: any[] } }>(PRODUCTS_QUERY, { first: 50 }, { revalidate: 60 })
    products = data.products.nodes.filter(Boolean).map((n: any) => ({
      slug: n.slug, name: n.name,
      priceCents: n.price ? parseCurrencyToCents(n.price) : 0,
      image: n.image?.sourceUrl ?? null, shortDescription: n.shortDescription ?? '',
    }))
  } catch (err) { console.error('[shop] failed to load products:', err) }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '5rem 1.5rem' }}>
      <h1 style={{ fontSize: '2.5rem', textTransform: 'uppercase', marginBottom: '2rem' }}>Shop</h1>
      {products.length === 0 ? <p>No products available right now. Check back soon.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {products.map(p => <ProductCard key={p.slug} product={p} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement `app/shop/[slug]/page.tsx` (uses html-react-parser like homepage — NOT dangerouslySetInnerHTML)**

```tsx
import { notFound } from 'next/navigation'
import Image from 'next/image'
import parse from 'html-react-parser'
import { wcGraphQL } from '../../../lib/wc-graphql'
import { parseCurrencyToCents, formatCents } from '../../../lib/cart-total'
import AddToCartButton from '../../../components/store/AddToCartButton'

const PRODUCT_QUERY = `query Product($slug: ID!) { product(id: $slug, idType: SLUG) { ... on SimpleProduct { databaseId slug name description price image { sourceUrl altText } stockStatus } } }`

export const revalidate = 60

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await wcGraphQL<{ product: any }>(PRODUCT_QUERY, { slug }, { revalidate: 60 })
  if (!data.product) notFound()
  const p = data.product
  const priceCents = p.price ? parseCurrencyToCents(p.price) : 0
  const safeDescription = (p.description ?? '').replace(/<script[\s\S]*?<\/script>/gi, '')

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '4rem 1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      {p.image?.sourceUrl && <Image src={p.image.sourceUrl} alt={p.image.altText ?? p.name} width={600} height={600} style={{ width: '100%', height: 'auto' }} />}
      <div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{p.name}</h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>{formatCents(priceCents)}</p>
        <div style={{ marginBottom: '2rem' }}>{parse(safeDescription)}</div>
        <AddToCartButton productId={p.databaseId} stockStatus={p.stockStatus} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement `components/store/AddToCartButton.tsx`**

```tsx
'use client'
import { useState } from 'react'

export default function AddToCartButton({ productId, stockStatus }: { productId: number; stockStatus: string }) {
  const [busy, setBusy] = useState(false)
  const disabled = busy || stockStatus !== 'IN_STOCK'
  async function add() {
    setBusy(true)
    try {
      await fetch('/api/wc/cart/add', { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }), headers: { 'Content-Type': 'application/json' } })
      window.location.href = '/cart'
    } finally { setBusy(false) }
  }
  return (
    <button onClick={add} disabled={disabled} style={{ padding: '0.875rem 2rem', backgroundColor: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', fontSize: '1rem', fontWeight: 600, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {busy ? 'Adding...' : stockStatus === 'IN_STOCK' ? 'Add to Cart' : 'Out of Stock'}
    </button>
  )
}
```

- [ ] **Step 6: Smoke + commit** — `npm run dev`, visit /shop and /shop/<slug>, then `git commit -m "feat(shop): product listing + single product (html-react-parser, no innerHTML)"`

---

### Task 2.6: `app/cart/page.tsx` + cart API routes — FIXES BUG #3 (silent removeFromCart failure)

**Files:** Create `app/cart/page.tsx`, `app/api/wc/cart/route.ts`, `app/api/wc/cart/add/route.ts`, `app/api/wc/cart/remove/route.ts`

- [ ] **Step 1: Cart GET API**

```typescript
// app/api/wc/cart/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../lib/wc-graphql'

const GET_CART = `query{cart{contents{nodes{key product{node{databaseId name slug image{sourceUrl}}} quantity total subtotal}} subtotal total}}`

export async function GET(req: NextRequest) {
  const session = req.cookies.get('woo-session')?.value
  const result = await wcGraphQLWithSession<{ cart: any }>(GET_CART, undefined, { sessionToken: session })
  const res = NextResponse.json(result.data.cart)
  if (result.sessionToken) res.cookies.set('woo-session', result.sessionToken, { sameSite: 'lax', maxAge: 7*24*60*60 })
  return res
}
```

- [ ] **Step 2: Add to cart API**

```typescript
// app/api/wc/cart/add/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../../lib/wc-graphql'
const ADD = `mutation Add($productId:Int!,$quantity:Int!){addToCart(input:{productId:$productId,quantity:$quantity}){cartItem{key quantity}}}`

export async function POST(req: NextRequest) {
  const { productId, quantity } = await req.json()
  if (!productId || !quantity) return NextResponse.json({ error: 'missing productId or quantity' }, { status: 400 })
  const session = req.cookies.get('woo-session')?.value
  try {
    const result = await wcGraphQLWithSession(ADD, { productId, quantity }, { sessionToken: session })
    const res = NextResponse.json({ success: true })
    if (result.sessionToken) res.cookies.set('woo-session', result.sessionToken, { sameSite: 'lax', maxAge: 7*24*60*60 })
    return res
  } catch (err: any) {
    console.error('[cart/add] WC error:', err.message)
    return NextResponse.json({ error: 'unable to add to cart' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Remove API — DOES NOT swallow failures (FIXES BUG #3)**

```typescript
// app/api/wc/cart/remove/route.ts — caller MUST NOT proceed if this 500s
import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../../lib/wc-graphql'
const REMOVE = `mutation Remove($keys:[ID]!){removeItemsFromCart(input:{keys:$keys}){cart{contents{itemCount}}}}`

export async function POST(req: NextRequest) {
  const { keys } = await req.json()
  if (!Array.isArray(keys) || keys.length === 0) return NextResponse.json({ error: 'keys required' }, { status: 400 })
  const session = req.cookies.get('woo-session')?.value
  try {
    const result = await wcGraphQLWithSession(REMOVE, { keys }, { sessionToken: session })
    const res = NextResponse.json({ success: true, itemCount: (result.data as any)?.removeItemsFromCart?.cart?.contents?.itemCount ?? 0 })
    if (result.sessionToken) res.cookies.set('woo-session', result.sessionToken, { sameSite: 'lax', maxAge: 7*24*60*60 })
    return res
  } catch (err: any) {
    console.error('[cart/remove] WC error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Cart page UI — surfaces remove failure**

```tsx
// app/cart/page.tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCents, parseCurrencyToCents } from '../../lib/cart-total'

export default function CartPage() {
  const [cart, setCart] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() { const r = await fetch('/api/wc/cart'); setCart(await r.json()) }
  useEffect(() => { load() }, [])

  async function remove(key: string) {
    setBusy(true); setError(null)
    const res = await fetch('/api/wc/cart/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: [key] }) })
    if (!res.ok) {
      const e = await res.json()
      setError(e.error ?? 'failed to remove item')
      // DO NOT navigate, do NOT reload — leave the item visible so the user knows it's still in cart
    } else {
      await load()
    }
    setBusy(false)
  }

  if (!cart) return <div style={{ padding: '5rem 1.5rem' }}>Loading cart...</div>
  const items = cart.contents?.nodes ?? []
  if (items.length === 0) return (
    <div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
      <h1>Your cart is empty.</h1>
      <Link href="/shop" style={{ color: 'var(--wp--preset--color--primary, #ac323a)' }}>Browse the shop</Link>
    </div>
  )

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '4rem 1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Cart</h1>
      {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.key} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '1rem 0' }}>{item.product.node.name} × {item.quantity}</td>
              <td style={{ textAlign: 'right' }}>{formatCents(parseCurrencyToCents(item.total))}</td>
              <td style={{ textAlign: 'right', paddingLeft: '1rem' }}>
                <button onClick={() => remove(item.key)} disabled={busy} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2} style={{ paddingTop: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Total: {formatCents(parseCurrencyToCents(cart.total))}</td></tr></tfoot>
      </table>
      <Link href="/checkout" style={{ display: 'inline-block', marginTop: '2rem', padding: '0.875rem 2rem', backgroundColor: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Proceed to Checkout</Link>
    </div>
  )
}
```

- [ ] **Step 5: Smoke (kill WP temporarily, click Remove, verify error surfaces; restart WP, verify normal flow) + commit** — `git commit -m "feat(cart): cart page + WC API routes; remove failure surfaces error (FIXES bug #3)"`

---

### Task 2.7: `app/checkout/page.tsx` + payment-intent route (FIXES BUG #2)

**Files:** Create `app/checkout/page.tsx`, `app/api/wc/checkout/payment-intent/route.ts`

- [ ] **Step 1: Server-side PI route — re-fetches cart total from WC at PI creation (FIXES BUG #2)**

```typescript
// app/api/wc/checkout/payment-intent/route.ts
// FIXES BUG #2: PI created from server-side fresh cart, NOT client-passed amount.
import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../../lib/wc-graphql'
import { parseCurrencyToCents } from '../../../../../lib/cart-total'
import { getStripeServer } from '../../../../../lib/stripe-client'

const GET_TOTAL = `query{cart{total contents{itemCount}}}`

export async function POST(req: NextRequest) {
  const session = req.cookies.get('woo-session')?.value
  const { data } = await wcGraphQLWithSession<{ cart: { total: string; contents: { itemCount: number } } }>(GET_TOTAL, undefined, { sessionToken: session })
  if (!data.cart || data.cart.contents.itemCount === 0) return NextResponse.json({ error: 'cart is empty' }, { status: 400 })
  const amountCents = parseCurrencyToCents(data.cart.total)
  if (amountCents <= 0) return NextResponse.json({ error: 'invalid cart total' }, { status: 400 })

  const stripe = getStripeServer()
  const intent = await stripe.paymentIntents.create({
    amount: amountCents, currency: 'usd', automatic_payment_methods: { enabled: true },
    metadata: { tenant_id: process.env.TENANT_ID ?? '', source_site: process.env.SOURCE_SITE ?? '' },
  })
  return NextResponse.json({ clientSecret: intent.client_secret, amountCents, paymentIntentId: intent.id })
}
```

- [ ] **Step 2: Checkout page**

```tsx
// app/checkout/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripeBrowser } from '../../lib/stripe-client'
import { formatCents } from '../../lib/cart-total'

function CheckoutForm({ amountCents, paymentIntentId }: { amountCents: number; paymentIntentId: string }) {
  const stripe = useStripe(); const elements = useElements()
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true); setError(null)
    // FIXES BUG #2 RE-CHECK: re-validate cart hasn't changed since PI created
    const recheck = await fetch('/api/wc/cart')
    const cart = await recheck.json()
    if (cart.contents.itemCount === 0) { setError('Cart is empty.'); setBusy(false); return }
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/order-confirmation?payment_intent=${paymentIntentId}` } })
    if (result.error) { setError(result.error.message ?? 'Payment failed'); setBusy(false) }
  }

  return (
    <form onSubmit={pay}>
      <PaymentElement />
      {error && <p style={{ color: '#ff4444', marginTop: '1rem' }}>{error}</p>}
      <button type="submit" disabled={!stripe || busy} style={{ marginTop: '1.5rem', padding: '0.875rem 2rem', backgroundColor: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Processing...' : `Pay ${formatCents(amountCents)}`}
      </button>
    </form>
  )
}

export default function CheckoutPage() {
  const [pi, setPi] = useState<{ clientSecret: string; amountCents: number; paymentIntentId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stripePromise] = useState(() => getStripeBrowser())

  useEffect(() => {
    fetch('/api/wc/checkout/payment-intent', { method: 'POST' })
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
      .then(setPi)
      .catch(e => setError(typeof e === 'string' ? e : 'failed to start checkout'))
  }, [])

  if (error) return <div style={{ padding: '5rem 1.5rem', color: '#ff4444' }}>{error}</div>
  if (!pi) return <div style={{ padding: '5rem 1.5rem' }}>Preparing checkout...</div>

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '4rem 1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Checkout</h1>
      <Elements stripe={stripePromise} options={{ clientSecret: pi.clientSecret }}>
        <CheckoutForm amountCents={pi.amountCents} paymentIntentId={pi.paymentIntentId} />
      </Elements>
    </div>
  )
}
```

- [ ] **Step 3: Commit** — `git commit -m "feat(checkout): server-side PI from fresh cart total (FIXES bug #2)"`

---

### Task 2.8: `app/order-confirmation/page.tsx` — verifies PI server-side (FIXES BUG #5)

**Why:** incpros-fe leaks order data via URL. Verify PI status with Stripe directly.

**Files:** Create `app/order-confirmation/page.tsx`

- [ ] **Step 1: Implement (server component)**

```tsx
// FIXES BUG #5: server-verify PI status, no DB lookup by URL param
import { getStripeServer } from '../../lib/stripe-client'
import { formatCents } from '../../lib/cart-total'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ payment_intent?: string }> }) {
  const { payment_intent } = await searchParams
  if (!payment_intent) redirect('/')

  let intent
  try { intent = await getStripeServer().paymentIntents.retrieve(payment_intent) }
  catch {
    return (<div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
      <h1>We couldn&apos;t verify this order.</h1>
      <p style={{ marginTop: '1rem' }}>If you completed a purchase, you&apos;ll receive an email confirmation shortly.</p>
    </div>)
  }

  if (intent.status !== 'succeeded') return (<div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
    <h1>Payment is processing.</h1>
    <p style={{ marginTop: '1rem' }}>Status: {intent.status}. We&apos;ll email you when it completes.</p>
  </div>)

  return (
    <div style={{ padding: '5rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem' }}>Thank you!</h1>
      <p style={{ marginTop: '1rem', color: 'var(--wp--preset--color--bone, #999)' }}>Your payment of <strong>{formatCents(intent.amount)}</strong> was successful.</p>
      <p style={{ marginTop: '1rem' }}>A confirmation email is on the way. Sign in to view full order details.</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit** — `git commit -m "feat(order-confirmation): server-verify PI (FIXES bug #5)"`

---

### Task 2.9: `app/api/stripe-webhook/route.ts` — webhook with idempotency (FIXES BUG #4)

**Files:** Create `app/api/stripe-webhook/route.ts`, `sql/003-stripe-events-processed.sql`

- [ ] **Step 1: Idempotency table + apply migration**

```sql
-- sql/003-stripe-events-processed.sql
USE fm_temp_sites_v1;
CREATE TABLE IF NOT EXISTS stripe_events_processed (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  tenant_id VARCHAR(64),
  payment_intent_id VARCHAR(255),
  processed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`./scripts/db-migrate.sh`

- [ ] **Step 2: Webhook handler with strict signature verify + INSERT IGNORE idempotency**

```typescript
// app/api/stripe-webhook/route.ts — FIXES BUG #4
import { NextRequest, NextResponse } from 'next/server'
import { getStripeServer } from '../../../lib/stripe-client'
import { getPool } from '../../../lib/db'
import { sendEmail } from '../../../lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'no signature' }, { status: 400 })
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) { console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set'); return NextResponse.json({ error: 'server not configured' }, { status: 500 }) }

  const stripe = getStripeServer()
  const rawBody = await req.text()
  let event
  try { event = stripe.webhooks.constructEvent(rawBody, sig, secret) }
  catch (err: any) { console.error('[stripe-webhook] signature verify failed:', err.message); return NextResponse.json({ error: 'bad signature' }, { status: 400 }) }

  const pool = getPool()
  const piId = (event.data.object as any)?.id ?? null
  const tenantId = (event.data.object as any)?.metadata?.tenant_id ?? null
  const [result]: any = await pool.execute(
    `INSERT IGNORE INTO stripe_events_processed (event_id, event_type, tenant_id, payment_intent_id) VALUES (?, ?, ?, ?)`,
    [event.id, event.type, tenantId, piId]
  )
  if (result.affectedRows === 0) {
    console.log('[stripe-webhook] duplicate event ignored:', event.id)
    return NextResponse.json({ received: true, idempotent: true })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as any
    try {
      await sendEmail({
        to: process.env.LEADS_NOTIFY_EMAIL ?? '',
        subject: `[${tenantId}] Order paid: ${pi.id}`,
        html: `<p>Payment Intent <code>${pi.id}</code> succeeded for ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}.</p>`,
      })
    } catch (err: any) { console.error('[stripe-webhook] notify failed:', err.message) }
  }
  return NextResponse.json({ received: true })
}
```

- [ ] **Step 3: Configure Stripe dashboard webhook endpoint to** `https://ujamaaexpo.com/api/stripe-webhook`, save signing secret to `STRIPE_WEBHOOK_SECRET` env

- [ ] **Step 4: Commit** — `git commit -m "feat(stripe-webhook): idempotent event processing (FIXES bug #4)"`

---

### Task 2.10: `lib/cognito.ts` — Cognito SDK wrapper

**Files:** Create `lib/cognito.ts`

- [ ] **Step 1: Implement**

```typescript
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute, type CognitoUserSession } from 'amazon-cognito-identity-js'

function customerPool() {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID
  if (!userPoolId || !clientId) throw new Error('Cognito customer pool env not configured')
  return new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId })
}

export async function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const pool = customerPool()
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool })
    const auth = new AuthenticationDetails({ Username: email, Password: password })
    user.authenticateUser(auth, {
      onSuccess: (s) => resolve(s),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error('NEW_PASSWORD_REQUIRED')),
    })
  })
}

export async function signUp(email: string, password: string, attributes: { given_name?: string; family_name?: string } = {}): Promise<void> {
  const pool = customerPool()
  const attrList: CognitoUserAttribute[] = [new CognitoUserAttribute({ Name: 'email', Value: email })]
  if (attributes.given_name) attrList.push(new CognitoUserAttribute({ Name: 'given_name', Value: attributes.given_name }))
  if (attributes.family_name) attrList.push(new CognitoUserAttribute({ Name: 'family_name', Value: attributes.family_name }))
  attrList.push(new CognitoUserAttribute({ Name: 'custom:role', Value: 'customer' }))
  return new Promise((resolve, reject) => { pool.signUp(email, password, attrList, [], (err) => err ? reject(err) : resolve()) })
}

export async function getCurrentSession(): Promise<CognitoUserSession | null> {
  const user = customerPool().getCurrentUser()
  if (!user) return null
  return new Promise((resolve) => { user.getSession((err: any, s: CognitoUserSession | null) => resolve(err ? null : s)) })
}

export function signOut(): void { customerPool().getCurrentUser()?.signOut() }
```

- [ ] **Step 2: Commit**

---

### Task 2.11: `middleware.ts` — App Router auth gate

**Files:** Create `middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/console') && pathname !== '/console/login') {
    if (!req.cookies.get('console-id-token')?.value) {
      const url = req.nextUrl.clone(); url.pathname = '/console/login'; url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  if (pathname.startsWith('/dashboard')) {
    if (!req.cookies.get('dashboard-id-token')?.value) {
      const url = req.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = { matcher: ['/console/:path*', '/dashboard/:path*'] }
```

- [ ] **Commit** — `git commit -m "feat(middleware): gate /dashboard and /console with separate cookies"`

---

### Task 2.12: `app/console/login/page.tsx` + admin auth route

**Files:** Create `app/console/login/page.tsx`, `app/api/console/auth/route.ts`

- [ ] **Step 1: Server admin auth (uses ADMIN client secret)**

```typescript
// app/api/console/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import { createHmac } from 'crypto'

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const client = new CognitoIdentityProviderClient({ region })

function secretHash(username: string): string {
  const cid = process.env.COGNITO_ADMIN_CLIENT_ID!
  const sec = process.env.COGNITO_ADMIN_CLIENT_SECRET!
  return createHmac('sha256', sec).update(username + cid).digest('base64')
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email + password required' }, { status: 400 })
  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_ADMIN_CLIENT_ID!,
      AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: secretHash(email) },
    }))
    const idToken = result.AuthenticationResult?.IdToken
    if (!idToken) return NextResponse.json({ error: 'auth failed' }, { status: 401 })
    const res = NextResponse.json({ success: true })
    res.cookies.set('console-id-token', idToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60*60, path: '/' })
    if (result.AuthenticationResult?.RefreshToken) res.cookies.set('console-refresh-token', result.AuthenticationResult.RefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30*24*60*60, path: '/' })
    return res
  } catch (err: any) {
    if (err.name === 'NotAuthorizedException') return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    if (err.name === 'PasswordResetRequiredException') return NextResponse.json({ error: 'password reset required' }, { status: 403 })
    console.error('[console/auth]', err)
    return NextResponse.json({ error: 'auth error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Login UI**

```tsx
// app/console/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ConsoleLogin() {
  const router = useRouter(); const search = useSearchParams()
  const next = search.get('next') ?? '/console'
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/console/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (res.ok) router.push(next)
    else { setError(data.error ?? 'login failed'); setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>Admin Console</h1>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
        {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '0.875rem', background: '#ac323a', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Enable USER_PASSWORD_AUTH on admin client (one-time)**

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id "$NEXT_PUBLIC_COGNITO_USER_POOL_ID" \
  --client-id "$COGNITO_ADMIN_CLIENT_ID" \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region us-west-1
```

- [ ] **Step 4: Commit** — `git commit -m "feat(console): admin login via USER_PASSWORD_AUTH with secret hash"`

---

### Task 2.13: `/console` lead viewer + JWT verify with tenant_access enforcement

**Files:** Create `lib/console-auth.ts`, `app/api/console/leads/route.ts`, `app/console/page.tsx`. Install `jose`.

- [ ] **Step 1: Install jose** — `npm install jose`

- [ ] **Step 2: JWT verify helper**

```typescript
// lib/console-auth.ts
import { jwtVerify, createRemoteJWKSet } from 'jose'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (jwks) return jwks
  if (!POOL_ID) throw new Error('NEXT_PUBLIC_COGNITO_USER_POOL_ID not set')
  jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))
  return jwks
}

export interface ConsoleClaims { sub: string; email: string; role: string; tenant_access: string[] }

export async function verifyConsoleToken(idToken: string): Promise<ConsoleClaims | null> {
  try {
    const { payload } = await jwtVerify(idToken, getJwks(), { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` })
    if (payload['custom:role'] !== 'admin') return null
    const ta = (payload['custom:tenant_access'] as string | undefined) ?? ''
    return { sub: payload.sub as string, email: payload.email as string, role: 'admin', tenant_access: ta.split(',').map(s => s.trim()).filter(Boolean) }
  } catch (err: any) {
    console.error('[console-auth] verify failed:', err.message)
    return null
  }
}
```

- [ ] **Step 3: Leads API**

```typescript
// app/api/console/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPool } from '../../../../lib/db'
import { verifyConsoleToken } from '../../../../lib/console-auth'

export async function GET(req: NextRequest) {
  const idToken = (await cookies()).get('console-id-token')?.value
  if (!idToken) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const claims = await verifyConsoleToken(idToken)
  if (!claims) return NextResponse.json({ error: 'invalid or expired session' }, { status: 401 })
  if (claims.tenant_access.length === 0) return NextResponse.json({ data: [], total: 0 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const tenantFilter = url.searchParams.get('tenant')
  const tenants = tenantFilter && claims.tenant_access.includes(tenantFilter) ? [tenantFilter] : claims.tenant_access

  const pool = getPool()
  const placeholders = tenants.map(() => '?').join(',')
  const [rows]: any = await pool.execute(
    `SELECT id, tenant_id, source_site, name, email, message, ip, recaptcha_score, created_at
     FROM contact_submissions WHERE tenant_id IN (${placeholders})
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, tenants
  )
  const [countRows]: any = await pool.execute(`SELECT COUNT(*) AS total FROM contact_submissions WHERE tenant_id IN (${placeholders})`, tenants)
  return NextResponse.json({ data: rows, total: countRows[0].total, tenant_access: claims.tenant_access })
}
```

- [ ] **Step 4: Console page**

```tsx
// app/console/page.tsx
'use client'
import { useEffect, useState } from 'react'

export default function ConsoleHome() {
  const [data, setData] = useState<any>(null)
  const [tenant, setTenant] = useState<string>('')

  async function load(t?: string) {
    const r = await fetch(t ? `/api/console/leads?tenant=${t}` : '/api/console/leads')
    if (r.status === 401) { window.location.href = '/console/login'; return }
    setData(await r.json())
  }
  useEffect(() => { load() }, [])

  if (!data) return <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Console — Leads</h1>
        <select value={tenant} onChange={e => { setTenant(e.target.value); load(e.target.value || undefined) }} style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #444', padding: '0.5rem' }}>
          <option value="">All tenants</option>
          {(data.tenant_access ?? []).map((t: string) => <option key={t} value={t}>{t}</option>)}
        </select>
      </header>
      <p style={{ marginBottom: '1rem', color: '#999' }}>{data.total} total submissions</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead><tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}><th style={{ padding: '0.75rem 0.5rem' }}>When</th><th>Tenant</th><th>Name</th><th>Email</th><th>Message</th><th>Score</th></tr></thead>
        <tbody>
          {data.data.map((row: any) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #1f1f1f' }}>
              <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleString()}</td>
              <td>{row.tenant_id}</td><td>{row.name}</td>
              <td><a href={`mailto:${row.email}`} style={{ color: '#9ec5ff' }}>{row.email}</a></td>
              <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.message}</td>
              <td>{row.recaptcha_score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Smoke + commit** — `git commit -m "feat(console): admin lead viewer with JWT verify + tenant_access enforcement"`

---

### Task 2.14: ujx production deploy + Sprint 2 smoke

**Files:** Create `__tests__/sprint2-smoke.md`

- [ ] **Step 1: Set production env on Amplify (or chosen host)** — all from `.env.local.sample`, with LIVE Stripe keys, RDS Proxy host if not in same VPC

- [ ] **Step 2: DNS — point ujamaaexpo.com to deploy target**

- [ ] **Step 3: Configure Stripe webhook in dashboard**: URL `https://ujamaaexpo.com/api/stripe-webhook`, events `payment_intent.succeeded` + `payment_intent.payment_failed` + `charge.refunded`. Save signing secret.

- [ ] **Step 4: Smoke checklist `__tests__/sprint2-smoke.md`**

```markdown
# Sprint 2 Smoke Checklist

GOLDEN PATH (live, on ujamaaexpo.com):
- [ ] GET / loads, header + footer render
- [ ] GET /shop loads, products visible
- [ ] GET /shop/<slug> shows product detail with formatted price
- [ ] Add to Cart → /cart shows the item with correct currency formatting
- [ ] /cart total = sum of items × quantity
- [ ] /checkout loads Stripe Elements
- [ ] Stripe TEST card 4242 4242 4242 4242 → /order-confirmation shows success
- [ ] Stripe webhook fires → row in stripe_events_processed, no duplicate on replay
- [ ] /console/login → enter OJ creds → /console
- [ ] /console shows leads for OJ's tenant_access

EDGE CASES (must pass before declaring shipped):
- [ ] BUG #1: Cart with $1,234.56+ total: charge in Stripe == cart display amount
- [ ] BUG #2: Cart change between PI create and pay: server PI re-fetched, no stale amount
- [ ] BUG #3: Block WC during /cart Remove click: error surfaces, item still visible
- [ ] BUG #4: Re-deliver same Stripe webhook from dashboard: 2nd call returns idempotent:true
- [ ] BUG #5: Hit /order-confirmation?payment_intent=<other-id>: shows "couldn't verify" message

Last run: <date>, by: <name>, result: <pass/fail>
```

- [ ] **Step 5: Run all checks, fix failures, COMMIT** — `git commit -m "docs: Sprint 2 smoke checklist with explicit bug-fix verifications"`

- [ ] **Step 6: Sprint 2 review checkpoint** — Stop, verify with OJ before Sprint 3.

---

## End of Sprint 2

ujamaaexpo.com is live. Customer dashboard is Sprint 3.

---

# SPRINT 3 — Customer Dashboard + Template Polish

**Goal:** Port the Ncmaz customer-facing dashboard chassis from incpros-fe so it lives in the template and is ready for IncPros, OJ's blog, and future client forks. Write CLONE.md so functionunion + abmillerday + future sites can be spun up cleanly.

**Estimated:** 2-3 days

---

### Task 3.1: Customer login + signup + forgot-password pages

**Files:** Create `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Customer login API (no client secret — uses public client)**

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const client = new CognitoIdentityProviderClient({ region })

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email + password required' }, { status: 400 })
  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID!,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))
    const idToken = result.AuthenticationResult?.IdToken
    if (!idToken) return NextResponse.json({ error: 'auth failed' }, { status: 401 })
    const res = NextResponse.json({ success: true })
    res.cookies.set('dashboard-id-token', idToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60*60, path: '/' })
    if (result.AuthenticationResult?.RefreshToken) res.cookies.set('dashboard-refresh-token', result.AuthenticationResult.RefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30*24*60*60, path: '/' })
    return res
  } catch (err: any) {
    if (err.name === 'NotAuthorizedException') return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    if (err.name === 'UserNotConfirmedException') return NextResponse.json({ error: 'email not verified' }, { status: 403 })
    return NextResponse.json({ error: 'auth error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Login page**

```tsx
// app/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter(); const search = useSearchParams()
  const next = search.get('next') ?? '/dashboard'
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (res.ok) router.push(next)
    else { setError(data.error ?? 'login failed'); setBusy(false) }
  }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Sign in</h1>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '0.875rem', background: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <Link href="/forgot-password" style={{ color: 'var(--wp--preset--color--bone, #999)' }}>Forgot password?</Link> · <Link href="/signup" style={{ color: 'var(--wp--preset--color--primary, #ac323a)' }}>Create account</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Signup page + API (calls Cognito SignUp via public client; emails verification code)**

```typescript
// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({ region: process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1' })

export async function POST(req: NextRequest) {
  const { email, password, given_name, family_name } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email + password required' }, { status: 400 })
  try {
    await client.send(new SignUpCommand({
      ClientId: process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        ...(given_name ? [{ Name: 'given_name', Value: given_name }] : []),
        ...(family_name ? [{ Name: 'family_name', Value: family_name }] : []),
        { Name: 'custom:role', Value: 'customer' },
      ],
    }))
    return NextResponse.json({ success: true, message: 'check your email for a verification code' })
  } catch (err: any) {
    if (err.name === 'UsernameExistsException') return NextResponse.json({ error: 'an account with that email already exists' }, { status: 409 })
    if (err.name === 'InvalidPasswordException') return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'signup failed' }, { status: 500 })
  }
}
```

`app/signup/page.tsx` — analogous to login page with extra fields (given_name, family_name) + confirmation message after submit.

- [ ] **Step 4: Forgot-password — sends reset code; reset confirmation page accepts code + new password**

Use `ForgotPasswordCommand` and `ConfirmForgotPasswordCommand`. UI follows same pattern as login. (Implementation mirrors login API/page.)

- [ ] **Step 5: Commit** — `git commit -m "feat(auth): customer login/signup/forgot-password (Cognito public client)"`

---

### Task 3.2: Port Ncmaz dashboard chassis — `app/dashboard/layout.tsx`

**Files:** Create `app/dashboard/layout.tsx`, `components/dashboard/DashboardSidebar.tsx`, `components/dashboard/DashboardHeader.tsx`. Reference: `/Users/odotjdot/APPS/incpros-fe/src/components/Dashboard/*` and `/Users/odotjdot/APPS/incpros-fe/src/container/PageDashboard/*`.

- [ ] **Step 1: Read the source components**

```bash
ls /Users/odotjdot/APPS/incpros-fe/src/components/Dashboard/ 2>/dev/null
ls /Users/odotjdot/APPS/incpros-fe/src/container/PageDashboard/ 2>/dev/null
```

Document the actual sidebar items, navigation structure, and styling tokens found in the Ncmaz template before starting the port.

- [ ] **Step 2: Implement `components/dashboard/DashboardSidebar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/profile', label: 'Profile' },
] as const

export default function DashboardSidebar() {
  const pathname = usePathname()
  return (
    <nav style={{ width: '240px', padding: '2rem 1rem', borderRight: '1px solid #333', minHeight: '100vh' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <li key={item.href} style={{ marginBottom: '0.25rem' }}>
              <Link href={item.href} style={{
                display: 'block', padding: '0.75rem 1rem', textDecoration: 'none',
                color: active ? '#fff' : 'var(--wp--preset--color--bone, #999)',
                background: active ? 'var(--wp--preset--color--primary, #ac323a)' : 'transparent',
                borderRadius: '4px', fontWeight: active ? 600 : 400,
              }}>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Implement `app/dashboard/layout.tsx`**

```tsx
import DashboardSidebar from '../../components/dashboard/DashboardSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <DashboardSidebar />
      <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Commit** — `git commit -m "feat(dashboard): port Ncmaz dashboard chassis (sidebar + layout)"`

---

### Task 3.3: `app/dashboard/page.tsx` + `/dashboard/profile/page.tsx`

**Files:** Create `app/dashboard/page.tsx`, `app/dashboard/profile/page.tsx`, `app/api/dashboard/profile/route.ts`

- [ ] **Step 1: Dashboard home**

```tsx
// app/dashboard/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))

async function getCustomerEmail(): Promise<string | null> {
  const t = (await cookies()).get('dashboard-id-token')?.value
  if (!t) return null
  try { const { payload } = await jwtVerify(t, jwks, { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` }); return payload.email as string }
  catch { return null }
}

export default async function DashboardHome() {
  const email = await getCustomerEmail()
  if (!email) redirect('/login?next=/dashboard')
  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Welcome back</h1>
      <p style={{ color: 'var(--wp--preset--color--bone, #999)' }}>Signed in as {email}</p>
    </div>
  )
}
```

- [ ] **Step 2: Profile page (read + update Cognito attributes via API route)**

`app/api/dashboard/profile/route.ts` — GET returns claims; PUT calls `UpdateUserAttributesCommand` with the user's access token.

`app/dashboard/profile/page.tsx` — form bound to GET, submits to PUT.

- [ ] **Step 3: Commit** — `git commit -m "feat(dashboard): home + profile editor"`

---

### Task 3.4: `app/dashboard/orders/page.tsx` — customer order history

**Files:** Create `app/dashboard/orders/page.tsx`, `app/api/dashboard/orders/route.ts`

- [ ] **Step 1: API queries WC for orders belonging to logged-in customer**

```typescript
// app/api/dashboard/orders/route.ts
// Uses WC GraphQL `customer{orders{nodes{...}}}` with the WC session OR Cognito-linked customerId.
// Verifies the requesting JWT first, then uses the email to look up WC customer.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { wcGraphQL } from '../../../../lib/wc-graphql'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))

const ORDERS = `query CustomerOrders($email: String!) { customers(where: { email: $email }) { nodes { id orders { nodes { id orderNumber date status total lineItems { nodes { quantity product { node { name } } } } } } } } }`

export async function GET(req: NextRequest) {
  const t = (await cookies()).get('dashboard-id-token')?.value
  if (!t) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  let email: string
  try { const { payload } = await jwtVerify(t, jwks, { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` }); email = payload.email as string }
  catch { return NextResponse.json({ error: 'invalid session' }, { status: 401 }) }

  const data = await wcGraphQL<{ customers: { nodes: any[] } }>(ORDERS, { email })
  const orders = data.customers.nodes[0]?.orders?.nodes ?? []
  return NextResponse.json({ orders })
}
```

- [ ] **Step 2: Orders page UI** — server component fetches via API, renders table with status, date, total, line items.

- [ ] **Step 3: Commit** — `git commit -m "feat(dashboard): customer order history (WC by email lookup)"`

---

### Task 3.5: `/console` expanded tabs — orders, customers, products

**Files:** Create `app/console/orders/page.tsx`, `app/console/customers/page.tsx`, `app/console/products/page.tsx` + corresponding API routes

- [ ] **Step 1: Each console tab follows the same pattern as `/console` (lead viewer):**
  - Server component or client-side fetch to API route
  - API route verifies JWT via `verifyConsoleToken`
  - API route enforces `tenant_access`
  - UI is a sortable, paginated table

- [ ] **Step 2: `/console/orders` — queries WC for all orders across admin's tenant_access**

```typescript
// app/api/console/orders/route.ts
// Read-only: WC orders across tenants the admin has access to.
// Per-tenant filter via WC's where clause; admin tenant_access enforced server-side.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyConsoleToken } from '../../../../lib/console-auth'
import { wcGraphQL } from '../../../../lib/wc-graphql'

const ALL_ORDERS = `query AllOrders($first: Int!) { orders(first: $first, where: { orderby: { field: DATE, order: DESC } }) { nodes { id orderNumber date status total billing { email firstName lastName } } } }`

export async function GET(req: NextRequest) {
  const t = (await cookies()).get('console-id-token')?.value
  if (!t) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const claims = await verifyConsoleToken(t)
  if (!claims) return NextResponse.json({ error: 'invalid' }, { status: 401 })
  // Note: WC orders are NOT tenant-scoped at WC level (one WC instance per tenant).
  // For v1 we trust admin's tenant_access; future: query each tenant's WC separately and merge.
  const data = await wcGraphQL<{ orders: { nodes: any[] } }>(ALL_ORDERS, { first: 100 })
  return NextResponse.json({ orders: data.orders.nodes, tenant_access: claims.tenant_access })
}
```

`app/console/orders/page.tsx` — table of orders, columns: Date, Order #, Customer, Total, Status. Click row → expand to show line items.

- [ ] **Step 3: `/console/customers`** — analogous, uses `customers(first: 100)` GraphQL query, table of registered customers with order count + total spent.

- [ ] **Step 4: `/console/products`** — analogous, uses `products(first: 100)` query, table of products with stock status + price + last modified. Edit deferred to WC admin (link out).

- [ ] **Step 5: Add nav items to `/console` header** — Leads | Orders | Customers | Products | Sign out

- [ ] **Step 6: Commit each tab** as separate commit for cleaner history.

---

### Task 3.6: `CLONE.md` — fork playbook

**Files:** Create `CLONE.md`

- [ ] **Step 1: Write the playbook**

```markdown
# Cloning the FMOS-Lite Template for a New Site

This template lives in `ujx-temp` and powers `ujamaaexpo.com`. To spin up a new site (e.g. `functionunion.com`, `abmillerday.com`, future client sites):

## 1. Provision the WordPress backend

The shared WP install at `hq.funkmedia.net` hosts content per tenant. Add a new tenant subpath:

\`\`\`bash
ssh funkm8319@hq.funkmedia.net
cd /var/www/<wp-multisite-root>
# Create new WP site for the tenant via WP CLI
wp site create --slug=functionunion --title="Function Union" --email=admin@example.com --network_id=1
\`\`\`

Verify content endpoint: `https://hq.funkmedia.net/functionunion/wp-json/wp/v2/pages` returns 200.

## 2. Fork the codebase

\`\`\`bash
cp -R /Users/odotjdot/wpserver-local/ujx-temp /Users/odotjdot/wpserver-local/functionunion-temp
cd /Users/odotjdot/wpserver-local/functionunion-temp
rm -rf .git node_modules .next
git init && git add . && git commit -m "fork: initial from ujx-temp"
\`\`\`

## 3. Brand swap

Replace files in `public/`:
- `ujx-logo.png` → new logo (same dimensions, ~150x50)
- `og-image.png` → 1200x630 social card
- `favicon.svg` → new favicon

Update `app/layout.tsx` metadata block:
- `title`, `description`, `openGraph.url`, `openGraph.siteName`, `twitter.title`
- `TICKETS_URL` (or remove the Get Tickets CTA if not applicable)
- Footer email + Instagram links

Update `app/globals.css` and `tailwind.config.js` for brand colors. Or override via WP theme tokens (the layout pulls compiled WP global styles via `fm-styles/v1/theme.css`).

## 4. Configure env per fork

Copy `.env.local.sample` to `.env.local` and set:

\`\`\`
TENANT_ID=functionunion
SOURCE_SITE=functionunion.com
NEXT_PUBLIC_WORDPRESS_URL=https://hq.funkmedia.net/functionunion
LEADS_NOTIFY_EMAIL=oj@funkmedia.io  # or per-site address
\`\`\`

All other env vars (Cognito pool IDs, MySQL creds, Stripe, SES) are SHARED across forks — copy from `ujx-temp/.env.local`.

## 5. Grant the admin tenant access

\`\`\`bash
aws cognito-idp admin-update-user-attributes \\
  --user-pool-id "$NEXT_PUBLIC_COGNITO_USER_POOL_ID" \\
  --username oj@funkmedia.io \\
  --user-attributes Name=custom:tenant_access,Value=ujamaaexpo,functionunion,abmillerday \\
  --region us-west-1
\`\`\`

(After this update, the admin must sign out + back in to /console/login to refresh the JWT with the new claim.)

## 6. Toggle nav surfaces

Edit `app/layout.tsx` header to remove `/shop` link if the fork doesn't sell anything, or add `/dashboard` link if customer accounts are wanted.

## 7. Deploy

Match ujx-temp's deploy target (Amplify / Vercel / EC2). Set the same env vars in the host's environment. Configure DNS to point the new domain.

## 8. Configure Stripe webhook for the new domain

In Stripe dashboard, add a webhook endpoint at `https://<new-domain>/api/stripe-webhook` with the same events (`payment_intent.succeeded`, etc.). Save the new signing secret to the fork's env as `STRIPE_WEBHOOK_SECRET`.

## 9. Smoke test

Run `__tests__/sprint1-smoke.md` and `__tests__/sprint2-smoke.md` against the new domain. Submit a real lead, verify it lands in MySQL with the correct `tenant_id`. Place a test order with the Stripe test card.

## What's shared vs per-fork

**Shared across all forks:**
- Cognito User Pool `fm-temp-sites` (one pool, multi-tenant via `custom:tenant_access`)
- MySQL `fm_temp_sites_v1` (one DB, multi-tenant via `tenant_id` column)
- AWS SES sender identity
- Stripe account (separate webhook endpoints per fork; same secret/publishable key)
- IAM users (`fm_tempsites_writer`)

**Per-fork:**
- Codebase (each is its own repo / deploy)
- Brand assets + env vars
- WP install at `hq.funkmedia.net/<tenant>`
- DNS record
- Stripe webhook endpoint URL + signing secret
\`\`\`

- [ ] **Step 2: Commit** — `git commit -m "docs: CLONE.md fork playbook"`

---

### Task 3.7: Sprint 3 smoke + final handoff

**Files:** `__tests__/sprint3-smoke.md`

- [ ] **Step 1: Smoke checklist**

```markdown
# Sprint 3 Smoke Checklist

DASHBOARD (logged in as a customer):
- [ ] /signup creates account, sends verification code, code confirms account
- [ ] /login signs in, redirects to /dashboard
- [ ] /dashboard renders with sidebar, shows email
- [ ] /dashboard/profile shows current name, edits save to Cognito
- [ ] /dashboard/orders shows orders for the logged-in customer's email (if any)
- [ ] Direct visit to /dashboard while signed out redirects to /login?next=/dashboard

CONSOLE (logged in as admin):
- [ ] /console/orders shows WC orders, paginated
- [ ] /console/customers shows registered customers
- [ ] /console/products shows products with stock status
- [ ] Switching tenant filter scopes results correctly (when multi-tenant data exists)

CLONE:
- [ ] Follow CLONE.md to spin up `functionunion-temp` from scratch in <2 hours
- [ ] functionunion smoke: contact form lands lead with tenant_id=functionunion
- [ ] /console (logged in as OJ) shows leads from BOTH ujamaaexpo AND functionunion

Last run: <date>, by: <name>, result: <pass/fail>
```

- [ ] **Step 2: Commit** — `git commit -m "docs: Sprint 3 smoke + final handoff"`

- [ ] **Step 3: Final review with OJ** — Template is ready. Forks can begin (functionunion + abmillerday + IncPros + blog).

---

## End of Sprint 3 / End of Plan

The FMOS-Lite template is complete. Forking process is documented. ujamaaexpo.com is live. Path to FMOS migration is mapped out in the spec.

**Total scope shipped:**
- 1 forkable Next.js 15 App Router template
- 8 customer-facing surfaces + 5 admin console surfaces
- 5 critical ecomm bugs eliminated during port (not patched — gone)
- Multi-tenant Cognito + MySQL infrastructure (shared, scoped by tenant_id)
- Forking playbook for future sites
- Migration path to FMOS documented

**Total commits across all 3 sprints:** ~50-70 small commits.
