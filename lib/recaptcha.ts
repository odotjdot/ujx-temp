export type RecaptchaResult =
  | { ok: true; score: number }
  | { ok: false; reason: string }

const SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify'

function minScore(): number {
  const raw = process.env.RECAPTCHA_MIN_SCORE
  const parsed = raw ? Number(raw) : 0.5
  return Number.isFinite(parsed) ? parsed : 0.5
}

/**
 * Verify a reCAPTCHA v3 token against Google's siteverify endpoint.
 * Fails closed: if RECAPTCHA_SECRET_KEY is missing, returns {ok:false}.
 * Bots do NOT bypass when the secret is unset.
 */
export async function verifyRecaptcha(token: string, expectedAction: string): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return { ok: false, reason: 'RECAPTCHA_SECRET_KEY not configured' }
  if (!token) return { ok: false, reason: 'no token provided' }

  const body = new URLSearchParams({ secret, response: token })
  let res: Response
  try {
    res = await fetch(SITEVERIFY, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch (err: any) {
    return { ok: false, reason: `siteverify network error: ${err?.message ?? 'unknown'}` }
  }
  if (!res.ok) return { ok: false, reason: `siteverify HTTP ${res.status}` }

  const data = (await res.json()) as {
    success: boolean
    score?: number
    action?: string
    'error-codes'?: string[]
  }

  if (!data.success) {
    return { ok: false, reason: `siteverify failed: ${data['error-codes']?.join(',') ?? 'unknown'}` }
  }
  if (data.action !== expectedAction) {
    return { ok: false, reason: `action mismatch: got ${data.action}, expected ${expectedAction}` }
  }
  const score = data.score ?? 0
  if (score < minScore()) {
    return { ok: false, reason: `score ${score} below threshold ${minScore()}` }
  }
  return { ok: true, score }
}
