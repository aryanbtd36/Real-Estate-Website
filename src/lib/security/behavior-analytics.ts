import { db } from '../db';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { SecurityEventLogger } from './event-logger';

export class BehavioralAnalyticsEngine {
  static async updateProfile(userId: string): Promise<void> {
    try {
      // Fetch user's recent successful login activities
      const logins = await db.session.findMany({
        where: { userId },
        orderBy: { loginAt: 'desc' },
        take: 30,
      });

      if (logins.length === 0) return;

      // Calculate average login hour
      let totalHour = 0;
      const countries: Record<string, number> = {};
      const cities: Record<string, number> = {};
      const devices: Record<string, number> = {};
      const browsers: Record<string, number> = {};
      let totalDuration = 0;
      let durationCount = 0;

      for (const log of logins) {
        const hour = new Date(log.loginAt).getHours();
        totalHour += hour;

        if (log.country) countries[log.country] = (countries[log.country] || 0) + 1;
        if (log.city) cities[log.city] = (cities[log.city] || 0) + 1;
        if (log.device) devices[log.device] = (devices[log.device] || 0) + 1;
        if (log.browser) browsers[log.browser] = (browsers[log.browser] || 0) + 1;

        // Session duration
        if (log.expiresAt && log.loginAt) {
          const durationMin = (new Date(log.expiresAt).getTime() - new Date(log.loginAt).getTime()) / (1000 * 60);
          totalDuration += durationMin;
          durationCount++;
        }
      }

      const averageLoginTime = totalHour / logins.length;
      const typicalSessionDuration = durationCount > 0 ? totalDuration / durationCount : 0.0;

      // Find modes
      const getMode = (obj: Record<string, number>) => {
        let mode = '';
        let max = 0;
        for (const k in obj) {
          if (obj[k] > max) {
            max = obj[k];
            mode = k;
          }
        }
        return mode;
      };

      const typicalCountry = getMode(countries);
      const typicalCity = getMode(cities);
      const typicalDevice = getMode(devices);
      const typicalBrowser = getMode(browsers);

      await db.userBehaviorProfile.upsert({
        where: { userId },
        create: {
          userId,
          averageLoginTime,
          typicalCountry,
          typicalCity,
          typicalDevice,
          typicalBrowser,
          typicalSessionDuration,
          typicalActivityPattern: 'STANDARD_ACTIVE_USER',
        },
        update: {
          averageLoginTime,
          typicalCountry,
          typicalCity,
          typicalDevice,
          typicalBrowser,
          typicalSessionDuration,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[BehavioralAnalyticsEngine.updateProfile Error]', err);
    }
  }

  static async analyzeBehavior(
    userId: string,
    userEmail: string,
    currentHour: number,
    country: string,
    city: string,
    device: string,
    browser: string
  ): Promise<{ riskDelta: number; triggers: string[] }> {
    let riskDelta = 0;
    const triggers: string[] = [];

    try {
      const profile = await db.userBehaviorProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        // No profile yet, skip analysis but schedule update
        return { riskDelta, triggers };
      }

      // 1. Check Login Hour
      const hourDiff = Math.abs(currentHour - profile.averageLoginTime);
      const cyclicDiff = Math.min(hourDiff, 24 - hourDiff);

      if (cyclicDiff > 5) {
        riskDelta += 15;
        triggers.push('Unusual Login Time');
        await SecurityEventLogger.log({
          userId,
          userEmail,
          eventType: 'BEHAVIORAL_ANOMALY',
          category: SecurityEventCategory.SECURITY,
          severity: SecurityEventSeverity.MEDIUM,
          title: 'Unusual Login Time Detected',
          description: `User ${userEmail} logged in at an unusual hour (${currentHour}:00) compared to average profile hour (${Math.round(profile.averageLoginTime)}:00).`,
          metadata: { currentHour, profileAverageHour: profile.averageLoginTime },
          riskScore: 15,
        });
      }

      // 2. Check Country
      if (profile.typicalCountry && country !== profile.typicalCountry) {
        riskDelta += 20;
        triggers.push('Unusual Country');
        await SecurityEventLogger.log({
          userId,
          userEmail,
          eventType: 'BEHAVIORAL_ANOMALY',
          category: SecurityEventCategory.SECURITY,
          severity: SecurityEventSeverity.HIGH,
          title: 'Unusual Country Detected',
          description: `User ${userEmail} logged in from unusual country: ${country} (typical is ${profile.typicalCountry}).`,
          metadata: { country, typicalCountry: profile.typicalCountry },
          riskScore: 20,
        });
      }

      // 3. Check Device / Browser Anomaly
      if (profile.typicalDevice && device !== profile.typicalDevice) {
        riskDelta += 10;
        triggers.push('Unusual Device');
        await SecurityEventLogger.log({
          userId,
          userEmail,
          eventType: 'BEHAVIORAL_ANOMALY',
          category: SecurityEventCategory.SECURITY,
          severity: SecurityEventSeverity.MEDIUM,
          title: 'Unusual Device Detected',
          description: `User ${userEmail} logged in using unusual device type: ${device} (typical is ${profile.typicalDevice}).`,
          metadata: { device, typicalDevice: profile.typicalDevice },
          riskScore: 10,
        });
      }
    } catch (err) {
      console.error('[BehavioralAnalyticsEngine.analyzeBehavior Error]', err);
    }

    return { riskDelta, triggers };
  }
}
