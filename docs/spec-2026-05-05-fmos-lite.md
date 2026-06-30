---
title: FMOS-Lite Template + UJX Stable Launch
date: 2026-05-05
author: oj + claude
status: DRAFT — awaiting OJ sign-off
---

# FMOS-Lite Template + UJX Stable Launch

## Mission

Build a forkable Next.js 15 App Router template that delivers FMOS-lite functionality (content + contact + store + customer dashboard + admin console) and ships **ujamaaexpo.com** as the first live instance. Each future site forks this template, brand-swaps, toggles which surfaces are public, and adds its own data-specific tabs.

**Sites that will fork this template:** ujx, functionunion, abmillerday, IncPros (advanced store), OJ's blog (with store), future Contra/Upwork client sites.

## Why this exists

- 3 client sites need to ship for revenue this month
- IncPros + blog are downstream forks of the same template (same DNA, more tabs)
- FMOS will eventually replace this template for all sites; this is the temporary stand-in
- All living data (orders, customers, leads, content) will migrate INTO FMOS when ready
- Doctrine: build the system (template), not the product (any single site)

## Architecture

| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 App Router (existing ujx-temp base) | Already built, clean, the "right router" |
| Content | WordPress at `hq.funkmedia.net/<tenant>` via REST + GraphQL | Already wired in ujx-temp |
| Products + Cart + Orders | WooCommerce on hq.funkmedia.net (port from incpros-fe) | OJ directive: use what's built, fix the bugs |
| Lead capture storage | NEW MySQL DB `fm_temp_sites_v1.contact_submissions` on `fm-aurora-cluster` | Isolated from FMOS Postgres prod |
| Auth | NEW Cognito User Pool (separate from FMOS Cognito) — admin + customer roles, `tenant_access` attribute | Mirrors FMOS multi-tenant; clean cutover when FMOS ready |
| Payments | Stripe via WooCommerce (port from incpros-fe, FIX bugs) | Existing wiring works |
| Email | AWS SES (form confirmations, order confirmations, password resets) | Already in FMOS env, scoped IAM available |

## Surfaces

| Path | Audience | Auth | Notes |
|---|---|---|---|
| `/` + content pages | Public | None | WP-driven, ISR cache 60s |
| `/contact` | Public | None | Form → MySQL → SES notification → optional Notion relay |
| `/shop` + `/shop/[product]` | Public | None | WooCommerce products, browse + add to cart |
| `/cart`, `/checkout`, `/order-confirmation` | Public | Optional (guest checkout) | WooCommerce + Stripe Elements |
| `/login`, `/signup`, `/forgot-password` | Public | None | Customer auth (Cognito) |
| `/dashboard/*` | Customer | Cognito (customer role) | Orders, profile, downloads, future site-specific tabs |
| `/console/login` | Admin | None | **Separate door** per FMOS pattern |
| `/console/*` | Admin | Cognito (admin role) | Lead viewer, order admin, customer admin, product admin |

## Per-fork configuration

Each site fork sets via env vars:
- `TENANT_ID` — e.g. `ujamaaexpo`
- `WP_BACKEND_URL` — `https://hq.funkmedia.net/<tenant>`
- `WC_PRODUCT_FILTER` — optional product category filter
- `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` — shared Stripe account v1, metadata-tagged per tenant
- `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` — shared pool
- `BRAND_PRIMARY_COLOR`, `BRAND_LOGO_URL`, etc. — themable
- `NAV_SURFACES` — comma list of which surfaces appear in nav (e.g. `home,shop,contact` for ujx; `home,shop,dashboard,contact` for IncPros)

## Code inventory: PORT / REWRITE / BUILD FRESH

