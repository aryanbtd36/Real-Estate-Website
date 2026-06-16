import { db } from './db';
import { UserRole, AlertSeverity, ActivityAction } from '@prisma/client';

export async function isGlobalLockdownActive(): Promise<boolean> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'global_lockdown' },
    });
    return setting?.value === 'true';
  } catch {
    return false;
  }
}

export async function setGlobalLockdown(active: boolean, actorId: string, reason?: string) {
  // 1. Update setting in database
  await db.systemSetting.upsert({
    where: { key: 'global_lockdown' },
    update: { value: active ? 'true' : 'false' },
    create: { key: 'global_lockdown', value: active ? 'true' : 'false' },
  });

  // 2. Log Governance History
  const actor = await db.user.findUnique({ where: { id: actorId } });
  await db.governanceHistory.create({
    data: {
      targetUserId: actorId,
      actorId,
      previousRole: actor?.role || null,
      newRole: actor?.role || UserRole.USER,
      reason: reason || (active ? 'Global Lockdown activated' : 'Global Lockdown deactivated'),
      metadata: { active },
    },
  });

  // 3. Log Activity Log
  await db.activityLog.create({
    data: {
      actorId,
      action: ActivityAction.IMMORTAL_LOCKDOWN,
      description: active ? 'Global Lockdown mode ENABLED.' : 'Global Lockdown mode DISABLED.',
    },
  });

  // 4. Create Security Alert if activated
  if (active) {
    await db.securityAlert.create({
      data: {
        adminId: actorId,
        type: 'GLOBAL_LOCKDOWN_ACTIVATED',
        severity: AlertSeverity.CRITICAL,
        description: `Global Lockdown was activated by Founder.`,
      },
    });
  }
}

export async function checkImmortalProtection({
  targetUserId,
  actorId,
  action,
}: {
  targetUserId: string;
  actorId: string;
  action: string;
}) {
  // 1. Fetch target user
  const target = await db.user.findUnique({
    where: { id: targetUserId },
  });

  if (!target) return;

  // Check if target is IMMORTAL (email = 'aryanmishra8113@gmail.com', or role = FOUNDER_SUPER_ADMIN, or isFounder = true)
  const isImmortal =
    target.isFounder ||
    target.email.toLowerCase() === 'aryanmishra8113@gmail.com';

  if (isImmortal) {
    const isSelf = actorId === targetUserId;
    let block = false;

    if (!isSelf) {
      // Any attempt by others to mutate the Immortal user must be blocked
      block = true;
    } else {
      // Immortal user cannot demote, suspend, delete, or revoke permissions of themselves
      const normalizedAction = action.toUpperCase();
      if (
        normalizedAction.includes('DELETE') ||
        normalizedAction.includes('SUSPEND') ||
        normalizedAction.includes('DEMOTE') ||
        normalizedAction.includes('ROLE') ||
        normalizedAction.includes('REVOKE') ||
        normalizedAction.includes('REMOVE_GOVERNANCE')
      ) {
        block = true;
      }
    }

    if (block) {
      // 1. Create Security Alert
      await db.securityAlert.create({
        data: {
          adminId: isSelf ? null : actorId,
          type: 'IMMORTAL_MUTATION_ATTEMPT',
          severity: AlertSeverity.CRITICAL,
          description: `Blocked unauthorized action "${action}" on protected IMMORTAL account.`,
          details: { targetUserId, actorId, action },
        },
      });

      // 2. Create Activity Log
      await db.activityLog.create({
        data: {
          actorId,
          targetUserId,
          action: ActivityAction.PROTECTED_ACCOUNT_ACCESS_ATTEMPT,
          description: `Blocked attempt to "${action}" protected IMMORTAL account.`,
          details: { action },
        },
      });

      // 3. Create Governance History Record
      await db.governanceHistory.create({
        data: {
          targetUserId,
          actorId,
          previousRole: target.role,
          newRole: target.role,
          reason: `BLOCKED MUTATION: ${action}`,
          metadata: { actorId, action },
        },
      });

      throw new Error('Protected IMMORTAL Account');
    }
  }
}
