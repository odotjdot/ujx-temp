import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { CognitoIdentityProviderClient, GetUserCommand, UpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const client = new CognitoIdentityProviderClient({ region: REGION })
const jwks = createRemoteJWKSet(new URL(`https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`))

async function getAccessToken(req: NextRequest) {
  // We need the access token to call GetUser/UpdateUserAttributes, not just the ID token
  // Let's assume we store it in dashboard-access-token, or we just trust the ID token for read, 
  // but we MUST have the access token for Cognito API calls.
  return req.cookies.get('dashboard-access-token')?.value
}

export async function GET(req: NextRequest) {
  const t = (await cookies()).get('dashboard-id-token')?.value
  if (!t) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const { payload } = await jwtVerify(t, jwks, { issuer: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}` })
    return NextResponse.json({
      email: payload.email,
      given_name: payload.given_name,
      family_name: payload.family_name,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }
}

export async function PUT(req: NextRequest) {
  const accessToken = await getAccessToken(req)
  if (!accessToken) return NextResponse.json({ error: 'access token required for updates' }, { status: 401 })
  
  const { given_name, family_name } = await req.json()
  try {
    await client.send(new UpdateUserAttributesCommand({
      AccessToken: accessToken,
      UserAttributes: [
        { Name: 'given_name', Value: given_name ?? '' },
        { Name: 'family_name', Value: family_name ?? '' },
      ],
    }))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[dashboard/profile]', err)
    return NextResponse.json({ error: 'failed to update profile' }, { status: 500 })
  }
}