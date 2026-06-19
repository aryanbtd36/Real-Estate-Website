import { db } from '../db';
import { IncidentStatus, SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { SecurityEventLogger } from './event-logger';
import { SecurityAutomationMetricsService } from './automation-metrics';

export class IncidentResponseService {
  /**
   * Automatically creates an incident if the alert is CRITICAL or if it is a correlated event.
   */
  static async handleAlertCreated(alertId: string): Promise<any> {
    try {
      const alert = await db.securityAlert.findUnique({
        where: { id: alertId },
        include: { sourceEvent: true },
      });

      if (!alert) return null;

      // Determine if this alert warrants an incident (CRITICAL alerts or correlated events)
      const isCritical = alert.severity === SecurityEventSeverity.CRITICAL;
      const isCorrelated = alert.type?.startsWith('ACCOUNT_TAKEOVER_ATTEMPT') ||
                           alert.type?.startsWith('ACCOUNT_COMPROMISE_SUSPECTED') ||
                           alert.type?.startsWith('POTENTIAL_INSIDER_THREAT') ||
                           alert.type?.startsWith('AUTOMATED_ATTACK_CAMPAIGN') ||
                           alert.type?.startsWith('SESSION_HIJACKING_SUSPECTED') ||
                           (alert.details as any)?.correlated === true;

      if (isCritical || isCorrelated) {
        // Create an incident!
        const incident = await this.createIncident({
          title: `Incident: ${alert.title}`,
          description: alert.description,
          severity: alert.severity,
          category: alert.sourceEvent?.category || SecurityEventCategory.SECURITY,
          alertIds: [alert.id],
          eventIds: alert.sourceEventId ? [alert.sourceEventId] : [],
        });
        return incident;
      }
    } catch (err) {
      console.error('[IncidentResponseService.handleAlertCreated Error]', err);
    }
    return null;
  }

  /**
   * Create a new incident (both automatic and manual)
   */
  static async createIncident(params: {
    title: string;
    description: string;
    severity: SecurityEventSeverity;
    category: SecurityEventCategory;
    alertIds?: string[];
    eventIds?: string[];
  }) {
    try {
      const incident = await db.incident.create({
        data: {
          severity: params.severity,
          category: params.category,
          status: IncidentStatus.OPEN,
          metadata: {
            title: params.title,
            description: params.description,
            transferHistory: [],
          },
        },
      });

      // Link the alerts and events
      if (params.alertIds && params.alertIds.length > 0) {
        await db.securityAlert.updateMany({
          where: { id: { in: params.alertIds } },
          data: { incidentId: incident.id },
        });
      }

      if (params.eventIds && params.eventIds.length > 0) {
        await db.securityEvent.updateMany({
          where: { id: { in: params.eventIds } },
          data: { incidentId: incident.id },
        });
      }

      // Increment metric
      await SecurityAutomationMetricsService.incrementMetric('incidentsCreated');

      // Log security event
      await SecurityEventLogger.log({
        eventType: 'INCIDENT_CREATED',
        severity: params.severity,
        category: params.category,
        description: `New incident ${incident.id} created: ${params.title}.`,
        incidentId: incident.id,
      });

      return incident;
    } catch (err) {
      console.error('[IncidentResponseService.createIncident Error]', err);
      return null;
    }
  }

  /**
   * Claim Incident: Assigns an incident to an analyst, transitions OPEN -> INVESTIGATING
   */
  static async claimIncident(incidentId: string, analystId: string) {
    try {
      const incident = await db.incident.findUnique({ where: { id: incidentId } });
      if (!incident) return null;

      const previousStatus = incident.status;
      const newStatus = incident.status === IncidentStatus.OPEN ? IncidentStatus.INVESTIGATING : incident.status;

      const updated = await db.incident.update({
        where: { id: incidentId },
        data: {
          assignedToId: analystId,
          assignmentTimestamp: new Date(),
          status: newStatus,
        },
      });

      await SecurityEventLogger.log({
        userId: analystId,
        eventType: 'INCIDENT_ASSIGNED',
        severity: incident.severity,
        category: incident.category,
        description: `Incident ${incidentId} claimed by analyst ${analystId}.`,
        incidentId,
        metadata: { analystId, previousStatus, newStatus },
      });

      return updated;
    } catch (err) {
      console.error('[IncidentResponseService.claimIncident Error]', err);
      return null;
    }
  }

  /**
   * Unassign Incident: Clears analyst, resets status to OPEN if it was INVESTIGATING
   */
  static async unassignIncident(incidentId: string, actorId: string) {
    try {
      const incident = await db.incident.findUnique({ where: { id: incidentId } });
      if (!incident) return null;

      const previousStatus = incident.status;
      const newStatus = incident.status === IncidentStatus.INVESTIGATING ? IncidentStatus.OPEN : incident.status;
      const previousAnalystId = incident.assignedToId;

      const updated = await db.incident.update({
        where: { id: incidentId },
        data: {
          assignedToId: null,
          assignmentTimestamp: null,
          status: newStatus,
        },
      });

      await SecurityEventLogger.log({
        userId: actorId,
        eventType: 'INCIDENT_UNASSIGNED',
        severity: incident.severity,
        category: incident.category,
        description: `Incident ${incidentId} unassigned by actor ${actorId}.`,
        incidentId,
        metadata: { actorId, previousAnalystId, previousStatus, newStatus },
      });

      return updated;
    } catch (err) {
      console.error('[IncidentResponseService.unassignIncident Error]', err);
      return null;
    }
  }

  /**
   * Transfer Incident: Reassigns to another analyst, records in transferHistory
   */
  static async transferIncident(incidentId: string, newAnalystId: string, actorId: string, reason?: string) {
    try {
      const incident = await db.incident.findUnique({ where: { id: incidentId } });
      if (!incident) return null;

      const previousAnalystId = incident.assignedToId;
      const metadata = (incident.metadata as any) || {};
      const transferHistory = metadata.transferHistory || [];

      const newTransfer = {
        fromId: previousAnalystId,
        toId: newAnalystId,
        timestamp: new Date().toISOString(),
        actorId,
        reason,
      };

      const updated = await db.incident.update({
        where: { id: incidentId },
        data: {
          assignedToId: newAnalystId,
          assignmentTimestamp: new Date(),
          metadata: {
            ...metadata,
            transferHistory: [...transferHistory, newTransfer],
          },
        },
      });

      await SecurityEventLogger.log({
        userId: actorId,
        eventType: 'INCIDENT_TRANSFERRED',
        severity: incident.severity,
        category: incident.category,
        description: `Incident ${incidentId} transferred from analyst ${previousAnalystId} to ${newAnalystId} by actor ${actorId}.`,
        incidentId,
        metadata: { actorId, previousAnalystId, newAnalystId, reason },
      });

      return updated;
    } catch (err) {
      console.error('[IncidentResponseService.transferIncident Error]', err);
      return null;
    }
  }

  /**
   * Update Incident Status & Resolution details
   */
  static async updateIncidentStatus(incidentId: string, status: IncidentStatus, notes?: string, actorId?: string) {
    try {
      const incident = await db.incident.findUnique({ where: { id: incidentId } });
      if (!incident) return null;

      const previousStatus = incident.status;
      const isResolved = status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED;

      const updated = await db.incident.update({
        where: { id: incidentId },
        data: {
          status,
          resolutionNotes: notes || incident.resolutionNotes,
        },
      });

      let eventType = 'INCIDENT_CREATED';
      if (status === IncidentStatus.CONTAINED) eventType = 'INCIDENT_CONTAINED';
      else if (status === IncidentStatus.RESOLVED) eventType = 'INCIDENT_RESOLVED';
      else if (status === IncidentStatus.CLOSED) eventType = 'INCIDENT_CLOSED';

      await SecurityEventLogger.log({
        userId: actorId,
        eventType,
        severity: incident.severity,
        category: incident.category,
        description: `Incident ${incidentId} transitioned from ${previousStatus} to ${status}.`,
        incidentId,
        metadata: { actorId, previousStatus, newStatus: status, notes },
      });

      if (isResolved) {
        // Increment metrics
        await SecurityAutomationMetricsService.incrementMetric('incidentsAutoResolved');
      }

      return updated;
    } catch (err) {
      console.error('[IncidentResponseService.updateIncidentStatus Error]', err);
      return null;
    }
  }

  /**
   * Get operational metrics including MTTD/MTTR
   */
  static async getOperationalMetrics() {
    try {
      const [
        totalIncidents,
        openCount,
        investigatingCount,
        containedCount,
        mitigatedCount,
        resolvedCount,
        closedCount,
        severityGroups,
      ] = await Promise.all([
        db.incident.count(),
        db.incident.count({ where: { status: IncidentStatus.OPEN } }),
        db.incident.count({ where: { status: IncidentStatus.INVESTIGATING } }),
        db.incident.count({ where: { status: IncidentStatus.CONTAINED } }),
        db.incident.count({ where: { status: IncidentStatus.MITIGATED } }),
        db.incident.count({ where: { status: IncidentStatus.RESOLVED } }),
        db.incident.count({ where: { status: IncidentStatus.CLOSED } }),
        db.incident.groupBy({
          by: ['severity'],
          _count: { id: true },
        }),
      ]);

      const openIncidents = openCount + investigatingCount + containedCount + mitigatedCount;
      const closedIncidents = resolvedCount + closedCount;

      const severityDistribution: Record<string, number> = {};
      severityGroups.forEach((g) => {
        severityDistribution[g.severity] = g._count.id;
      });

      // Calculate MTTD and MTTR
      const resolvedIncidents = await db.incident.findMany({
        where: {
          status: { in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] },
        },
        include: {
          events: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          alerts: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      });

      let totalMttdMs = 0;
      let mttdCount = 0;
      let totalMttrMs = 0;
      let mttrCount = 0;

      resolvedIncidents.forEach((inc) => {
        // MTTR: Resolve time
        const duration = inc.updatedAt.getTime() - inc.createdAt.getTime();
        totalMttrMs += duration;
        mttrCount++;

        // MTTD: Detection time
        let earliestSourceTime = inc.createdAt.getTime();
        if (inc.events && inc.events.length > 0) {
          earliestSourceTime = inc.events[0].createdAt.getTime();
        } else if (inc.alerts && inc.alerts.length > 0) {
          earliestSourceTime = inc.alerts[0].createdAt.getTime();
        }

        const detectionTime = inc.createdAt.getTime() - earliestSourceTime;
        if (detectionTime >= 0) {
          totalMttdMs += detectionTime;
          mttdCount++;
        }
      });

      const mttdMinutes = mttdCount > 0 ? (totalMttdMs / (1000 * 60)) / mttdCount : 0;
      const mttrMinutes = mttrCount > 0 ? (totalMttrMs / (1000 * 60)) / mttrCount : 0;

      const automations = await SecurityAutomationMetricsService.getMetrics();

      return {
        openIncidents,
        closedIncidents,
        escalatedIncidents: severityDistribution[SecurityEventSeverity.CRITICAL] || 0,
        averageResolutionTimeMinutes: mttrMinutes,
        meanTimeToDetectMinutes: mttdMinutes,
        meanTimeToResolveMinutes: mttrMinutes,
        severityDistribution,
        totalIncidents,
        statusBreakdown: {
          OPEN: openCount,
          INVESTIGATING: investigatingCount,
          CONTAINED: containedCount,
          MITIGATED: mitigatedCount,
          RESOLVED: resolvedCount,
          CLOSED: closedCount,
        },
        playbooksExecuted: automations.playbooksExecuted,
        alertsCorrelated: automations.alertsCorrelated,
        falsePositives: automations.falsePositives,
      };
    } catch (err) {
      console.error('[IncidentResponseService.getOperationalMetrics Error]', err);
      return {
        openIncidents: 0,
        closedIncidents: 0,
        escalatedIncidents: 0,
        averageResolutionTimeMinutes: 0,
        meanTimeToDetectMinutes: 0,
        meanTimeToResolveMinutes: 0,
        severityDistribution: {},
        totalIncidents: 0,
        statusBreakdown: {},
        playbooksExecuted: 0,
        alertsCorrelated: 0,
        falsePositives: 0,
      };
    }
  }
}
