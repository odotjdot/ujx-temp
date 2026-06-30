import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getThemeCSS', () => {
  let originalFetch: typeof fetch
  beforeEach(() => { originalFetch = global.fetch })
  afterEach(() => { global.fetch = originalFetch })

  it('returns empty string when WP fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const { getThemeCSS } = await import('../lib/theme')
    const css = await getThemeCSS()
    expect(css).toBe('')
  })

  it('returns empty string when WP returns 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' } as any)
    const { getThemeCSS } = await import('../lib/theme')
    const css = await getThemeCSS()
    expect(css).toBe('')
  })
})