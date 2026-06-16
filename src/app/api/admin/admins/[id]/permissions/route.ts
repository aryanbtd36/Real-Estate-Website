import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { Permission, UserRole } from '@prisma/client';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: adminId } = await params;
    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'PRIMARY_SUPER_ADMIN' || callerRole === 'FOUNDER_SUPER_ADMIN';

    // Lockdown check
    const { isGlobalLockdownActive, checkImmortalProtection } = await import('@/lib/governance');
    if (await isGlobalLockdownActive() && callerRole !== 'FOUNDER_SUPER_ADMIN') {
      return NextResponse.json({ error: 'System is in Global Lockdown. Mutations are disabled.' }, { status: 503 });
    }

    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.MANAGE_ADMINS));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    // Fetch target admin user
    const targetAdmin = await db.user.findUnique({
      where: { id: adminId },
    });

    if (!targetAdmin || targetAdmin.deletedAt !== null) {
      return NextResponse.json({ error: 'Administrator not found' }, { status: 404 });
    }

    // Check Immortal Protection
    try {
      await checkImmortalProtection({
        targetUserId: adminId,
        actorId: callerId,
        action: 'Modify Administrator Permissions',
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    // ADMIN cannot change Super Admin permissions
    const targetIsSuper = targetAdmin.role === 'PRIMARY_SUPER_ADMIN' || targetAdmin.role === 'FOUNDER_SUPER_ADMIN';
    if (targetIsSuper && callerRole === 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Standard administrators cannot modify Super Admin permissions' }, { status: 403 });
    }

    // PRIMARY_SUPER_ADMIN cannot change Founder permissions
    if (targetAdmin.role === 'FOUNDER_SUPER_ADMIN' && callerRole === 'PRIMARY_SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Primary Super Administrators cannot modify Founder permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { permissions } = body; // Array of Permission strings

    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
    }

    // Validate that all permissions are valid enums
    const validPermissions = Object.values(Permission);
    const invalid = permissions.filter((p) => !validPermissions.includes(p));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid permission values: ${invalid.join(', ')}` }, { status: 400 });
    }

    // Update permissions in transaction
    await db.$transaction(async (tx) => {
      // 1. Get current permissions
      const currentPerms = await tx.adminPermission.findMany({
        where: { userId: adminId },
        select: { permission: true },
      });
      const currentList = currentPerms.map((cp) => cp.permission);

      // 2. Identify permissions to delete and add
      const toDelete = currentList.filter((p) => !permissions.includes(p));
      const toAdd = permissions.filter((p) => !currentList.includes(p));

      // 3. Perform deletes
      if (toDelete.length > 0) {
        await tx.adminPermission.deleteMany({
          where: {
            userId: adminId,
            permission: { in: toDelete },
          },
        });

        for (const p of toDelete) {
          await tx.activityLog.create({
            data: {
              actorId: callerId,
              targetUserId: adminId,
              action: 'PERMISSION_REVOKED',
              description: `Revoked permission ${p} from ${targetAdmin.email}`,
              details: { permission: p },
            },
          });
        }
      }

      // 4. Perform inserts
      if (toAdd.length > 0) {
        await tx.adminPermission.createMany({
          data: toAdd.map((p) => ({
            userId: adminId,
            permission: p,
            grantedById: callerId,
          })),
        });

        for (const p of toAdd) {
          await tx.activityLog.create({
            data: {
              actorId: callerId,
              targetUserId: adminId,
              action: 'PERMISSION_GRANTED',
              description: `Granted permission ${p} to ${targetAdmin.email}`,
              details: { permission: p },
            },
          });
        }
      }
    }, { maxWait: 10000, timeout: 30000 });

    // Emit event (can be listened to refresh permissions cache or log)
    eventEmitter.emit(EVENTS.PERMISSION_GRANTED, {
      actorId: callerId,
      targetUserId: adminId,
      permissions,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API Admin Admins ID Permissions POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
