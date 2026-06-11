import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import { TokenService } from '@/lib/token';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password, turnstileToken } = body;

    // 1. Enforce global Turnstile validation rule
    const isTurnstileValid = await verifyTurnstile(turnstileToken);
    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: 'Turnstile verification failed. Please try again.' },
        { status: 403 }
      );
    }

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing required token or password fields' }, { status: 400 });
    }

    // 2. Validate reset token via token service (expiration, used flag, and token type checked)
    const user = await TokenService.validateAndUseToken(token, 'RESET_PASSWORD');
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired password reset link.' },
        { status: 400 }
      );
    }

    // 3. Hash the new password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update password in database
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // 5. Send password changed confirmation email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Security Alert: Password Changed - AURA Estates',
        title: 'Your Account Password Has Been Updated',
        message: `Dear ${user.name || 'Client'},\n\nThis is a notification that the password for your AURA Luxury Real Estate client profile was successfully changed.\n\nIf you initiated this change, no further action is required.\n\nIf you did not request this update, please contact the AURA Concierge relations desk immediately.`,
      });
    } catch (mailErr) {
      console.error('Failed to dispatch password changed confirmation email:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password confirmation error:', error);
    return NextResponse.json({ error: 'Failed to configure new password' }, { status: 500 });
  }
}
