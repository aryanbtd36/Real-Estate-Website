import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import { TokenService } from '@/lib/token';
import { resolveUserRole } from '@/lib/role';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, password, turnstileToken } = body;

    // 1. Enforce global Turnstile validation rule
    const isTurnstileValid = await verifyTurnstile(turnstileToken);
    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: 'Turnstile verification failed. Please try again.' },
        { status: 403 }
      );
    }

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password must be at most 128 characters long.' }, { status: 400 });
    }

    const { validatePassword } = await import('@/lib/security/password-policy');
    const policyResult = validatePassword(password);
    if (!policyResult.isValid) {
      return NextResponse.json({ error: policyResult.errors.join(' ') }, { status: 400 });
    }

    const existing = await db.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // 2. Hash password using production-grade security
    const hashedPassword = await bcrypt.hash(password, 10);
    const initialRole = resolveUserRole(email, 'USER');

    const newUser = await db.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: initialRole,
      },
    });

    // 3. Generate verification token (OTP-ready token service)
    let verifyLink = '';
    try {
      const verifyToken = await TokenService.createToken(newUser.id, 'VERIFY_EMAIL', 24 * 60); // 24 hours
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      verifyLink = `${baseUrl}/api/auth/verify-email?token=${verifyToken.token}`;
    } catch (tokenErr) {
      console.error('Failed to generate email verification token:', tokenErr);
    }

    // 4. Send welcome email (non-blocking)
    try {
      await sendEmail({
        to: newUser.email,
        subject: 'Welcome to AURA Luxury Real Estate',
        title: 'Welcome to the World of AURA',
        message: `Dear ${newUser.name},\n\nWe are delighted to welcome you to AURA Luxury Real Estate. Your client account has been successfully registered.\n\nTo complete your profile activation and verify your identity, please click the button below to confirm your email.`,
        actionLink: verifyLink || undefined,
        actionText: 'Confirm Email Address',
      });
    } catch (mailErr) {
      console.error('Failed to dispatch registration welcome email:', mailErr);
    }

    return NextResponse.json({ success: true, userId: newUser.id });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
  }
}
