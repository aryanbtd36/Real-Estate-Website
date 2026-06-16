import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { UserRole, ActivityAction } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate and enforce Founder only
    const authResult = await requireFounderSuperAdmin(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { userId: callerId } = authResult;

    // 2. Parse body
    const body = await request.json();
    const { targetUserId, action, reason } = body;

    if (!targetUserId || !action || !['PROMOTE', 'DEMOTE'].includes(action)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    // 3. Fetch target user
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.deletedAt !== null) {
      return NextResponse.json({ error: 'User not found or has been soft-deleted' }, { status: 404 });
    }

    // Block any attempt to promote/demote Founder
    if (targetUser.email.toLowerCase() === 'aryanmishra8113@gmail.com' || targetUser.isFounder) {
      return NextResponse.json({ error: 'Protected IMMORTAL Account' }, { status: 403 });
    }

    const result = await db.$transaction(async (tx) => {
      let updatedUser;

      if (action === 'PROMOTE') {
        if (targetUser.role !== UserRole.ADMIN) {
          throw new Error('Only standard ADMIN users can be promoted to PRIMARY_SUPER_ADMIN.');
        }

        updatedUser = await tx.user.update({
          where: { id: targetUserId },
          data: {
            role: UserRole.PRIMARY_SUPER_ADMIN,
            isPrimarySA: true,
            promotedById: callerId,
            promotedAt: new Date(),
          },
        });

        // Log Role History
        await tx.roleHistory.create({
          data: {
            userId: targetUserId,
            changedById: callerId,
            previousRole: targetUser.role,
            newRole: UserRole.PRIMARY_SUPER_ADMIN,
          },
        });

        // Log Governance History
        await tx.governanceHistory.create({
          data: {
            targetUserId,
            actorId: callerId,
            previousRole: targetUser.role,
            newRole: UserRole.PRIMARY_SUPER_ADMIN,
            reason: reason || 'Promoted to Primary Super Admin by Founder',
          },
        });

        // Log Activity
        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId,
            action: ActivityAction.FOUNDER_PROMOTION,
            description: `Promoted ${targetUser.email} to PRIMARY_SUPER_ADMIN.`,
          },
        });

      } else {
        // DEMOTE
        if (targetUser.role !== UserRole.PRIMARY_SUPER_ADMIN) {
          throw new Error('User is not a Primary Super Admin.');
        }

        // Count Primary SAs to enforce governance rule: at least one Primary Super Admin must exist
        const psaCount = await tx.user.count({
          where: {
            role: UserRole.PRIMARY_SUPER_ADMIN,
            deletedAt: null,
          },
        });

        if (psaCount <= 1) {
          throw new Error('At least one Primary Super Admin must exist. Demotion denied.');
        }

        updatedUser = await tx.user.update({
          where: { id: targetUserId },
          data: {
            role: UserRole.ADMIN,
            isPrimarySA: false,
            promotedById: null,
            promotedAt: null,
          },
        });

        // Log Role History
        await tx.roleHistory.create({
          data: {
            userId: targetUserId,
            changedById: callerId,
            previousRole: targetUser.role,
            newRole: UserRole.ADMIN,
          },
        });

        // Log Governance History
        await tx.governanceHistory.create({
          data: {
            targetUserId,
            actorId: callerId,
            previousRole: targetUser.role,
            newRole: UserRole.ADMIN,
            reason: reason || 'Demoted to Admin by Founder',
          },
        });

        // Log Activity
        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId,
            action: ActivityAction.FOUNDER_DEMOTION,
            description: `Demoted ${targetUser.email} to ADMIN.`,
          },
        });
      }

      return updatedUser;
    });

    return NextResponse.json({ success: true, user: result });
  } catch (error: any) {
    console.error('[API Governance Promote POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
