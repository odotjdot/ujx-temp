import DashboardSidebar from '../../components/dashboard/DashboardSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <DashboardSidebar />
      <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
    </div>
  )
}