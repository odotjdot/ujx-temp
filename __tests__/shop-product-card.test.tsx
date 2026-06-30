import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ProductCard', () => {
  it('renders price formatted as currency', async () => {
    const { ProductCard } = await import('../components/store/ProductCard')
    render(<ProductCard product={{ slug: 't', name: 'Ticket', priceCents: 5000, image: null }} />)
    expect(screen.getByText('$50.00')).toBeDefined()
  })
  it('links to /shop/[slug]', async () => {
    const { ProductCard } = await import('../components/store/ProductCard')
    render(<ProductCard product={{ slug: 'event-ticket', name: 'Ticket', priceCents: 5000, image: null }} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/shop/event-ticket')
  })
})