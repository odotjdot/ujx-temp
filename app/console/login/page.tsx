'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Inner component holds useSearchParams — must be inside a Suspense boundary
// in Next.js 15 to avoid the prerender bailout error.
function ConsoleLoginForm() {
  const router = useRouter(); const search = useSearchParams()
  const next = search.get('next') ?? '/console'
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/console/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (res.ok) router.push(next)
    else { setError(data.error ?? 'login failed'); setBusy(false) }
  }

  return (
    <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>Admin Console</h1>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
      {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ width: '100%', padding: '0.875rem', background: '#ac323a', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>{busy ? 'Signing in...' : 'Sign in'}</button>
    </form>
  )
}

export default function ConsoleLogin() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff' }}>
      <Suspense>
        <ConsoleLoginForm />
      </Suspense>
    </div>
  )
}
