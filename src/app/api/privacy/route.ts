import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { PrivacyRequestType, PrivacyRequestStatus } from '@prisma/client';

// POST: Submit a new privacy request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requestType, details } = body;

    if (!requestType || !Object.values(PrivacyRequestType).includes(requestType)) {
      return NextResponse.json({ error: 'Invalid or missing privacy requestType' }, { status: 400 });
    }

    // Capture requester ip and info
    const ipAddress = request.headers.get('x-forwarded-for') || (request as any).ip || '127.0.0.1';

    const privacyRequest = await db.privacyRequest.create({
      data: {
        userId,
        requestType: requestType as PrivacyRequestType,
        status: PrivacyRequestStatus.PENDING,
        details: details || null,
      },
    });

    // Audit this privacy action
    const { SecurityEventSeverity, SecurityEventCategory } = await import('@prisma/client');
    await db.securityEvent.create({
      data: {
        eventType: 'PRIVACY_REQUEST_SUBMITTED',
        severity: SecurityEventSeverity.MEDIUM,
        category: SecurityEventCategory.COMPLIANCE,
        title: 'Privacy Request Submitted',
        description: `Privacy request (${requestType}) submitted by user ${userId}.`,
        userId,
        ipAddress,
        metadata: { requestId: privacyRequest.id, requestType },
      },
    });

    return NextResponse.json({ success: true, privacyRequest }, { status: 201 });
  } catch (error: any) {
    console.error('[API Privacy POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit privacy request' }, { status: 500 });
  }
}

// GET: List requests submitted by current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await db.privacyRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error('[API Privacy GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch privacy requests' }, { status: 500 });
  }
}
