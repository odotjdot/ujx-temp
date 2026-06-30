import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({ region: process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1' })

export async function POST(req: NextRequest) {
  const { email, password, given_name, family_name } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email + password required' }, { status: 400 })
  try {
    await client.send(new SignUpCommand({
      ClientId: process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        ...(given_name ? [{ Name: 'given_name', Value: given_name }] : []),
        ...(family_name ? [{ Name: 'family_name', Value: family_name }] : []),
        { Name: 'custom:role', Value: 'customer' },
      ],
    }))
    return NextResponse.json({ success: true, message: 'check your email for a verification code' })
  } catch (err: any) {
    if (err.name === 'UsernameExistsException') return NextResponse.json({ error: 'an account with that email already exists' }, { status: 409 })
    if (err.name === 'InvalidPasswordException') return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'signup failed' }, { status: 500 })
  }
}