'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter(); const search = useSearchParams()
  const next = search.get('next') ?? '/dashboard'
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (res.ok) router.push(next)
    else { setError(data.error ?? 'login failed'); setBusy(false) }
  }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Sign in</h1>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '0.875rem', background: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <Link href="/forgot-password" style={{ color: 'var(--wp--preset--color--bone, #999)' }}>Forgot password?</Link> · <Link href="/signup" style={{ color: 'var(--wp--preset--color--primary, #ac323a)' }}>Create account</Link>
        </p>
      </form>
    </div>
  )
}