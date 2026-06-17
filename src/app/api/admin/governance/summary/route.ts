import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { UserRole, UserStatus, LegacyPermission as Permission } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate and enforce Founder only
    const authResult = await requireFounderSuperAdmin(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 2. Fetch registries & histories
    const [
      primarySAs,
      governanceHistory,
      securityAlerts,
      settingsList,
      totalUsersCount,
      totalAdminsCount,
    ] = await Promise.all([
      db.user.findMany({
        where: { role: UserRole.SUPER_ADMIN, isPrimarySA: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          promotedAt: true,
          promotedBy: { select: { name: true, email: true } },
        },
      }),
      db.governanceHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.securityAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { admin: { select: { name: true, email: true } } },
      }),
      db.systemSetting.findMany(),
      db.user.count({ where: { role: UserRole.USER, deletedAt: null } }),
      db.user.count({ where: { role: UserRole.ADMIN, deletedAt: null } }),
    ]);

    const settings = settingsList.reduce((acc, curr) => {
      acc[curr.key] = curr.value === 'true';
      return acc;
    }, {} as Record<string, boolean>);

    // 3. Founder status & integrity checks
    const founderEmail = process.env.FOUNDER_SUPER_ADMIN_EMAIL || 'aryanmishra8113@gmail.com';
    const founder = await db.user.findUnique({
      where: { email: founderEmail },
      include: { adminPermissions: true },
    });

    const isFounderActive = founder?.status === UserStatus.ACTIVE;
    const isFounderRoleIntact = founder?.role === UserRole.SUPER_ADMIN && founder?.isFounder;
    const isFounderLockEnabled = !!founder?.governanceLocked;
    const isFounderPermissionsIntact =
      founder?.adminPermissions.length === Object.keys(Permission).length;

    const founderIntegrity = {
      email: founderEmail,
      exists: !!founder,
      active: isFounderActive,
      roleIntact: isFounderRoleIntact,
      lockEnabled: isFounderLockEnabled,
      permissionsIntact: isFounderPermissionsIntact,
    };

    // 4. Primary SA count checks
    const psaCount = primarySAs.length;
    const isPsaIntact = psaCount >= 1;

    const systemIntegrity = {
      founderStatus: founderIntegrity,
      primarySACount: psaCount,
      primarySAIntact: isPsaIntact,
      healthScore: isFounderActive && isPsaIntact && isFounderLockEnabled ? 100 : 75,
    };

    return NextResponse.json({
      primarySAs,
      governanceHistory,
      securityAlerts,
      settings: {
        global_lockdown: !!settings['global_lockdown'],
        read_only: !!settings['read_only'],
        maintenance_mode: !!settings['maintenance_mode'],
      },
      stats: {
        totalUsers: totalUsersCount,
        totalAdmins: totalAdminsCount,
        totalPrimarySAs: psaCount,
      },
      systemIntegrity,
    });
  } catch (error: any) {
    console.error('[API Governance Summary GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
