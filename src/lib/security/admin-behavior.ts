import { db } from '../db';
import { AlertSeverity, NotificationType, UserRole } from '@prisma/client';
import { NotificationService } from '../notification';
import { eventEmitter, EVENTS } from '../events';

/**
 * Analyzes admin actions for suspicious behavior and generates alerts.
 * This is triggered upon sensitive actions or scheduled security scans.
 */
export async function analyzeAdminBehavior(adminId: string): Promise<void> {
  try {
    const admin = await db.user.findUnique({
      where: { id: adminId },
      select: { email: true, name: true, role: true },
    });

    if (!admin) return;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Check for Mass Property Deletion (>3 deletions within 5 minutes)
    const propertyDeletions = await db.activityLog.count({
      where: {
        actorId: adminId,
        action: 'PROPERTY_DELETE',
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (propertyDeletions >= 3) {
      await raiseSecurityAlert({
        adminId,
        type: 'MASS_PROPERTY_DELETION',
        severity: AlertSeverity.CRITICAL,
        description: `Potential compromise: Administrator ${admin.email} deleted ${propertyDeletions} properties in the last 5 minutes.`,
        details: { deletionsCount: propertyDeletions },
      });
    }

    // 2. Check for Mass User Modifications / Suspensions (>3 within 5 minutes)
    const userModifications = await db.activityLog.count({
      where: {
        actorId: adminId,
        action: 'USER_SUSPEND',
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (userModifications >= 3) {
      await raiseSecurityAlert({
        adminId,
        type: 'MASS_USER_MODIFICATION',
        severity: AlertSeverity.HIGH,
        description: `Suspicious activity: Administrator ${admin.email} suspended ${userModifications} client profiles in the last 5 minutes.`,
        details: { suspensionsCount: userModifications },
      });
    }

    // 3. Check for Excessive Exports (>3 exports in last 24 hours / 5 minutes)
    const dataExports = await db.activityLog.count({
      where: {
        actorId: adminId,
        action: 'EXPORT_DATA', // Let's check for EXPORT_DATA action
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (dataExports >= 3) {
      await raiseSecurityAlert({
        adminId,
        type: 'EXCESSIVE_EXPORTS',
        severity: AlertSeverity.HIGH,
        description: `Data Exfiltration Alert: Administrator ${admin.email} requested ${dataExports} Excel/CSV reports in 5 minutes.`,
        details: { exportsCount: dataExports },
      });
    }

    // 4. Check for Unusual Login Times (Logins between 11:00 PM and 5:00 AM)
    const latestLoginLog = await db.activityLog.findFirst({
      where: {
        actorId: adminId,
        action: 'LOGIN',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestLoginLog) {
      const loginHour = new Date(latestLoginLog.createdAt).getHours();
      if (loginHour >= 23 || loginHour < 5) {
        // Check if we already alerted for this today
        const existingTimeAlert = await db.securityAlert.findFirst({
          where: {
            adminId,
            type: 'UNUSUAL_LOGIN_TIME',
            createdAt: { gte: todayStart },
          },
        });

        if (!existingTimeAlert) {
          await raiseSecurityAlert({
            adminId,
            type: 'UNUSUAL_LOGIN_TIME',
            severity: AlertSeverity.MEDIUM,
            description: `Off-hours access: Administrator ${admin.email} logged in at an unusual hour (${loginHour}:00).`,
            details: { loginHour },
          });
        }
      }
    }

    // 5. Check for Activity Bursts (>15 actions within 5 minutes)
    const recentActions = await db.activityLog.count({
      where: {
        actorId: adminId,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentActions >= 15) {
      const existingBurstAlert = await db.securityAlert.findFirst({
        where: {
          adminId,
          type: 'SUSPICIOUS_BURST',
          createdAt: { gte: fiveMinutesAgo },
        },
      });

      if (!existingBurstAlert) {
        await raiseSecurityAlert({
          adminId,
          type: 'SUSPICIOUS_BURST',
          severity: AlertSeverity.MEDIUM,
          description: `Rapid operations burst: Administrator ${admin.email} triggered ${recentActions} operations within 5 minutes.`,
          details: { actionsCount: recentActions },
        });
      }
    }

  } catch (error) {
    console.error('[analyzeAdminBehavior] Error running checks:', error);
  }
}

interface RaiseAlertParams {
  adminId: string;
  type: string;
  severity: AlertSeverity;
  description: string;
  details?: any;
}

async function raiseSecurityAlert({ adminId, type, severity, description, details }: RaiseAlertParams) {
  try {
    // 1. Create alert entry
    const alert = await db.securityAlert.create({
      data: {
        adminId,
        type,
        severity,
        description,
        details: details || null,
      },
    });

    // 2. Dispatch notifications to all SUPER_ADMINS
    const superAdmins = await db.user.findMany({
      where: { role: { in: [UserRole.PRIMARY_SUPER_ADMIN, UserRole.FOUNDER_SUPER_ADMIN] }, deletedAt: null },
      select: { id: true },
    });

    for (const sa of superAdmins) {
      await NotificationService.create({
        userId: sa.id,
        title: `SECURITY BREACH WARNING: ${severity}`,
        message: description,
        type: NotificationType.SECURITY,
        link: '/admin/security',
      });
    }

    // 3. Emit event
    eventEmitter.emit(EVENTS.SECURITY_ALERT_CREATED, {
      alertId: alert.id,
      adminId,
      severity,
      description,
    });

    console.warn(`[SECURITY SOC MONITOR] Generated ${severity} alert for admin ${adminId}: ${description}`);
  } catch (err) {
    console.error('[raiseSecurityAlert] Failed to write warning:', err);
  }
}
