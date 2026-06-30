import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('HomePage fallback', () => {
  let originalFetch: typeof fetch
  beforeEach(() => { originalFetch = global.fetch })
  afterEach(() => { global.fetch = originalFetch })

  it('renders a useful message when WP front page is not configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { allSettings: { readingSettingsShowOnFront: 'posts' } } }),
    } as any)
    const HomePage = (await import('../app/page')).default
    const ui = await HomePage()
    render(ui as any)
    expect(screen.getByText(/site is being set up|no front page configured/i)).toBeDefined()
  })
})