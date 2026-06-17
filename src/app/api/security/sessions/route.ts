import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { SessionStatus } from '@prisma/client';
import { SessionManager } from '@/lib/security/session-manager';
import { secureApiHandler } from '@/lib/security/api-security';
import { z } from 'zod';

const sessionActionSchema = z.object({
  action: z.enum(['LOGOUT_CURRENT', 'LOGOUT_SESSION', 'LOGOUT_ALL']),
  sessionId: z.string().optional(),
});

// GET: Fetch all active sessions for the current user
async function getSessionsHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const currentSessionId = (session?.user as any)?.sessionId;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeSessions = await db.session.findMany({
    where: {
      userId,
      status: { in: [SessionStatus.ACTIVE, SessionStatus.SUSPICIOUS] },
    },
    orderBy: { loginAt: 'desc' },
  });

  const formatted = activeSessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    browser: s.browser || 'Unknown',
    device: s.device || 'Unknown',
    operatingSystem: s.operatingSystem || 'Unknown',
    location: s.city && s.country ? `${s.city}, ${s.country}` : 'Unknown',
    loginAt: s.loginAt,
    lastActivityAt: s.lastActivityAt,
    riskScore: s.riskScore,
    isCurrent: s.id === currentSessionId,
  }));

  return NextResponse.json(formatted);
}

// POST: Revoke current, specific, or all active sessions
async function postSessionsHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const currentSessionId = (session?.user as any)?.sessionId;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (req as any).validatedBody;
  const { action, sessionId } = body;

  if (action === 'LOGOUT_CURRENT') {
    if (currentSessionId) {
      await SessionManager.revokeSession(currentSessionId, userId);
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'LOGOUT_SESSION') {
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!targetSession || targetSession.userId !== userId) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 });
    }

    await SessionManager.revokeSession(sessionId, userId);
    return NextResponse.json({ success: true });
  }

  if (action === 'LOGOUT_ALL') {
    await SessionManager.revokeUserSessions(userId, userId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export const GET = secureApiHandler(getSessionsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'sessions-get' },
});

export const POST = secureApiHandler(postSessionsHandler, {
  schema: sessionActionSchema,
  csrfCheck: true,
  rateLimit: { max: 50, windowMs: 60 * 1000, keyPrefix: 'sessions-post' },
});