### PORT from `/Users/odotjdot/APPS/incpros-fe` (lift, rewire data layer to App Router patterns)
- Storefront UI: `src/wp-templates/single-product.tsx`, `archive-product.tsx`, `page-cart.tsx`, `page-checkout.tsx`
- Dashboard chassis: `src/components/Dashboard/*` (layout, sidebar, top nav)
- Reusable UI: `src/components/Card*`, `Badge*`, `Button*`, `Modal*`, `Form*`
- Profile editor: `src/pages/dashboard/edit-profile/*`
- WooCommerce session middleware: from `faust.config.js` (the woo-session token capture pattern, simplified for App Router fetch)
- Stripe Elements integration shape

### REWRITE during port (DO NOT carry these bugs forward)
1. **Cart total math** — replace `parseFloat(total.replace(/[^0-9.]/g, ''))` (overcharges 100× on $1k+ carts) with proper currency parser
2. **Payment intent revalidation** — re-create PI when cart total changes between fill and confirm
3. **`removeFromCart` failure handling** — block redirect on failure, surface error to user
4. **Stripe webhook idempotency** — check order status before applying update; reject duplicate event IDs
5. **Order confirmation auth** — verify `order_id` belongs to authenticated user server-side before returning data

### BUILD FRESH (no incpros-fe equivalent)
- Cognito User Pool + IAM provisioning
- `/login`, `/signup`, `/forgot-password` (customer)
- `/console/login` (admin — separate door)
- App Router middleware gating `/dashboard/*` and `/console/*`
- `/console` admin pages (lead viewer + order/customer/product admin)
- MySQL `contact_submissions` table + writer
- Server-side reCAPTCHA v3 verification (currently fake)
- AWS SES email notifications

### STABILITY FIXES on existing ujx-temp code
1. `app/layout.tsx:31` — wrap `getThemeCSS()` in try-catch (currently crashes whole site if WP down)
2. `app/page.tsx:50` — replace "Loading..." inline div with proper fallback when WP front page missing
3. `app/api/contact/route.ts` — replace broken `api.funkmedia.io` POST with MySQL writer + server-side reCAPTCHA verify
4. `app/page.tsx:67` — decide on `wpforms` block filter (drop entirely or document with comment)

## Sequencing

### Sprint 1 — UJX Stable Foundation (Days 1-2)
| Story | AC |
|---|---|
| S1: Stability fixes | 4 stability fixes deployed, ujx-temp builds clean, smoke test passes for /, /contact, /api/contact |
| S2: MySQL provision | `fm_temp_sites_v1` DB created on fm-aurora-cluster, `contact_submissions` table created with schema below, scoped IAM user `fm_tempsites_writer` provisioned |
| S3: /api/contact rewrite | Writes to MySQL via SSH tunnel (dev) or RDS Proxy (prod), verifies reCAPTCHA token server-side, sends SES notification, returns 200 on success / 400 on validation / 500 on infra error |
| S4: Cognito User Pool | Pool `fm-temp-sites` provisioned, app client configured, `role` (admin\|customer) and `tenant_access` (CSV) custom attributes added, OJ admin user seeded with all-tenant access |

### Sprint 2 — UJX Store + Admin Console (Days 3-4)
| Story | AC |
|---|---|
| S5: WooCommerce session middleware port | Cart session token captured + sent on subsequent requests in App Router fetch wrapper, persists 7 days, invalidates on logout |
| S6: Storefront port + bug fixes | `/shop`, `/shop/[slug]`, `/cart`, `/checkout`, `/order-confirmation` all functional; **all 5 ecomm bugs verified fixed** with explicit test cases |
| S7: /console/login + /console | Admin can log in via separate `/console/login` door, `/console` shows leads table filtered by `tenant_access`, pagination + date filter work |
| S8: UJX production deploy | ujamaaexpo.com live with content + contact + store + admin console, smoke test of golden path passes |

