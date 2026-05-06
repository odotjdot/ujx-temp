import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('wcGraphQL', () => {
  let originalFetch: typeof fetch
  beforeEach(() => {
    originalFetch = global.fetch
    process.env.NEXT_PUBLIC_WORDPRESS_URL = 'https://hq.funkmedia.net/ujamaaexpo'
  })
  afterEach(() => { global.fetch = originalFetch })

  it('POSTs query+variables to /graphql and returns data', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { products: { nodes: [{ id: '1' }] } } }) } as any)
    const { wcGraphQL } = await import('../lib/wc-graphql')
    const res = await wcGraphQL<{ products: { nodes: { id: string }[] } }>('query{products{nodes{id}}}')
    expect(res.products.nodes).toHaveLength(1)
  })

  it('forwards woo session header when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), json: async () => ({ data: {} }) } as any)
    global.fetch = fetchMock
    const { wcGraphQL } = await import('../lib/wc-graphql')
    await wcGraphQL('query{viewer{id}}', undefined, { sessionToken: 'tok123' })
    const call = fetchMock.mock.calls[0]
    expect((call[1] as any).headers['woocommerce-session']).toBe('Session tok123')
  })

  it('throws on GraphQL errors array', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ errors: [{ message: 'boom' }] }) } as any)
    const { wcGraphQL } = await import('../lib/wc-graphql')
    await expect(wcGraphQL('q')).rejects.toThrow(/boom/)
  })
})