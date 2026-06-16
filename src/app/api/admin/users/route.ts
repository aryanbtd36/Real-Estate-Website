import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { UserStatus } from '@prisma/client';
import { calculateEngagementScore, getEngagementCategory } from '@/lib/engagement';
import { eventEmitter, EVENTS } from '@/lib/events';

// GET all users with CRM details, search, filtering, and pagination (excluding soft deletes)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actorRole = (session?.user as any)?.role;

    const hasAdminAccess = actorRole === 'ADMIN' || actorRole === 'PRIMARY_SUPER_ADMIN' || actorRole === 'FOUNDER_SUPER_ADMIN';
    if (!session || !hasAdminAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as UserStatus | null;
    const role = searchParams.get('role') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Build query filters (excluding soft-deleted users where deletedAt is set)
    const whereClause: any = {
      deletedAt: null,
    };

    if (status) {
      whereClause.status = status;
    }

    if (role) {
      whereClause.role = role;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch users with relation counts
    const [usersRaw, total] = await Promise.all([
      db.user.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          lastLogin: true,
          lastActivity: true,
          createdAt: true,
          emailVerified: true,
          _count: {
            select: {
              propertyViews: true,
              savedProperties: true,
              appointments: true,
            },
          },
        },
      }),
      db.user.count({ where: whereClause }),
    ]);

    // Format users with engagement metrics and scores
    const users = await Promise.all(
      usersRaw.map(async (u) => {
        // Query inquiries count matching the user's email
        const inquiriesCount = await db.lead.count({
          where: { email: u.email },
        });

        const viewsCount = u._count.propertyViews;
        const savesCount = u._count.savedProperties;
        const appointmentsCount = u._count.appointments;

        const isSuspended = u.status === UserStatus.SUSPENDED;
        const score = isSuspended
          ? 0
          : calculateEngagementScore({
              viewsCount,
              savesCount,
              inquiriesCount,
              appointmentsCount,
            });

        const category = getEngagementCategory(score);

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          lastLogin: u.lastLogin,
          lastActivity: u.lastActivity,
          createdAt: u.createdAt,
          emailVerified: u.emailVerified,
          metrics: {
            views: viewsCount,
            saves: savesCount,
            inquiries: inquiriesCount,
            appointments: appointmentsCount,
          },
          engagementScore: score,
          engagementCategory: category,
        };
      })
    );

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API Admin Users GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// PUT: Modify user status (suspend/restore), role (promote/revoke), or profile details with strict validations and audit logging
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actorId = (session?.user as any)?.id;
    const actorRole = (session?.user as any)?.role;

    const hasAdminAccess = actorRole === 'ADMIN' || actorRole === 'PRIMARY_SUPER_ADMIN' || actorRole === 'FOUNDER_SUPER_ADMIN';
    if (!session || !hasAdminAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Lockdown check
    const { isGlobalLockdownActive, checkImmortalProtection } = await import('@/lib/governance');
    if (await isGlobalLockdownActive() && actorRole !== 'FOUNDER_SUPER_ADMIN') {
      return NextResponse.json({ error: 'System is in Global Lockdown. Mutations are disabled.' }, { status: 503 });
    }

    const body = await request.json();
    const { userId, status, role, name, email, phone, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Safety check: Admins cannot modify their own permissions or status
    if (userId === actorId) {
      return NextResponse.json(
        { error: 'Self-modification is prohibited. You cannot suspend yourself, change your own role, or revoke your own admin access.' },
        { status: 400 }
      );
    }

    // Fetch target user to inspect parameters and verify existence
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser || targetUser.deletedAt !== null) {
      return NextResponse.json({ error: 'User not found or has been soft-deleted' }, { status: 404 });
    }

    // Check Immortal Protection
    try {
      await checkImmortalProtection({
        targetUserId: userId,
        actorId,
        action: `Modify User (role: ${role || targetUser.role}, status: ${status || targetUser.status})`,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    // Standard Admins cannot modify Super Admins (Primary SA or Founder)
    const isTargetSuper = targetUser.role === 'PRIMARY_SUPER_ADMIN' || targetUser.role === 'FOUNDER_SUPER_ADMIN';
    if (isTargetSuper && actorRole === 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Standard administrators cannot modify a Super Administrator.' }, { status: 403 });
    }

    // Primary SAs cannot modify the Founder
    if (targetUser.role === 'FOUNDER_SUPER_ADMIN' && actorRole === 'PRIMARY_SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Primary Super Administrators cannot modify the Founder.' }, { status: 403 });
    }

    // Only Founder can assign Super Admin roles
    const assigningSuper = role === 'PRIMARY_SUPER_ADMIN' || role === 'FOUNDER_SUPER_ADMIN';
    if (assigningSuper && actorRole !== 'FOUNDER_SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only the Founder can assign Super Administrator roles.' }, { status: 403 });
    }

    const updateData: any = {};
    const eventsToEmit: { eventName: string; payload: any }[] = [];

    // Begin database transaction to ensure atomicity
    const updatedUser = await db.$transaction(async (tx) => {
      // 1. Validate and track status updates
      if (status !== undefined) {
        if (status !== UserStatus.ACTIVE && status !== UserStatus.SUSPENDED) {
          throw new Error('Invalid user status');
        }
        if (status !== targetUser.status) {
          updateData.status = status;
          
          await tx.userStatusHistory.create({
            data: {
              userId,
              changedById: actorId,
              previousStatus: targetUser.status,
              newStatus: status,
              reason: reason || null,
            },
          });

          await tx.activityLog.create({
            data: {
              actorId,
              targetUserId: userId,
              action: 'STATUS_HISTORY_CREATE',
              description: `Created status history record for ${targetUser.email}: changed from ${targetUser.status} to ${status}${reason ? ` (Reason: ${reason})` : ''}`,
              details: { previousStatus: targetUser.status, newStatus: status, reason },
            },
          });

          const eventName = status === UserStatus.SUSPENDED ? EVENTS.USER_SUSPENDED : EVENTS.USER_RESTORED;
          eventsToEmit.push({
            eventName,
            payload: {
              actorId,
              targetUserId: userId,
              targetEmail: targetUser.email,
            },
          });
        }
      }

      // 2. Validate and track role changes
      if (role !== undefined) {
        if (role !== 'USER' && role !== 'ADMIN' && role !== 'PRIMARY_SUPER_ADMIN' && role !== 'FOUNDER_SUPER_ADMIN') {
          throw new Error('Invalid role value');
        }
        if (role !== targetUser.role) {
          updateData.role = role;

          await tx.roleHistory.create({
            data: {
              userId,
              changedById: actorId,
              previousRole: targetUser.role,
              newRole: role,
            },
          });

          await tx.activityLog.create({
            data: {
              actorId,
              targetUserId: userId,
              action: 'ROLE_HISTORY_CREATE',
              description: `Created role history record for ${targetUser.email}: changed from ${targetUser.role} to ${role}`,
              details: { previousRole: targetUser.role, newRole: role },
            },
          });

          const eventName = role === 'ADMIN' ? EVENTS.ROLE_PROMOTED : EVENTS.ROLE_REVOKED;
          eventsToEmit.push({
            eventName,
            payload: {
              actorId,
              targetUserId: userId,
              targetEmail: targetUser.email,
              previousRole: targetUser.role,
            },
          });
        }
      }

      // 3. Track name changes
      if (name !== undefined && name !== targetUser.name) {
        updateData.name = name;

        await tx.userProfileHistory.create({
          data: {
            userId,
            changedById: actorId,
            fieldName: 'name',
            oldValue: targetUser.name || null,
            newValue: name || null,
          },
        });

        await tx.activityLog.create({
          data: {
            actorId,
            targetUserId: userId,
            action: 'PROFILE_UPDATE',
            description: `Updated name for ${targetUser.email}: "${targetUser.name || ''}" -> "${name || ''}"`,
            details: { fieldName: 'name', oldValue: targetUser.name, newValue: name },
          },
        });
      }

      // 4. Track email changes
      if (email !== undefined && email !== targetUser.email) {
        // Double check if email already exists
        const existingEmail = await tx.user.findFirst({
          where: { email, deletedAt: null },
        });
        if (existingEmail) {
          throw new Error('Email is already in use by another user');
        }

        updateData.email = email;

        await tx.userProfileHistory.create({
          data: {
            userId,
            changedById: actorId,
            fieldName: 'email',
            oldValue: targetUser.email,
            newValue: email,
          },
        });

        await tx.activityLog.create({
          data: {
            actorId,
            targetUserId: userId,
            action: 'PROFILE_UPDATE',
            description: `Updated email for ${targetUser.email}: "${targetUser.email}" -> "${email}"`,
            details: { fieldName: 'email', oldValue: targetUser.email, newValue: email },
          },
        });
      }

      // 5. Track phone changes
      if (phone !== undefined && phone !== targetUser.phone) {
        updateData.phone = phone;

        await tx.userProfileHistory.create({
          data: {
            userId,
            changedById: actorId,
            fieldName: 'phone',
            oldValue: targetUser.phone || null,
            newValue: phone || null,
          },
        });

        await tx.activityLog.create({
          data: {
            actorId,
            targetUserId: userId,
            action: 'PROFILE_UPDATE',
            description: `Updated phone for ${targetUser.email}: "${targetUser.phone || ''}" -> "${phone || ''}"`,
            details: { fieldName: 'phone', oldValue: targetUser.phone, newValue: phone },
          },
        });
      }

      if (Object.keys(updateData).length === 0) {
        return targetUser;
      }

      // Execute database update
      return await tx.user.update({
        where: { id: userId },
        data: updateData,
      });
    });

    // Emit decoupled event handlers (outside the transaction)
    eventsToEmit.forEach(({ eventName, payload }) => {
      try {
        eventEmitter.emit(eventName, payload);
      } catch (emitterErr) {
        console.error(`[Admin Users PUT] Failed to emit event ${eventName}:`, emitterErr);
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('[API Admin Users PUT] Error:', error);
    const status = error.message === 'User not found or has been soft-deleted' ? 404 : 400;
    return NextResponse.json({ error: error.message || 'Failed to update user profile' }, { status });
  }
}
