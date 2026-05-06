import Link from 'next/link'

export function ConsoleNav({ current }: { current: 'leads' | 'orders' | 'customers' | 'products' }) {
  const tabs = [
    { id: 'leads', label: 'Leads', href: '/console' },
    { id: 'orders', label: 'Orders', href: '/console/orders' },
    { id: 'customers', label: 'Customers', href: '/console/customers' },
    { id: 'products', label: 'Products', href: '/console/products' },
  ]
  return (
    <nav style={{ borderBottom: '1px solid #333', marginBottom: '2rem' }}>
      <ul style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0 }}>
        {tabs.map(t => (
          <li key={t.id} style={{ marginRight: '1rem' }}>
            <Link href={t.href} style={{ 
              display: 'block', padding: '1rem 0', textDecoration: 'none', 
              color: current === t.id ? '#fff' : '#999', 
              borderBottom: current === t.id ? '2px solid var(--wp--preset--color--primary, #ac323a)' : '2px solid transparent',
              fontWeight: current === t.id ? 600 : 400
            }}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}