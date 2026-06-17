import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ActivityService } from '@/lib/activity';
import { ActivityAction, CommunicationType } from '@prisma/client';
import { AnalyticsCache } from '@/lib/analytics/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const isAuthorized = session && (role === 'ADMIN' || role === 'SUPER_ADMIN');
    console.log(`[API DIAGNOSTIC] Path: /api/admin/analytics/communications, Role: ${role}, Authorized: ${!!isAuthorized}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cacheKey = 'analytics_communications';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      const [logs, totalLeads] = await Promise.all([
        db.communicationLog.findMany({
          select: { id: true, type: true, createdAt: true },
        }),
        db.lead.count(),
      ]);

      // 1. Breakdown
      const breakdown = {
        calls: logs.filter((l) => l.type === CommunicationType.CALL).length,
        emails: logs.filter((l) => l.type === CommunicationType.EMAIL).length,
        whatsapp: logs.filter((l) => l.type === CommunicationType.WHATSAPP).length,
        sms: logs.filter((l) => l.type === CommunicationType.SMS).length,
        meetings: logs.filter((l) => l.type === CommunicationType.MEETING).length,
        other: logs.filter((l) => l.type === CommunicationType.OTHER).length,
      };

      // 2. Average interactions per lead
      const avgInteractionsPerLead = totalLeads > 0 ? logs.length / totalLeads : 0;

      // 3. Volume Trends (last 6 months)
      const volumeTrends: { label: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        const count = logs.filter((l) => {
          const logDate = new Date(l.createdAt);
          return logDate.getFullYear() === d.getFullYear() && logDate.getMonth() === d.getMonth();
        }).length;

        volumeTrends.push({ label: yyyymm, count });
      }

      data = {
        breakdown,
        avgInteractionsPerLead: parseFloat(avgInteractionsPerLead.toFixed(2)),
        volumeTrends,
      };

      AnalyticsCache.set(cacheKey, data, 30000);
    }

    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: Communication Channel Breakdown & Volume Trends',
      details: { report: 'communications_analytics' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.communications] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve communication analytics' }, { status: 500 });
  }
}
