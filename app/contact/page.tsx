'use client'

import { useState } from 'react'

declare global {
  interface Window {
    grecaptcha: any
  }
}

const RECAPTCHA_SITE_KEY = '6LecXY8sAAAAANqi4AO2T2f5wb2ltOpU-KgTwPXZ'

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const form = e.currentTarget
    const data = new FormData(form)

    // Get reCAPTCHA token
    let token = ''
    try {
      token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'contact' })
    } catch {
      // reCAPTCHA not loaded — submit anyway, server will handle
    }

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        email: data.get('email'),
        message: data.get('message'),
        recaptchaToken: token,
      }),
    })

    if (res.ok) {
      setStatus('sent')
      form.reset()
      // Push to GTM dataLayer for conversion tracking
      ;(window as any).dataLayer?.push({ event: 'form_submit', form_name: 'contact' })
    } else {
      const err = await res.json()
      setErrorMsg(err.error || 'Something went wrong')
      setStatus('error')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '0',
    color: 'inherit',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--wp--preset--color--bone, #aaa)',
  }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ minHeight: '70vh', padding: '5rem 1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontFamily: "var(--wp--preset--font-family--abril-fatface, 'Abril Fatface', serif)", marginBottom: '1rem', textTransform: 'uppercase' as const }}>Contact</h1>
        <p style={{ color: 'var(--wp--preset--color--bone, #999)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Have a question, idea, or want to get involved with The Ujamaa Expo? Drop us a line.
        </p>

        {status === 'sent' ? (
          <div style={{ padding: '2rem', border: '1px solid #333', borderRadius: '8px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Message sent.</p>
            <p style={{ color: 'var(--wp--preset--color--bone, #999)' }}>We'll be in touch.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="name" style={labelStyle}>Name *</label>
                <input id="name" name="name" type="text" required style={inputStyle} />
              </div>
              <div>
                <label htmlFor="email" style={labelStyle}>Email *</label>
                <input id="email" name="email" type="email" required style={inputStyle} />
              </div>
            </div>

            <div>
              <label htmlFor="message" style={labelStyle}>Message *</label>
              <textarea id="message" name="message" rows={6} required style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            {status === 'error' && (
              <p style={{ color: '#ff4444', fontSize: '0.875rem' }}>{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="wp-element-button"
              style={{
                padding: '0.875rem 2rem',
                backgroundColor: 'var(--wp--preset--color--primary, #ac323a)',
                color: '#fff',
                border: 'none',
                borderRadius: '0',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: status === 'sending' ? 'wait' : 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
