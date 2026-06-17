import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';
import { SecurityReportGenerator } from '@/lib/security/reporting';

async function generateReportHandler(request: NextRequest) {
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
  const type = searchParams.get('type') || 'threat';
  const format = searchParams.get('format') || 'csv';
  const filter = searchParams.get('filter') || '24h';

  let hours = 24;
  if (filter === '7d') hours = 24 * 7;
  else if (filter === '30d') hours = 24 * 30;
  else if (filter === '90d') hours = 24 * 90;

  try {
    const report = await SecurityReportGenerator.generateReport(type, format, hours);

    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${report.filename}"`);

    return new NextResponse(report.content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[API Security Reports GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = secureApiHandler(generateReportHandler, {
  rateLimit: { max: 10, windowMs: 60 * 1000, keyPrefix: 'admin-security-reports' },
});
