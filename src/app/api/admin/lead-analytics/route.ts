import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { LeadStatus, LeadPriority, LeadSource } from '@prisma/client';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Lead Status Counts
    const statusCounts = await db.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusMap: Record<LeadStatus, number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      VISIT_SCHEDULED: 0,
      NEGOTIATION: 0,
      WON: 0,
      LOST: 0,
    };

    statusCounts.forEach((group) => {
      statusMap[group.status] = group._count.id;
    });

    // 2. Lead Source Performance
    const sourceCounts = await db.lead.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    const sourceMap: Record<LeadSource, number> = {
      WEBSITE: 0,
      REFERRAL: 0,
      WALK_IN: 0,
      SOCIAL_MEDIA: 0,
      GOOGLE_ADS: 0,
      FACEBOOK_ADS: 0,
      OTHER: 0,
    };

    sourceCounts.forEach((group) => {
      sourceMap[group.source] = group._count.id;
    });

    // 3. Lead Priority Distribution
    const priorityCounts = await db.lead.groupBy({
      by: ['priority'],
      _count: { id: true },
    });

    const priorityMap: Record<LeadPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };

    priorityCounts.forEach((group) => {
      priorityMap[group.priority] = group._count.id;
    });

    // 4. Assignment Metrics
    const assignmentCounts = await db.lead.groupBy({
      by: ['assignedToId'],
      _count: { id: true },
    });

    // Fetch admin names for assignment mapping
    const adminIds = assignmentCounts.map((g) => g.assignedToId).filter(Boolean) as string[];
    const admins = await db.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, email: true },
    });

    const adminMap: Record<string, string> = {};
    admins.forEach((admin) => {
      adminMap[admin.id] = admin.name || admin.email;
    });

    const assignmentDistribution = assignmentCounts.map((group) => ({
      adminId: group.assignedToId,
      adminName: group.assignedToId ? adminMap[group.assignedToId] || 'Unknown Admin' : 'Unassigned',
      count: group._count.id,
    }));

    // 5. Conversion Metrics
    const totalLeads = await db.lead.count();
    const wonCount = statusMap.WON;
    const lostCount = statusMap.LOST;

    const winRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
    const lossRate = totalLeads > 0 ? (lostCount / totalLeads) * 100 : 0;

    // Alternative funnel conversion rate (WON / (WON + LOST))
    const closedTotal = wonCount + lostCount;
    const funnelConversionRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0;

    // 6. Average Lead Lifetime (hours) for closed leads (WON or LOST)
    const closedLeads = await db.lead.findMany({
      where: {
        status: { in: ['WON', 'LOST'] },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        statusHistory: {
          where: {
            toStatus: { in: ['WON', 'LOST'] },
          },
          orderBy: {
            changedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    let totalDurationMs = 0;
    let closedWithTimelineCount = 0;

    closedLeads.forEach((lead) => {
      const terminalLog = lead.statusHistory[0];
      const terminalTime = terminalLog ? new Date(terminalLog.changedAt) : new Date(lead.updatedAt);
      const duration = terminalTime.getTime() - new Date(lead.createdAt).getTime();
      if (duration >= 0) {
        totalDurationMs += duration;
        closedWithTimelineCount++;
      }
    });

    const averageLeadLifetimeHours = closedWithTimelineCount > 0 ? (totalDurationMs / closedWithTimelineCount) / (1000 * 60 * 60) : 0;

    return NextResponse.json({
      statusCounts: statusMap,
      sourcePerformance: sourceMap,
      priorityDistribution: priorityMap,
      assignmentDistribution,
      totalLeads,
      conversionMetrics: {
        winRate,
        lossRate,
        funnelConversionRate,
        averageLeadLifetimeHours,
        closedCount: closedWithTimelineCount,
      },
    });
  } catch (error) {
    console.error('Lead analytics calculation error:', error);
    return NextResponse.json({ error: 'Failed to retrieve lead analytics' }, { status: 500 });
  }
}
