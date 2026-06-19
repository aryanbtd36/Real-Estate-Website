import { db } from '../db';
import { RiskScoringEngine } from './risk-engine';

export interface CampaignEvent {
  id: string;
  timestamp: Date;
  type: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  phase: 'Initial Access' | 'Escalation' | 'Lateral Actions' | 'Exports' | 'Mitigation' | 'Resolution';
  metadata?: any;
}

export class CampaignReconstructionService {
  /**
   * Determine the campaign attack phase of a security event/alert/log
   */
  static getPhase(eventType: string, category: string, description: string): 'Initial Access' | 'Escalation' | 'Lateral Actions' | 'Exports' | 'Mitigation' | 'Resolution' {
    const lowerType = eventType.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const lowerCat = category.toLowerCase();

    // 1. Resolution
    if (lowerType.includes('resolved') || lowerType.includes('closed') || lowerDesc.includes('resolved') || lowerDesc.includes('closed')) {
      return 'Resolution';
    }

    // 2. Mitigation
    if (
      lowerType.includes('locked') ||
      lowerType.includes('revoked') ||
      lowerType.includes('blocked') ||
      lowerType.includes('mitigated') ||
      lowerType.includes('unassigned') ||
      lowerType.includes('contained') ||
      lowerType.includes('playbook') ||
      lowerDesc.includes('locked') ||
      lowerDesc.includes('revoked') ||
      lowerDesc.includes('blocked') ||
      lowerDesc.includes('mitigated') ||
      lowerDesc.includes('playbook')
    ) {
      return 'Mitigation';
    }

    // 3. Exports
    if (lowerType.includes('export') || lowerDesc.includes('export') || lowerCat === 'export') {
      return 'Exports';
    }

    // 4. Escalation
    if (
      lowerType.includes('promote') ||
      lowerType.includes('grant') ||
      lowerType.includes('escalate') ||
      lowerType.includes('ownership') ||
      lowerDesc.includes('promote') ||
      lowerDesc.includes('grant') ||
      lowerDesc.includes('escalate') ||
      lowerDesc.includes('privilege')
    ) {
      return 'Escalation';
    }

    // 5. Initial Access
    if (
      lowerType.includes('login') ||
      lowerType.includes('auth') ||
      lowerType.includes('session_created') ||
      lowerType.includes('device_login') ||
      lowerDesc.includes('login') ||
      lowerDesc.includes('authenticated') ||
      lowerDesc.includes('session created')
    ) {
      return 'Initial Access';
    }

    // 6. Default to Lateral Actions for other logs
    return 'Lateral Actions';
  }

