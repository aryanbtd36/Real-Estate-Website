import { db } from '../db';
import { LeadStatus, LeadPriority, LeadSource } from '@prisma/client';

export interface SourcePerformanceMetric {
  source: LeadSource;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  averageDealTimeHours: number;
}

export interface PriorityMetric {
  priority: LeadPriority;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export interface AssignmentMetric {
  adminId: string;
  adminName: string;
  assignedLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
}

export interface LeadAnalyticsData {
  sourcePerformance: SourcePerformanceMetric[];
  priorityPerformance: PriorityMetric[];
  assignmentPerformance: AssignmentMetric[];
}

export const LeadAnalyticsService = {
  /**
   * Calculates CRM lead source, priority, and admin assignment statistics.
   */
  async getLeadAnalytics(): Promise<LeadAnalyticsData> {
    try {
      const [leads, statusHistory, admins] = await Promise.all([
        db.lead.findMany({
          select: {
            id: true,
            status: true,
            priority: true,
            source: true,
            assignedToId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.leadStatusHistory.findMany({
          where: { toStatus: 'WON' },
          orderBy: { changedAt: 'asc' },
        }),
        db.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true, name: true, email: true },
        }),
      ]);

      const adminMap = new Map<string, string>();
      admins.forEach((a) => adminMap.set(a.id, a.name || a.email));

      // Map lead ID to its WON transition timestamp
      const winTransitionMap = new Map<string, number>();
      statusHistory.forEach((h) => {
        if (!winTransitionMap.has(h.leadId)) {
          winTransitionMap.set(h.leadId, new Date(h.changedAt).getTime());
        }
      });

      const getDealTimeHours = (lead: typeof leads[0]): number => {
        const start = new Date(lead.createdAt).getTime();
        const end = winTransitionMap.get(lead.id) || new Date(lead.updatedAt).getTime();
        const diff = (end - start) / (1000 * 60 * 60);
        return diff >= 0 ? diff : 0;
      };

      // 1. Lead Source Performance
      const sources: LeadSource[] = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'GOOGLE_ADS', 'FACEBOOK_ADS', 'OTHER'];
      const sourcePerformance = sources.map((source) => {
        const sourceLeads = leads.filter((l) => l.source === source);
        const total = sourceLeads.length;
        const converted = sourceLeads.filter((l) => l.status === 'WON').length;
        const rate = total > 0 ? (converted / total) * 100 : 0;

        const convertedLeadsList = sourceLeads.filter((l) => l.status === 'WON');
        const avgTime = convertedLeadsList.length > 0
          ? convertedLeadsList.reduce((sum, l) => sum + getDealTimeHours(l), 0) / convertedLeadsList.length
          : 0;

        return {
          source,
          totalLeads: total,
          convertedLeads: converted,
          conversionRate: parseFloat(rate.toFixed(2)),
          averageDealTimeHours: parseFloat(avgTime.toFixed(2)),
        };
      });

      // 2. Lead Priority Performance
      const priorities: LeadPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const priorityPerformance = priorities.map((priority) => {
        const priorityLeads = leads.filter((l) => l.priority === priority);
        const total = priorityLeads.length;
        const converted = priorityLeads.filter((l) => l.status === 'WON').length;
        const rate = total > 0 ? (converted / total) * 100 : 0;

        return {
          priority,
          totalLeads: total,
          convertedLeads: converted,
          conversionRate: parseFloat(rate.toFixed(2)),
        };
      });

      // 3. Assignment Performance
      const adminLeadsMap = new Map<string, typeof leads>();
      leads.forEach((l) => {
        if (l.assignedToId) {
          if (!adminLeadsMap.has(l.assignedToId)) {
            adminLeadsMap.set(l.assignedToId, []);
          }
          adminLeadsMap.get(l.assignedToId)!.push(l);
        }
      });

      const assignmentPerformance = admins.map((admin) => {
        const adminLeads = adminLeadsMap.get(admin.id) || [];
        const total = adminLeads.length;
        const won = adminLeads.filter((l) => l.status === 'WON').length;
        const lost = adminLeads.filter((l) => l.status === 'LOST').length;
        const rate = total > 0 ? (won / total) * 100 : 0;

        return {
          adminId: admin.id,
          adminName: admin.name || admin.email,
          assignedLeads: total,
          wonLeads: won,
          lostLeads: lost,
          conversionRate: parseFloat(rate.toFixed(2)),
        };
      });

      // Handle unassigned leads performance
      const unassignedLeads = leads.filter((l) => !l.assignedToId);
      if (unassignedLeads.length > 0) {
        const total = unassignedLeads.length;
        const won = unassignedLeads.filter((l) => l.status === 'WON').length;
        const lost = unassignedLeads.filter((l) => l.status === 'LOST').length;
        const rate = total > 0 ? (won / total) * 100 : 0;

        assignmentPerformance.push({
          adminId: 'unassigned',
          adminName: 'Unassigned',
          assignedLeads: total,
          wonLeads: won,
          lostLeads: lost,
          conversionRate: parseFloat(rate.toFixed(2)),
        });
      }

      return {
        sourcePerformance,
        priorityPerformance,
        assignmentPerformance,
      };
    } catch (error) {
      console.error('[LeadAnalyticsService.getLeadAnalytics] Error:', error);
      throw error;
    }
  },
};
