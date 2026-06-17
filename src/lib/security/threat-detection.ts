import { db } from '../db';
import {
  SecurityEventSeverity,
  SecurityEventCategory,
  SecurityAlertStatus,
  UserRole,
  NotificationType
} from '@prisma/client';
import { SecurityEventLogger } from './event-logger';
import { NotificationService } from '../notification';
import { eventEmitter, EVENTS } from '../events';

export class ThreatDetectionService {
  /**
   * Helper to raise an alert and notify Super Admins
   */
  static async raiseAlert(params: {
    title: string;
    description: string;
    severity: SecurityEventSeverity;
    category: SecurityEventCategory;
    eventType: string;
    userId?: string;
    userEmail?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    riskScore: number;
    metadata?: any;
  }) {
    // 1. Log the security event
    const event = await SecurityEventLogger.log({
      userId: params.userId,
      userEmail: params.userEmail,
      eventType: params.eventType,
      category: params.category,
      severity: params.severity,
      title: params.title,
      description: params.description,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceFingerprint: params.deviceFingerprint,
      riskScore: params.riskScore,
      metadata: params.metadata,
    });

    if (!event) return;

    // 2. Create security alert record
    const alert = await db.securityAlert.create({
      data: {
        title: params.title,
        description: params.description,
        severity: params.severity,
        status: SecurityAlertStatus.OPEN,
        sourceEventId: event.id,
        // legacy compatibility fields
        adminId: params.userId || null,
        type: params.eventType,
        details: params.metadata || null,
        resolved: false,
      },
    });

    // 3. Dispatch notifications to all SUPER_ADMINS
    try {
      const superAdmins = await db.user.findMany({
        where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
        select: { id: true },
      });

      for (const sa of superAdmins) {
        await NotificationService.create({
          userId: sa.id,
          title: `SECURITY SOC WARNING: ${params.severity}`,
          message: params.description,
          type: NotificationType.SECURITY,
          link: '/super-admin/security',
        });
      }
    } catch (err) {
      console.error('[ThreatDetectionService] Failed to notify super admins:', err);
    }

    // 4. Emit event
    eventEmitter.emit(EVENTS.SECURITY_ALERT_CREATED, {
      alertId: alert.id,
      adminId: params.userId || null,
      severity: params.severity,
      description: params.description,
    });

    console.warn(`[THREAT ENGINE] Raised ${params.severity} alert: ${params.description}`);
    return alert;
  }

  /**
   * Check for Failed Login Burst (10 failed attempts within 5 minutes)
   * Check for Credential Stuffing (50 accounts attempted from one IP within 5 minutes)
   */
  static async checkAuthenticationThreats(email: string, ip: string, userAgent: string): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Record failed attempt
      await db.loginAttempt.create({
        data: {
          email,
          ipAddress: ip,
          userAgent,
          success: false,
        },
      });

      // 1. Check Failed Login Burst per Email
      const emailFailures = await db.loginAttempt.count({
        where: {
          email,
          success: false,
          createdAt: { gte: fiveMinutesAgo },
        },
      });

      if (emailFailures >= 10) {
        await this.raiseAlert({
          title: 'Brute Force Attempt Detected',
          description: `Failed login burst: 10 or more login failures detected for email ${email} within 5 minutes.`,
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.AUTHENTICATION,
          eventType: 'BRUTE_FORCE_ATTEMPT',
          userEmail: email,
          ipAddress: ip,
          userAgent,
          riskScore: 50,
          metadata: { emailFailuresCount: emailFailures, email },
        });
      }

      // 2. Check Credential Stuffing per IP
      const uniqueEmailsAttempted = await db.loginAttempt.groupBy({
        by: ['email'],
        where: {
          ipAddress: ip,
          success: false,
          createdAt: { gte: fiveMinutesAgo },
        },
      });

