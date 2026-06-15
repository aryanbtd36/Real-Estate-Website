import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserAnalyticsService } from '@/lib/analytics/users';
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

    const cacheKey = 'analytics_users';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      data = await UserAnalyticsService.getUserAnalytics();
      AnalyticsCache.set(cacheKey, data, 30000);
    }

    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: User Growth Trends, Retention & Engagement Categories',
      details: { report: 'user_analytics' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.users] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve user analytics' }, { status: 500 });
  }
}
