import { NextRequest, NextResponse } from 'next/server'

const FMBH_API = 'https://api.funkmedia.io'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, message } = body

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${FMBH_API}/forms/system-contact/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ujamaaexpo',
        'X-Network-Id': '9',
      },
      body: JSON.stringify({
        submission_data: {
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        },
      }),
    })

    const data = await res.json()
    if (data.success) {
      return NextResponse.json({ success: true })
    } else {
      console.error('Form submit error:', data)
      return NextResponse.json({ error: data.error?.message || 'Failed to send' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('Contact error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
