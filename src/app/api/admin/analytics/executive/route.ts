import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ExecutiveAnalyticsService } from '@/lib/analytics/executive';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';
import { AnalyticsCache } from '@/lib/analytics/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cacheKey = 'analytics_executive';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      data = await ExecutiveAnalyticsService.getExecutiveOverview();
      AnalyticsCache.set(cacheKey, data, 30000); // 30s TTL
    }

    // Audit and Tracking: log report generation
    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: Executive Dashboard Overview',
      details: { report: 'executive_overview' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.executive] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve executive analytics' }, { status: 500 });
  }
}
