import { db } from '../db';
import { LeadStatus } from '@prisma/client';

export interface ProductivityReport {
  score: number;
  grade: 'ELITE' | 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_ATTENTION';
  breakdown: {
    leadPerformance: number;
    appointmentCompletion: number;
    followUpCompletion: number;
    propertyOperations: number;
    responseTime: number;
  };
  metrics: {
    leadsWon: number;
    leadsLost: number;
    appointmentsCompleted: number;
    appointmentsTotal: number;
    followUpsCompleted: number;
    followUpsTotal: number;
    propertiesCreatedOrUpdated: number;
  };
}

/**
 * Calculates productivity score and returns a grading report for a specific admin.
 */
export async function calculateAdminProductivity(adminId: string): Promise<ProductivityReport> {
  try {
    // 1. Fetch CRM Leads performance
    const [leadsWon, leadsLost] = await Promise.all([
      db.lead.count({ where: { assignedToId: adminId, status: LeadStatus.WON } }),
      db.lead.count({ where: { assignedToId: adminId, status: LeadStatus.LOST } }),
    ]);
    const totalTerminatedLeads = leadsWon + leadsLost;
    const leadPerformanceScore = totalTerminatedLeads > 0 ? (leadsWon / totalTerminatedLeads) * 100 : 75; // Default 75 if no terminated leads

    // 2. Fetch Showing Appointments completion
    const [appointmentsCompleted, appointmentsTotal] = await Promise.all([
      db.appointment.count({ where: { adminId, status: 'COMPLETED' } }),
      db.appointment.count({ where: { adminId } }),
    ]);
    const appointmentCompletionScore = appointmentsTotal > 0 ? (appointmentsCompleted / appointmentsTotal) * 100 : 80; // Default 80 if no appointments

    // 3. Fetch Follow-Up tasks completion
    const [followUpsCompleted, followUpsTotal] = await Promise.all([
      db.followUp.count({ where: { assignedToId: adminId, completed: true } }),
      db.followUp.count({ where: { assignedToId: adminId } }),
    ]);
    const followUpCompletionScore = followUpsTotal > 0 ? (followUpsCompleted / followUpsTotal) * 100 : 90; // Default 90 if no follow-ups

    // 4. Fetch Property Operations (Activity Logs)
    const propertyOperationsCount = await db.activityLog.count({
      where: {
        actorId: adminId,
        action: { in: ['PROPERTY_CREATE', 'PROPERTY_UPDATE', 'PROPERTY_PUBLISH', 'PROPERTY_ARCHIVE', 'PROPERTY_RESTORE'] },
      },
    });
    // Target 10 property operations for a perfect score
    const propertyOperationsScore = Math.min(100, propertyOperationsCount * 10);

    // 5. Calculate Response Time score (mocked/estimated based on delayed follow-ups)
    // We compute how many follow-ups were completed late, or default to a baseline score.
    const overdueFollowUps = await db.followUp.count({
      where: {
        assignedToId: adminId,
        completed: false,
        dueDate: { lt: new Date() },
      },
    });
    const responseTimeScore = Math.max(0, 100 - overdueFollowUps * 10);

    // Weighted Score calculation:
    // 30% Lead Performance
    // 20% Appointment Completion
    // 20% Follow-Up Completion
    // 15% Property Operations
    // 15% Response Time
    const weightedScore = Math.round(
      leadPerformanceScore * 0.3 +
      appointmentCompletionScore * 0.2 +
      followUpCompletionScore * 0.2 +
      propertyOperationsScore * 0.15 +
      responseTimeScore * 0.15
    );

    let grade: ProductivityReport['grade'] = 'AVERAGE';
    if (weightedScore >= 90) {
      grade = 'ELITE';
    } else if (weightedScore >= 80) {
      grade = 'EXCELLENT';
    } else if (weightedScore >= 70) {
      grade = 'GOOD';
    } else if (weightedScore >= 50) {
      grade = 'AVERAGE';
    } else {
      grade = 'NEEDS_ATTENTION';
    }

    return {
      score: weightedScore,
      grade,
      breakdown: {
        leadPerformance: Math.round(leadPerformanceScore),
        appointmentCompletion: Math.round(appointmentCompletionScore),
        followUpCompletion: Math.round(followUpCompletionScore),
        propertyOperations: Math.round(propertyOperationsScore),
        responseTime: Math.round(responseTimeScore),
      },
      metrics: {
        leadsWon,
        leadsLost,
        appointmentsCompleted,
        appointmentsTotal,
        followUpsCompleted,
        followUpsTotal,
        propertiesCreatedOrUpdated: propertyOperationsCount,
      },
    };
  } catch (error) {
    console.error(`[calculateAdminProductivity] Error for admin ${adminId}:`, error);
    return {
      score: 50,
      grade: 'AVERAGE',
      breakdown: { leadPerformance: 50, appointmentCompletion: 50, followUpCompletion: 50, propertyOperations: 50, responseTime: 50 },
      metrics: { leadsWon: 0, leadsLost: 0, appointmentsCompleted: 0, appointmentsTotal: 0, followUpsCompleted: 0, followUpsTotal: 0, propertiesCreatedOrUpdated: 0 },
    };
  }
}
