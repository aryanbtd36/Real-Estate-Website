import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SecurityEventSeverity } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';

async function getTimelineHandler(request: NextRequest) {
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
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('sessionId');

  if (!userId && !sessionId) {
    return NextResponse.json({ error: 'Either userId or sessionId parameter is required' }, { status: 400 });
  }

  try {
    let targetUserId = userId;
    let targetUserEmail = '';

    // If we only have sessionId, find the userId
    if (sessionId && !targetUserId) {
      const sess = await db.session.findUnique({
        where: { id: sessionId },
        select: { userId: true, userEmail: true },
      });
      if (sess) {
        targetUserId = sess.userId;
        targetUserEmail = sess.userEmail;
      }
    }

    if (targetUserId && !targetUserEmail) {
      const user = await db.user.findUnique({
        where: { id: targetUserId },
        select: { email: true },
      });
      if (user) {
        targetUserEmail = user.email;
      }
    }

    // Parallel fetch timeline components
    const [
      securityEvents,
      securityAlerts,
      activityLogs,
      loginAttempts,
      userSessions,
    ] = await Promise.all([
      db.securityEvent.findMany({
        where: {
          OR: [
            targetUserId ? { userId: targetUserId } : {},
            sessionId ? { sessionId } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.securityAlert.findMany({
        where: targetUserId
          ? {
              OR: [
                { adminId: targetUserId },
                { assignedToId: targetUserId },
              ],
            }
          : {},
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      targetUserId
        ? db.activityLog.findMany({
            where: { actorId: targetUserId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
      targetUserEmail
        ? db.loginAttempt.findMany({
            where: { email: targetUserEmail },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      targetUserId
        ? db.session.findMany({
            where: { userId: targetUserId },
            orderBy: { loginAt: 'desc' },
            take: 30,
          })
        : Promise.resolve([]),
    ]);

    // Structure timeline events
    const timelineEvents: any[] = [];

    // Map Security Events
    securityEvents.forEach((e) => {
      timelineEvents.push({
        id: e.id,
        timestamp: e.createdAt,
        type: 'SECURITY_EVENT',
        title: e.title,
        description: e.description,
        severity: e.severity,
        category: e.category,
        metadata: {
          eventType: e.eventType,
          ipAddress: e.ipAddress,
          country: e.country,
          city: e.city,
          riskScore: e.riskScore,
          userAgent: e.userAgent,
        },
      });
    });

    // Map Security Alerts
    securityAlerts.forEach((a) => {
      timelineEvents.push({
        id: a.id,
        timestamp: a.createdAt,
        type: 'SECURITY_ALERT',
        title: a.title || 'Security Alert Raised',
        description: a.description,
        severity: a.severity,
        category: 'SECURITY',
        metadata: {
          status: a.status,
          resolved: a.resolved,
          assignedToId: a.assignedToId,
        },
      });
    });

    // Map Activity Logs
    activityLogs.forEach((l) => {
      timelineEvents.push({
        id: l.id,
        timestamp: l.createdAt,
        type: 'ADMIN_ACTION',
        title: l.action,
        description: l.description,
        severity: 'LOW',
        category: 'ADMIN',
        metadata: {
          details: l.details,
          targetUserId: l.targetUserId,
        },
      });
    });

    // Map Login Attempts
    loginAttempts.forEach((la) => {
      timelineEvents.push({
        id: la.id,
        timestamp: la.createdAt,
        type: 'LOGIN_ATTEMPT',
        title: la.success ? 'Login Succeeded' : 'Login Failed',
        description: la.success
          ? `Successful login attempt from IP ${la.ipAddress}`
          : `Failed login attempt for ${la.email} from IP ${la.ipAddress}`,
        severity: la.success ? 'LOW' : 'MEDIUM',
        category: 'AUTHENTICATION',
        metadata: {
          ipAddress: la.ipAddress,
          userAgent: la.userAgent,
          browser: la.browser,
          device: la.device,
        },
      });
    });

    // Map User Sessions
    userSessions.forEach((s) => {
      timelineEvents.push({
        id: s.id,
        timestamp: s.loginAt,
        type: 'SESSION_LIFECYCLE',
        title: 'Session Started',
        description: `Session created with ID ${s.id} from IP ${s.ipAddress} (${s.city}, ${s.country})`,
        severity: s.riskScore >= 50 ? 'HIGH' : 'LOW',
        category: 'SESSION',
        metadata: {
          sessionId: s.id,
          status: s.status,
          riskScore: s.riskScore,
          expiresAt: s.expiresAt,
        },
      });
    });

    // Sort timeline chronologically (latest first)
    timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      userId: targetUserId,
      email: targetUserEmail,
      timeline: timelineEvents,
    });
  } catch (error) {
    console.error('[API Security Timeline GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = secureApiHandler(getTimelineHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-timeline' },
});