  /**
   * Reconstruct a campaign timeline and compile an attack narrative
   */
  static async reconstructCampaign(userId?: string, sessionId?: string): Promise<{
    userId?: string;
    sessionId?: string;
    timeline: CampaignEvent[];
    narrative: string;
    riskBreakdown?: {
      authenticationRisk: number;
      sessionRisk: number;
      deviceRisk: number;
      geoRisk: number;
      behaviorRisk: number;
      threatIntelRisk: number;
      correlationRisk: number;
    };
  }> {
    if (!userId && !sessionId) {
      return { timeline: [], narrative: 'No target specified for campaign reconstruction.' };
    }

    try {
      // Find matching security events
      const events = await db.securityEvent.findMany({
        where: {
          OR: [
            userId ? { userId } : null,
            sessionId ? { sessionId } : null,
          ].filter(Boolean) as any,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Find matching security alerts
      const alerts = await db.securityAlert.findMany({
        where: {
          OR: [
            userId ? { adminId: userId } : null,
            userId ? { assignedToId: userId } : null,
          ].filter(Boolean) as any,
        },
        orderBy: { createdAt: 'asc' },
      });

      const timeline: CampaignEvent[] = [];

      events.forEach((e) => {
        const phase = this.getPhase(e.eventType, e.category, e.description);
        timeline.push({
          id: e.id,
          timestamp: e.createdAt,
          type: e.eventType,
          title: e.title,
          description: e.description,
          severity: e.severity,
          category: e.category,
          phase,
          metadata: e.metadata,
        });
      });

      alerts.forEach((a) => {
        const phase = this.getPhase(a.type || 'Alert', 'SECURITY', a.description);
        timeline.push({
          id: a.id,
          timestamp: a.createdAt,
          type: a.type || 'Security Alert',
          title: a.title,
          description: a.description,
          severity: a.severity,
          category: 'SECURITY',
          phase,
          metadata: a.details,
        });
      });

      // Sort timeline chronologically (earliest first)
      timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Generate attack narrative from timeline events
      const narrativeParts: string[] = [];
      
      if (timeline.length === 0) {
        return { userId, sessionId, timeline, narrative: 'No threat events detected. The system reports zero suspicious activity.' };
      }

      // Initial access narrative
      const accessEvents = timeline.filter((t) => t.phase === 'Initial Access');
      if (accessEvents.length > 0) {
        const first = accessEvents[0];
        if (first.type.includes('Failed') || first.type.includes('FAILURE')) {
          narrativeParts.push(`Anomalous activity started with failed authentication attempts for user at ${first.timestamp.toLocaleTimeString()}.`);
        } else {
          narrativeParts.push(`The actor established initial access through session creation or authentication at ${first.timestamp.toLocaleTimeString()}.`);
        }
      }

      // Escalation narrative
      const escalationEvents = timeline.filter((t) => t.phase === 'Escalation');
      if (escalationEvents.length > 0) {
        narrativeParts.push(`Following access, privilege escalation was attempted: ${escalationEvents.map(e => e.title).join(', ')}.`);
      }

      // Lateral action narrative
      const lateralEvents = timeline.filter((t) => t.phase === 'Lateral Actions');
      if (lateralEvents.length > 0) {
        narrativeParts.push(`The actor then performed lateral operations, accessing system resources or data nodes (${lateralEvents.length} distinct actions recorded).`);
      }

      // Export narrative
      const exportEvents = timeline.filter((t) => t.phase === 'Exports');
      if (exportEvents.length > 0) {
        narrativeParts.push(`A mass export of data was triggered, raising concerns of potential data exfiltration (${exportEvents.map(e => e.description).join('; ')}).`);
      }

      // Mitigation narrative
      const mitigationEvents = timeline.filter((t) => t.phase === 'Mitigation');
      if (mitigationEvents.length > 0) {
        narrativeParts.push(`SOC automation or administrators responded with containment actions, terminating active sessions or locking target assets to neutralize the threat.`);
      }

      // Resolution narrative
      const resolutionEvents = timeline.filter((t) => t.phase === 'Resolution');
      if (resolutionEvents.length > 0) {
        narrativeParts.push(`The incident was finally resolved and closed by analysts after review.`);
      } else {
        narrativeParts.push(`The campaign is currently OPEN and actively monitored by the SOC.`);
      }

      const narrative = narrativeParts.join(' ');

      // Reconstruct risk inputs from timeline events and threat intelligence
      const hasEvent = (type: string) => timeline.some((t) => t.type === type);
      const failedLoginsCount = timeline.filter((t) => t.type === 'Login Failed' || t.type === 'AUTH_LOGIN_FAILURE').length;

      const ips = Array.from(new Set(events.map((e) => e.ipAddress).filter(Boolean))) as string[];
      let isKnownMaliciousIP = false;
      let isTorExitNode = false;
      let isProxy = false;

      if (ips.length > 0) {
        const indicators = await db.threatIndicator.findMany({
          where: {
            type: { in: ['IP', 'TOR', 'TOR_EXIT', 'VPN', 'PROXY'] },
            value: { in: ips },
          },
        });
        isKnownMaliciousIP = indicators.some((ind) => ind.type === 'IP' || ind.riskScore >= 50);
        isTorExitNode = indicators.some((ind) => ind.type === 'TOR' || ind.type === 'TOR_EXIT');
        isProxy = indicators.some((ind) => ind.type === 'VPN' || ind.type === 'PROXY');
      }

      const riskParams = {
        failedLoginsCount,
        isBruteForce: hasEvent('BRUTE_FORCE_ATTEMPT'),
        isCredentialStuffing: hasEvent('CREDENTIAL_STUFFING'),
        isAccountTakeover: hasEvent('ACCOUNT_TAKEOVER_ATTEMPT'),
        isSuspiciousSession: hasEvent('SUSPICIOUS_SESSION'),
        isNewDevice: hasEvent('NEW_DEVICE_LOGIN') || hasEvent('NEW_DEVICE'),
        isImpossibleTravel: hasEvent('IMPOSSIBLE_TRAVEL'),
        isAdminAnomaly: hasEvent('ADMIN_ANOMALY'),
        sessionHijackingSuspected: hasEvent('SESSION_HIJACKING_SUSPECTED'),
        hasCorrelatedThreats: timeline.some((t) => t.metadata?.correlated === true),
        correlatedAlertsCount: timeline.filter((t) => t.metadata?.correlated === true).length,
        isKnownMaliciousIP,
        isTorExitNode,
        isProxy,
      };

      const riskResult = RiskScoringEngine.calculateScoreV2(riskParams);

      return {
        userId,
        sessionId,
        timeline,
        narrative,
        riskBreakdown: riskResult.breakdown,
      };
    } catch (err) {
      console.error('[CampaignReconstructionService Error]', err);
      return { userId, sessionId, timeline: [], narrative: 'Error reconstructing attack campaign.' };
    }
  }
}
