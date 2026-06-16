import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { Permission, UserRole, UserStatus } from '@prisma/client';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const isSuperAdmin = (session.user as any).role === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterActive = searchParams.get('active') === 'true';

    const whereClause: any = {};
    if (filterActive) {
      whereClause.isActive = true;
    }

    const sessions = await db.adminSession.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { loginAt: 'desc' },
      take: 50, // Limit to top 50 sessions
    });

    const formattedSessions = sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      browser: s.browser,
      device: s.device,
      operatingSystem: s.operatingSystem,
      location: s.city && s.country ? `${s.city}, ${s.country}` : s.ipAddress || 'Unknown',
      loginAt: s.loginAt,
      lastActivityAt: s.lastActivityAt,
      logoutAt: s.logoutAt,
      isActive: s.isActive,
      user: s.user,
    }));

    return NextResponse.json(formattedSessions);
  } catch (error) {
    console.error('[API Admin Security Sessions GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { action, sessionId, targetUserId } = body;

    if (!action || !['TERMINATE_SESSION', 'TERMINATE_ALL', 'LOCK_ACCOUNT', 'FORCE_PASSWORD_RESET'].includes(action)) {
      return NextResponse.json({ error: 'Invalid or missing action' }, { status: 400 });
    }

    // 1. Terminate a specific session
    if (action === 'TERMINATE_SESSION') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      }

      const targetSession = await db.adminSession.findUnique({
        where: { id: sessionId },
      });

      if (!targetSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Check hierarchy constraints: ADMIN cannot terminate session of SUPER_ADMIN
      const targetUser = await db.user.findUnique({ where: { id: targetSession.userId } });
      if (targetUser && targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden: Standard administrators cannot terminate Super Admin sessions' }, { status: 403 });
      }

      await db.$transaction(async (tx) => {
        await tx.adminSession.update({
          where: { id: sessionId },
          data: { isActive: false, logoutAt: new Date() },
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId: targetSession.userId,
            action: 'SESSION_TERMINATED',
            description: `Force-terminated active session ${sessionId} for user ${targetUser?.email || 'Unknown'}`,
            details: { sessionId },
          },
        });
      }, { maxWait: 10000, timeout: 30000 });

      eventEmitter.emit(EVENTS.SESSION_TERMINATED, { sessionId, actorId: callerId });
      return NextResponse.json({ success: true });
    }

    // 2. Terminate all sessions for a user
    if (action === 'TERMINATE_ALL') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
      }

      const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden: Standard administrators cannot modify Super Admin profiles' }, { status: 403 });
      }

      await db.$transaction(async (tx) => {
        await tx.adminSession.updateMany({
          where: { userId: targetUserId, isActive: true },
          data: { isActive: false, logoutAt: new Date() },
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId,
            action: 'SESSION_TERMINATED',
            description: `Forced logout of all active sessions for ${targetUser.email}`,
          },
        });
      }, { maxWait: 10000, timeout: 30000 });

      return NextResponse.json({ success: true });
    }

    // 3. Lock Account
    if (action === 'LOCK_ACCOUNT') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
      }

      const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden: Standard administrators cannot modify Super Admin profiles' }, { status: 403 });
      }

      await db.$transaction(async (tx) => {
        // Suspend account
        await tx.user.update({
          where: { id: targetUserId },
          data: { status: UserStatus.SUSPENDED },
        });

        await tx.userStatusHistory.create({
          data: {
            userId: targetUserId,
            changedById: callerId,
            previousStatus: targetUser.status,
            newStatus: UserStatus.SUSPENDED,
            reason: 'Administrative emergency account lock',
          },
        });

        // Terminate all sessions
        await tx.adminSession.updateMany({
          where: { userId: targetUserId, isActive: true },
          data: { isActive: false, logoutAt: new Date() },
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId,
            action: 'ADMIN_SUSPENDED',
            description: `Locked account and forced logouts for ${targetUser.email}`,
          },
        });
      }, { maxWait: 10000, timeout: 30000 });

      eventEmitter.emit(EVENTS.USER_SUSPENDED, {
        actorId: callerId,
        targetUserId,
        targetEmail: targetUser.email,
      });

      return NextResponse.json({ success: true });
    }

    // 4. Force Password Reset
    if (action === 'FORCE_PASSWORD_RESET') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
      }

      const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden: Standard administrators cannot modify Super Admin profiles' }, { status: 403 });
      }

      await db.$transaction(async (tx) => {
        // Clear password to force password reset flows
        await tx.user.update({
          where: { id: targetUserId },
          data: { password: null }, // Stripping password triggers email token resetting
        });

        await tx.activityLog.create({
          data: {
            actorId: callerId,
            targetUserId,
            action: 'PASSWORD_RESET_REQUEST',
            description: `Revoked password and demanded password reset for ${targetUser.email}`,
          },
        });
      }, { maxWait: 10000, timeout: 30000 });

      eventEmitter.emit(EVENTS.PASSWORD_RESET_REQUESTED, { userId: targetUserId, email: targetUser.email });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (error: any) {
    console.error('[API Admin Security Sessions POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
