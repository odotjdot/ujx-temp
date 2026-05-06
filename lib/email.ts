import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

let client: SESClient | null = null
function getClient(): SESClient {
  if (client) return client
  client = new SESClient({ region: process.env.AWS_REGION ?? 'us-west-1' })
  return client
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface SendEmailResult { messageId: string }

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from ?? process.env.EMAIL_FROM
  if (!from) throw new Error('EMAIL_FROM not configured (and no `from` override provided)')

  const toAddresses = Array.isArray(input.to) ? input.to : [input.to]
  const cmd = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: toAddresses },
    ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
    Message: {
      Subject: { Data: input.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: input.html, Charset: 'UTF-8' },
        Text: input.text ? { Data: input.text, Charset: 'UTF-8' } : undefined,
      },
    },
  })

  const res = await getClient().send(cmd)
  if (!res.MessageId) throw new Error('SES returned no MessageId')
  return { messageId: res.MessageId }
}

// Backward-compat wrapper for any caller still using the old name+signature.
// Returns void on success, throws on failure (caller decides whether to swallow).
export async function sendNotificationEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  await sendEmail({ to, subject, text, html: html ?? text.replace(/\n/g, '<br>') })
}
