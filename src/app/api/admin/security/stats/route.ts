import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SessionStatus, UserRole } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';

async function getStatsHandler(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerId = (session.user as any).id;
  const callerRole = (session.user as any).role;
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  // Parse time filter
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || '24h'; // '24h', '7d', '30d'
  
  let hours = 24;
  if (filter === '7d') hours = 24 * 7;
  else if (filter === '30d') hours = 24 * 30;

  const timeLimit = new Date(Date.now() - hours * 60 * 60 * 1000);

  // 1. Fetch counts
  const [
    activeSessionsCount,
    suspiciousSessionsCount,
    failedLoginsCount,
    lockedAccountsCount,
    totalAdminsCount,
    mfaAdminsCount,
    securityAlertsCount,
    totalAlertsCount,
  ] = await Promise.all([
    // Active sessions
    db.session.count({
      where: { status: SessionStatus.ACTIVE },
    }),
    // Suspicious sessions
    db.session.count({
      where: { status: SessionStatus.SUSPICIOUS },
    }),
    // Failed logins via LoginAttempt
    db.loginAttempt.count({
      where: {
        success: false,
        createdAt: { gte: timeLimit },
      },
    }),
    // Locked accounts
    db.user.count({
      where: {
        accountLockedUntil: { gte: new Date() },
      },
    }),
    // Total admins
    db.user.count({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, deletedAt: null },
    }),
    // MFA enabled admins
    db.user.count({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, mfaEnabled: true, deletedAt: null },
    }),
    // Active security alerts
    db.securityAlert.count({
      where: { resolved: false, createdAt: { gte: timeLimit } },
    }),
    // Total security alerts
    db.securityAlert.count({
      where: { createdAt: { gte: timeLimit } },
    }),
  ]);

  // Sensitive actions in the filter time window
  const sensitiveActionsCount = await db.activityLog.count({
    where: {
      action: {
        in: [
          'PROPERTY_DELETE',
          'USER_SUSPEND',
          'ROLE_PROMOTE',
          'ROLE_REVOKE',
          'ADMIN_REVOKED',
          'ADMIN_SUSPENDED',
          'PERMISSION_GRANTED',
          'PERMISSION_REVOKED',
          'SESSION_TERMINATED'
        ],
      },
      createdAt: { gte: timeLimit },
    },
  });

  const mfaAdoptionRate = totalAdminsCount > 0 ? (mfaAdminsCount / totalAdminsCount) * 100 : 0;

  return NextResponse.json({
    activeSessions: activeSessionsCount,
    suspiciousSessions: suspiciousSessionsCount,
    failedLogins: failedLoginsCount,
    lockedAccounts: lockedAccountsCount,
    mfaAdoption: Math.round(mfaAdoptionRate),
    securityAlerts: securityAlertsCount,
    totalAlerts: totalAlertsCount,
    sensitiveActions: sensitiveActionsCount,
  });
}

export const GET = secureApiHandler(getStatsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-stats' },
});
