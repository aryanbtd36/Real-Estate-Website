import { db } from '../db';
import { SecurityEventSeverity, SecurityEventCategory, NotificationType, UserRole } from '@prisma/client';
import { SecurityEventLogger } from './event-logger';
import { ThreatDetectionService } from './threat-detection';
import { IncidentResponseService } from './incident-response';
import { ThreatIntelligenceService } from './threat-intelligence';
import { SecurityAutomationMetricsService } from './automation-metrics';
import { NotificationService } from '../notification';
import { SessionManager } from './session-manager';

export class SecurityPlaybooks {
  private static async logPlaybookExecution(playbookName: string, targetId: string, details: any) {
    await SecurityAutomationMetricsService.incrementMetric('playbooksExecuted');
    await SecurityEventLogger.log({
      eventType: 'PLAYBOOK_EXECUTED',
      severity: SecurityEventSeverity.LOW,
      category: SecurityEventCategory.SECURITY,
      description: `Security Playbook [${playbookName}] executed successfully on target: ${targetId}.`,
      metadata: { playbookName, targetId, details },
    });
  }

  /**
   * Playbook 1: Credential Stuffing Playbook
   */
  static async runCredentialStuffingPlaybook(ipAddress: string, email: string) {
    try {
      // 1. Flag IP
      await ThreatIntelligenceService.addIndicator('IP', ipAddress, 50, 'Flagged by Credential Stuffing Playbook');

      // 2. Elevate User Risk Score
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        await db.adminTrustProfile.upsert({
          where: { userId: user.id },
          update: { adminRiskScore: { increment: 30 } },
          create: { userId: user.id, adminRiskScore: 30, trustScore: 70 },
        });
      }

      // 3. Create Incident
      const incident = await IncidentResponseService.createIncident({
        title: `Incident: Credential Stuffing Campaign from IP ${ipAddress}`,
        description: `Automated mitigation triggered: Flagged IP ${ipAddress} and elevated risk score due to credential stuffing.`,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.AUTHENTICATION,
      });

      // 4. Notify SOC
      const superAdmins = await db.user.findMany({
        where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
      });
      for (const sa of superAdmins) {
        await NotificationService.create({
          userId: sa.id,
          title: `PLAYBOOK TRIGGERED: Credential Stuffing`,
          message: `Credential Stuffing playbook successfully executed for IP ${ipAddress}. Raised Incident ${incident?.id || ''}.`,
          type: NotificationType.SECURITY,
          link: '/super-admin/security',
        });
      }

      await this.logPlaybookExecution('Credential Stuffing Playbook', ipAddress, { email, incidentId: incident?.id });
      return true;
    } catch (err) {
      console.error('[SecurityPlaybooks.runCredentialStuffingPlaybook Error]', err);
      return false;
    }
  }

  /**
   * Playbook 2: Brute Force Playbook
   */
  static async runBruteForcePlaybook(email: string, ipAddress: string) {
    try {
      // 1. Temporary Lock (Lock account for 1 hour)
      const user = await db.user.findUnique({ where: { email } });
      let locked = false;
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: {
            accountLockedUntil: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            failedLoginAttempts: 0,
          },
        });
        locked = true;
      }

      // 2. Generate Alert
      const alert = await ThreatDetectionService.raiseAlert({
        title: 'Brute Force Mitigation Triggered',
        description: `Brute force alert for email ${email} resolved via playbook. User account locked temporarily.`,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.AUTHENTICATION,
        eventType: 'BRUTE_FORCE_ATTEMPT',
        userEmail: email,
        ipAddress,
        riskScore: 50,
      });

      // 3. Create Incident
      const incident = await IncidentResponseService.createIncident({
        title: `Incident: Brute Force Attempt for ${email}`,
        description: `Brute force attempt detected from IP ${ipAddress}. Account was locked for 1 hour.`,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.AUTHENTICATION,
        alertIds: alert ? [alert.id] : [],
      });

      await this.logPlaybookExecution('Brute Force Playbook', email, { ipAddress, locked, incidentId: incident?.id });
      return true;
    } catch (err) {
      console.error('[SecurityPlaybooks.runBruteForcePlaybook Error]', err);
      return false;
    }
  }

  /**
   * Playbook 3: Impossible Travel Playbook
   */
  static async runImpossibleTravelPlaybook(userId: string, email: string, currentCity: string, previousCity: string) {
    try {
      // 1. Elevate Session Risk
      const lastSession = await db.session.findFirst({
        where: { userId, status: { in: ['ACTIVE', 'SUSPICIOUS'] } },
        orderBy: { lastActivityAt: 'desc' },
      });
      if (lastSession) {
        await db.session.update({
          where: { id: lastSession.id },
          data: {
            status: 'SUSPICIOUS',
            riskScore: 75,
          },
        });
      }

      // 2. Notify User
      await NotificationService.create({
        userId,
        title: 'Security Alert: Impossible Travel Detected',
        message: `We detected a login from ${currentCity} shortly after activity in ${previousCity}. Please verify if this was you.`,
        type: NotificationType.SECURITY,
        link: '/profile',
      });

      // 3. Generate Incident
      const incident = await IncidentResponseService.createIncident({
        title: `Incident: Impossible Travel for ${email}`,
        description: `User traveling from ${previousCity} to ${currentCity} in an impossible timeframe. Raised session risk and notified user.`,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SECURITY,
        eventIds: lastSession ? [lastSession.id] : [],
      });

      await this.logPlaybookExecution('Impossible Travel Playbook', userId, { email, currentCity, previousCity, incidentId: incident?.id });
      return true;
    } catch (err) {
      console.error('[SecurityPlaybooks.runImpossibleTravelPlaybook Error]', err);
      return false;
    }
  }

  /**
   * Playbook 4: Insider Threat Playbook
   */
  static async runInsiderThreatPlaybook(adminId: string, email: string) {
    try {
      // 1. Create Critical Incident
      const incident = await IncidentResponseService.createIncident({
        title: `Incident: Potential Insider Threat from Admin ${email}`,
        description: `Critical Warning: Administrator ${email} triggered an anomalous sequence of sensitive operations (abnormal exports, mass record access, permission updates).`,
        severity: SecurityEventSeverity.CRITICAL,
        category: SecurityEventCategory.ADMIN,
      });

      // 2. Escalate To Super Admin
      const superAdmins = await db.user.findMany({
        where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
      });
      for (const sa of superAdmins) {
        await NotificationService.create({
          userId: sa.id,
          title: `CRITICAL INSIDER THREAT DETECTED`,
          message: `Insider threat playbook executed for Admin ${email}. Critical Incident raised: ${incident?.id || ''}. Immediate audit required.`,
          type: NotificationType.SECURITY,
          link: '/super-admin/security',
        });
      }

      // 3. Preserve Audit Trail
      await SecurityEventLogger.log({
        userId: adminId,
        userEmail: email,
        eventType: 'DATABASE_ACCESS_AUDIT',
        severity: SecurityEventSeverity.CRITICAL,
        category: SecurityEventCategory.ADMIN,
        description: `Sealed audit trail for admin ${email}. Preserved all activity logs under Incident ${incident?.id || 'none'}.`,
        incidentId: incident?.id,
      });

      await this.logPlaybookExecution('Insider Threat Playbook', adminId, { email, incidentId: incident?.id });
      return true;
    } catch (err) {
      console.error('[SecurityPlaybooks.runInsiderThreatPlaybook Error]', err);
      return false;
    }
  }

  /**
   * Playbook 5: Session Hijacking Playbook
   */
  static async runSessionHijackingPlaybook(sessionId: string, userId: string, email: string) {
    try {
      // 1. Revoke suspicious session
      await SessionManager.revokeSession(sessionId, 'SYSTEM_PLAYBOOK');

      // 2. Force session rotation (expire all other active sessions, forcing re-login)
      await db.session.updateMany({
        where: {
          userId,
          id: { not: sessionId },
          status: { in: ['ACTIVE', 'SUSPICIOUS'] },
        },
        data: { status: 'EXPIRED' },
      });

      // 3. Notify affected user
      await NotificationService.create({
        userId,
        title: 'Security Alert: Suspicious Activity Blocked',
        message: 'Your active session was terminated due to a suspected session hijacking attempt. Please login again and review your security settings.',
        type: NotificationType.SECURITY,
        link: '/login',
      });

      // 4. Generate Incident
      const incident = await IncidentResponseService.createIncident({
        title: `Incident: Session Hijacking Suspected for ${email}`,
        description: `Suspected session hijacking on session ${sessionId}. Suspicious session revoked and other sessions expired.`,
        severity: SecurityEventSeverity.CRITICAL,
        category: SecurityEventCategory.SESSION,
      });

      // 5. Generate Security Alert
      const alert = await ThreatDetectionService.raiseAlert({
        title: 'Suspected Session Hijacking Mitigated',
        description: `Suspected session hijacking on session ${sessionId} for user ${email}. Session revoked and playbook triggered.`,
        severity: SecurityEventSeverity.CRITICAL,
        category: SecurityEventCategory.SESSION,
        eventType: 'SESSION_HIJACKING_SUSPECTED',
        userId,
        userEmail: email,
        sessionId,
        riskScore: 90,
        metadata: { sessionId, incidentId: incident?.id },
      });

      if (alert && incident) {
        await db.securityAlert.update({
          where: { id: alert.id },
          data: { incidentId: incident.id },
        });
      }

      await this.logPlaybookExecution('Session Hijacking Playbook', sessionId, { userId, email, incidentId: incident?.id });
      return true;
    } catch (err) {
      console.error('[SecurityPlaybooks.runSessionHijackingPlaybook Error]', err);
      return false;
    }
  }
}
