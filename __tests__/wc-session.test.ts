import { describe, it, expect, beforeEach } from 'vitest'

describe('wc-session', () => {
  beforeEach(() => { localStorage.removeItem('woo-session') })
  it('returns null when no token stored', async () => {
    const { getSessionToken } = await import('../lib/wc-session')
    expect(getSessionToken()).toBeNull()
  })
  it('round-trips token within 7 days', async () => {
    const { setSessionToken, getSessionToken } = await import('../lib/wc-session')
    setSessionToken('abc123'); expect(getSessionToken()).toBe('abc123')
  })
  it('expires token after 7 days', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    localStorage.setItem('woo-session', JSON.stringify({ token: 'old', createdTime: eightDaysAgo }))
    const { getSessionToken } = await import('../lib/wc-session')
    expect(getSessionToken()).toBeNull()
    expect(localStorage.getItem('woo-session')).toBeNull()
  })
  it('clears on "false" sentinel', async () => {
    const { setSessionToken, getSessionToken } = await import('../lib/wc-session')
    setSessionToken('abc'); setSessionToken('false'); expect(getSessionToken()).toBeNull()
  })
})