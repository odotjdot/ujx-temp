import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))

async function getCustomerEmail(): Promise<string | null> {
  const t = (await cookies()).get('dashboard-id-token')?.value
  if (!t) return null
  try { const { payload } = await jwtVerify(t, jwks, { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` }); return payload.email as string }
  catch { return null }
}

export default async function DashboardHome() {
  const email = await getCustomerEmail()
  if (!email) redirect('/login?next=/dashboard')
  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Welcome back</h1>
      <p style={{ color: 'var(--wp--preset--color--bone, #999)' }}>Signed in as {email}</p>
    </div>
  )
}