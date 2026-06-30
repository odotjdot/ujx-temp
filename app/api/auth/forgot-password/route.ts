import { NextRequest, NextResponse } from 'next/server'
import { CognitoIdentityProviderClient, ForgotPasswordCommand, ConfirmForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({ region: process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-west-1' })

export async function POST(req: NextRequest) {
  const { action, email, code, password } = await req.json()
  
  if (action === 'request') {
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    try {
      await client.send(new ForgotPasswordCommand({
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID!,
        Username: email,
      }))
      return NextResponse.json({ success: true })
    } catch (err: any) {
      console.error('[auth/forgot-password/request]', err)
      // Always return true to prevent email enumeration
      return NextResponse.json({ success: true })
    }
  } 
  
  if (action === 'confirm') {
    if (!email || !code || !password) return NextResponse.json({ error: 'email, code, and new password required' }, { status: 400 })
    try {
      await client.send(new ConfirmForgotPasswordCommand({
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID!,
        Username: email,
        ConfirmationCode: code,
        Password: password,
      }))
      return NextResponse.json({ success: true })
    } catch (err: any) {
      if (err.name === 'CodeMismatchException' || err.name === 'ExpiredCodeException') {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
      }
      if (err.name === 'InvalidPasswordException') return NextResponse.json({ error: err.message }, { status: 400 })
      console.error('[auth/forgot-password/confirm]', err)
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 })
}