      if (uniqueEmailsAttempted.length >= 50) {
        await this.raiseAlert({
          title: 'Credential Stuffing Attack Detected',
          description: `Credential stuffing: 50 or more unique account attempts made from IP ${ip} within 5 minutes.`,
          severity: SecurityEventSeverity.CRITICAL,
          category: SecurityEventCategory.AUTHENTICATION,
          eventType: 'CREDENTIAL_STUFFING',
          ipAddress: ip,
          userAgent,
          riskScore: 60,
          metadata: { uniqueAccountsCount: uniqueEmailsAttempted.length, ipAddress: ip },
        });
      }
    } catch (err) {
      console.error('[ThreatDetectionService.checkAuthenticationThreats Error]', err);
    }
  }

  /**
   * Check OTP abuse (5 requests/failures in 15 minutes)
   */
  static async checkOtpAbuse(phoneNumber: string, ip: string): Promise<void> {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const otpCount = await db.otpVerification.count({
        where: {
          phoneNumber,
          createdAt: { gte: fifteenMinutesAgo },
        },
      });

      if (otpCount >= 5) {
        await this.raiseAlert({
          title: 'OTP Abuse Flagged',
          description: `OTP abuse: Phone number ${phoneNumber} generated 5 or more OTP codes in 15 minutes.`,
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.AUTHENTICATION,
          eventType: 'OTP_ABUSE',
          ipAddress: ip,
          riskScore: 30,
          metadata: { otpCount, phoneNumber },
        });
      }
    } catch (err) {
      console.error('[ThreatDetectionService.checkOtpAbuse Error]', err);
    }
  }

  /**
   * Check Password Reset Abuse (3 reset requests in 1 hour)
   */
  static async checkPasswordResetAbuse(email: string, ip: string): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const resetAttempts = await db.passwordResetToken.count({
        where: {
          user: { email },
          createdAt: { gte: oneHourAgo },
        },
      });

      if (resetAttempts >= 3) {
        await this.raiseAlert({
          title: 'Password Reset Abuse Flagged',
          description: `Password reset abuse: 3 or more password reset requests made for ${email} within 1 hour.`,
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.AUTHENTICATION,
          eventType: 'PASSWORD_RESET_ABUSE',
          userEmail: email,
          ipAddress: ip,
          riskScore: 30,
          metadata: { resetAttempts, email },
        });
      }
    } catch (err) {
      console.error('[ThreatDetectionService.checkPasswordResetAbuse Error]', err);
    }
  }

  /**
   * Check Admin Anomaly (100 property/lead/appointment modifications within 10 minutes)
   */
  static async checkAdminAnomaly(adminId: string, userEmail: string): Promise<void> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Fetch admin activity counts in the last 10 minutes
      const activityCount = await db.activityLog.count({
        where: {
          actorId: adminId,
          createdAt: { gte: tenMinutesAgo },
          action: {
            in: [
              'PROPERTY_UPDATE',
              'PROPERTY_DELETE',
              'USER_SUSPEND',
              'LEAD_UPDATE',
              'APPOINTMENT_UPDATE',
              'APPOINTMENT_DELETE',
              'ROLE_PROMOTE',
              'ROLE_REVOKE',
              'PERMISSION_GRANTED',
              'PERMISSION_REVOKED',
              'EXPORT_DATA',
            ],
          },
        },
      });

      if (activityCount >= 100) {
        await this.raiseAlert({
          title: 'Administrative Operation Anomaly',
          description: `Admin ${userEmail} triggered a burst of sensitive operations (${activityCount} edits/deletes in 10 minutes).`,
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.ADMIN,
          eventType: 'ADMIN_ANOMALY',
          userId: adminId,
          userEmail,
          riskScore: 50,
          metadata: { activityCount },
        });
      }
    } catch (err) {
      console.error('[ThreatDetectionService.checkAdminAnomaly Error]', err);
    }
  }

  /**
   * Detect Account Takeover risk
   */
  static async checkAccountTakeover(
    userId: string,
    userEmail: string,
    isNewDevice: boolean,
    isNewCountry: boolean,
    ip: string
  ): Promise<boolean> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { passwordChangedAt: true },
      });

      if (!user) return false;

      // 1. Check Password Change + New Device + New Country within 24 hours
      if (user.passwordChangedAt) {
        const timeSincePasswordChange = Date.now() - new Date(user.passwordChangedAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (timeSincePasswordChange <= oneDayMs && isNewDevice && isNewCountry) {
          await this.raiseAlert({
            title: 'Critical Account Takeover Risk',
            description: `Account takeover warning: Password change followed immediately by session creation from a new device and a new country for ${userEmail}.`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.AUTHENTICATION,
            eventType: 'ACCOUNT_TAKEOVER_RISK',
            userId,
            userEmail,
            ipAddress: ip,
            riskScore: 70,
            metadata: { isNewDevice, isNewCountry, timeSincePasswordChangeMs: timeSincePasswordChange },
          });
          return true;
        }
      }

      // 2. Check Password Reset + New Device + Session Creation within 24 hours
      const lastReset = await db.passwordResetToken.findFirst({
        where: {
          userId,
          usedAt: { not: null },
        },
        orderBy: { usedAt: 'desc' },
      });

      if (lastReset && lastReset.usedAt) {
        const timeSinceReset = Date.now() - new Date(lastReset.usedAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (timeSinceReset <= oneDayMs && isNewDevice) {
          await this.raiseAlert({
            title: 'Account Takeover Reset Pattern Detected',
            description: `Account takeover warning: Password reset followed immediately by login from a new device for ${userEmail}.`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.AUTHENTICATION,
            eventType: 'ACCOUNT_TAKEOVER_RISK',
            userId,
            userEmail,
            ipAddress: ip,
            riskScore: 70,
            metadata: { isNewDevice, timeSinceResetMs: timeSinceReset },
          });
          return true;
        }
      }
    } catch (err) {
      console.error('[ThreatDetectionService.checkAccountTakeover Error]', err);
    }
    return false;
  }
}
