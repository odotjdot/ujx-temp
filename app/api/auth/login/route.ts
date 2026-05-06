import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1'
const client = new CognitoIdentityProviderClient({ region })

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email + password required' }, { status: 400 })
  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID!,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))
    const idToken = result.AuthenticationResult?.IdToken
    const accessToken = result.AuthenticationResult?.AccessToken
    if (!idToken || !accessToken) return NextResponse.json({ error: 'auth failed' }, { status: 401 })
    const res = NextResponse.json({ success: true })
    res.cookies.set('dashboard-id-token', idToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60*60, path: '/' })
    res.cookies.set('dashboard-access-token', accessToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60*60, path: '/' })
    if (result.AuthenticationResult?.RefreshToken) res.cookies.set('dashboard-refresh-token', result.AuthenticationResult.RefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30*24*60*60, path: '/' })
    return res
  } catch (err: any) {
    if (err.name === 'NotAuthorizedException') return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    if (err.name === 'UserNotConfirmedException') return NextResponse.json({ error: 'email not verified' }, { status: 403 })
    return NextResponse.json({ error: 'auth error' }, { status: 500 })
  }
}