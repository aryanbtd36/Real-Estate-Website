import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { Permission, UserRole, UserStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
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

    // 1. Fetch counts
    const [
      activeAdminsCount,
      suspendedAdminsCount,
      activeSessionsCount,
      unresolvedAlertsCount,
      totalAlertsCount,
    ] = await Promise.all([
      db.user.count({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      db.user.count({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          status: UserStatus.SUSPENDED,
          deletedAt: null,
        },
      }),
      db.adminSession.count({
        where: { isActive: true },
      }),
      db.securityAlert.count({
        where: { resolved: false },
      }),
      db.securityAlert.count(),
    ]);

    // 2. Compute failed logins simulation
    const failedLoginsCount = await db.activityLog.count({
      where: {
        action: 'PASSWORD_RESET_REQUEST',
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) }, // last 24 hours
      },
    });

    // 3. Count sensitive actions in last 7 days
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
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
      },
    });

    return NextResponse.json({
      activeAdmins: activeAdminsCount,
      suspendedAdmins: suspendedAdminsCount,
      activeSessions: activeSessionsCount,
      failedLogins: failedLoginsCount,
      securityAlerts: unresolvedAlertsCount,
      totalAlerts: totalAlertsCount,
      sensitiveActions: sensitiveActionsCount,
    });
  } catch (error) {
    console.error('[API Admin Security Stats GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
