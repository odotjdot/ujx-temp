import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { wcGraphQL } from '../../../../lib/wc-graphql'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))

const CUSTOMER_ORDERS_QUERY = `
query CustomerOrders($email: String!) {
  customer(customerId: $email) {
    orders {
      nodes {
        databaseId
        orderKey
        status
        total
        date
        lineItems {
          nodes {
            product { node { name } }
            quantity
          }
        }
      }
    }
  }
}
`

export async function GET(req: NextRequest) {
  const t = (await cookies()).get('dashboard-id-token')?.value
  if (!t) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  let email: string
  try {
    const { payload } = await jwtVerify(t, jwks, { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` })
    email = payload.email as string
  } catch (err) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  try {
    // We query WC using the user's email as the lookup.
    // In WPGraphQL, customerId accepts email for lookups if permissions allow.
    const data = await wcGraphQL<{ customer: { orders: { nodes: any[] } } }>(CUSTOMER_ORDERS_QUERY, { email })
    return NextResponse.json({ orders: data.customer?.orders?.nodes ?? [] })
  } catch (err: any) {
    console.error('[dashboard/orders]', err)
    return NextResponse.json({ error: 'failed to fetch orders' }, { status: 500 })
  }
}