import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, UserRole, UserStatus } from '@prisma/client';
import { eventEmitter, EVENTS } from '@/lib/events';

// GET all administrators
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.MANAGE_ADMINS));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    // Fetch all users with admin or super admin roles
    const admins = await db.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isFounder: true,
        isPrimarySA: true,
        status: true,
        lastLogin: true,
        lastActivity: true,
        createdAt: true,
        adminPermissions: {
          select: {
            permission: true,
          },
        },
        _count: {
          select: {
            leadsAssigned: true,
            appointmentsManaged: true,
            reviewsReceived: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedAdmins = admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      isFounder: admin.isFounder,
      isPrimarySA: admin.isPrimarySA,
      status: admin.status,
      lastLogin: admin.lastLogin,
      lastActivity: admin.lastActivity,
      createdAt: admin.createdAt,
      permissions: admin.adminPermissions.map((ap) => ap.permission),
      permissionCount: admin.adminPermissions.length,
      leadsCount: admin._count.leadsAssigned,
      appointmentsCount: admin._count.appointmentsManaged,
      reviewsCount: admin._count.reviewsReceived,
    }));

    return NextResponse.json(formattedAdmins);
  } catch (error) {
    console.error('[API Admin Admins GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Promote user to administrator
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.MANAGE_ADMINS));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const targetRole = role || UserRole.ADMIN;
    if (targetRole !== UserRole.ADMIN && targetRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Invalid target administrative role' }, { status: 400 });
    }

    // Restriction: Only Super Admins can assign Super Admin roles
    if (targetRole === UserRole.SUPER_ADMIN && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only a Super Administrator can assign Super Administrator roles' }, { status: 403 });
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt !== null) {
      return NextResponse.json({ error: 'User not found or has been soft-deleted' }, { status: 404 });
    }

    if (user.role === targetRole) {
      return NextResponse.json({ error: `User already has the role ${targetRole}` }, { status: 400 });
    }

    const updatedUser = await db.$transaction(async (tx) => {
      // Create role history log
      await tx.roleHistory.create({
        data: {
          userId: user.id,
          changedById: callerId,
          previousRole: user.role,
          newRole: targetRole,
        },
      });

      // Update user role
      const res = await tx.user.update({
        where: { id: user.id },
        data: { role: targetRole },
      });

      // Add activity log
      await tx.activityLog.create({
        data: {
          actorId: callerId,
          targetUserId: user.id,
          action: 'ADMIN_PROMOTED',
          description: `Promoted ${user.email} from ${user.role} to ${targetRole}`,
          details: { previousRole: user.role, newRole: targetRole },
        },
      });

      return res;
    }, { maxWait: 10000, timeout: 30000 });

    // Emit event
    eventEmitter.emit(EVENTS.ROLE_PROMOTED, {
      actorId: callerId,
      targetUserId: user.id,
      targetEmail: user.email,
      previousRole: user.role,
      newRole: targetRole,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('[API Admin Admins POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
