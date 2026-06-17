import { db } from '../db';
import { SecurityEventSeverity } from '@prisma/client';

export interface LogSecurityEventInput {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  severity: SecurityEventSeverity;
  description: string;
  details?: any;
}

export class SecurityEventLogger {
  static async log(input: LogSecurityEventInput) {
    try {
      return await db.securityEvent.create({
        data: {
          userId: input.userId || null,
          userEmail: input.userEmail || null,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
          action: input.action,
          severity: input.severity,
          description: input.description,
          details: input.details || null,
        },
      });
    } catch (err) {
      console.error('[SecurityEventLogger Error] Failed to log security event:', err);
    }
  }
}
