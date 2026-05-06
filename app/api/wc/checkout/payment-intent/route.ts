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