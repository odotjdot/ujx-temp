import { describe, it, expect } from 'vitest'

describe('parseCurrencyToCents', () => {
  it('parses simple US dollar amount', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$24.99')).toBe(2499)
  })
  it('THE BUG FIX: parses amount with thousands comma correctly', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$1,234.56')).toBe(123456)
    expect(parseCurrencyToCents('$10,000.00')).toBe(1000000)
  })
  it('handles missing decimals', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(parseCurrencyToCents('$50')).toBe(5000)
  })
  it('throws on garbage instead of silently returning wrong value', async () => {
    const { parseCurrencyToCents } = await import('../lib/cart-total')
    expect(() => parseCurrencyToCents('')).toThrow()
    expect(() => parseCurrencyToCents('abc')).toThrow()
  })
  it('formats cents back to display string', async () => {
    const { formatCents } = await import('../lib/cart-total')
    expect(formatCents(2499)).toBe('$24.99')
    expect(formatCents(123456)).toBe('$1,234.56')
  })
})