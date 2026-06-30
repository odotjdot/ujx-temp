import { NextRequest, NextResponse } from 'next/server'
import { getStripeServer } from '../../../lib/stripe-client'
import { getDb } from '../../../lib/db'
import { sendNotificationEmail } from '../../../lib/email'

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

  const pool = getDb()
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
      await sendNotificationEmail(
        process.env.NOTIFICATION_EMAIL ?? 'info@ujamaaexpo.com',
        `[${tenantId}] Order paid: ${pi.id}`,
        `Payment Intent ${pi.id} succeeded for ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}.`,
        `<p>Payment Intent <code>${pi.id}</code> succeeded for ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}.</p>`
      )
    } catch (err: any) { console.error('[stripe-webhook] notify failed:', err.message) }
  }
  return NextResponse.json({ received: true })
}