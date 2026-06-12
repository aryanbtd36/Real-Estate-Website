import { db } from './db';
import { ActivityAction } from '@prisma/client';

export interface LogParams {
  actorId?: string | null;
  targetUserId?: string | null;
  action: ActivityAction;
  description: string;
  details?: any;
}

export const MEANINGFUL_ACTIONS: ActivityAction[] = [
  ActivityAction.LOGIN,
  ActivityAction.PROPERTY_VIEW,
  ActivityAction.PROPERTY_SAVE,
  ActivityAction.PROPERTY_UNSAVE,
  ActivityAction.INQUIRY_CREATE,
  ActivityAction.APPOINTMENT_CREATE,
  ActivityAction.PASSWORD_RESET_COMPLETE,
  ActivityAction.EMAIL_VERIFIED,
];

// Memory cache for log signatures to prevent duplicates within 5 seconds
const recentLogSignatures = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 5000;

function getSignatureKey(
  actorId?: string | null,
  targetUserId?: string | null,
  action?: ActivityAction,
  description?: string
): string {
  return `${actorId || 'system'}:${targetUserId || 'none'}:${action || 'none'}:${description || ''}`;
}

export const ActivityService = {
  /**
   * Memory cache getter for testing/debugging.
   */
  getRecentLogSignatures() {
    return recentLogSignatures;
  },

  /**
   * Logs a new activity to the database with idempotency checks and updates the actor's lastActivity timestamp.
   */
  async log({ actorId, targetUserId, action, description, details }: LogParams) {
    try {
      const now = Date.now();
      const signature = getSignatureKey(actorId, targetUserId, action, description);
      const lastLogged = recentLogSignatures.get(signature);

      // 1. Idempotency Protection: Discard duplicate calls within the duplicate window
      if (lastLogged && now - lastLogged < DUPLICATE_WINDOW_MS) {
        console.warn(`[ActivityService] Ignored duplicate activity log within protection window: ${signature}`);
        return null;
      }
      recentLogSignatures.set(signature, now);

      // 2. Perform periodic cleanup of map keys
      for (const [key, timestamp] of recentLogSignatures.entries()) {
        if (now - timestamp > DUPLICATE_WINDOW_MS) {
          recentLogSignatures.delete(key);
        }
      }

      // 3. Create the activity log entry (with try-catch safety for DB retry resilience)
      const logEntry = await db.activityLog.create({
        data: {
          actorId: actorId || null,
          targetUserId: targetUserId || null,
          action,
          description,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
        },
      });

      // 4. Update lastActivity for meaningful actor actions
      if (actorId && MEANINGFUL_ACTIONS.includes(action)) {
        await db.user.update({
          where: { id: actorId },
          data: { lastActivity: new Date() },
        });
      }

      // 5. Update lastActivity for meaningful target actions (e.g. suspension, password resets)
      if (targetUserId && actorId !== targetUserId && MEANINGFUL_ACTIONS.includes(action)) {
        await db.user.update({
          where: { id: targetUserId },
          data: { lastActivity: new Date() },
        });
      }

      return logEntry;
    } catch (error) {
      console.error('[ActivityService.log] Failed to create activity log:', error);
      return null;
    }
  },

  /**
   * Fetches the chronological timeline of events for a specific user.
   */
  async getUserTimeline(userId: string) {
    return db.activityLog.findMany({
      where: {
        OR: [
          { actorId: userId },
          { targetUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  },

  /**
   * Fetches system-wide activities for the admin audit log dashboard.
   */
  async getAuditLogs({
    limit = 50,
    offset = 0,
    action,
    search,
  }: {
    limit?: number;
    offset?: number;
    action?: ActivityAction;
    search?: string;
  }) {
    const whereClause: any = {};

    if (action) {
      whereClause.action = action;
    }

    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        {
          actor: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          targetUser: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
          targetUser: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      db.activityLog.count({ where: whereClause }),
    ]);

    return { logs, total };
  },
};
