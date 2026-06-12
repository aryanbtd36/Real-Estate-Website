import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import { TokenService } from '@/lib/token';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, turnstileToken } = body;

    // 1. Enforce global Turnstile validation rule
    const isTurnstileValid = await verifyTurnstile(turnstileToken);
    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: 'Turnstile verification failed. Please try again.' },
        { status: 403 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    // 2. Prevent User Enumeration: Return successful response even if user is not found
    const user = await db.user.findUnique({
      where: { email },
    });

    if (user && user.deletedAt === null) {
      // 3. Generate password reset token (expires in 60 minutes)
      const token = await TokenService.createToken(user.id, 'RESET_PASSWORD', 60);
      
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-password?token=${token.token}`;

      // Emit decoupled event
      eventEmitter.emit(EVENTS.PASSWORD_RESET_REQUESTED, {
        userId: user.id,
        email: user.email,
      });

      // 4. Send reset email
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset Password - AURA Luxury Real Estate',
          title: 'Secure Password Configuration Request',
          message: `Dear ${user.name || 'Client'},\n\nWe received a request to configure new credentials for your AURA client profile. If you initiated this, please click the button below to configure your password. This secure link is single-use and will expire in 60 minutes.\n\nIf you did not request this recovery, you can safely ignore this email.`,
          actionLink: resetLink,
          actionText: 'Configure Password',
        });
      } catch (mailErr) {
        console.error('Failed to dispatch password reset email:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account matches that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password endpoint error:', error);
    return NextResponse.json({ error: 'Failed to process password recovery request' }, { status: 500 });
  }
}
