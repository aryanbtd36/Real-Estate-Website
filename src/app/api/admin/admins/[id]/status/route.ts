import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { Permission, UserRole, UserStatus } from '@prisma/client';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function PUT(
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
    const callerIsFounder = (session.user as any).isFounder;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';

    // Lockdown check
    const { isGlobalLockdownActive, checkImmortalProtection } = await import('@/lib/governance');
    if (await isGlobalLockdownActive() && !callerIsFounder) {
      return NextResponse.json({ error: 'System is in Global Lockdown. Mutations are disabled.' }, { status: 503 });
    }

    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.MANAGE_ADMINS));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    // Safety check: Cannot modify yourself
    if (adminId === callerId) {
      return NextResponse.json({ error: 'Self-modification is prohibited.' }, { status: 400 });
    }

    // Fetch target admin user
    const targetAdmin = await db.user.findUnique({
      where: { id: adminId },
    });

    if (!targetAdmin || targetAdmin.deletedAt !== null) {
      return NextResponse.json({ error: 'Administrator not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, reason } = body; // action can be: 'SUSPEND', 'RESTORE', 'REVOKE'

    // Check Immortal Protection
    try {
      await checkImmortalProtection({
        targetUserId: adminId,
        actorId: callerId,
        action: `${action} Administrator`,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    // ADMIN cannot modify or suspend Super Admins
    const targetIsSuper = targetAdmin.role === 'SUPER_ADMIN';
    if (targetIsSuper && callerRole === 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Standard administrators cannot modify a Super Administrator' }, { status: 403 });
    }

    // PRIMARY_SUPER_ADMIN cannot modify or suspend FOUNDER_SUPER_ADMIN
    if (targetAdmin.isFounder && (session.user as any).isPrimarySA) {
      return NextResponse.json({ error: 'Forbidden: Primary Super Administrators cannot modify the Founder' }, { status: 403 });
    }

    if (!action || !['SUSPEND', 'RESTORE', 'REVOKE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid or missing administrative action' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      let updatedUser;
      
      if (action === 'SUSPEND') {
        if (targetAdmin.status === UserStatus.SUSPENDED) {
          throw new Error('Administrator is already suspended');
        }

        await tx.userStatusHistory.create({
          data: {
            userId: adminId,
            changedById: callerId,
            previousStatus: targetAdmin.status,
            newStatus: UserStatus.SUSPENDED,
            reason: reason || 'Suspended via admin management console',
          },
        });

        updatedUser = await tx.user.update({
          where: { id: adminId },
          data: { status: UserStatus.SUSPENDED },
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId: adminId,
            action: 'ADMIN_SUSPENDED',
            description: `Suspended administrator ${targetAdmin.email}${reason ? ` (Reason: ${reason})` : ''}`,
            details: { reason },
          },
        });

        // Terminate any active sessions for suspended admin
        await tx.adminSession.updateMany({
          where: { userId: adminId, isActive: true },
          data: { isActive: false, logoutAt: new Date() },
        });

      } else if (action === 'RESTORE') {
        if (targetAdmin.status === UserStatus.ACTIVE) {
          throw new Error('Administrator is already active');
        }

        await tx.userStatusHistory.create({
          data: {
            userId: adminId,
            changedById: callerId,
            previousStatus: targetAdmin.status,
            newStatus: UserStatus.ACTIVE,
            reason: reason || 'Restored via admin management console',
          },
        });

        updatedUser = await tx.user.update({
          where: { id: adminId },
          data: { status: UserStatus.ACTIVE },
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId: adminId,
            action: 'ADMIN_RESTORED',
            description: `Restored administrator ${targetAdmin.email}`,
          },
        });

      } else if (action === 'REVOKE') {
        // Demotes role back to USER and strips permissions
        await tx.roleHistory.create({
          data: {
            userId: adminId,
            changedById: callerId,
            previousRole: targetAdmin.role,
            newRole: UserRole.USER,
          },
        });

        // Remove all granular permissions
        await tx.adminPermission.deleteMany({
          where: { userId: adminId },
        });

        updatedUser = await tx.user.update({
          where: { id: adminId },
          data: { role: UserRole.USER },
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId: adminId,
            action: 'ADMIN_REVOKED',
            description: `Revoked administrator privileges from ${targetAdmin.email}`,
          },
        });

        // Terminate active sessions
        await tx.adminSession.updateMany({
          where: { userId: adminId, isActive: true },
          data: { isActive: false, logoutAt: new Date() },
        });
      }

      return updatedUser;
    }, { maxWait: 10000, timeout: 30000 });

    // Emit events
    if (action === 'SUSPEND') {
      eventEmitter.emit(EVENTS.USER_SUSPENDED, {
        actorId: callerId,
        targetUserId: adminId,
        targetEmail: targetAdmin.email,
      });
    } else if (action === 'RESTORE') {
      eventEmitter.emit(EVENTS.USER_RESTORED, {
        actorId: callerId,
        targetUserId: adminId,
        targetEmail: targetAdmin.email,
      });
    } else if (action === 'REVOKE') {
      eventEmitter.emit(EVENTS.ROLE_REVOKED, {
        actorId: callerId,
        targetUserId: adminId,
        targetEmail: targetAdmin.email,
        previousRole: targetAdmin.role,
      });
    }

    return NextResponse.json({ success: true, user: result });
  } catch (error: any) {
    console.error('[API Admin Admins ID Status PUT] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