### Sprint 3 — Customer Dashboard + Template Polish (Days 5-7)
| Story | AC |
|---|---|
| S9: Ncmaz dashboard chassis port | `/dashboard` layout + sidebar + top nav rendered behind Cognito gate, /dashboard/profile editable + saves to Cognito + WC customer |
| S10: Customer order history | `/dashboard/orders` lists logged-in customer's WC orders with status, line items, totals |
| S11: /console expanded tabs | `/console/orders`, `/console/customers`, `/console/products` — admin can view (read-only v1), edit deferred to WC admin |
| S12: CLONE.md | Step-by-step playbook for forking template → branding → enabling surfaces → deploy. Includes spinning up `fm_<tenant>` WP install on hq.funkmedia.net + Cognito tenant_access entry + Stripe metadata + DNS |

## Data model

### MySQL `fm_temp_sites_v1.contact_submissions`
```sql
CREATE TABLE contact_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  source_site VARCHAR(255) NOT NULL,        -- e.g. 'ujamaaexpo.com'
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Cognito User Pool `fm-temp-sites`
- Standard attributes: email, given_name, family_name, phone_number
- Custom attributes:
  - `custom:role` — enum `admin` | `customer`
  - `custom:tenant_access` — CSV of tenant_ids the user can see (admins only — customers always see their own)
- App clients:
  - `fm-temp-sites-customer` — USER_SRP_AUTH flow, used by customer login
  - `fm-temp-sites-admin` — USER_SRP_AUTH flow + admin app secret, used by admin login

### WooCommerce side
- Products live in WP per tenant (`hq.funkmedia.net/ujamaaexpo/wp-admin`)
- Customer accounts linked from Cognito sub → WC customer via `wc_user_meta.cognito_sub`
- Order metadata includes `_tenant_id` and `_cognito_sub` for cross-system traceability

## Migration path to FMOS

When FMOS is ready to take over:
- **Contact submissions:** mysqldump → INSERT into FMOS Postgres `submissions` (1 SQL transform)
- **Customers:** Cognito-to-Cognito user migration trigger (AWS native pattern)
- **WC orders:** mysqldump WP tables → AWS DMS or custom script → FMOS Postgres orders
- **Products:** WP admin export → FMOS product import
- **Content:** stays in WP until FMOS content module replaces it
- **DNS cutover** per site, decommission temp infra after 30-day backup window

Total estimated cutover effort per site: ~4-6 hours when FMOS is ready.

## Open decisions (defaults applied unless OJ overrides)

1. **Stripe account:** ONE shared, tenant in metadata for v1. Per-tenant accounts later when 1099/tax volume requires it.
2. **Email provider:** AWS SES (already in env). FROM addresses per tenant via verified identities.
3. **Inventory management:** WooCommerce native — admin manages in WP admin
4. **Tax handling:** WooCommerce + TaxJar plugin (or manual rates). Decided per site by OJ in WC admin.
5. **Refunds:** WooCommerce admin only for v1. /console may add refund initiation in v2.
6. **WC product cache:** ISR 60s for product pages, no cache for cart/checkout/inventory checks.

## Risks

- **WooCommerce session token lifecycle complexity** — proven in incpros-fe, port carefully
- **WPGraphQL performance at scale** — switch to WC REST API for hot paths if WPGraphQL becomes bottleneck
- **Cognito ↔ WC customer linking edge cases** — sign-up race conditions, email change syncs (deferred to v2)
- **Stripe webhook delivery reliability** — implement webhook retry queue if AWS Lambda cold-start causes drops
- **The 5 ported ecomm bugs** must be verified fixed with explicit test cases before launch — easy to forget in the porting blur

## Out of scope for this template

- Subscriptions / recurring billing (WC subscriptions plugin if needed per site)
- Marketplace / multi-vendor (different problem entirely)
- IncPros entity formation flow (separate chat, separate template extension)
- FMOS replacement (this is explicitly the interim)

---

**Status:** DRAFT — awaiting OJ approval before build begins.
**Estimated effort:** ~1 week focused work (3 sprints of 2-3 days each).
**First live ship:** ujamaaexpo.com end of Sprint 2 (~day 4).
