import { db } from '../db';
import { SecurityAlertStatus, IncidentStatus, ResponseActionStatus } from '@prisma/client';

export class SocMetricsService {
  /**
   * Computes dynamic SOC operational performance metrics.
   */
  static async calculateMetrics(): Promise<any> {
    // 1. Fetch all closed incidents to calculate MTTR and MTTD
    const closedIncidents = await db.incident.findMany({
      where: {
        status: { in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] }
      },
      include: {
        events: true,
        alerts: true
      }
    });

    let totalTtdMs = 0;
    let totalTtrMs = 0;
    let ttdCount = 0;
    let ttrCount = 0;

    for (const inc of closedIncidents) {
      const firstEvent = inc.events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      const resolutionTime = inc.updatedAt.getTime();

      // Time To Detect (TTD): from first event to incident created time
      if (firstEvent) {
        totalTtdMs += inc.createdAt.getTime() - firstEvent.createdAt.getTime();
        ttdCount++;
      }

      // Time To Resolve (TTR): from incident created to resolved/closed time
      totalTtrMs += resolutionTime - inc.createdAt.getTime();
      ttrCount++;
    }

    const mttd = ttdCount > 0 ? Math.round(totalTtdMs / (60 * 1000) / ttdCount) : 5; // default 5 mins
    const mttr = ttrCount > 0 ? Math.round(totalTtrMs / (60 * 1000) / ttrCount) : 45; // default 45 mins

    // 2. Mean Time To Containment (MTTC): from first alert/event to automated containment action execution
    const executedResponses = await db.automatedResponseAction.findMany({
      where: {
        status: ResponseActionStatus.EXECUTED,
        executedAt: { not: null }
      }
    });

    let totalTtcMs = 0;
    let ttcCount = 0;

    for (const action of executedResponses) {
      if (action.executedAt) {
        totalTtcMs += action.executedAt.getTime() - action.requestedAt.getTime();
        ttcCount++;
      }
    }

    const mttc = ttcCount > 0 ? Math.round(totalTtcMs / (60 * 1000) / ttcCount) : 2; // default 2 mins

    // 3. Alert Accuracy & False Positive Rate
    const resolvedAlertsCount = await db.securityAlert.count({
      where: { status: { in: [SecurityAlertStatus.RESOLVED, SecurityAlertStatus.FALSE_POSITIVE] } }
    });
    const fpAlertsCount = await db.securityAlert.count({
      where: { status: SecurityAlertStatus.FALSE_POSITIVE }
    });

    const falsePositiveRate = resolvedAlertsCount > 0 ? fpAlertsCount / resolvedAlertsCount : 0.0;
    const alertAccuracy = resolvedAlertsCount > 0 ? (resolvedAlertsCount - fpAlertsCount) / resolvedAlertsCount : 1.0;

    // 4. Playbook Success Rate
    const totalPlaybooks = await db.playbookExecution.count();
    const successfulPlaybooks = await db.playbookExecution.count({
      where: { status: 'COMPLETED' }
    });
    const playbookSuccessRate = totalPlaybooks > 0 ? successfulPlaybooks / totalPlaybooks : 1.0;

    // 5. Automation Containment Success Rate
    const totalResponses = await db.automatedResponseAction.count();
    const successfulResponses = await db.automatedResponseAction.count({
      where: { status: ResponseActionStatus.EXECUTED }
    });
    const automationSuccessRate = totalResponses > 0 ? successfulResponses / totalResponses : 1.0;

    // 6. Incident Closure Rate
    const totalIncidentsCount = await db.incident.count();
    const closedIncidentsCount = await db.incident.count({
      where: { status: { in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] } }
    });
    const incidentClosureRate = totalIncidentsCount > 0 ? closedIncidentsCount / totalIncidentsCount : 1.0;

    // 7. Active Detections Coverage
    const activeRulesCount = await db.detectionRuleConfig.count({
      where: { state: 'ACTIVE' }
    });
    const totalRulesCount = await db.detectionRuleConfig.count();
    const detectionCoverage = totalRulesCount > 0 ? activeRulesCount / totalRulesCount : 1.0;

    return {
      mttdMinutes: mttd,
      mttrMinutes: mttr,
      mttcMinutes: mttc,
      alertVolume: resolvedAlertsCount,
      alertAccuracyPercentage: Math.round(alertAccuracy * 100),
      falsePositiveRatePercentage: Math.round(falsePositiveRate * 100),
      playbookSuccessRatePercentage: Math.round(playbookSuccessRate * 100),
      automationSuccessRatePercentage: Math.round(automationSuccessRate * 100),
      incidentClosureRatePercentage: Math.round(incidentClosureRate * 100),
      detectionCoveragePercentage: Math.round(detectionCoverage * 100),
    };
  }
}
