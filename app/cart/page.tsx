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