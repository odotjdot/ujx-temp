'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestReset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/auth/forgot-password', { 
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', email }) 
    })
    if (res.ok) setStep('confirm')
    else setError('Failed to request reset')
    setBusy(false)
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/auth/forgot-password', { 
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', email, code, password }) 
    })
    const data = await res.json()
    if (res.ok) setStep('done')
    else setError(data.error ?? 'Failed to reset password')
    setBusy(false)
  }

  if (step === 'done') {
    return (
      <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Password Reset Complete</h1>
        <p style={{ marginBottom: '2rem' }}>You can now sign in with your new password.</p>
        <Link href="/login" style={{ padding: '0.875rem 2rem', backgroundColor: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Proceed to login</Link>
      </div>
    )
  }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem' }}>
      <form onSubmit={step === 'request' ? requestReset : confirmReset} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Reset Password</h1>
        
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} disabled={step !== 'request'} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit', opacity: step !== 'request' ? 0.5 : 1 }} />
        
        {step === 'confirm' && (
          <>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--wp--preset--color--bone, #999)' }}>Enter the verification code sent to your email.</p>
            <input type="text" placeholder="Verification Code" value={code} onChange={e => setCode(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
            <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'transparent', border: '1px solid #444', color: 'inherit' }} />
          </>
        )}

        {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
        
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '0.875rem', background: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>
          {busy ? 'Processing...' : step === 'request' ? 'Send Reset Code' : 'Reset Password'}
        </button>
        
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          Remembered it? <Link href="/login" style={{ color: 'var(--wp--preset--color--primary, #ac323a)' }}>Sign in</Link>
        </p>
      </form>
    </div>
  )
}