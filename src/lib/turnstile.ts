/**
 * Security Service - Cloudflare Turnstile Verification
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!token) {
    console.warn('[SECURITY MONITOR] Turnstile verification failed: Token is empty.');
    return false;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn('[SECURITY MONITOR] Turnstile verification failed: TURNSTILE_SECRET_KEY is not defined in environment variables.');
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!data.success) {
      console.warn(
        `[SECURITY MONITOR] Turnstile verification failed for IP: ${ip || 'unknown'}. Error codes: ${
          data['error-codes']?.join(', ') || 'none'
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SECURITY MONITOR] Turnstile verification request failed due to connection error:', error);
    return false;
  }
}
