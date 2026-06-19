import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';
import { ThreatIntelligenceService } from '@/lib/security/threat-intelligence';

async function threatIntelHandler(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerId = (session.user as any).id;
  const callerRole = (session.user as any).role;
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  const method = request.method;

  if (method === 'GET') {
    try {
      const indicators = await db.threatIndicator.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(indicators);
    } catch (err: any) {
      console.error('[API Threat Intel GET] Error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      const { type, value, riskScore, description } = body;

      if (!type || !value || riskScore === undefined) {
        return NextResponse.json({ error: 'Missing required indicator parameters' }, { status: 400 });
      }

      const indicator = await ThreatIntelligenceService.addIndicator(type, value, riskScore, description);
      return NextResponse.json({ success: true, indicator });
    } catch (err: any) {
      console.error('[API Threat Intel POST] Error:', err);
      return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  if (method === 'DELETE') {
    try {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');
      const value = searchParams.get('value');

      if (!type || !value) {
        return NextResponse.json({ error: 'Missing type or value query parameters' }, { status: 400 });
      }

      await ThreatIntelligenceService.removeIndicator(type, value);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.error('[API Threat Intel DELETE] Error:', err);
      return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export const GET = secureApiHandler(threatIntelHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-threat-intel-get' },
});

export const POST = secureApiHandler(threatIntelHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-threat-intel-post' },
});

export const DELETE = secureApiHandler(threatIntelHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-threat-intel-delete' },
});
