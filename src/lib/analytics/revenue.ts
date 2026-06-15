import { db } from '../db';
import { LeadSource } from '@prisma/client';

export interface RevenueTrendMetric {
  label: string; // e.g. "2026-06", "Q2 2026", "2026"
  revenue: number;
}

export interface AverageDealValueMetric {
  category: string; // e.g. "WEBSITE", "Admin User"
  avgValue: number;
}

export interface RevenueAnalyticsData {
  pipelineValue: number;
  potentialRevenue: number;
  wonRevenue: number;
  lostRevenue: number;
  trends: {
    monthly: RevenueTrendMetric[];
    quarterly: RevenueTrendMetric[];
    yearly: RevenueTrendMetric[];
  };
  averages: {
    perSource: AverageDealValueMetric[];
    perAdmin: AverageDealValueMetric[];
  };
}

export const RevenueAnalyticsService = {
  /**
   * Evaluates sales pipeline values, deal values, and historical revenue trends.
   */
  async getRevenueAnalytics(): Promise<RevenueAnalyticsData> {
    try {
      const [leads, appointments, properties, admins, statusHistory] = await Promise.all([
        db.lead.findMany({
          select: { id: true, email: true, status: true, source: true, assignedToId: true, createdAt: true, updatedAt: true },
        }),
        db.appointment.findMany({
          select: { propertyId: true, email: true },
        }),
        db.property.findMany({
          select: { id: true, price: true },
        }),
        db.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true, name: true, email: true },
        }),
        db.leadStatusHistory.findMany({
          where: { toStatus: 'WON' },
          select: { leadId: true, changedAt: true },
        }),
      ]);

      const priceLookup = new Map<string, number>();
      properties.forEach((p) => priceLookup.set(p.id, p.price));

      // Resolve lead email to property price via appointment
      const leadPropertyPrice = new Map<string, number>();
      appointments.forEach((app) => {
        const price = priceLookup.get(app.propertyId);
        if (price) {
          leadPropertyPrice.set(app.email.toLowerCase(), price);
        }
      });

      // Default fallback price (average price of all properties)
      const defaultPrice = properties.length > 0
        ? properties.reduce((sum, p) => sum + p.price, 0) / properties.length
        : 5000000;

      const getLeadValue = (l: typeof leads[0]): number => {
        return leadPropertyPrice.get(l.email.toLowerCase()) || defaultPrice;
      };

      // 1. Pipeline/Revenue Totals
      let pipelineValue = 0;
      let potentialRevenue = 0;
      let wonRevenue = 0;
      let lostRevenue = 0;

      leads.forEach((l) => {
        const val = getLeadValue(l);
        if (l.status === 'WON') {
          wonRevenue += val;
        } else if (l.status === 'LOST') {
          lostRevenue += val;
        } else {
          potentialRevenue += val;
          if (l.status === 'NEGOTIATION' || l.status === 'VISIT_SCHEDULED') {
            pipelineValue += val;
          }
        }
      });

      // Map lead ID to its WON transition date
      const winDateMap = new Map<string, Date>();
      statusHistory.forEach((h) => {
        winDateMap.set(h.leadId, new Date(h.changedAt));
      });

      const getWonDate = (lead: typeof leads[0]): Date => {
        return winDateMap.get(lead.id) || new Date(lead.updatedAt);
      };

      // 2. Revenue Trends
      // Generate monthly trend for past 6 months
      const monthlyTrends: RevenueTrendMetric[] = [];
      const quarterlyTrends: RevenueTrendMetric[] = [];
      const yearlyTrends: RevenueTrendMetric[] = [];

      const wonLeads = leads.filter((l) => l.status === 'WON');

      // Helper to format trends
      // Monthly
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        const rev = wonLeads
          .filter((wl) => {
            const wDate = getWonDate(wl);
            return wDate.getFullYear() === d.getFullYear() && wDate.getMonth() === d.getMonth();
          })
          .reduce((sum, wl) => sum + getLeadValue(wl), 0);

        monthlyTrends.push({ label: yyyymm, revenue: parseFloat(rev.toFixed(2)) });
      }

      // Quarterly
      const quarters = [
        { label: 'Q1', months: [0, 1, 2] },
        { label: 'Q2', months: [3, 4, 5] },
        { label: 'Q3', months: [6, 7, 8] },
        { label: 'Q4', months: [9, 10, 11] },
      ];
      const currYear = new Date().getFullYear();
      quarters.forEach((q) => {
        const rev = wonLeads
          .filter((wl) => {
            const wDate = getWonDate(wl);
            return wDate.getFullYear() === currYear && q.months.includes(wDate.getMonth());
          })
          .reduce((sum, wl) => sum + getLeadValue(wl), 0);

        quarterlyTrends.push({ label: `${q.label} ${currYear}`, revenue: parseFloat(rev.toFixed(2)) });
      });

      // Yearly
      const years = [currYear - 1, currYear];
      years.forEach((y) => {
        const rev = wonLeads
          .filter((wl) => getWonDate(wl).getFullYear() === y)
          .reduce((sum, wl) => sum + getLeadValue(wl), 0);

        yearlyTrends.push({ label: String(y), revenue: parseFloat(rev.toFixed(2)) });
      });

      // 3. Average Deal Values
      // Per Source
      const sources: LeadSource[] = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'GOOGLE_ADS', 'FACEBOOK_ADS', 'OTHER'];
      const perSource = sources.map((source) => {
        const sourceLeads = wonLeads.filter((l) => l.source === source);
        const totalVal = sourceLeads.reduce((sum, l) => sum + getLeadValue(l), 0);
        const avg = sourceLeads.length > 0 ? totalVal / sourceLeads.length : 0;
        return { category: source, avgValue: parseFloat(avg.toFixed(2)) };
      });

      // Per Admin
      const perAdmin = admins.map((admin) => {
        const adminLeads = wonLeads.filter((l) => l.assignedToId === admin.id);
        const totalVal = adminLeads.reduce((sum, l) => sum + getLeadValue(l), 0);
        const avg = adminLeads.length > 0 ? totalVal / adminLeads.length : 0;
        return { category: admin.name || admin.email, avgValue: parseFloat(avg.toFixed(2)) };
      });

      // Unassigned
      const unassignedLeads = wonLeads.filter((l) => !l.assignedToId);
      if (unassignedLeads.length > 0) {
        const totalVal = unassignedLeads.reduce((sum, l) => sum + getLeadValue(l), 0);
        const avg = totalVal / unassignedLeads.length;
        perAdmin.push({ category: 'Unassigned', avgValue: parseFloat(avg.toFixed(2)) });
      }

      return {
        pipelineValue: parseFloat(pipelineValue.toFixed(2)),
        potentialRevenue: parseFloat(potentialRevenue.toFixed(2)),
        wonRevenue: parseFloat(wonRevenue.toFixed(2)),
        lostRevenue: parseFloat(lostRevenue.toFixed(2)),
        trends: {
          monthly: monthlyTrends,
          quarterly: quarterlyTrends,
          yearly: yearlyTrends,
        },
        averages: {
          perSource,
          perAdmin,
        },
      };
    } catch (error) {
      console.error('[RevenueAnalyticsService.getRevenueAnalytics] Error:', error);
      throw error;
    }
  },
};
