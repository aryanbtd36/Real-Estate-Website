import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LeadAnalyticsService } from '@/lib/analytics/leads';
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

    const cacheKey = 'analytics_leads';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      const { ConversionsService } = await import('@/lib/analytics/conversions');
      const leadStats = await LeadAnalyticsService.getLeadAnalytics();
      const conversions = await ConversionsService.getLeadFunnelData();
      data = {
        ...leadStats,
        conversions,
      };
      AnalyticsCache.set(cacheKey, data, 30000);
    }

    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: Lead CRM Source & Priority Performance',
      details: { report: 'lead_analytics' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.leads] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve lead analytics' }, { status: 500 });
  }
}
