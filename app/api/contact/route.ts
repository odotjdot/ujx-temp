import { NextRequest, NextResponse } from 'next/server'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const TO_EMAIL = 'info@ujamaaexpo.com'
const FROM_EMAIL = 'oj.smith@funkmedia.net'
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || ''

// No explicit credentials — uses IAM role on Amplify, ~/.aws/credentials locally
const ses = new SESClient({ region: 'us-west-1' })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, message, recaptchaToken } = body

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  // Verify reCAPTCHA
  if (recaptchaToken) {
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET}&response=${recaptchaToken}`,
    })
    const verify = await verifyRes.json()
    if (!verify.success || verify.score < 0.3) {
      return NextResponse.json({ success: true })
    }
  }

  try {
    const result = await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [TO_EMAIL] },
      Message: {
        Subject: { Data: `UJX Contact: ${name.trim()}` },
        Body: {
          Text: { Data: `Name: ${name.trim()}\nEmail: ${email.trim()}\n\nMessage:\n${message.trim()}` },
          Html: { Data: `<p><strong>Name:</strong> ${name.trim()}</p><p><strong>Email:</strong> ${email.trim()}</p><hr/><p>${message.trim().replace(/\n/g, '<br/>')}</p>` }
        }
      },
      ReplyToAddresses: [email.trim()],
    }))
    console.log('SES sent:', result.MessageId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('SES ERROR:', err.name, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
