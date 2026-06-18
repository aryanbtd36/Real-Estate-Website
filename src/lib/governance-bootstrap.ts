import { PrismaClient, UserRole, UserStatus, LegacyPermission as Permission } from '@prisma/client';

export async function bootstrapGovernance(db: PrismaClient) {
  try {
    const founderEmail = process.env.FOUNDER_SUPER_ADMIN_EMAIL || 'aryanmishra8113@gmail.com';
    const primarySAEmail = process.env.PRIMARY_SUPER_ADMIN_EMAIL || 'mishraaryan3662@gmail.com';

    console.log(`[BOOTSTRAP] Validating governance accounts (Founder: ${founderEmail}, Primary SA: ${primarySAEmail})...`);

    // 1. Founder Validation & Auto-Repair
    let founder = await db.user.findUnique({
      where: { email: founderEmail },
      include: { adminPermissions: true },
    });

    const allPermissions = Object.values(Permission);
    let founderRepaired = false;
    const repairedFields: string[] = [];

    if (!founder) {
      console.log(`[BOOTSTRAP] Founder account not found. Bootstrapping new account.`);
      founder = await db.user.create({
        data: {
          email: founderEmail,
          name: 'Aryan Mishra',
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          isFounder: true,
          isPrimarySA: false,
          governanceLocked: true,
        },
        include: { adminPermissions: true },
      });
      founderRepaired = true;
      repairedFields.push('account_creation');
    } else {
      const updates: any = {};
      if (founder.role !== UserRole.SUPER_ADMIN) {
        updates.role = UserRole.SUPER_ADMIN;
        repairedFields.push('role');
      }
      if (founder.status !== UserStatus.ACTIVE) {
        updates.status = UserStatus.ACTIVE;
        repairedFields.push('status');
      }
      if (!founder.isFounder) {
        updates.isFounder = true;
        repairedFields.push('isFounder');
      }
      if (!founder.governanceLocked) {
        updates.governanceLocked = true;
        repairedFields.push('governanceLocked');
      }

      if (Object.keys(updates).length > 0) {
        console.log(`[BOOTSTRAP] Repairing Founder account attributes:`, Object.keys(updates));
        founder = await db.user.update({
          where: { id: founder.id },
          data: updates,
          include: { adminPermissions: true },
        });
        founderRepaired = true;
      }
    }

    // Verify founder permissions are intact
    const existingPerms = founder.adminPermissions.map((p) => p.permission);
    const missingPerms = allPermissions.filter((p) => !existingPerms.includes(p));

    if (missingPerms.length > 0) {
      console.log(`[BOOTSTRAP] Restoring ${missingPerms.length} missing permissions for Founder...`);
      await db.adminPermission.createMany({
        data: missingPerms.map(perm => ({
          userId: founder!.id,
          permission: perm,
        })),
        skipDuplicates: true,
      });
      founderRepaired = true;
      repairedFields.push('permissions_restored');
    }

    // Log Founder governance restoration event if repaired
    if (founderRepaired) {
      console.log(`[BOOTSTRAP] Founder account repaired. Logging governance restoration event.`);
      await db.governanceHistory.create({
        data: {
          targetUserId: founder.id,
          actorId: 'SYSTEM_BOOTSTRAP',
          previousRole: UserRole.SUPER_ADMIN,
          newRole: UserRole.SUPER_ADMIN,
          reason: 'Auto-restored Founder account/permissions during startup check',
          metadata: { repairedFields },
        },
      });

      await db.activityLog.create({
        data: {
          actorId: null,
          targetUserId: founder.id,
          action: 'SYSTEM_EVENT',
          description: `Founder account restored. Repaired attributes: ${repairedFields.join(', ')}`,
        },
      });
    }

    // 2. Primary SA Validation & Auto-Repair
    let primarySA = await db.user.findUnique({
      where: { email: primarySAEmail },
      include: { adminPermissions: true },
    });

    let primarySARepaired = false;
    const saRepairedFields: string[] = [];

    if (!primarySA) {
      console.log(`[BOOTSTRAP] Primary SA account not found. Bootstrapping new account.`);
      primarySA = await db.user.create({
        data: {
          email: primarySAEmail,
          name: 'Primary SA',
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          isFounder: false,
          isPrimarySA: true,
          governanceLocked: false,
        },
        include: { adminPermissions: true },
      });
      primarySARepaired = true;
      saRepairedFields.push('account_creation');
    } else {
      const saUpdates: any = {};
      if (primarySA.role !== UserRole.SUPER_ADMIN) {
        saUpdates.role = UserRole.SUPER_ADMIN;
        saRepairedFields.push('role');
      }
      if (primarySA.status !== UserStatus.ACTIVE) {
        saUpdates.status = UserStatus.ACTIVE;
        saRepairedFields.push('status');
      }
      if (!primarySA.isPrimarySA) {
        saUpdates.isPrimarySA = true;
        saRepairedFields.push('isPrimarySA');
      }

      if (Object.keys(saUpdates).length > 0) {
        console.log(`[BOOTSTRAP] Repairing Primary SA account attributes:`, Object.keys(saUpdates));
        primarySA = await db.user.update({
          where: { id: primarySA.id },
          data: saUpdates,
          include: { adminPermissions: true },
        });
        primarySARepaired = true;
      }
    }

    // Ensure Primary SA permissions are intact
    const existingSAPerms = primarySA.adminPermissions.map((p) => p.permission);
    const missingSAPerms = allPermissions.filter((p) => !existingSAPerms.includes(p));

    if (missingSAPerms.length > 0) {
      console.log(`[BOOTSTRAP] Restoring ${missingSAPerms.length} missing permissions for Primary SA...`);
      await db.adminPermission.createMany({
        data: missingSAPerms.map(perm => ({
          userId: primarySA!.id,
          permission: perm,
        })),
        skipDuplicates: true,
      });
      primarySARepaired = true;
      saRepairedFields.push('permissions_restored');
    }

    if (primarySARepaired) {
      console.log(`[BOOTSTRAP] Primary SA account repaired.`);
      await db.activityLog.create({
        data: {
          actorId: null,
          targetUserId: primarySA.id,
          action: 'SYSTEM_EVENT',
          description: `Primary SA account restored. Repaired attributes: ${saRepairedFields.join(', ')}`,
        },
      });
    }

    // 3. Seed RBAC permissions and RolePermission mappings
    console.log('[BOOTSTRAP] Seeding database-driven RBAC permissions...');
    const permissionsToSeed = [
      'ADMIN_PROMOTE',
      'ADMIN_DEMOTE',
      'VIEW_ANALYTICS',
      'MANAGE_PROPERTIES',
      'MANAGE_LEADS',
      'MANAGE_APPOINTMENTS',
      'MANAGE_USERS',
      'VIEW_SECURITY',
      'VIEW_AUDITS',
      'VIEW_FINANCIALS',
      'EXPORT_DATA',
      'MANAGE_CONTENT',
      'MANAGE_SETTINGS',
      'MANAGE_ADMINS'
    ];

    const existingDbPerms = await db.permission.findMany({
      where: { name: { in: permissionsToSeed } }
    });
    const existingDbPermNames = new Set(existingDbPerms.map(p => p.name));
    const missingDbPerms = permissionsToSeed.filter(name => !existingDbPermNames.has(name));
    if (missingDbPerms.length > 0) {
      await db.permission.createMany({
        data: missingDbPerms.map(name => ({ name })),
        skipDuplicates: true,
      });
    }

    const dbPermissions = await db.permission.findMany();
    const permMap = dbPermissions.reduce((acc, curr) => {
      acc[curr.name] = curr.id;
      return acc;
    }, {} as Record<string, string>);

    const adminRolePermissions = [
      'VIEW_ANALYTICS',
      'MANAGE_PROPERTIES',
      'MANAGE_LEADS',
      'MANAGE_APPOINTMENTS',
      'EXPORT_DATA'
    ];

    const existingRolePerms = await db.rolePermission.findMany({
      where: {
        OR: [
          { role: UserRole.ADMIN },
          { role: UserRole.SUPER_ADMIN }
        ]
      }
    });

    const existingRolePermSet = new Set(
      existingRolePerms.map(rp => `${rp.role}:${rp.permissionId}`)
    );

    const rolePermsToCreate: { role: UserRole; permissionId: string }[] = [];

    // Admin permissions
    for (const permName of adminRolePermissions) {
      const permissionId = permMap[permName];
      if (permissionId && !existingRolePermSet.has(`${UserRole.ADMIN}:${permissionId}`)) {
        rolePermsToCreate.push({ role: UserRole.ADMIN, permissionId });
      }
    }

    // Super Admin permissions
    for (const permName of permissionsToSeed) {
      const permissionId = permMap[permName];
      if (permissionId && !existingRolePermSet.has(`${UserRole.SUPER_ADMIN}:${permissionId}`)) {
        rolePermsToCreate.push({ role: UserRole.SUPER_ADMIN, permissionId });
      }
    }

    if (rolePermsToCreate.length > 0) {
      await db.rolePermission.createMany({
        data: rolePermsToCreate,
        skipDuplicates: true,
      });
    }

    console.log('[BOOTSTRAP] Governance accounts verification complete.');
  } catch (error) {
    console.error('[BOOTSTRAP ERROR] Failed to bootstrap governance accounts:', error);
  }
}
