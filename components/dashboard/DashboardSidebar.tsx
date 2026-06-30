'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/profile', label: 'Profile' },
] as const

export default function DashboardSidebar() {
  const pathname = usePathname()
  return (
    <nav style={{ width: '240px', padding: '2rem 1rem', borderRight: '1px solid #333', minHeight: '100vh' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <li key={item.href} style={{ marginBottom: '0.25rem' }}>
              <Link href={item.href} style={{
                display: 'block', padding: '0.75rem 1rem', textDecoration: 'none',
                color: active ? '#fff' : 'var(--wp--preset--color--bone, #999)',
                background: active ? 'var(--wp--preset--color--primary, #ac323a)' : 'transparent',
                borderRadius: '4px', fontWeight: active ? 600 : 400,
              }}>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}