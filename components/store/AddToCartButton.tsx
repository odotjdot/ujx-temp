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