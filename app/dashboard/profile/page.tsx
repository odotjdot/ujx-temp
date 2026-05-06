'use client'
import { useEffect, useState } from 'react'

export default function ProfilePage() {
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/profile').then(r => r.json()).then(data => {
      if (data.email) {
        setEmail(data.email)
        setGivenName(data.given_name ?? '')
        setFamilyName(data.family_name ?? '')
      }
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null)
    const res = await fetch('/api/dashboard/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ given_name: givenName, family_name: familyName })
    })
    if (res.ok) setMessage({ type: 'success', text: 'Profile updated successfully' })
    else setMessage({ type: 'error', text: 'Failed to update profile' })
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Profile</h1>
      <form onSubmit={save}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#999' }}>Email (cannot be changed)</label>
          <input type="email" value={email} disabled style={{ width: '100%', padding: '0.75rem', background: '#111', border: '1px solid #333', color: '#666', cursor: 'not-allowed' }} />
        </div>
        <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#ccc' }}>First Name</label>
            <input type="text" value={givenName} onChange={e => setGivenName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#ccc' }}>Last Name</label>
            <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)} required style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
          </div>
        </div>
        {message && <p style={{ color: message.type === 'error' ? '#ff4444' : '#4ade80', marginBottom: '1rem' }}>{message.text}</p>}
        <button type="submit" disabled={busy} style={{ padding: '0.875rem 2rem', background: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600 }}>
          {busy ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}