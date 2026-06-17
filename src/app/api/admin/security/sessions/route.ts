import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SessionStatus } from '@prisma/client';
import { SessionManager } from '@/lib/security/session-manager';
import { secureApiHandler } from '@/lib/security/api-security';
import { z } from 'zod';

const adminActionSchema = z.object({
  action: z.enum(['TERMINATE_SESSION', 'TERMINATE_ALL', 'GLOBAL_REVOCATION', 'EMERGENCY_PURGE']),
  sessionId: z.string().optional(),
  targetUserId: z.string().optional(),
});

// GET: Fetch sessions globally for monitoring
async function getAdminSessions(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const filterActive = searchParams.get('active') === 'true';

  const whereClause: any = {};
  if (filterActive) {
    whereClause.status = { in: [SessionStatus.ACTIVE, SessionStatus.SUSPICIOUS] };
  }

  const sessions = await db.session.findMany({
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
    take: 50,
  });

  const formatted = sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    browser: s.browser || 'Unknown',
    device: s.device || 'Unknown',
    operatingSystem: s.operatingSystem || 'Unknown',
    location: s.city && s.country ? `${s.city}, ${s.country}` : 'Unknown',
    loginAt: s.loginAt,
    lastActivityAt: s.lastActivityAt,
    isActive: s.status === SessionStatus.ACTIVE || s.status === SessionStatus.SUSPICIOUS,
    status: s.status,
    riskScore: s.riskScore,
    user: s.user,
  }));

  return NextResponse.json(formatted);
}

// POST: Administrative Session Control
async function postAdminSessions(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerId = (session.user as any).id;
  const callerRole = (session.user as any).role;
  const callerIsFounder = (session.user as any).isFounder;
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';

  // Global Lockdown Check
  const { isGlobalLockdownActive, checkImmortalProtection } = await import('@/lib/governance');
  if (await isGlobalLockdownActive() && !callerIsFounder) {
    return NextResponse.json({ error: 'System is in Global Lockdown. Mutations are disabled.' }, { status: 503 });
  }

  const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.MANAGE_USERS));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  const body = (request as any).validatedBody;
  const { action, sessionId, targetUserId } = body;

  // 1. Terminate a specific session
  if (action === 'TERMINATE_SESSION') {
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check Immortal protection
    try {
      await checkImmortalProtection({
        targetUserId: targetSession.userId,
        actorId: callerId,
        action: 'Terminate Session',
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    // Role Hierarchy rules
    const targetUser = await db.user.findUnique({ where: { id: targetSession.userId } });
    if (targetUser?.role === 'SUPER_ADMIN' && callerRole === 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Standard administrators cannot terminate Super Admin sessions' }, { status: 403 });
    }
    if (targetUser?.isFounder && (session.user as any).isPrimarySA) {
      return NextResponse.json({ error: 'Forbidden: Primary Super Administrators cannot terminate Founder sessions' }, { status: 403 });
    }

    await SessionManager.revokeSession(sessionId, callerId);
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

    // Check Immortal protection
    try {
      await checkImmortalProtection({
        targetUserId,
        actorId: callerId,
        action: 'Terminate All Sessions',
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    if (targetUser.role === 'SUPER_ADMIN' && callerRole === 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Standard administrators cannot revoke Super Admin sessions' }, { status: 403 });
    }
    if (targetUser.isFounder && (session.user as any).isPrimarySA) {
      return NextResponse.json({ error: 'Forbidden: Primary Super Administrators cannot revoke Founder sessions' }, { status: 403 });
    }

    await SessionManager.revokeUserSessions(targetUserId, callerId);
    return NextResponse.json({ success: true });
  }

  // 3. Global Session Revocation (Super Admin only)
  if (action === 'GLOBAL_REVOCATION') {
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin privileges required' }, { status: 403 });
    }

    await SessionManager.globalSessionRevocation(callerId);
    return NextResponse.json({ success: true });
  }

  // 4. Emergency Session Purge (Super Admin only)
  if (action === 'EMERGENCY_PURGE') {
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin privileges required' }, { status: 403 });
    }

    await SessionManager.emergencySessionPurge(callerId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
}

export const GET = secureApiHandler(getAdminSessions, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-sessions-get' },
});

export const POST = secureApiHandler(postAdminSessions, {
  schema: adminActionSchema,
  csrfCheck: true,
  rateLimit: { max: 50, windowMs: 60 * 1000, keyPrefix: 'admin-sessions-post' },
});
