import { db } from '../db';
import { AppointmentOutcome } from '@prisma/client';

export interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number; // percentage relative to the first stage (Scheduled)
  dropOffRate: number;    // percentage of drop-off relative to the previous stage
}

export interface ShowingAnalyticsProData {
  funnel: {
    scheduled: number;
    completed: number;
    negotiation: number;
    won: number;
    stages: FunnelStage[];
  };
  metrics: {
    averageTimeToVisitDays: number;
    averageTimeToCloseDays: number;
  };
  outcomeDistribution: Record<AppointmentOutcome, number>;
  repPerformance: Array<{
    adminId: string;
    adminName: string;
    showingsCompleted: number;
    negotiationStarted: number;
    dealsWon: number;
    conversionRate: number;
  }>;
}

export const AppointmentsProAnalytics = {
  /**
   * Generates funnel, averages, outcome distribution, and rep performance tables.
   */
  async getAdvancedAnalytics(): Promise<ShowingAnalyticsProData> {
    try {
      const [appointments, leads, statusHistories, admins] = await Promise.all([
        db.appointment.findMany({
          include: {
            property: true,
          },
        }),
        db.lead.findMany(),
        db.leadStatusHistory.findMany({
          orderBy: { changedAt: 'asc' },
        }),
        db.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true, name: true, email: true },
        }),
      ]);

      const getLinkedLead = (app: typeof appointments[0]) => {
        if (app.leadId) return leads.find((l) => l.id === app.leadId);
        return leads.find((l) => l.email.toLowerCase() === app.email.toLowerCase());
      };

      // 1. Funnel Stages
      // Scheduled: All active showing slots (status is not CANCELLED)
      const scheduledApps = appointments.filter((app) => app.status !== 'CANCELLED');
      const scheduledCount = scheduledApps.length;

      // Completed: status is COMPLETED and outcome is not NO_SHOW
      const completedApps = scheduledApps.filter((app) => app.status === 'COMPLETED' && app.outcome !== 'NO_SHOW');
      const completedCount = completedApps.length;

      // Negotiation: outcome is NEGOTIATION_STARTED, SALE_COMPLETED, or Lead status/history is NEGOTIATION or WON
      const negotiationApps = completedApps.filter((app) => {
        if (app.outcome === 'NEGOTIATION_STARTED' || app.outcome === 'SALE_COMPLETED') return true;
        const lead = getLinkedLead(app);
        if (lead) {
          if (lead.status === 'NEGOTIATION' || lead.status === 'WON') return true;
          return statusHistories.some((h) => h.leadId === lead.id && (h.toStatus === 'NEGOTIATION' || h.toStatus === 'WON'));
        }
        return false;
      });
      const negotiationCount = negotiationApps.length;

      // Won: outcome is SALE_COMPLETED or Lead status/history is WON
      const wonApps = negotiationApps.filter((app) => {
        if (app.outcome === 'SALE_COMPLETED') return true;
        const lead = getLinkedLead(app);
        if (lead) {
          if (lead.status === 'WON') return true;
          return statusHistories.some((h) => h.leadId === lead.id && h.toStatus === 'WON');
        }
        return false;
      });
      const wonCount = wonApps.length;

      const stages: FunnelStage[] = [
        {
          stage: 'Scheduled',
          count: scheduledCount,
          conversionRate: 100,
          dropOffRate: 0,
        },
        {
          stage: 'Completed',
          count: completedCount,
          conversionRate: scheduledCount > 0 ? parseFloat(((completedCount / scheduledCount) * 100).toFixed(2)) : 0,
          dropOffRate: scheduledCount > 0 ? parseFloat((((scheduledCount - completedCount) / scheduledCount) * 100).toFixed(2)) : 0,
        },
        {
          stage: 'Negotiation',
          count: negotiationCount,
          conversionRate: scheduledCount > 0 ? parseFloat(((negotiationCount / scheduledCount) * 100).toFixed(2)) : 0,
          dropOffRate: completedCount > 0 ? parseFloat((((completedCount - negotiationCount) / completedCount) * 100).toFixed(2)) : 0,
        },
        {
          stage: 'Won',
          count: wonCount,
          conversionRate: scheduledCount > 0 ? parseFloat(((wonCount / scheduledCount) * 100).toFixed(2)) : 0,
          dropOffRate: negotiationCount > 0 ? parseFloat((((negotiationCount - wonCount) / negotiationCount) * 100).toFixed(2)) : 0,
        },
      ];

      // 2. Average Time to Visit
      let totalTimeToVisitMs = 0;
      let timeToVisitCount = 0;

      appointments.forEach((app) => {
        const lead = getLinkedLead(app);
        if (lead) {
          const timeDiff = app.startTime.getTime() - lead.createdAt.getTime();
          if (timeDiff > 0) {
            totalTimeToVisitMs += timeDiff;
            timeToVisitCount++;
          }
        }
      });

      const averageTimeToVisitDays = timeToVisitCount > 0
        ? parseFloat((totalTimeToVisitMs / (1000 * 60 * 60 * 24) / timeToVisitCount).toFixed(2))
        : 0;

      // 3. Average Time to Close
      let totalTimeToCloseMs = 0;
      let timeToCloseCount = 0;

      appointments.forEach((app) => {
        const lead = getLinkedLead(app);
        if (lead) {
          const wonHistory = statusHistories.find((h) => h.leadId === lead.id && h.toStatus === 'WON');
          if (wonHistory) {
            const timeDiff = wonHistory.changedAt.getTime() - app.startTime.getTime();
            if (timeDiff > 0) {
              totalTimeToCloseMs += timeDiff;
              timeToCloseCount++;
            }
          } else if (lead.status === 'WON') {
            const timeDiff = lead.updatedAt.getTime() - app.startTime.getTime();
            if (timeDiff > 0) {
              totalTimeToCloseMs += timeDiff;
              timeToCloseCount++;
            }
          }
        }
      });

      const averageTimeToCloseDays = timeToCloseCount > 0
        ? parseFloat((totalTimeToCloseMs / (1000 * 60 * 60 * 24) / timeToCloseCount).toFixed(2))
        : 0;

      // 4. Outcome distribution counts
      const outcomeDistribution: Record<AppointmentOutcome, number> = {
        [AppointmentOutcome.INTERESTED]: 0,
        [AppointmentOutcome.VERY_INTERESTED]: 0,
        [AppointmentOutcome.FOLLOW_UP_REQUIRED]: 0,
        [AppointmentOutcome.NEGOTIATION_STARTED]: 0,
        [AppointmentOutcome.NOT_INTERESTED]: 0,
        [AppointmentOutcome.NO_SHOW]: 0,
        [AppointmentOutcome.SALE_COMPLETED]: 0,
      };

      appointments.forEach((app) => {
        if (app.outcome) {
          outcomeDistribution[app.outcome]++;
        }
      });

      // 5. Rep Performance table
      const repPerformanceMap = new Map<string, {
        completed: number;
        negotiation: number;
        won: number;
        total: number;
      }>();

      admins.forEach((admin) => {
        repPerformanceMap.set(admin.id, { completed: 0, negotiation: 0, won: 0, total: 0 });
      });

      appointments.forEach((app) => {
        const adminId = app.adminId;
        if (!adminId || !repPerformanceMap.has(adminId)) return;

        const metrics = repPerformanceMap.get(adminId)!;
        metrics.total++;

        if (app.status === 'COMPLETED' && app.outcome !== 'NO_SHOW') {
          metrics.completed++;
        }

        if (app.outcome === 'NEGOTIATION_STARTED' || app.outcome === 'SALE_COMPLETED') {
          metrics.negotiation++;
        } else {
          const lead = getLinkedLead(app);
          if (lead && (lead.status === 'NEGOTIATION' || lead.status === 'WON' || statusHistories.some((h) => h.leadId === lead.id && (h.toStatus === 'NEGOTIATION' || h.toStatus === 'WON')))) {
            metrics.negotiation++;
          }
        }

        if (app.outcome === 'SALE_COMPLETED') {
          metrics.won++;
        } else {
          const lead = getLinkedLead(app);
          if (lead && (lead.status === 'WON' || statusHistories.some((h) => h.leadId === lead.id && h.toStatus === 'WON'))) {
            metrics.won++;
          }
        }
      });

      const repPerformance = admins.map((admin) => {
        const perf = repPerformanceMap.get(admin.id) || { completed: 0, negotiation: 0, won: 0, total: 0 };
        const conversionRate = perf.total > 0 ? parseFloat(((perf.won / perf.total) * 100).toFixed(2)) : 0;

        return {
          adminId: admin.id,
          adminName: admin.name || admin.email,
          showingsCompleted: perf.completed,
          negotiationStarted: perf.negotiation,
          dealsWon: perf.won,
          conversionRate,
        };
      });

      return {
        funnel: {
          scheduled: scheduledCount,
          completed: completedCount,
          negotiation: negotiationCount,
          won: wonCount,
          stages,
        },
        metrics: {
          averageTimeToVisitDays,
          averageTimeToCloseDays,
        },
        outcomeDistribution,
        repPerformance,
      };
    } catch (error) {
      console.error('[AppointmentsProAnalytics.getAdvancedAnalytics] Error:', error);
      throw error;
    }
  },
};
