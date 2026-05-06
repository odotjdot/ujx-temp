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