import { db } from '../db';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export interface LogSecurityEventInput {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  ipAddress?: string;
  country?: string;
  state?: string;
  city?: string;
  asn?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  riskScore?: number;
  metadata?: any;

  // New fields
  eventType?: string;
  category?: SecurityEventCategory;
  title?: string;
  description: string;
  severity: SecurityEventSeverity;

  // Legacy fields for backward compatibility
  action?: string;
  details?: any;
}

export class SecurityEventLogger {
  static async log(input: LogSecurityEventInput) {
    try {
      // 1. Backward compatibility mapping
      const eventType = input.eventType || input.action || 'SYSTEM_EVENT';
      const action = input.action || eventType;
      const metadata = input.metadata || input.details || null;
      const details = input.details || metadata || null;
      const title = input.title || action || 'Security Event';

      // 2. Category mapping heuristic if not provided
      let category = input.category || SecurityEventCategory.SYSTEM;
      if (!input.category) {
        const lowerEvent = eventType.toLowerCase();
        if (lowerEvent.includes('login') || lowerEvent.includes('auth') || lowerEvent.includes('otp') || lowerEvent.includes('password') || lowerEvent.includes('brute')) {
          category = SecurityEventCategory.AUTHENTICATION;
        } else if (lowerEvent.includes('session')) {
          category = SecurityEventCategory.SESSION;
        } else if (lowerEvent.includes('admin')) {
          category = SecurityEventCategory.ADMIN;
        } else if (lowerEvent.includes('property')) {
          category = SecurityEventCategory.PROPERTY;
        } else if (lowerEvent.includes('lead')) {
          category = SecurityEventCategory.LEAD;
        } else if (lowerEvent.includes('export')) {
          category = SecurityEventCategory.EXPORT;
        } else if (lowerEvent.includes('governance') || lowerEvent.includes('founder') || lowerEvent.includes('immortal')) {
          category = SecurityEventCategory.GOVERNANCE;
        }
      }

      const createdEvent = await db.securityEvent.create({
        data: {
          eventType,
          severity: input.severity,
          category,
          title,
          description: input.description,
          userId: input.userId || null,
          userEmail: input.userEmail || null,
          userRole: input.userRole || null,
          sessionId: input.sessionId || null,
          ipAddress: input.ipAddress || null,
          country: input.country || null,
          state: input.state || null,
          city: input.city || null,
          asn: input.asn || null,
          userAgent: input.userAgent || null,
          deviceFingerprint: input.deviceFingerprint || null,
          riskScore: input.riskScore || 0,
          metadata,
          action,
          details,
        },
      });

      return createdEvent;
    } catch (err) {
      console.error('[SecurityEventLogger Error] Failed to log security event:', err);
      return null;
    }
  }

  /**
   * Run retention policy: Keep CRITICAL events forever, delete low/medium/high events older than 90 days
   */
  static async runRetentionPolicy(): Promise<{ deletedCount: number }> {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const res = await db.securityEvent.deleteMany({
        where: {
          severity: { in: [SecurityEventSeverity.LOW, SecurityEventSeverity.MEDIUM, SecurityEventSeverity.HIGH] },
          createdAt: { lt: ninetyDaysAgo },
        },
      });
      return { deletedCount: res.count };
    } catch (err) {
      console.error('[SecurityEventLogger.runRetentionPolicy Error]', err);
      return { deletedCount: 0 };
    }
  }
}
