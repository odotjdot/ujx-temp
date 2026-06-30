import { getStripeServer } from '../../lib/stripe-client'
import { formatCents } from '../../lib/cart-total'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ payment_intent?: string }> }) {
  const { payment_intent } = await searchParams
  if (!payment_intent) redirect('/')

  // Guest checkout has no authenticated session: the unguessable pi_ id is the
  // bearer credential. We tenant-scope that bearer (PI must carry our tenant_id)
  // and reveal amount-only — never line items or PII — as the accepted v1
  // tradeoff. See FM-11 (UJX-6).
  const cantVerify = (
    <div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
      <h1>We couldn&apos;t verify this order.</h1>
      <p style={{ marginTop: '1rem' }}>If you completed a purchase, you&apos;ll receive an email confirmation shortly.</p>
    </div>
  )

  let intent
  try { intent = await getStripeServer().paymentIntents.retrieve(payment_intent) }
  catch {
    return cantVerify
  }

  // Tenant-scope the bearer: on the SHARED Stripe account a pi_ id minted by
  // another tenant would otherwise be viewable here. Reject any PI whose
  // metadata.tenant_id is missing or does not match this deployment's tenant,
  // showing the same generic view so the amount is never revealed cross-tenant.
  // Fail closed: require a configured tenant AND a matching, present tenant_id.
  const tenantId = process.env.TENANT_ID
  if (!tenantId || intent.metadata?.tenant_id !== tenantId) {
    return cantVerify
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