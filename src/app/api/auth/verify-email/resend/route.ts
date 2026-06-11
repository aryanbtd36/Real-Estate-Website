import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import { TokenService } from '@/lib/token';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!session || !email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { turnstileToken } = body;

    // 1. Enforce global Turnstile validation rule
    const isTurnstileValid = await verifyTurnstile(turnstileToken);
    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: 'Turnstile verification failed. Please try again.' },
        { status: 403 }
      );
    }

    // 2. Fetch fresh user information from database
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email address is already verified' }, { status: 400 });
    }

    // 3. Prevent abuse: Enforce a strict 60-second rate-limiting rule
    const lastToken = await db.authToken.findFirst({
      where: {
        userId: user.id,
        type: 'VERIFY_EMAIL',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (lastToken) {
      const msElapsed = Date.now() - new Date(lastToken.createdAt).getTime();
      const secondsLeft = Math.ceil((60000 - msElapsed) / 1000);
      
      if (msElapsed < 60000) {
        return NextResponse.json(
          { error: `Please wait ${secondsLeft} seconds before requesting another link.` },
          { status: 429 }
        );
      }
    }

    // 5. Generate and dispatch the verification email
    const token = await TokenService.createToken(user.id, 'VERIFY_EMAIL', 24 * 60); // 24 hours
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verifyLink = `${baseUrl}/api/auth/verify-email?token=${token.token}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your AURA Account - Resend',
        title: 'Email Verification Requested',
        message: `Dear ${user.name || 'Client'},\n\nWe received a request to send a new email verification link for your client profile. Please click the button below to verify your email. This link is single-use and will expire in 24 hours.\n\nIf you did not make this request, you can safely ignore this email.`,
        actionLink: verifyLink,
        actionText: 'Verify Email Address',
      });
    } catch (mailErr) {
      console.error('Failed to resend verification email:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend verification email error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
