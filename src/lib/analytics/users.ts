import { db } from '../db';
import { UserStatus } from '@prisma/client';
import { calculateEngagementScore, getEngagementCategory } from '../engagement';

export interface UserAnalyticsData {
  growthTrends: {
    dailyRegistrations: number;
    weeklyRegistrations: number;
    monthlyRegistrations: number;
  };
  activityMetrics: {
    dau: number; // Daily Active Users
    wau: number; // Weekly Active Users
    mau: number; // Monthly Active Users
    activeUserRatio: number; // (DAU / MAU) * 100
  };
  retentionMetrics: {
    returningUsers: number;
    repeatVisitors: number;
    engagementDistribution: {
      vip: number;
      high: number;
      medium: number;
      low: number;
      inactive: number;
    };
  };
}

export const UserAnalyticsService = {
  /**
   * Evaluates active user engagement, registration growth, and retention tiers.
   */
  async getUserAnalytics(): Promise<UserAnalyticsData> {
    try {
      const now = new Date();

      const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const w1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const m1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        // Registration growth
        dailyRegistrations,
        weeklyRegistrations,
        monthlyRegistrations,
        // Active Users (DAU, WAU, MAU)
        dauCount,
        wauCount,
        mauCount,
        // All active users list with counts
        usersRaw,
      ] = await Promise.all([
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: d1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: w1 } } }),
        db.user.count({ where: { role: 'USER', deletedAt: null, createdAt: { gte: m1 } } }),

        // DAU: Unique actorIds in last 24h
        db.activityLog.groupBy({
          by: ['actorId'],
          where: { actorId: { not: null }, createdAt: { gte: d1 } },
        }).then(res => res.length),

        // WAU: Unique actorIds in last 7d
        db.activityLog.groupBy({
          by: ['actorId'],
          where: { actorId: { not: null }, createdAt: { gte: w1 } },
        }).then(res => res.length),

        // MAU: Unique actorIds in last 30d
        db.activityLog.groupBy({
          by: ['actorId'],
          where: { actorId: { not: null }, createdAt: { gte: m1 } },
        }).then(res => res.length),

        // Load users with interaction counts
        db.user.findMany({
          where: { role: 'USER', deletedAt: null },
          select: {
            id: true,
            email: true,
            status: true,
            _count: {
              select: {
                propertyViews: true,
                savedProperties: true,
                appointments: true,
              },
            },
          },
        }),
      ]);

      const activeUserRatio = mauCount > 0 ? (dauCount / mauCount) * 100 : 0;

      // Returning users: users with more than 1 distinct day with activity in log
      const activityDays = await db.activityLog.findMany({
        where: { actorId: { not: null }, createdAt: { gte: m1 } },
        select: { actorId: true, createdAt: true },
      });

      const userDaysMap = new Map<string, Set<string>>();
      activityDays.forEach((log) => {
        const userId = log.actorId!;
        const dateStr = new Date(log.createdAt).toDateString();
        if (!userDaysMap.has(userId)) {
          userDaysMap.set(userId, new Set());
        }
        userDaysMap.get(userId)!.add(dateStr);
      });

      let returningUsers = 0;
      userDaysMap.forEach((days) => {
        if (days.size > 1) {
          returningUsers++;
        }
      });

      // Repeat visitors: users who logged in at least twice (or viewed at least twice)
      const repeatVisitors = Array.from(userDaysMap.keys()).length;

      // Group users into engagement categories
      const engagementDistribution = {
        vip: 0,
        high: 0,
        medium: 0,
        low: 0,
        inactive: 0,
      };

      // Load lead inquiries count mapped by email in parallel
      const leadEmails = await db.lead.findMany({
        select: { email: true },
      });
      const leadEmailsCountMap = new Map<string, number>();
      leadEmails.forEach((l) => {
        const email = l.email.toLowerCase();
        leadEmailsCountMap.set(email, (leadEmailsCountMap.get(email) || 0) + 1);
      });

      usersRaw.forEach((u) => {
        const viewsCount = u._count.propertyViews;
        const savesCount = u._count.savedProperties;
        const appointmentsCount = u._count.appointments;
        const inquiriesCount = leadEmailsCountMap.get(u.email.toLowerCase()) || 0;

        const isSuspended = u.status === UserStatus.SUSPENDED;
        const score = isSuspended
          ? 0
          : calculateEngagementScore({
              viewsCount,
              savesCount,
              inquiriesCount,
              appointmentsCount,
            });

        const category = getEngagementCategory(score);
        if (category === 'VIP') engagementDistribution.vip++;
        else if (category === 'HIGH') engagementDistribution.high++;
        else if (category === 'MEDIUM') engagementDistribution.medium++;
        else if (category === 'LOW') engagementDistribution.low++;
        else engagementDistribution.inactive++;
      });

      return {
        growthTrends: {
          dailyRegistrations,
          weeklyRegistrations,
          monthlyRegistrations,
        },
        activityMetrics: {
          dau: dauCount,
          wau: wauCount,
          mau: mauCount,
          activeUserRatio: parseFloat(activeUserRatio.toFixed(2)),
        },
        retentionMetrics: {
          returningUsers,
          repeatVisitors,
          engagementDistribution,
        },
      };
    } catch (error) {
      console.error('[UserAnalyticsService.getUserAnalytics] Error:', error);
      throw error;
    }
  },
};
