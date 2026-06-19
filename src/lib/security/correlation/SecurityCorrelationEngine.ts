import { db } from '../../db';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { SecurityEventLogger } from '../event-logger';
import { ThreatDetectionService } from '../threat-detection';
import { IncidentResponseService } from '../incident-response';
import { SecurityPlaybooks } from '../playbooks';
import { SecurityAutomationMetricsService } from '../automation-metrics';

export class SecurityCorrelationEngine {
  /**
   * Main entry point called automatically by SecurityEventLogger.log
   */
  static async analyzeEvent(event: any): Promise<void> {
    try {
      // Avoid correlation loops on our own correlated findings
      if (
        event.eventType === 'ACCOUNT_TAKEOVER_ATTEMPT' ||
        event.eventType === 'ACCOUNT_COMPROMISE_SUSPECTED' ||
        event.eventType === 'POTENTIAL_INSIDER_THREAT' ||
        event.eventType === 'AUTOMATED_ATTACK_CAMPAIGN' ||
        event.eventType === 'SESSION_HIJACKING_SUSPECTED'
      ) {
        return;
      }

      await Promise.all([
        this.checkLoginFailureBurst(event),
        this.checkImpossibleTravelChain(event),
        this.checkAdminAbusePattern(event),
        this.checkBotAttackCorrelation(event),
        this.checkSessionHijackingSuspected(event),
      ]);
    } catch (err) {
      console.error('[SecurityCorrelationEngine.analyzeEvent Error]', err);
    }
  }

  /**
   * Rule 1: Login Failure Burst
   * Bursts of failures + stuffings + new devices for same IP or userEmail within 15 mins
   */
  private static async checkLoginFailureBurst(event: any) {
    const email = event.userEmail;
    const ip = event.ipAddress;
    if (!email && !ip) return;

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const matchEmail = email ? { userEmail: email } : {};
    const matchIp = ip ? { ipAddress: ip } : {};

    // Get recent events in window matching either email or IP
    const events = await db.securityEvent.findMany({
      where: {
        OR: [
          email ? { userEmail: email } : null,
          ip ? { ipAddress: ip } : null,
        ].filter(Boolean) as any,
        createdAt: { gte: fifteenMinsAgo },
      },
    });

    const failedLogins = events.filter(
      (e) =>
        e.eventType === 'Login Failed' ||
        e.eventType === 'AUTH_LOGIN_FAILURE'
    );
    const credentialStuffing = events.some(
      (e) => e.eventType === 'CREDENTIAL_STUFFING'
    );
    const newDevice = events.some((e) => e.eventType === 'NEW_DEVICE_LOGIN');

    // Correlation criteria
    if (failedLogins.length >= 3 && credentialStuffing && newDevice) {
      // Check if we already raised this alert in the last 15 mins to avoid spam
      const alreadyRaised = await db.securityAlert.findFirst({
        where: {
          type: 'ACCOUNT_TAKEOVER_ATTEMPT',
          createdAt: { gte: fifteenMinsAgo },
          description: { contains: email || ip },
        },
      });

      if (!alreadyRaised) {
        // Increment metrics
        await SecurityAutomationMetricsService.incrementMetric('alertsCorrelated');

        // Log correlated event
        const correlationEvent = await SecurityEventLogger.log({
          eventType: 'ACCOUNT_TAKEOVER_ATTEMPT',
          severity: SecurityEventSeverity.CRITICAL,
          category: SecurityEventCategory.AUTHENTICATION,
          title: 'Account Takeover Attempt',
          description: `Correlated threat chain [Login Failure Burst] matched for user ${email || 'unknown'} from IP ${ip || 'unknown'}.`,
          userEmail: email || undefined,
          ipAddress: ip || undefined,
          riskScore: 95,
          metadata: { failedLoginsCount: failedLogins.length, credentialStuffing, newDevice, correlated: true },
        });

        if (correlationEvent) {
          // Raise Alert
          const alert = await ThreatDetectionService.raiseAlert({
            title: 'Critical Account Takeover Attempt Detected',
            description: `Correlated threat chain [Login Failure Burst] matched: multiple failed logins, credential stuffing, and new device detected for ${email || ip}.`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.AUTHENTICATION,
            eventType: 'ACCOUNT_TAKEOVER_ATTEMPT',
            userEmail: email || undefined,
            ipAddress: ip || undefined,
            riskScore: 95,
            metadata: { correlationEventId: correlationEvent.id, correlated: true },
          });

          // Create Incident
          const incident = await IncidentResponseService.createIncident({
            title: `Incident: Account Takeover Attempt for ${email || ip}`,
            description: `Correlated Login Failure Burst pattern matched. User ${email || 'unknown'} from IP ${ip || 'unknown'}.`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.AUTHENTICATION,
            alertIds: alert ? [alert.id] : [],
            eventIds: [correlationEvent.id],
          });

          // Trigger Playbook
          if (ip) {
            await SecurityPlaybooks.runCredentialStuffingPlaybook(ip, email || '');
          }
        }
      }
    }
  }

