import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';

async function getEventsHandler(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const severity = searchParams.get('severity');
  const category = searchParams.get('category');
  const search = searchParams.get('search') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const filter = searchParams.get('filter') || '24h';

  let hours = 24;
  if (filter === '7d') hours = 24 * 7;
  else if (filter === '30d') hours = 24 * 30;
  else if (filter === '90d') hours = 24 * 90;

  const timeLimit = new Date(Date.now() - hours * 60 * 60 * 1000);

  const whereClause: any = {
    createdAt: { gte: timeLimit },
  };

  if (severity) {
    whereClause.severity = severity as SecurityEventSeverity;
  }
  if (category) {
    whereClause.category = category as SecurityEventCategory;
  }
  if (search) {
    whereClause.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { eventType: { contains: search, mode: 'insensitive' } },
      { userEmail: { contains: search, mode: 'insensitive' } },
      { ipAddress: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const events = await db.securityEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('[API Security Events GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = secureApiHandler(getEventsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-events' },
});
