import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendEmail } from '@/lib/email'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { name, email, message, recaptchaToken } = body ?? {}
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const captcha = await verifyRecaptcha(recaptchaToken ?? '', 'contact')
  if (!captcha.ok) {
    console.warn('[contact] recaptcha rejected:', captcha.reason)
    return NextResponse.json({ error: 'captcha verification failed' }, { status: 403 })
  }

  const tenantId = process.env.TENANT_ID
  if (!tenantId) {
    console.error('[contact] TENANT_ID env missing')
    return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  }
  const sourceSite = process.env.SOURCE_SITE ?? req.headers.get('host') ?? 'unknown'
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null
  const referrer = req.headers.get('referer')?.slice(0, 500) ?? null

  let insertId: number
  try {
    const db = getDb()
    const [result]: any = await db.execute(
      `INSERT INTO contact_submissions
       (tenant_id, source_site, form_name, name, email, message, ip, user_agent, referrer, recaptcha_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, sourceSite, 'contact', name.trim(), email.trim(), message.trim(), ip, userAgent, referrer, captcha.score]
    )
    insertId = result.insertId
  } catch (err: any) {
    console.error('[contact] DB insert failed:', err.message)
    return NextResponse.json({ error: 'unable to save submission' }, { status: 500 })
  }

  // Notify admin (best-effort — lead is the source of truth, NEVER fail the request if SES errors)
  const notifyTo = process.env.LEADS_NOTIFY_EMAIL
  if (notifyTo) {
    try {
      await sendEmail({
        to: notifyTo,
        replyTo: email.trim(),
        subject: `[${tenantId}] New lead from ${name.trim()}`,
        html: `<h2>New lead</h2>
          <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
          <p><strong>Site:</strong> ${escapeHtml(sourceSite)}</p>
          <p><strong>Submission #:</strong> ${insertId}</p>
          <p><strong>Message:</strong></p>
          <pre style="background:#f4f4f4;padding:1rem;border-radius:4px;white-space:pre-wrap;">${escapeHtml(message)}</pre>`,
      })
    } catch (err: any) {
      console.error('[contact] notification email failed (lead WAS saved):', err.message)
    }
  } else {
    console.warn('[contact] LEADS_NOTIFY_EMAIL not set — admin notification skipped')
  }

  return NextResponse.json({ success: true, id: insertId })
}
