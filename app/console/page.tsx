'use client'
import { useEffect, useState } from 'react'

export default function ConsoleHome() {
  const [data, setData] = useState<any>(null)
  const [tenant, setTenant] = useState<string>('')

  async function load(t?: string) {
    const r = await fetch(t ? `/api/console/leads?tenant=${t}` : '/api/console/leads')
    if (r.status === 401) { window.location.href = '/console/login'; return }
    setData(await r.json())
  }
  useEffect(() => { load() }, [])

  if (!data) return <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Console — Leads</h1>
        <select value={tenant} onChange={e => { setTenant(e.target.value); load(e.target.value || undefined) }} style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #444', padding: '0.5rem' }}>
          <option value="">All tenants</option>
          {(data.tenant_access ?? []).map((t: string) => <option key={t} value={t}>{t}</option>)}
        </select>
      </header>
      <p style={{ marginBottom: '1rem', color: '#999' }}>{data.total} total submissions</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead><tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}><th style={{ padding: '0.75rem 0.5rem' }}>When</th><th>Tenant</th><th>Name</th><th>Email</th><th>Message</th><th>Score</th></tr></thead>
        <tbody>
          {data.data.map((row: any) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #1f1f1f' }}>
              <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleString()}</td>
              <td>{row.tenant_id}</td><td>{row.name}</td>
              <td><a href={`mailto:${row.email}`} style={{ color: '#9ec5ff' }}>{row.email}</a></td>
              <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.message}</td>
              <td>{row.recaptcha_score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}