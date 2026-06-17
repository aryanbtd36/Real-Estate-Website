import { db } from '../db';
import { Session, SessionStatus, SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { SecurityEventLogger } from './event-logger';
import crypto from 'crypto';

import { DeviceIntelligenceService } from './device-intelligence';
import { GeoSecurityEngine } from './geosecurity';
import { BehavioralAnalyticsEngine } from './behavior-analytics';
import { RiskScoringEngine } from './risk-engine';
import { ThreatDetectionService } from './threat-detection';

// Session config timeouts (in milliseconds)
export const SESSION_CONFIG = {
  TIMEOUTS: {
    USER: { IDLE: 60 * 60 * 1000, ABSOLUTE: 24 * 60 * 60 * 1000 },
    ADMIN: { IDLE: 30 * 60 * 1000, ABSOLUTE: 12 * 60 * 60 * 1000 },
    SUPER_ADMIN: { IDLE: 20 * 60 * 1000, ABSOLUTE: 8 * 60 * 60 * 1000 },
  }
};

export interface SessionHeaders {
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  state?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  asn?: string;
}

export class SessionManager {
  private static sha256(val: string): string {
    return crypto.createHash('sha256').update(val).digest('hex');
  }

  private static parseUserAgent(ua: string) {
    let browser = 'unknown';
    let device = 'unknown';
    let os = 'unknown';
    const uaLower = ua.toLowerCase();

    // Browser detection
    if (uaLower.includes('firefox')) browser = 'Firefox';
    else if (uaLower.includes('chrome')) browser = 'Chrome';
    else if (uaLower.includes('safari') && !uaLower.includes('chrome')) browser = 'Safari';
    else if (uaLower.includes('edge')) browser = 'Edge';
    else if (uaLower.includes('msie') || uaLower.includes('trident')) browser = 'IE';

    // Device detection
    if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone') || uaLower.includes('ipad')) {
      device = 'Mobile';
    } else if (uaLower.includes('tablet')) {
      device = 'Tablet';
    } else {
      device = 'Desktop';
    }

    // OS detection
    if (uaLower.includes('windows')) os = 'Windows';
    else if (uaLower.includes('macintosh') || uaLower.includes('mac os')) os = 'macOS';
    else if (uaLower.includes('linux')) os = 'Linux';
    else if (uaLower.includes('android')) os = 'Android';
    else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';

    return { browser, device, operatingSystem: os };
  }

  static getTimeoutLimits(role: string) {
    if (role === 'SUPER_ADMIN') {
      return SESSION_CONFIG.TIMEOUTS.SUPER_ADMIN;
    } else if (role === 'ADMIN') {
      return SESSION_CONFIG.TIMEOUTS.ADMIN;
    }
    return SESSION_CONFIG.TIMEOUTS.USER;
  }

  static async createSession(
    userId: string,
    email: string,
    role: string,
    headersData: SessionHeaders
  ): Promise<Session> {
    const ip = headersData.ipAddress || '127.0.0.1';
    const ua = headersData.userAgent || 'unknown';
    const { browser, device, operatingSystem } = this.parseUserAgent(ua);

    // Parse Vercel headers or fallbacks
    const country = headersData.country || 'IN';
    const state = headersData.state || 'UP';
    const city = headersData.city || 'Lucknow';
    const latitude = headersData.latitude !== undefined ? headersData.latitude : 26.8467;
    const longitude = headersData.longitude !== undefined ? headersData.longitude : 80.9462;
    const asn = headersData.asn || 'AS0';

    // 1. Device Intelligence Check
    const { state: deviceState, riskDelta: deviceRisk } = await DeviceIntelligenceService.analyzeDevice(
      userId,
      email,
      browser,
      operatingSystem,
      device,
      asn,
      country,
      city
    );

    // 2. GeoSecurity Check
    const { riskDelta: geoRisk, triggers: geoTriggers } = await GeoSecurityEngine.analyzeLocation(userId, email, {
      country,
      state,
      city,
      latitude,
      longitude,
      asn,
      isp: 'unknown',
    });

    // 3. Behavioral Anomaly Check
    const now = new Date();
    const currentHour = now.getHours();
    const { riskDelta: behaviorRisk, triggers: behaviorTriggers } = await BehavioralAnalyticsEngine.analyzeBehavior(
      userId,
      email,
      currentHour,
      country,
      city,
      device,
      browser
    );

    // 4. Fetch additional factors
    const failedLoginsCount = await db.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const isImpossibleTravel = geoTriggers.includes('Impossible Travel');
    const isNewDevice = deviceState === 'NEW';
    const isNewCountry = geoTriggers.includes('Country Change');

    // Fetch user details for MFA status check
    const userDb = await db.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    // Detect Account Takeover
    const isAccountTakeover = await ThreatDetectionService.checkAccountTakeover(
      userId,
      email,
      isNewDevice,
      isNewCountry,
      ip
    );

    // Calculate final risk score
    const riskResult = RiskScoringEngine.calculateScore({
      failedLoginsCount,
      isNewDevice,
      isNewCountry,
      isImpossibleTravel,
      isBruteForce: failedLoginsCount >= 10,
      isCredentialStuffing: false,
      isAccountTakeover,
      isTrustedDevice: deviceState === 'TRUSTED',
      isMfaEnabled: !!userDb?.mfaEnabled,
      isVerifiedSession: true,
    });

    const riskScore = riskResult.score;
    const initialStatus = riskScore >= 50 ? SessionStatus.SUSPICIOUS : SessionStatus.ACTIVE;

    const riskTriggers = [...geoTriggers, ...behaviorTriggers];
    if (isNewDevice) riskTriggers.push('New Device');

    // Log security event for suspicious session if risk is elevated
    if (riskScore >= 50) {
      await SecurityEventLogger.log({
        userId,
        userEmail: email,
        eventType: 'SUSPICIOUS_SESSION',
        action: 'Suspicious Session Detected',
        category: SecurityEventCategory.SESSION,
        severity: SecurityEventSeverity.HIGH,
        title: 'Suspicious Session Flagged',
        description: `Session opened with elevated risk factors. Risk Score: ${riskScore}. Triggers: ${riskTriggers.join(', ')}`,
        metadata: { riskScore, riskTriggers, ipAddress: ip },
      });
    }

    // Update behavior profile asynchronously
    BehavioralAnalyticsEngine.updateProfile(userId).catch(console.error);

    // Set expiration times
    const limits = this.getTimeoutLimits(role);
    const expiresAt = new Date(now.getTime() + limits.ABSOLUTE);

    // Create session record
    const session = await db.session.create({
      data: {
        userId,
        userEmail: email,
        userRole: role,
        ipAddress: ip,
        country,
        state,
        city,
        latitude,
        longitude,
        browser,
        device,
        operatingSystem,
        userAgent: ua,
        loginAt: now,
        lastActivityAt: now,
        expiresAt,
        status: initialStatus,
        riskScore,
        deviceFingerprint: this.sha256(device + operatingSystem + asn),
        browserFingerprint: this.sha256(browser + ua),
        ipFingerprint: this.sha256(ip),
      },
    });

    await SecurityEventLogger.log({
      userId,
      userEmail: email,
      ipAddress: ip,
      userAgent: ua,
      action: 'Login Success',
      severity: SecurityEventSeverity.LOW,
      description: `User ${email} successfully authenticated and session created: ${session.id}`,
      details: { sessionId: session.id, role },
    });

    return session;
  }

  static async validateSession(sessionId: string): Promise<Session | null> {
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.SUSPICIOUS) {
      return null;
    }

    const now = new Date();
    const limits = this.getTimeoutLimits(session.userRole);

    // 1. Absolute timeout check
    if (now.getTime() - session.loginAt.getTime() > limits.ABSOLUTE) {
      await db.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.EXPIRED },
      });
      await SecurityEventLogger.log({
        userId: session.userId,
        userEmail: session.userEmail,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent || undefined,
        action: 'Session Expired',
        severity: SecurityEventSeverity.LOW,
        description: `Session ${sessionId} reached absolute expiration limit and was invalidated.`,
        details: { sessionId },
      });
      return null;
    }

    // 2. Idle timeout check
    if (now.getTime() - session.lastActivityAt.getTime() > limits.IDLE) {
      await db.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.EXPIRED },
      });
      await SecurityEventLogger.log({
        userId: session.userId,
        userEmail: session.userEmail,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent || undefined,
        action: 'Session Expired',
        severity: SecurityEventSeverity.LOW,
        description: `Session ${sessionId} expired due to inactivity.`,
        details: { sessionId },
      });
      return null;
    }

    // Throttled activity update (only update lastActivityAt if it has been > 60 seconds since last update)
    if (now.getTime() - session.lastActivityAt.getTime() > 60 * 1000) {
      await db.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: now },
      });
    }

    return session;
  }

  static async rotateSession(oldSessionId: string): Promise<Session> {
    const oldSession = await db.session.findUnique({
      where: { id: oldSessionId },
    });

    if (!oldSession) {
      throw new Error('Old session not found');
    }

    // Mark old session as EXPIRED (or we can use REVOKED, but spec says rotate old)
    await db.session.update({
      where: { id: oldSessionId },
      data: { status: SessionStatus.EXPIRED },
    });

    // Create a new session with identical details but new login / expiry time
    const limits = this.getTimeoutLimits(oldSession.userRole);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + limits.ABSOLUTE);

    const newSession = await db.session.create({
      data: {
        userId: oldSession.userId,
        userEmail: oldSession.userEmail,
        userRole: oldSession.userRole,
        ipAddress: oldSession.ipAddress,
        country: oldSession.country,
        state: oldSession.state,
        city: oldSession.city,
        latitude: oldSession.latitude,
        longitude: oldSession.longitude,
        browser: oldSession.browser,
        device: oldSession.device,
        operatingSystem: oldSession.operatingSystem,
        userAgent: oldSession.userAgent,
        loginAt: now,
        lastActivityAt: now,
        expiresAt,
        status: SessionStatus.ACTIVE,
        riskScore: oldSession.riskScore,
        deviceFingerprint: oldSession.deviceFingerprint,
        browserFingerprint: oldSession.browserFingerprint,
        ipFingerprint: oldSession.ipFingerprint,
      },
    });

    await SecurityEventLogger.log({
      userId: oldSession.userId,
      userEmail: oldSession.userEmail,
      ipAddress: oldSession.ipAddress,
      userAgent: oldSession.userAgent || undefined,
      action: 'Session Rotated',
      severity: SecurityEventSeverity.LOW,
      description: `Session identifier rotated from ${oldSessionId} to ${newSession.id}`,
      details: { oldSessionId, newSessionId: newSession.id },
    });

    return newSession;
  }

  static async revokeSession(sessionId: string, actorId: string): Promise<void> {
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) return;

    await db.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.REVOKED },
    });

    await SecurityEventLogger.log({
      userId: session.userId,
      userEmail: session.userEmail,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent || undefined,
      action: 'Session Revoked',
      severity: SecurityEventSeverity.MEDIUM,
      description: `Session ${sessionId} was explicitly revoked by actor ${actorId}.`,
      details: { sessionId, actorId },
    });
  }

  static async revokeUserSessions(userId: string, actorId: string): Promise<void> {
    await db.session.updateMany({
      where: { userId, status: { in: [SessionStatus.ACTIVE, SessionStatus.SUSPICIOUS] } },
      data: { status: SessionStatus.REVOKED },
    });

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });

    await SecurityEventLogger.log({
      userId,
      userEmail: user?.email || undefined,
      action: 'Session Revoked',
      severity: SecurityEventSeverity.HIGH,
      description: `All active sessions for user ${userId} were explicitly revoked by actor ${actorId}.`,
      details: { userId, actorId },
    });
  }

  static async globalSessionRevocation(actorId: string): Promise<void> {
    await db.session.updateMany({
      where: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SUSPICIOUS] } },
      data: { status: SessionStatus.REVOKED },
    });

    await SecurityEventLogger.log({
      userId: actorId,
      action: 'Session Revoked',
      severity: SecurityEventSeverity.CRITICAL,
      description: `Global active session revocation was triggered by actor ${actorId}.`,
      details: { actorId },
    });
  }

  static async emergencySessionPurge(actorId: string): Promise<void> {
    // Revoke all active sessions
    await db.session.updateMany({
      where: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SUSPICIOUS] } },
      data: { status: SessionStatus.REVOKED },
    });

    // Revoke all admin sessions too
    await db.adminSession.updateMany({
      where: { isActive: true },
      data: { isActive: false, logoutAt: new Date() },
    });

    await SecurityEventLogger.log({
      userId: actorId,
      action: 'Session Revoked',
      severity: SecurityEventSeverity.CRITICAL,
      description: `Emergency session purge triggered by actor ${actorId}.`,
      details: { actorId },
    });
  }
}
