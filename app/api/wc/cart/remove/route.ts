import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../../lib/wc-graphql'
const REMOVE = `mutation Remove($keys:[ID]!){removeItemsFromCart(input:{keys:$keys}){cart{contents{itemCount}}}}`

export async function POST(req: NextRequest) {
  const { keys } = await req.json()
  if (!Array.isArray(keys) || keys.length === 0) return NextResponse.json({ error: 'keys required' }, { status: 400 })
  const session = req.cookies.get('woo-session')?.value
  try {
    const result = await wcGraphQLWithSession(REMOVE, { keys }, { sessionToken: session })
    const res = NextResponse.json({ success: true, itemCount: (result.data as any)?.removeItemsFromCart?.cart?.contents?.itemCount ?? 0 })
    if (result.sessionToken) res.cookies.set('woo-session', result.sessionToken, { sameSite: 'lax', maxAge: 7*24*60*60 })
    return res
  } catch (err: any) {
    console.error('[cart/remove] WC error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}