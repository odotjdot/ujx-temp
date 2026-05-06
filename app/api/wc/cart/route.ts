import { NextRequest, NextResponse } from 'next/server'
import { wcGraphQLWithSession } from '../../../../lib/wc-graphql'

const GET_CART = `query{cart{contents{nodes{key product{node{databaseId name slug image{sourceUrl}}} quantity total subtotal}} subtotal total}}`

export async function GET(req: NextRequest) {
  const session = req.cookies.get('woo-session')?.value
  const result = await wcGraphQLWithSession<{ cart: any }>(GET_CART, undefined, { sessionToken: session })
  const res = NextResponse.json(result.data.cart)
  if (result.sessionToken) res.cookies.set('woo-session', result.sessionToken, { sameSite: 'lax', maxAge: 7*24*60*60 })
  return res
}