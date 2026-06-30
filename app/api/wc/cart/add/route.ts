import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../../lib/wc-graphql'
const ADD = `mutation Add($productId:Int!,$quantity:Int!){addToCart(input:{productId:$productId,quantity:$quantity}){cartItem{key quantity}}}`

export async function POST(req: NextRequest) {
  const { productId, quantity } = await req.json()
  if (!productId || !quantity) return NextResponse.json({ error: 'missing productId or quantity' }, { status: 400 })
  const session = req.cookies.get('woo-session')?.value
  try {
    const result = await wcGraphQLWithSession(ADD, { productId, quantity }, { sessionToken: session })
    const res = NextResponse.json({ success: true })
    if (result.sessionToken) res.cookies.set('woo-session', result.sessionToken, { sameSite: 'lax', maxAge: 7*24*60*60 })
    return res
  } catch (err: any) {
    console.error('[cart/add] WC error:', err.message)
    return NextResponse.json({ error: 'unable to add to cart' }, { status: 500 })
  }
}