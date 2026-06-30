import { ConsoleNav } from '../../../components/console/ConsoleNav'

export default function ConsoleOrders() {
  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Admin Console</h1>
      </header>
      <ConsoleNav current="orders" />
      <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed #333', borderRadius: '8px' }}>
        <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Order management coming soon.</p>
        <p style={{ color: '#999' }}>Please manage orders directly in the WooCommerce admin dashboard for v1.</p>
      </div>
    </div>
  )
}