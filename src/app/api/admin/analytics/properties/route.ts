import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PropertyAnalyticsService } from '@/lib/analytics/properties';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';
import { AnalyticsCache } from '@/lib/analytics/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const isAuthorized = session && (role === 'ADMIN' || role === 'SUPER_ADMIN');
    console.log(`[API DIAGNOSTIC] Path: /api/admin/analytics/properties, Role: ${role}, Authorized: ${!!isAuthorized}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cacheKey = 'analytics_properties';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      data = await PropertyAnalyticsService.getPropertyAnalytics();
      AnalyticsCache.set(cacheKey, data, 30000);
    }

    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: Property Engagement Funnel & Rankings',
      details: { report: 'property_analytics' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.properties] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve property analytics' }, { status: 500 });
  }
}
