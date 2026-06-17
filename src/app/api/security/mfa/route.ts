import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MfaService } from '@/lib/security/mfa';
import { db } from '@/lib/db';

// GET: Check MFA status or generate new secret for onboarding
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json({ enabled: true });
    }

    // Generate secret for setup
    const secret = MfaService.generateSecret();
    const otpauthUrl = `otpauth://totp/AuraEstates:${user.email}?secret=${secret}&issuer=AuraEstates`;

    return NextResponse.json({
      enabled: false,
      secret,
      otpauthUrl,
    });
  } catch (error) {
    console.error('[MFA GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Verify code and enable MFA
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { secret, code } = body;

    if (!secret || !code) {
      return NextResponse.json({ error: 'Secret and verification code are required' }, { status: 400 });
    }

    const res = await MfaService.enableMfa(userId, secret, code);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      recoveryCodes: res.recoveryCodes,
    });
  } catch (error) {
    console.error('[MFA POST] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: Regenerate Recovery Codes
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await MfaService.regenerateRecoveryCodes(userId);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      recoveryCodes: res.recoveryCodes,
    });
  } catch (error) {
    console.error('[MFA PUT] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Disable MFA (requires validation code or recovery code)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Verification or recovery code is required to disable MFA' }, { status: 400 });
    }

    const res = await MfaService.disableMfa(userId, code);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MFA DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
