import { describe, it, expect } from 'vitest'

describe('parseCurrencyToCents', () => {
  it('parses simple US dollar amount', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$24.99')).toBe(2499)
  })
  it('THE BUG FIX: parses amount with thousands comma correctly', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$1,234.56')).toBe(123456)
  })
  it('handles empty/invalid gracefully', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('')).toBe(0)
    expect(parseCurrencyToCents(null as any)).toBe(0)
    expect(parseCurrencyToCents('free')).toBe(0)
  })
})