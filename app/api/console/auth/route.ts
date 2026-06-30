import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import { createHmac } from 'crypto'

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const client = new CognitoIdentityProviderClient({ region })

function secretHash(username: string): string {
  const cid = process.env.COGNITO_ADMIN_CLIENT_ID!
  const sec = process.env.COGNITO_ADMIN_CLIENT_SECRET!
  return createHmac('sha256', sec).update(username + cid).digest('base64')
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email + password required' }, { status: 400 })
  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_ADMIN_CLIENT_ID!,
      AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: secretHash(email) },
    }))
    const idToken = result.AuthenticationResult?.IdToken
    if (!idToken) return NextResponse.json({ error: 'auth failed' }, { status: 401 })
    const res = NextResponse.json({ success: true })
    res.cookies.set('console-id-token', idToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60*60, path: '/' })
    if (result.AuthenticationResult?.RefreshToken) res.cookies.set('console-refresh-token', result.AuthenticationResult.RefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30*24*60*60, path: '/' })
    return res
  } catch (err: any) {
    if (err.name === 'NotAuthorizedException') return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    if (err.name === 'PasswordResetRequiredException') return NextResponse.json({ error: 'password reset required' }, { status: 403 })
    console.error('[console/auth]', err)
    return NextResponse.json({ error: 'auth error' }, { status: 500 })
  }
}