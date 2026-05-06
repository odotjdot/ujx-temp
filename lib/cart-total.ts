export type Locale = 'us' | 'eu'

export function parseCurrencyToCents(input: string, locale: Locale = 'us'): number {
  if (!input || typeof input !== 'string') throw new Error('parseCurrencyToCents: empty input')
  let cleaned = input.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) throw new Error(`parseCurrencyToCents: no digits in "${input}"`)
  if (locale === 'eu') cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  else cleaned = cleaned.replace(/,/g, '')
  const num = Number(cleaned)
  if (!Number.isFinite(num)) throw new Error(`parseCurrencyToCents: not a number "${input}"`)
  return Math.round(num * 100)
}

export function formatCents(cents: number, locale: Locale = 'us'): string {
  const dollars = cents / 100
  if (locale === 'eu') return `€${dollars.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  return `$${dollars.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}