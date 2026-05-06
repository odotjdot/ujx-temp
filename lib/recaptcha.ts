export async function verifyRecaptcha(token: string): Promise<number | null> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('RECAPTCHA_SECRET_KEY not set. Bypassing verification.');
    return 1.0;
  }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token}`,
    });
    
    const data = await res.json();
    if (data.success && data.score !== undefined) {
      return data.score;
    }
    console.warn('reCAPTCHA verification failed:', data);
    return null;
  } catch (error) {
    console.error('reCAPTCHA error:', error);
    return null;
  }
}