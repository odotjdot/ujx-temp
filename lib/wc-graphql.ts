const ENDPOINT = () => {
  const base = process.env.NEXT_PUBLIC_WORDPRESS_URL
  if (!base) throw new Error('NEXT_PUBLIC_WORDPRESS_URL not set')
  return `${base}/graphql`
}

export interface WcGraphQLOptions { sessionToken?: string; revalidate?: number }
export interface SessionAware<T> { data: T; sessionToken: string | null }

export async function wcGraphQL<T>(query: string, variables?: Record<string, unknown>, opts: WcGraphQLOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.sessionToken) headers['woocommerce-session'] = `Session ${opts.sessionToken}`
  const res = await fetch(ENDPOINT(), {
    method: 'POST', headers, body: JSON.stringify({ query, variables }),
    next: opts.revalidate !== undefined ? { revalidate: opts.revalidate } : undefined,
  })
  if (!res.ok) throw new Error(`WPGraphQL HTTP ${res.status}`)
  const json = await res.json() as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(`WPGraphQL: ${json.errors.map(e => e.message).join('; ')}`)
  if (!json.data) throw new Error('WPGraphQL: no data returned')
  return json.data
}

export async function wcGraphQLWithSession<T>(query: string, variables?: Record<string, unknown>, opts: WcGraphQLOptions = {}): Promise<SessionAware<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.sessionToken) headers['woocommerce-session'] = `Session ${opts.sessionToken}`
  const res = await fetch(ENDPOINT(), { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  if (!res.ok) throw new Error(`WPGraphQL HTTP ${res.status}`)
  const json = await res.json() as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(`WPGraphQL: ${json.errors.map(e => e.message).join('; ')}`)
  const sessionToken = res.headers.get('woocommerce-session')
  return { data: json.data!, sessionToken: sessionToken && sessionToken !== 'false' ? sessionToken : null }
}