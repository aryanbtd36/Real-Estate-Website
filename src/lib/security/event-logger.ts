import { db } from '../db';
import { SecurityEventSeverity, SecurityEventCategory, SecurityAlertStatus } from '@prisma/client';

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
  incidentId?: string;

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

export interface EventStreamFilters {
  severity?: SecurityEventSeverity;
  category?: SecurityEventCategory;
  search?: string;
  limit?: number;
  offset?: number;
  hoursBack?: number;
}

export interface AlertSummaryResult {
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
  openCritical: number;
}

export interface CorrelatedEventChain {
  correlationKey: string;
  correlationValue: string;
  events: any[];
  count: number;
  earliestAt: Date;
  latestAt: Date;
  maxSeverity: string;
}

/**
 * Canonical event type constants used across the platform.
 * All event producers should reference these constants for consistency.
 */
export const EVENT_TYPES = {
  // Authentication
  AUTH_LOGIN_SUCCESS: 'Login Success',
  AUTH_LOGIN_FAILURE: 'Login Failed',
  BRUTE_FORCE_ATTEMPT: 'BRUTE_FORCE_ATTEMPT',
  CREDENTIAL_STUFFING: 'CREDENTIAL_STUFFING',
  OTP_ABUSE: 'OTP_ABUSE',
  PASSWORD_RESET_ABUSE: 'PASSWORD_RESET_ABUSE',
  ACCOUNT_TAKEOVER_RISK: 'ACCOUNT_TAKEOVER_RISK',

  // Session
  SESSION_CREATED: 'Login Success',
  SESSION_EXPIRED: 'Session Expired',
  SESSION_REVOKED: 'Session Revoked',
  SESSION_ROTATED: 'Session Rotated',
  SUSPICIOUS_SESSION: 'SUSPICIOUS_SESSION',

  // API Security
  REPLAY_ATTACK_BLOCKED: 'REPLAY_ATTACK_BLOCKED',
  CSRF_ATTACK_BLOCKED: 'CSRF_ATTACK_BLOCKED',
  RATE_LIMIT_TRIGGERED: 'RATE_LIMIT_TRIGGERED',
  PAYLOAD_LIMIT_EXCEEDED: 'Payload Limit Exceeded',
  BOT_SUBMISSION_BLOCKED: 'Bot Submission Blocked',

  // Application Security
  XSS_PAYLOAD_BLOCKED: 'XSS_PAYLOAD_BLOCKED',
  SSTI_ATTEMPT_BLOCKED: 'SSTI_ATTEMPT_BLOCKED',
  MALICIOUS_UPLOAD_BLOCKED: 'MALICIOUS_UPLOAD_BLOCKED',
  SECRET_EXPOSURE_DETECTED: 'SECRET_EXPOSURE_DETECTED',

  // Governance
  GOVERNANCE_LOCKDOWN: 'GLOBAL_LOCKDOWN_ACTIVATED',
  IMMORTAL_MUTATION_ATTEMPT: 'IMMORTAL_MUTATION_ATTEMPT',

  // Geosecurity & Behavior
  LOCATION_ANOMALY: 'LOCATION_ANOMALY',
  IMPOSSIBLE_TRAVEL: 'IMPOSSIBLE_TRAVEL',
  NEW_DEVICE_LOGIN: 'NEW_DEVICE_LOGIN',
  TIME_ANOMALY: 'TIME_ANOMALY',
  DEVICE_ANOMALY: 'DEVICE_ANOMALY',

  // Compliance
  PRIVACY_CONSENT_RECORDED: 'PRIVACY_CONSENT_RECORDED',
  PRIVACY_REQUEST_SUBMITTED: 'PRIVACY_REQUEST_SUBMITTED',
  DATABASE_ACCESS_AUDIT: 'DATABASE_ACCESS_AUDIT',

  // System
  SECURITY_BASELINE_REGRESSION: 'SECURITY_BASELINE_REGRESSION',
  EXPORT_ABUSE: 'EXPORT_ABUSE',

  // Alert Lifecycle (new for Wave 7C.1)
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
  ALERT_ESCALATED: 'ALERT_ESCALATED',
  ALERT_FALSE_POSITIVE: 'ALERT_FALSE_POSITIVE',

  // Incidents and automation (Wave 7C.2)
  INCIDENT_CREATED: 'INCIDENT_CREATED',
  INCIDENT_ASSIGNED: 'INCIDENT_ASSIGNED',
  INCIDENT_TRANSFERRED: 'INCIDENT_TRANSFERRED',
  INCIDENT_UNASSIGNED: 'INCIDENT_UNASSIGNED',
  INCIDENT_CONTAINED: 'INCIDENT_CONTAINED',
  INCIDENT_RESOLVED: 'INCIDENT_RESOLVED',
  INCIDENT_CLOSED: 'INCIDENT_CLOSED',
  PLAYBOOK_EXECUTED: 'PLAYBOOK_EXECUTED',
  SESSION_HIJACKING_SUSPECTED: 'SESSION_HIJACKING_SUSPECTED',
} as const;

