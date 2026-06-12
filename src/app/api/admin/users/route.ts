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

    if (!session || actorRole !== 'ADMIN') {
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

// PUT: Modify user status (suspend/restore) or role (promote/revoke) with strict validations
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actorId = (session?.user as any)?.id;
    const actorRole = (session?.user as any)?.role;

    if (!session || actorRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status, role } = body;

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

    const updateData: any = {};
    const eventsToEmit: { eventName: string; payload: any }[] = [];

    // 1. Validate status updates
    if (status !== undefined) {
      if (status !== UserStatus.ACTIVE && status !== UserStatus.SUSPENDED) {
        return NextResponse.json({ error: 'Invalid user status' }, { status: 400 });
      }
      updateData.status = status;
      
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

    // 2. Validate role changes
    if (role !== undefined) {
      if (role !== 'USER' && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
      }
      updateData.role = role;

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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Execute database update
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    // 3. Emit decoupled event handlers
    eventsToEmit.forEach(({ eventName, payload }) => {
      try {
        eventEmitter.emit(eventName, payload);
      } catch (emitterErr) {
        console.error(`[Admin Users PUT] Failed to emit event ${eventName}:`, emitterErr);
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[API Admin Users PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
