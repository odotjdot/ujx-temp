'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/auth/signup', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ email, password, given_name: givenName, family_name: familyName }) 
    })
    const data = await res.json()
    if (res.ok) setSuccess(true)
    else { setError(data.error ?? 'signup failed'); setBusy(false) }
  }

  if (success) {
    return (
      <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Check your email</h1>
        <p style={{ marginBottom: '2rem' }}>We&apos;ve sent a verification code to <strong>{email}</strong>.</p>
        <Link href="/login" style={{ padding: '0.875rem 2rem', backgroundColor: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Proceed to login</Link>
      </div>
    )
  }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Create Account</h1>
        <input type="text" placeholder="First Name" value={givenName} onChange={e => setGivenName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        <input type="text" placeholder="Last Name" value={familyName} onChange={e => setFamilyName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        <input type="password" placeholder="Password (min 8 chars, numbers, cases)" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
        {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '0.875rem', background: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>{busy ? 'Creating...' : 'Create Account'}</button>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--wp--preset--color--primary, #ac323a)' }}>Sign in</Link>
        </p>
      </form>
    </div>
  )
}