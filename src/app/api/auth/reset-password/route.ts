import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import { TokenService } from '@/lib/token';
import { eventEmitter, EVENTS } from '@/lib/events';

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

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password must be at most 128 characters long.' }, { status: 400 });
    }

    const { validatePassword } = await import('@/lib/security/password-policy');
    const policyResult = validatePassword(password);
    if (!policyResult.isValid) {
      return NextResponse.json({ error: policyResult.errors.join(' ') }, { status: 400 });
    }

    // 2. Validate reset token via the new token service, fallback to legacy TokenService
    const { PasswordResetTokenService } = await import('@/lib/security/password-reset');
    let user = await PasswordResetTokenService.validateAndUseToken(token);
    if (!user) {
      user = await TokenService.validateAndUseToken(token, 'RESET_PASSWORD');
    }

    if (!user || user.deletedAt !== null) {
      return NextResponse.json(
        { error: 'Invalid or expired password reset link.' },
        { status: 400 }
      );
    }

    // Check history reuse
    const { isPasswordInHistory, addPasswordToHistory } = await import('@/lib/security/password-history');
    const inHistory = await isPasswordInHistory(user.id, password);
    if (inHistory) {
      return NextResponse.json({ error: 'Password cannot be one of your recent passwords.' }, { status: 400 });
    }

    // Add old password to history
    if (user.password) {
      await addPasswordToHistory(user.id, user.password);
    }

    // 3. Hash the new password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update password in database
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    // Emit decoupled event
    eventEmitter.emit(EVENTS.PASSWORD_RESET_COMPLETED, {
      userId: user.id,
      email: user.email,
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
