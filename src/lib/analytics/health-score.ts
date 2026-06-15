import { db } from '../db';
import { UserStatus, LeadStatus } from '@prisma/client';

export type HealthGrade = 'EXCELLENT' | 'HEALTHY' | 'MODERATE' | 'RISK' | 'CRITICAL';

export interface HealthScoreBreakdown {
  score: number;
  grade: HealthGrade;
  breakdown: {
    leadConversionRate: number;
    appointmentCompletionRate: number;
    followUpCompletionRate: number;
    propertyEngagement: number;
    growthRateScore: number;
    userActivityRate: number;
  };
}

export const HealthScoreService = {
  /**
   * Calculates the overall business health score based on parallel DB queries.
   */
  async calculateHealthScore(): Promise<HealthScoreBreakdown> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const [
        // 1. Leads
        totalLeads,
        wonLeads,
        newLeads30d,
        prevLeads30d,
        // 2. Appointments
        totalAppointments,
        completedAppointments,
        // 3. Follow-Ups
        totalFollowUps,
        completedFollowUps,
        // 4. Properties
        totalProperties,
        totalViews,
        totalSaves,
        newProperties30d,
        prevProperties30d,
        // 5. Users
        totalUsers,
        activeUsers,
        newUsers30d,
        prevUsers30d,
        uniqueActiveUsers30d,
      ] = await Promise.all([
        // Leads
        db.lead.count(),
        db.lead.count({ where: { status: 'WON' } }),
        db.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        db.lead.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),

        // Appointments
        db.appointment.count(),
        db.appointment.count({ where: { status: 'COMPLETED' } }),

        // Follow-Ups
        db.followUp.count(),
        db.followUp.count({ where: { completed: true } }),

        // Properties
        db.property.count(),
        db.propertyView.count(),
        db.savedProperty.count(),
        db.property.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        db.property.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),

        // Users
        db.user.count({ where: { role: 'USER', deletedAt: null } }),
        db.user.count({ where: { role: 'USER', status: UserStatus.ACTIVE, deletedAt: null } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
        
        // Unique active users in past 30 days from ActivityLog
        db.activityLog.groupBy({
          by: ['actorId'],
          where: {
            actorId: { not: null },
            createdAt: { gte: thirtyDaysAgo },
          },
        }).then(res => res.length),
      ]);

      // 1. Lead Conversion Rate (25% Weight)
      const leadConversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 100;

      // 2. Appointment Completion Rate (20% Weight)
      const appointmentCompletionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 100;

      // 3. Follow-Up Completion Rate (15% Weight)
      const followUpCompletionRate = totalFollowUps > 0 ? (completedFollowUps / totalFollowUps) * 100 : 100;

      // 4. Property Engagement (15% Weight)
      // Baseline target: 5 views + 1 save per property in the entire system.
      const avgViews = totalProperties > 0 ? totalViews / totalProperties : 0;
      const avgSaves = totalProperties > 0 ? totalSaves / totalProperties : 0;
      const rawEngagement = avgViews + avgSaves * 5;
      const propertyEngagement = Math.min(100, (rawEngagement / 10) * 100);

      // 5. Growth Rate (15% Weight)
      // Compare 30d registrations/listings vs the previous 30d.
      const getGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const leadGrowth = getGrowth(newLeads30d, prevLeads30d);
      const userGrowth = getGrowth(newUsers30d, prevUsers30d);
      const propertyGrowth = getGrowth(newProperties30d, prevProperties30d);

      const avgGrowth = (leadGrowth + userGrowth + propertyGrowth) / 3;
      // Growth rate score centered around 10% monthly growth being 100 points
      const growthRateScore = Math.max(0, Math.min(100, 50 + avgGrowth * 5));

      // 6. User Activity Rate (10% Weight)
      // Active users/Total users or WAU/MAU relative. Let's use Active Users status as baseline, modulated by log activity.
      const rawActivity = totalUsers > 0 ? (uniqueActiveUsers30d / totalUsers) * 100 : 100;
      const userActivityRate = Math.min(100, rawActivity * 2); // Assume 50% monthly activity is excellent (100 pts)

      // Compute Weighted Total Score
      const totalScore = parseFloat(
        (
          leadConversionRate * 0.25 +
          appointmentCompletionRate * 0.20 +
          followUpCompletionRate * 0.15 +
          propertyEngagement * 0.15 +
          growthRateScore * 0.15 +
          userActivityRate * 0.10
        ).toFixed(2)
      );

      // Map score to Grade
      let grade: HealthGrade = 'MODERATE';
      if (totalScore >= 85) grade = 'EXCELLENT';
      else if (totalScore >= 70) grade = 'HEALTHY';
      else if (totalScore >= 50) grade = 'MODERATE';
      else if (totalScore >= 30) grade = 'RISK';
      else grade = 'CRITICAL';

      return {
        score: totalScore,
        grade,
        breakdown: {
          leadConversionRate: parseFloat(leadConversionRate.toFixed(2)),
          appointmentCompletionRate: parseFloat(appointmentCompletionRate.toFixed(2)),
          followUpCompletionRate: parseFloat(followUpCompletionRate.toFixed(2)),
          propertyEngagement: parseFloat(propertyEngagement.toFixed(2)),
          growthRateScore: parseFloat(growthRateScore.toFixed(2)),
          userActivityRate: parseFloat(userActivityRate.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('[HealthScoreService.calculateHealthScore] Error:', error);
      return {
        score: 0,
        grade: 'CRITICAL',
        breakdown: {
          leadConversionRate: 0,
          appointmentCompletionRate: 0,
          followUpCompletionRate: 0,
          propertyEngagement: 0,
          growthRateScore: 0,
          userActivityRate: 0,
        },
      };
    }
  },
};
