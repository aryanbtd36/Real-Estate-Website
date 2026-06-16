import { PrismaClient, UserRole, UserStatus, Permission } from '@prisma/client';

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
          role: UserRole.FOUNDER_SUPER_ADMIN,
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
      if (founder.role !== UserRole.FOUNDER_SUPER_ADMIN) {
        updates.role = UserRole.FOUNDER_SUPER_ADMIN;
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
      for (const perm of missingPerms) {
        await db.adminPermission.upsert({
          where: {
            userId_permission: {
              userId: founder.id,
              permission: perm,
            },
          },
          update: {},
          create: {
            userId: founder.id,
            permission: perm,
          },
        });
      }
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
          previousRole: UserRole.FOUNDER_SUPER_ADMIN,
          newRole: UserRole.FOUNDER_SUPER_ADMIN,
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
          role: UserRole.PRIMARY_SUPER_ADMIN,
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
      if (primarySA.role !== UserRole.PRIMARY_SUPER_ADMIN) {
        saUpdates.role = UserRole.PRIMARY_SUPER_ADMIN;
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
      for (const perm of missingSAPerms) {
        await db.adminPermission.upsert({
          where: {
            userId_permission: {
              userId: primarySA.id,
              permission: perm,
            },
          },
          update: {},
          create: {
            userId: primarySA.id,
            permission: perm,
          },
        });
      }
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

    console.log('[BOOTSTRAP] Governance accounts verification complete.');
  } catch (error) {
    console.error('[BOOTSTRAP ERROR] Failed to bootstrap governance accounts:', error);
  }
}
