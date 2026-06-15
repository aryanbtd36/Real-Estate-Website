import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
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

    const cacheKey = 'analytics_followups';
    let data = AnalyticsCache.get<any>(cacheKey);

    if (!data) {
      const now = new Date();

      const [followUps, admins] = await Promise.all([
        db.followUp.findMany({
          select: {
            id: true,
            completed: true,
            dueDate: true,
            completedAt: true,
            assignedToId: true,
            lead: {
              select: { status: true },
            },
          },
        }),
        db.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true, name: true, email: true },
        }),
      ]);

      const adminMap = new Map<string, string>();
      admins.forEach((a) => adminMap.set(a.id, a.name || a.email));

      const total = followUps.length;
      const completed = followUps.filter((f) => f.completed).length;
      const overdue = followUps.filter((f) => !f.completed && new Date(f.dueDate) < now).length;
      const completionRate = total > 0 ? (completed / total) * 100 : 100;

      // Team Performance per admin
      const adminPerformanceMap = new Map<string, { total: number; completed: number; overdue: number }>();
      admins.forEach((admin) => {
        adminPerformanceMap.set(admin.id, { total: 0, completed: 0, overdue: 0 });
      });

      followUps.forEach((f) => {
        if (f.assignedToId && adminPerformanceMap.has(f.assignedToId)) {
          const stats = adminPerformanceMap.get(f.assignedToId)!;
          stats.total++;
          if (f.completed) stats.completed++;
          if (!f.completed && new Date(f.dueDate) < now) stats.overdue++;
        }
      });

      const teamPerformance = admins.map((admin) => {
        const stats = adminPerformanceMap.get(admin.id)!;
        const rate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 100;
        return {
          adminId: admin.id,
          adminName: admin.name || admin.email,
          totalTasks: stats.total,
          completedTasks: stats.completed,
          overdueTasks: stats.overdue,
          completionRate: parseFloat(rate.toFixed(2)),
        };
      });

      // Include unassigned
      const unassignedFollowUps = followUps.filter((f) => !f.assignedToId);
      if (unassignedFollowUps.length > 0) {
        const uTotal = unassignedFollowUps.length;
        const uCompleted = unassignedFollowUps.filter((f) => f.completed).length;
        const uOverdue = unassignedFollowUps.filter((f) => !f.completed && new Date(f.dueDate) < now).length;
        const uRate = uTotal > 0 ? (uCompleted / uTotal) * 100 : 100;
        teamPerformance.push({
          adminId: 'unassigned',
          adminName: 'Unassigned',
          totalTasks: uTotal,
          completedTasks: uCompleted,
          overdueTasks: uOverdue,
          completionRate: parseFloat(uRate.toFixed(2)),
        });
      }

      // Reminder effectiveness: tasks completed on or before due date
      const completedTasks = followUps.filter((f) => f.completed && f.completedAt);
      const onTime = completedTasks.filter((f) => new Date(f.completedAt!) <= new Date(f.dueDate)).length;
      const reminderEffectiveness = completed > 0 ? (onTime / completed) * 100 : 100;

      // Success rate: tasks on won leads vs tasks on closed (won/lost) leads
      const closedLeadsTasks = followUps.filter((f) => f.lead.status === 'WON' || f.lead.status === 'LOST');
      const wonLeadsTasks = closedLeadsTasks.filter((f) => f.lead.status === 'WON').length;
      const successRate = closedLeadsTasks.length > 0 ? (wonLeadsTasks / closedLeadsTasks.length) * 100 : 100;

      data = {
        total,
        completed,
        overdue,
        completionRate: parseFloat(completionRate.toFixed(2)),
        teamPerformance,
        reminderEffectiveness: parseFloat(reminderEffectiveness.toFixed(2)),
        successRate: parseFloat(successRate.toFixed(2)),
      };

      AnalyticsCache.set(cacheKey, data, 30000);
    }

    await ActivityService.log({
      actorId: (session.user as any).id,
      action: ActivityAction.SYSTEM_EVENT,
      description: 'Report generated: Follow-Up Performance and Team Effectiveness',
      details: { report: 'followups_analytics' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API.admin.analytics.followups] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve follow-up analytics' }, { status: 500 });
  }
}
