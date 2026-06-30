'use client'
import { useEffect, useState } from 'react'
import { formatCents, parseCurrencyToCents } from '../../../lib/cart-total'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/orders')
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
      .then(d => setOrders(d.orders))
      .catch(e => setError(typeof e === 'string' ? e : 'Failed to load orders'))
  }, [])

  if (error) return <div style={{ color: '#ff4444' }}>{error}</div>
  if (!orders) return <div style={{ color: '#999' }}>Loading orders...</div>

  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Order History</h1>
      {orders.length === 0 ? (
        <p style={{ color: '#999' }}>You haven&apos;t placed any orders yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {orders.map(order => (
            <div key={order.databaseId} style={{ border: '1px solid #333', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #222' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>Order #{order.databaseId}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999' }}>{new Date(order.date).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCents(parseCurrencyToCents(order.total))}</p>
                  <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.25rem 0.5rem', background: '#222', borderRadius: '4px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {order.status}
                  </span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {order.lineItems.nodes.map((item: any, i: number) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <span>{item.quantity}× {item.product?.node?.name ?? 'Unknown Product'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}