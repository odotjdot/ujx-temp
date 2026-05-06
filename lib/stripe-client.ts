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