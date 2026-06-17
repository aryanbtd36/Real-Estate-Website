import { db } from '../db';
import { RateLimitThreshold, SecurityEventSeverity } from '@prisma/client';
import { SecurityEventLogger } from './event-logger';

export class RateLimiter {
  private static trackers = new Map<string, { count: number; resetAt: number; logged80: boolean; logged90: boolean; logged100: boolean }>();

  static async check(
    key: string,
    ip: string,
    max: number,
    windowMs: number,
    endpoint: string,
    userId?: string
  ): Promise<{ allowed: boolean; count: number; resetAt: number }> {
    const now = Date.now();
    let tracker = this.trackers.get(key);

    if (!tracker || now > tracker.resetAt) {
      tracker = {
        count: 0,
        resetAt: now + windowMs,
        logged80: false,
        logged90: false,
        logged100: false,
      };
      this.trackers.set(key, tracker);
    }

    tracker.count++;

    const limit80 = Math.max(1, Math.floor(max * 0.8));
    const limit90 = Math.max(1, Math.floor(max * 0.9));

    // 80% Threshold
    if (tracker.count >= limit80 && !tracker.logged80) {
      tracker.logged80 = true;
      this.logThresholdEvent(userId, ip, endpoint, RateLimitThreshold.WARNING_80, tracker.count);
    }

    // 90% Threshold
    if (tracker.count >= limit90 && !tracker.logged90) {
      tracker.logged90 = true;
      this.logThresholdEvent(userId, ip, endpoint, RateLimitThreshold.ALERT_90, tracker.count);
    }

    // 100% Threshold (Blocked)
    if (tracker.count > max) {
      if (!tracker.logged100) {
        tracker.logged100 = true;
        this.logThresholdEvent(userId, ip, endpoint, RateLimitThreshold.BLOCKED_100, tracker.count);
      }
      return { allowed: false, count: tracker.count, resetAt: tracker.resetAt };
    }

    return { allowed: true, count: tracker.count, resetAt: tracker.resetAt };
  }

  private static logThresholdEvent(userId: string | undefined, ip: string, endpoint: string, threshold: RateLimitThreshold, count: number) {
    db.rateLimitEvent.create({
      data: {
        userId: userId || null,
        ipAddress: ip,
        endpoint,
        threshold,
        requestCount: count,
      },
    }).catch((err) => console.error('[RateLimiter Event Error]:', err));

    if (threshold === RateLimitThreshold.BLOCKED_100) {
      SecurityEventLogger.log({
        userId,
        ipAddress: ip,
        action: 'Rate Limit Triggered',
        severity: SecurityEventSeverity.MEDIUM,
        description: `Rate limit exceeded on ${endpoint} (Count: ${count}). Request blocked.`,
        details: { endpoint, threshold, count },
      }).catch((err) => console.error('[RateLimiter Security Event Error]:', err));
    }
  }

  // Helper to construct configuration limits dynamically
  static getConfigs() {
    return {
      guest: {
        login: { max: 5, windowMs: 15 * 60 * 1000 },
        register: { max: 5, windowMs: 60 * 60 * 1000 },
        forgotPasswordAccount: { max: 3, windowMs: 60 * 60 * 1000 },
        forgotPasswordIp: { max: 5, windowMs: 60 * 60 * 1000 },
        contactForm: { max: 10, windowMs: 60 * 60 * 1000 },
      },
      user: {
        search: { max: 300, windowMs: 60 * 1000 },
        saves: { max: 500, windowMs: 60 * 60 * 1000 },
        inquiry: { max: 20, windowMs: 60 * 60 * 1000 },
        appointment: { max: 5, windowMs: 60 * 60 * 1000 }, // hourly check
        profile: { max: 50, windowMs: 60 * 60 * 1000 },
      },
      admin: {
        analytics: { max: 300, windowMs: 60 * 60 * 1000 },
        properties: { max: 1000, windowMs: 60 * 60 * 1000 },
        users: { max: 500, windowMs: 60 * 60 * 1000 },
        leads: { max: 1000, windowMs: 60 * 60 * 1000 },
        exports: { max: 10, windowMs: 60 * 60 * 1000 },
      },
      superAdmin: {
        analytics: { max: 1000, windowMs: 60 * 60 * 1000 },
        adminActions: { max: 2000, windowMs: 60 * 60 * 1000 },
        exports: { max: 25, windowMs: 60 * 60 * 1000 },
      }
    };
  }
}
