import { jwtVerify, createRemoteJWKSet } from 'jose'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.COGNITO_USER_POOL_ID

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (jwks) return jwks
  if (!POOL_ID) throw new Error('COGNITO_USER_POOL_ID not set')
  jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))
  return jwks
}

export interface ConsoleClaims { sub: string; email: string; role: string; tenant_access: string[] }

export async function verifyConsoleToken(idToken: string): Promise<ConsoleClaims | null> {
  try {
    const { payload } = await jwtVerify(idToken, getJwks(), { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` })
    if (payload['custom:role'] !== 'admin') return null
    const ta = (payload['custom:tenant_access'] as string | undefined) ?? ''
    return { sub: payload.sub as string, email: payload.email as string, role: 'admin', tenant_access: ta.split(',').map(s => s.trim()).filter(Boolean) }
  } catch (err: any) {
    console.error('[console-auth] verify failed:', err.message)
    return null
  }
}