import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppointmentAnalyticsService } from '@/lib/analytics/appointments';
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

    const cacheKey = 'analytics_appointments';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      data = await AppointmentAnalyticsService.getAppointmentAnalytics();
      AnalyticsCache.set(cacheKey, data, 30000);
    }

    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: Appointment Visit Statuses & Admin Performance',
      details: { report: 'appointment_analytics' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.appointments] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve appointment analytics' }, { status: 500 });
  }
}