  /**
   * Rule 2: Impossible Travel Chain
   * Login + Country Change + Impossible Travel for same user/session within 30 mins
   */
  private static async checkImpossibleTravelChain(event: any) {
    const userId = event.userId;
    const sessionId = event.sessionId;
    if (!userId) return;

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const events = await db.securityEvent.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyMinsAgo },
      },
    });

    const logins = events.some(
      (e) =>
        e.eventType === 'Login Success' ||
        e.eventType === 'Login Failed' ||
        e.eventType === 'AUTH_LOGIN_SUCCESS' ||
        e.eventType === 'AUTH_LOGIN_FAILURE'
    );
    const countryChange = events.some(
      (e) =>
        e.eventType === 'LOCATION_ANOMALY' &&
        e.description.includes('country')
    );
    const impossibleTravel = events.some(
      (e) => e.eventType === 'IMPOSSIBLE_TRAVEL'
    );

    if (logins && countryChange && impossibleTravel) {
      const alreadyRaised = await db.securityAlert.findFirst({
        where: {
          type: 'ACCOUNT_COMPROMISE_SUSPECTED',
          createdAt: { gte: thirtyMinsAgo },
          adminId: userId,
        },
      });

      if (!alreadyRaised) {
        await SecurityAutomationMetricsService.incrementMetric('alertsCorrelated');

        const correlationEvent = await SecurityEventLogger.log({
          eventType: 'ACCOUNT_COMPROMISE_SUSPECTED',
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.SECURITY,
          title: 'Account Compromise Suspected',
          description: `Correlated threat chain [Impossible Travel Chain] matched for user ${userId}.`,
          userId,
          sessionId: sessionId || undefined,
          userEmail: event.userEmail || undefined,
          riskScore: 85,
          metadata: { logins, countryChange, impossibleTravel, correlated: true },
        });

        if (correlationEvent) {
          const alert = await ThreatDetectionService.raiseAlert({
            title: 'Suspicious Impossible Travel Activity Chain',
            description: `Correlated chain [Impossible Travel] matched: Login followed by country change and flight speed limit violation for user ${event.userEmail || userId}.`,
            severity: SecurityEventSeverity.HIGH,
            category: SecurityEventCategory.SECURITY,
            eventType: 'ACCOUNT_COMPROMISE_SUSPECTED',
            userId,
            userEmail: event.userEmail || undefined,
            riskScore: 85,
            metadata: { correlationEventId: correlationEvent.id, correlated: true },
          });

          const incident = await IncidentResponseService.createIncident({
            title: `Incident: Suspected Account Compromise for ${event.userEmail || userId}`,
            description: `Correlated Impossible Travel pattern matched. Login, Country Change and Speed violation detected in 30 minutes.`,
            severity: SecurityEventSeverity.HIGH,
            category: SecurityEventCategory.SECURITY,
            alertIds: alert ? [alert.id] : [],
            eventIds: [correlationEvent.id],
          });

          // Run Playbook
          await SecurityPlaybooks.runImpossibleTravelPlaybook(userId, event.userEmail || '', 'Current', 'Previous');
        }
      }
    }
  }

  /**
   * Rule 3: Admin Abuse Pattern
   * Admin Login + Mass Export + Mass Record Access + Permission Changes for same admin within 30 mins
   */
  private static async checkAdminAbusePattern(event: any) {
    const adminId = event.userId;
    const email = event.userEmail;
    if (!adminId || event.userRole === 'USER') return;

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const events = await db.securityEvent.findMany({
      where: {
        userId: adminId,
        createdAt: { gte: thirtyMinsAgo },
      },
    });

    const hasLogin = events.some(
      (e) =>
        e.eventType === 'Login Success' ||
        e.eventType === 'AUTH_LOGIN_SUCCESS' ||
        e.eventType === 'SESSION_CREATED'
    );
    const hasExport = events.some(
      (e) =>
        e.eventType === 'EXPORT_DATA' ||
        e.eventType === 'EXPORT_ABUSE' ||
        e.category === SecurityEventCategory.EXPORT
    );
    const hasRecordAccess = events.some(
      (e) =>
        e.eventType === 'DATABASE_ACCESS_AUDIT' ||
        e.eventType === 'ADMIN_ANOMALY' ||
        e.category === SecurityEventCategory.ADMIN
    );
    const hasPermissionChange = events.some(
      (e) =>
        e.eventType === 'PERMISSION_GRANTED' ||
        e.eventType === 'PERMISSION_REVOKED' ||
        e.eventType === 'ROLE_PROMOTE' ||
        e.eventType === 'ROLE_REVOKE'
    );

    if (hasLogin && hasExport && hasRecordAccess && hasPermissionChange) {
      const alreadyRaised = await db.securityAlert.findFirst({
        where: {
          type: 'POTENTIAL_INSIDER_THREAT',
          createdAt: { gte: thirtyMinsAgo },
          adminId,
        },
      });

      if (!alreadyRaised) {
        await SecurityAutomationMetricsService.incrementMetric('alertsCorrelated');

        const correlationEvent = await SecurityEventLogger.log({
          eventType: 'POTENTIAL_INSIDER_THREAT',
          severity: SecurityEventSeverity.CRITICAL,
          category: SecurityEventCategory.ADMIN,
          title: 'Potential Insider Threat',
          description: `Correlated threat chain [Admin Abuse Pattern] matched for administrator ${email || adminId}.`,
          userId: adminId,
          userEmail: email || undefined,
          riskScore: 95,
          metadata: { hasLogin, hasExport, hasRecordAccess, hasPermissionChange, correlated: true },
        });

        if (correlationEvent) {
          const alert = await ThreatDetectionService.raiseAlert({
            title: 'Critical Potential Insider Threat Detected',
            description: `Correlated chain [Admin Abuse Pattern] matched: login, data export, mass record modifications, and privilege adjustments made in 30 minutes by admin ${email || adminId}.`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.ADMIN,
            eventType: 'POTENTIAL_INSIDER_THREAT',
            userId: adminId,
            userEmail: email || undefined,
            riskScore: 95,
            metadata: { correlationEventId: correlationEvent.id, correlated: true },
          });

          const incident = await IncidentResponseService.createIncident({
            title: `Incident: Admin Abuse / Insider Threat for ${email || adminId}`,
            description: `Correlated Admin Abuse pattern matched. Sensitive sequences executed by ${email || adminId}.`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.ADMIN,
            alertIds: alert ? [alert.id] : [],
            eventIds: [correlationEvent.id],
          });

          // Run Playbook
          await SecurityPlaybooks.runInsiderThreatPlaybook(adminId, email || '');
        }
      }
    }
  }

  /**
   * Rule 4: Bot Attack Correlation
   * OTP Abuse + Password Reset Abuse + Rate Limit Events from same IP within 30 mins
   */
  private static async checkBotAttackCorrelation(event: any) {
    const ip = event.ipAddress;
    if (!ip) return;

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const events = await db.securityEvent.findMany({
      where: {
        ipAddress: ip,
        createdAt: { gte: thirtyMinsAgo },
      },
    });

    const otpAbuse = events.some((e) => e.eventType === 'OTP_ABUSE');
    const passwordReset = events.some((e) => e.eventType === 'PASSWORD_RESET_ABUSE');
    const rateLimits = events.some(
      (e) =>
        e.eventType === 'RATE_LIMIT_TRIGGERED' ||
        e.eventType === 'RATE_LIMIT_VIOLATION'
    );

    if (otpAbuse && passwordReset && rateLimits) {
      const alreadyRaised = await db.securityAlert.findFirst({
        where: {
          type: 'AUTOMATED_ATTACK_CAMPAIGN',
          createdAt: { gte: thirtyMinsAgo },
          description: { contains: ip },
        },
      });

      if (!alreadyRaised) {
        await SecurityAutomationMetricsService.incrementMetric('alertsCorrelated');

        const correlationEvent = await SecurityEventLogger.log({
          eventType: 'AUTOMATED_ATTACK_CAMPAIGN',
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.AUTHENTICATION,
          title: 'Automated Attack Campaign',
          description: `Correlated threat chain [Bot Attack Correlation] matched for IP ${ip}.`,
          ipAddress: ip,
          riskScore: 80,
          metadata: { otpAbuse, passwordReset, rateLimits, correlated: true },
        });

        if (correlationEvent) {
          const alert = await ThreatDetectionService.raiseAlert({
            title: 'Automated Bot Attack Campaign Detected',
            description: `Correlated chain [Bot Attack] matched: OTP abuse, password reset spam, and rate limiting triggered from IP ${ip}.`,
            severity: SecurityEventSeverity.HIGH,
            category: SecurityEventCategory.AUTHENTICATION,
            eventType: 'AUTOMATED_ATTACK_CAMPAIGN',
            ipAddress: ip,
            riskScore: 80,
            metadata: { correlationEventId: correlationEvent.id, correlated: true },
          });

          const incident = await IncidentResponseService.createIncident({
            title: `Incident: Bot Attack Campaign from IP ${ip}`,
            description: `Correlated Bot Attack pattern matched: spamming OTP/resets under rate limits from IP ${ip}.`,
            severity: SecurityEventSeverity.HIGH,
            category: SecurityEventCategory.AUTHENTICATION,
            alertIds: alert ? [alert.id] : [],
            eventIds: [correlationEvent.id],
          });

          // Run Playbook (runs stuffing playbook which flags IP)
          await SecurityPlaybooks.runCredentialStuffingPlaybook(ip, '');
        }
      }
    }
  }

  /**
   * Rule 5: Session Hijacking Suspected
   * Session Risk Spike + New Device Detected + Geographic Change + Session Rotation Anomaly within 15 mins for same sessionId
   */
  private static async checkSessionHijackingSuspected(event: any) {
    const sessionId = event.sessionId;
    const userId = event.userId;
    if (!sessionId || !userId) return;

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const events = await db.securityEvent.findMany({
      where: {
        sessionId,
        createdAt: { gte: fifteenMinsAgo },
      },
    });

    const sessionRiskSpike = events.some(
      (e) =>
        (e.eventType === 'SUSPICIOUS_SESSION' && e.riskScore >= 60) ||
        (e.eventType === 'BEHAVIORAL_ANOMALY' && e.riskScore >= 15)
    );
    const newDevice = events.some((e) => e.eventType === 'NEW_DEVICE_LOGIN');
    const geoChange = events.some(
      (e) =>
        e.eventType === 'LOCATION_ANOMALY' ||
        e.eventType === 'IMPOSSIBLE_TRAVEL'
    );
    const rotationAnomaly = events.some(
      (e) =>
        e.eventType === 'Session Rotated' ||
        e.eventType === 'SESSION_ROTATED'
    );

    if (sessionRiskSpike && newDevice && geoChange && rotationAnomaly) {
      const alreadyRaised = await db.securityAlert.findFirst({
        where: {
          type: 'SESSION_HIJACKING_SUSPECTED',
          createdAt: { gte: fifteenMinsAgo },
          description: { contains: sessionId },
        },
      });

      if (!alreadyRaised) {
        await SecurityAutomationMetricsService.incrementMetric('alertsCorrelated');

        const correlationEvent = await SecurityEventLogger.log({
          eventType: 'SESSION_HIJACKING_SUSPECTED',
          severity: SecurityEventSeverity.CRITICAL,
          category: SecurityEventCategory.SESSION,
          title: 'Session Hijacking Suspected',
          description: `Correlated threat chain [Session Hijacking Suspected] matched for session ${sessionId}.`,
          userId,
          userEmail: event.userEmail || undefined,
          sessionId,
          riskScore: 90,
          metadata: { sessionRiskSpike, newDevice, geoChange, rotationAnomaly, correlated: true },
        });

        if (correlationEvent) {
          // Playbook automatically generates alert, incident, notifies user, and revokes session
          await SecurityPlaybooks.runSessionHijackingPlaybook(
            sessionId,
            userId,
            event.userEmail || ''
          );

          // Elevate User Risk Score
          await db.adminTrustProfile.upsert({
            where: { userId },
            update: { adminRiskScore: { increment: 40 } },
            create: { userId, adminRiskScore: 40, trustScore: 60 },
          });
        }
      }
    }
  }
}
