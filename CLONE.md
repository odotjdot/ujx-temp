# FMOS-Lite Forking Playbook

This repository serves as the FMOS-lite template. When you need to spin up a new tenant (e.g., functionunion, abmillerday, IncPros), follow this playbook.

## 1. Fork & Clone
Do not clone this repository directly for a specific site. Instead, fork it or duplicate the template:

```bash
git clone git@github.com:odotjdot/ujx-temp.git <new-site-name>
cd <new-site-name>
rm -rf .git
git init
git add .
git commit -m "Initial commit from FMOS-Lite template"
```

## 2. Infrastructure (WordPress)
1. Log into the `hq.funkmedia.net` server.
2. Spin up a new WP install in `/home/funkmedia.net/hq/<tenant_id>`.
3. Install the standard plugin stack (WooCommerce, WPGraphQL, FM-Styles).
4. Configure the front page and create standard products.

## 3. Infrastructure (Cognito)
The `fm-temp-sites` Cognito pool is shared. You do not need to create a new pool.
1. Determine the exact `tenant_id` string you will use (e.g., `functionunion`).
2. Add the `tenant_id` to the `custom:tenant_access` CSV list for any admin users who need access to its leads via `/console`.

## 4. Environment Variables
Copy `.env.local.sample` to `.env.local` and update the tenant specific variables:

```bash
# Set to the new tenant slug
TENANT_ID=<tenant_id>
SOURCE_SITE=<domain.com>

# Point to the new WP backend
NEXT_PUBLIC_WORDPRESS_URL=https://hq.funkmedia.net/<tenant_id>

# Keep these shared across tenants
TEMPSITES_DB_NAME=fm_funkmedia
TEMPSITES_DB_USER=fm_tempsites_writer

# Optional: customize notification email
LEADS_NOTIFY_EMAIL=oj@funkmedia.io
```

## 5. Enable/Disable Surfaces
Depending on the tenant, they may not need all features. You can toggle them by modifying the `Nav` in `app/layout.tsx` or deleting the folders if absolutely unnecessary (e.g. deleting `app/shop` if they don't have e-commerce).

## 6. Stripe setup (If Store enabled)
We use a shared Stripe account for v1. 
1. The metadata `tenant_id` tag is automatically passed in `lib/stripe-client.ts`.
2. Add the new `SOURCE_SITE` URL to the allowed origins in the Stripe Dashboard Webhooks to ensure `payment_intent.succeeded` routes to `<domain.com>/api/stripe-webhook`.

## 7. Deploy
Deploy the new repository to AWS Amplify, Vercel, or a custom EC2 host. Ensure all environment variables are populated in the hosting provider.