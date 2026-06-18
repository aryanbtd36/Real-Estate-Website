import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// POST: Record user consent (Terms and Privacy Policy)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { termsAccepted, privacyPolicyAccepted, versionAccepted } = body;

    if (termsAccepted === undefined || privacyPolicyAccepted === undefined) {
      return NextResponse.json({ error: 'Missing termsAccepted or privacyPolicyAccepted values' }, { status: 400 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || (request as any).ip || '127.0.0.1';

    const userId = (session?.user as any)?.id || 'anonymous';

    const consent = await db.userConsent.create({
      data: {
        userId,
        termsAccepted: !!termsAccepted,
        privacyPolicyAccepted: !!privacyPolicyAccepted,
        ipAddress,
        versionAccepted: versionAccepted || '1.0.0',
      },
    });

    // Create a compliance security event
    const { SecurityEventSeverity, SecurityEventCategory } = await import('@prisma/client');
    await db.securityEvent.create({
      data: {
        eventType: 'PRIVACY_CONSENT_RECORDED',
        severity: SecurityEventSeverity.LOW,
        category: SecurityEventCategory.COMPLIANCE,
        title: 'User Privacy Consent Recorded',
        description: `Consent recorded for user ID: ${userId}. Terms: ${termsAccepted}, Privacy: ${privacyPolicyAccepted}`,
        userId: userId !== 'anonymous' ? userId : null,
        ipAddress,
      },
    });

    return NextResponse.json({ success: true, consent }, { status: 201 });
  } catch (error: any) {
    console.error('[API Consent POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record consent' }, { status: 500 });
  }
}

// GET: Retrieve consent status for logged-in user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const latestConsent = await db.userConsent.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });

    return NextResponse.json({ success: true, consent: latestConsent });
  } catch (error: any) {
    console.error('[API Consent GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 });
  }
}
