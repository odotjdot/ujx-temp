import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { sendNotificationEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, message, recaptchaToken } = body;

    if (!name || !email || !message || !recaptchaToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify reCAPTCHA
    const score = await verifyRecaptcha(recaptchaToken);
    if (score === null || score < 0.5) {
      return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });
    }

    // 2. Write to MySQL
    const db = getDb();
    const tenantId = process.env.TENANT_ID || 'ujamaaexpo';
    const sourceSite = req.headers.get('host') || 'unknown';
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const referrer = req.headers.get('referer') || 'unknown';

    await db.execute(
      `INSERT INTO contact_submissions 
       (tenant_id, source_site, form_name, name, email, message, ip, user_agent, referrer, recaptcha_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, sourceSite, 'contact', name, email, message, ip, userAgent, referrer, score]
    );

    // 3. Send Notification via SES
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'info@ujamaaexpo.com';
    const emailSubject = `New Contact Form Submission: ${name}`;
    const emailBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
    
    // Await the email send so serverless functions don't kill the background promise
    await sendNotificationEmail(notificationEmail, emailSubject, emailBody).catch(err => {
      console.error('Failed to send notification email, but submission was saved:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}