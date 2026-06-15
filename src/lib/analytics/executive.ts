import { db } from '../db';
import { UserStatus, LeadStatus, PropertyStatus } from '@prisma/client';
import { HealthScoreService, HealthScoreBreakdown } from './health-score';

export interface GrowthMetric {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface ExecutiveKPIs {
  properties: {
    total: number;
    active: number;
    published: number;
    archived: number;
  };
  leads: {
    total: number;
    active: number;
    won: number;
    lost: number;
  };
  appointments: {
    total: number;
    upcoming: number;
    completed: number;
  };
  users: {
    total: number;
    active: number;
    returning: number;
  };
  followUps: {
    total: number;
    completed: number;
    overdue: number;
  };
  growth: {
    leads: GrowthMetric;
    users: GrowthMetric;
    properties: GrowthMetric;
  };
  healthScore: HealthScoreBreakdown;
}

function getGrowthRate(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return parseFloat((((curr - prev) / prev) * 100).toFixed(2));
}

export const ExecutiveAnalyticsService = {
  /**
   * Generates a complete executive dashboard summary with growth trends and health score.
   */
  async getExecutiveOverview(): Promise<ExecutiveKPIs> {
    try {
      const now = new Date();
      
      // Time boundaries
      const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const d2 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      
      const w1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const w2 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const m1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const m2 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const [
        // Properties
        totalProperties,
        activeProperties,
        publishedProperties,
        archivedProperties,
        // Leads
        totalLeads,
        wonLeads,
        lostLeads,
        // Appointments
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        // Users
        totalUsers,
        activeUsers,
        returningUsers,
        // Follow-Ups
        totalFollowUps,
        completedFollowUps,
        overdueFollowUps,
        // Lead Growth counts
        leadsD1, leadsD2, leadsW1, leadsW2, leadsM1, leadsM2,
        // User Growth counts
        usersD1, usersD2, usersW1, usersW2, usersM1, usersM2,
        // Property Growth counts
        propertiesD1, propertiesD2, propertiesW1, propertiesW2, propertiesM1, propertiesM2,
        // Health Score
        healthScore,
      ] = await Promise.all([
        // Properties counts
        db.property.count(),
        db.property.count({ where: { availability: 'AVAILABLE' } }),
        db.property.count({ where: { status: PropertyStatus.PUBLISHED } }),
        db.property.count({ where: { status: PropertyStatus.ARCHIVED } }),

        // Leads counts
        db.lead.count(),
        db.lead.count({ where: { status: 'WON' } }),
        db.lead.count({ where: { status: 'LOST' } }),

        // Appointments counts
        db.appointment.count(),
        db.appointment.count({ where: { status: { in: ['PENDING', 'APPROVED', 'CONFIRMED', 'RESCHEDULED'] } } }),
        db.appointment.count({ where: { status: 'COMPLETED' } }),

        // Users counts
        db.user.count({ where: { role: 'USER', deletedAt: null } }),
        db.user.count({ where: { role: 'USER', status: UserStatus.ACTIVE, deletedAt: null } }),
        // Returning Users: User who logged in and has lastLogin not equal to null and different from createdAt
        db.user.count({
          where: {
            role: 'USER',
            deletedAt: null,
            lastLogin: { not: null },
            // Approximation: last login > 1 hour after creation to count as returning
            // We can check user records where lastLogin is set
          },
        }),

        // Follow-Ups counts
        db.followUp.count(),
        db.followUp.count({ where: { completed: true } }),
        db.followUp.count({ where: { completed: false, dueDate: { lt: now } } }),

        // Growth: Leads
        db.lead.count({ where: { createdAt: { gte: d1 } } }),
        db.lead.count({ where: { createdAt: { gte: d2, lt: d1 } } }),
        db.lead.count({ where: { createdAt: { gte: w1 } } }),
        db.lead.count({ where: { createdAt: { gte: w2, lt: w1 } } }),
        db.lead.count({ where: { createdAt: { gte: m1 } } }),
        db.lead.count({ where: { createdAt: { gte: m2, lt: m1 } } }),

        // Growth: Users
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: d1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: d2, lt: d1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: w1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: w2, lt: w1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: m1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: m2, lt: m1 } } }),

        // Growth: Properties
        db.property.count({ where: { createdAt: { gte: d1 } } }),
        db.property.count({ where: { createdAt: { gte: d2, lt: d1 } } }),
        db.property.count({ where: { createdAt: { gte: w1 } } }),
        db.property.count({ where: { createdAt: { gte: w2, lt: w1 } } }),
        db.property.count({ where: { createdAt: { gte: m1 } } }),
        db.property.count({ where: { createdAt: { gte: m2, lt: m1 } } }),

        // Health Score
        HealthScoreService.calculateHealthScore(),
      ]);

      const activeLeads = totalLeads - wonLeads - lostLeads;

      return {
        properties: {
          total: totalProperties,
          active: activeProperties,
          published: publishedProperties,
          archived: archivedProperties,
        },
        leads: {
          total: totalLeads,
          active: activeLeads,
          won: wonLeads,
          lost: lostLeads,
        },
        appointments: {
          total: totalAppointments,
          upcoming: upcomingAppointments,
          completed: completedAppointments,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          returning: returningUsers,
        },
        followUps: {
          total: totalFollowUps,
          completed: completedFollowUps,
          overdue: overdueFollowUps,
        },
        growth: {
          leads: {
            daily: getGrowthRate(leadsD1, leadsD2),
            weekly: getGrowthRate(leadsW1, leadsW2),
            monthly: getGrowthRate(leadsM1, leadsM2),
          },
          users: {
            daily: getGrowthRate(usersD1, usersD2),
            weekly: getGrowthRate(usersW1, usersW2),
            monthly: getGrowthRate(usersM1, usersM2),
          },
          properties: {
            daily: getGrowthRate(propertiesD1, propertiesD2),
            weekly: getGrowthRate(propertiesW1, propertiesW2),
            monthly: getGrowthRate(propertiesM1, propertiesM2),
          },
        },
        healthScore,
      };
    } catch (error) {
      console.error('[ExecutiveAnalyticsService.getExecutiveOverview] Error:', error);
      throw error;
    }
  },
};
