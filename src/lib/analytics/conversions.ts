import { db } from '../db';
import { LeadStatus } from '@prisma/client';

export interface FunnelStage {
  stage: LeadStatus;
  label: string;
  count: number;
  conversionRate: number; // overall conversion rate relative to starting stage
  stageConversionRate: number; // stage-to-stage conversion rate
  dropOffRate: number; // drop-off rate from preceding stage
  averageDurationHours: number; // average hours spent in this stage
}

export interface FunnelData {
  stages: FunnelStage[];
  summary: {
    totalActiveLeads: number;
    winRate: number;
    lostRate: number;
  };
}

const STAGE_ORDER: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'VISIT_SCHEDULED',
  'NEGOTIATION',
  'WON',
];

const STAGE_LABELS: Record<LeadStatus, string> = {
  NEW: 'New Leads',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  VISIT_SCHEDULED: 'Visit Scheduled',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export const ConversionsService = {
  /**
   * Calculates CRM stages count, conversions, drop-offs, and durations.
   */
  async getLeadFunnelData(): Promise<FunnelData> {
    try {
      const [leads, statusHistory] = await Promise.all([
        db.lead.findMany({
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.leadStatusHistory.findMany({
          orderBy: { changedAt: 'asc' },
        }),
      ]);

      const totalActiveLeads = leads.filter(l => l.status !== 'LOST').length;
      const wonCount = leads.filter(l => l.status === 'WON').length;
      const lostCount = leads.filter(l => l.status === 'LOST').length;

      const totalLeads = leads.length;
      const winRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
      const lostRate = totalLeads > 0 ? (lostCount / totalLeads) * 100 : 0;

      // Calculate stage counts (cumulative funnel count: a lead that is WON has passed through all stages)
      // Cumulative means count at stage S includes all leads that have reached S or higher.
      const rawStageCounts: Record<LeadStatus, number> = {
        NEW: 0,
        CONTACTED: 0,
        QUALIFIED: 0,
        VISIT_SCHEDULED: 0,
        NEGOTIATION: 0,
        WON: 0,
        LOST: 0,
      };

      // Exact current status counts
      leads.forEach((lead) => {
        rawStageCounts[lead.status]++;
      });

      // Cumulative funnel counts
      // NEW counts everything that was created (excluding LOST from start)
      // WON counts only WON
      const cumulativeCounts: Record<LeadStatus, number> = {
        NEW: totalLeads - rawStageCounts.LOST,
        CONTACTED: 0,
        QUALIFIED: 0,
        VISIT_SCHEDULED: 0,
        NEGOTIATION: 0,
        WON: rawStageCounts.WON,
        LOST: rawStageCounts.LOST,
      };

      // Derive intermediate cumulative stages based on status history and current states
      // Let's assume that if a lead is currently at status X, it has passed all prior stages.
      leads.forEach((lead) => {
        if (lead.status === 'LOST') return;
        const currentIdx = STAGE_ORDER.indexOf(lead.status);
        if (currentIdx !== -1) {
          for (let i = 0; i <= currentIdx; i++) {
            const stage = STAGE_ORDER[i];
            if (stage !== 'NEW' && stage !== 'WON') {
              cumulativeCounts[stage]++;
            }
          }
        }
      });

      // Calculate durations in each stage
      // We will track the timestamps of transitions for each lead.
      const durationsMap: Record<LeadStatus, number[]> = {
        NEW: [],
        CONTACTED: [],
        QUALIFIED: [],
        VISIT_SCHEDULED: [],
        NEGOTIATION: [],
        WON: [],
        LOST: [],
      };

      leads.forEach((lead) => {
        const leadHistory = statusHistory.filter((h) => h.leadId === lead.id);
        
        let lastTime = new Date(lead.createdAt).getTime();
        let lastStatus: LeadStatus = 'NEW';

        leadHistory.forEach((historyItem) => {
          const currentTime = new Date(historyItem.changedAt).getTime();
          const diffHours = (currentTime - lastTime) / (1000 * 60 * 60);

          if (diffHours >= 0) {
            durationsMap[lastStatus].push(diffHours);
          }

          lastTime = currentTime;
          lastStatus = historyItem.toStatus;
        });

        // Current status duration (from last transition/creation until now)
        const currentDurationHours = (Date.now() - lastTime) / (1000 * 60 * 60);
        if (currentDurationHours >= 0 && lead.status !== 'WON' && lead.status !== 'LOST') {
          durationsMap[lead.status].push(currentDurationHours);
        }
      });

      const avgDurations: Record<LeadStatus, number> = {
        NEW: 0,
        CONTACTED: 0,
        QUALIFIED: 0,
        VISIT_SCHEDULED: 0,
        NEGOTIATION: 0,
        WON: 0,
        LOST: 0,
      };

      STAGE_ORDER.forEach((stage) => {
        const arr = durationsMap[stage];
        avgDurations[stage] = arr.length > 0
          ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2))
          : 0;
      });

      // Build funnel stages list
      const stages: FunnelStage[] = [];
      const firstStageCount = cumulativeCounts.NEW;

      STAGE_ORDER.forEach((stage, idx) => {
        const count = cumulativeCounts[stage];
        const precedingCount = idx > 0 ? cumulativeCounts[STAGE_ORDER[idx - 1]] : count;

        const conversionRate = firstStageCount > 0 ? (count / firstStageCount) * 100 : 0;
        const stageConversionRate = precedingCount > 0 ? (count / precedingCount) * 100 : 100;
        const dropOffRate = 100 - stageConversionRate;

        stages.push({
          stage,
          label: STAGE_LABELS[stage],
          count,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          stageConversionRate: parseFloat(stageConversionRate.toFixed(2)),
          dropOffRate: parseFloat(dropOffRate.toFixed(2)),
          averageDurationHours: avgDurations[stage],
        });
      });

      return {
        stages,
        summary: {
          totalActiveLeads,
          winRate: parseFloat(winRate.toFixed(2)),
          lostRate: parseFloat(lostRate.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('[ConversionsService.getLeadFunnelData] Error:', error);
      return {
        stages: [],
        summary: { totalActiveLeads: 0, winRate: 0, lostRate: 0 },
      };
    }
  },
};