export class SecurityEventLogger {
  /**
   * Typed constant map of all event types used across the platform.
   */
  static readonly EVENT_TYPES = EVENT_TYPES;

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
        } else if (lowerEvent.includes('session') || lowerEvent.includes('hijack')) {
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
        } else if (lowerEvent.includes('incident') || lowerEvent.includes('playbook')) {
          category = SecurityEventCategory.SECURITY;
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
          incidentId: input.incidentId || null,
        },
      });

      if (createdEvent) {
        import('./correlation/SecurityCorrelationEngine')
          .then(({ SecurityCorrelationEngine }) => {
            SecurityCorrelationEngine.analyzeEvent(createdEvent).catch((err) => {
              console.error('[Correlation Engine Error]', err);
            });
          })
          .catch((err) => {
            console.error('[Dynamic Import of Correlation Engine Failed]', err);
          });
      }

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

  /**
   * Paginated, filtered event stream query for the SOC dashboard.
   */
  static async getEventStream(filters: EventStreamFilters = {}): Promise<{ events: any[]; totalCount: number }> {
    try {
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      const hoursBack = filters.hoursBack || 24;
      const timeLimit = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const whereClause: any = {
        createdAt: { gte: timeLimit },
      };

      if (filters.severity) {
        whereClause.severity = filters.severity;
      }
      if (filters.category) {
        whereClause.category = filters.category;
      }
      if (filters.search) {
        whereClause.OR = [
          { description: { contains: filters.search, mode: 'insensitive' } },
          { title: { contains: filters.search, mode: 'insensitive' } },
          { eventType: { contains: filters.search, mode: 'insensitive' } },
          { userEmail: { contains: filters.search, mode: 'insensitive' } },
          { ipAddress: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [events, totalCount] = await Promise.all([
        db.securityEvent.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.securityEvent.count({ where: whereClause }),
      ]);

      return { events, totalCount };
    } catch (err) {
      console.error('[SecurityEventLogger.getEventStream Error]', err);
      return { events: [], totalCount: 0 };
    }
  }

  /**
   * Returns aggregated alert counts by severity and status for SOC dashboard widgets.
   */
  static async getAlertSummary(): Promise<AlertSummaryResult> {
    try {
      const [bySeverityRaw, byStatusRaw, total, openCritical] = await Promise.all([
        db.securityAlert.groupBy({
          by: ['severity'],
          _count: { id: true },
        }),
        db.securityAlert.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        db.securityAlert.count(),
        db.securityAlert.count({
          where: {
            status: SecurityAlertStatus.OPEN,
            severity: SecurityEventSeverity.CRITICAL,
          },
        }),
      ]);

      const bySeverity: Record<string, number> = {};
      for (const row of bySeverityRaw) {
        bySeverity[row.severity] = row._count.id;
      }

      const byStatus: Record<string, number> = {};
      for (const row of byStatusRaw) {
        byStatus[row.status] = row._count.id;
      }

      return { bySeverity, byStatus, total, openCritical };
    } catch (err) {
      console.error('[SecurityEventLogger.getAlertSummary Error]', err);
      return { bySeverity: {}, byStatus: {}, total: 0, openCritical: 0 };
    }
  }

  /**
   * Groups related security events by a shared field within a time window.
   * Used to build correlated event chains in the SOC UI.
   */
  static async correlateEvents(
    key: 'userId' | 'ipAddress' | 'sessionId',
    value: string,
    windowMinutes: number = 60
  ): Promise<CorrelatedEventChain | null> {
    try {
      const timeLimit = new Date(Date.now() - windowMinutes * 60 * 1000);
      const whereClause: any = {
        [key]: value,
        createdAt: { gte: timeLimit },
      };

      const events = await db.securityEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      if (events.length === 0) return null;

      // Determine max severity in the chain
      const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      let maxSeverityIdx = 0;
      for (const e of events) {
        const idx = severityOrder.indexOf(e.severity);
        if (idx > maxSeverityIdx) maxSeverityIdx = idx;
      }

      return {
        correlationKey: key,
        correlationValue: value,
        events,
        count: events.length,
        earliestAt: events[0].createdAt,
        latestAt: events[events.length - 1].createdAt,
        maxSeverity: severityOrder[maxSeverityIdx],
      };
    } catch (err) {
      console.error('[SecurityEventLogger.correlateEvents Error]', err);
      return null;
    }
  }
}
