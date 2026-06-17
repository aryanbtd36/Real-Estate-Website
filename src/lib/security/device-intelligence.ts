import { db } from '../db';
import { DeviceState, SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { ThreatDetectionService } from './threat-detection';
import crypto from 'crypto';

export class DeviceIntelligenceService {
  static computeHash(browser: string, os: string, device: string, asn: string): string {
    const data = `${browser.toLowerCase()}|${os.toLowerCase()}|${device.toLowerCase()}|${asn.toLowerCase()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static async analyzeDevice(
    userId: string,
    userEmail: string,
    browser: string,
    os: string,
    device: string,
    asn: string,
    country: string,
    city: string
  ): Promise<{ state: DeviceState; riskDelta: number }> {
    const fingerprintHash = this.computeHash(browser, os, device, asn);

    try {
      const existing = await db.deviceFingerprint.findUnique({
        where: {
          userId_fingerprintHash: {
            userId,
            fingerprintHash,
          },
        },
      });

      if (!existing) {
        // First seen device: Register it as NEW
        await db.deviceFingerprint.create({
          data: {
            userId,
            fingerprintHash,
            browser,
            os,
            device,
            country,
            city,
            state: DeviceState.NEW,
            trusted: false,
          },
        });

        // Log new device login event
        await ThreatDetectionService.raiseAlert({
          title: 'New Device Login',
          description: `User ${userEmail} logged in using a new device/browser fingerprint.`,
          severity: SecurityEventSeverity.LOW,
          category: SecurityEventCategory.AUTHENTICATION,
          eventType: 'NEW_DEVICE_LOGIN',
          userId,
          userEmail,
          riskScore: 15,
          metadata: { browser, os, device, country, city },
        });

        return { state: DeviceState.NEW, riskDelta: 15 };
      }

      // Update last seen
      await db.deviceFingerprint.update({
        where: { id: existing.id },
        data: { lastSeen: new Date() },
      });

      if (existing.state === DeviceState.SUSPICIOUS) {
        await ThreatDetectionService.raiseAlert({
          title: 'Suspicious Device Attempted Login',
          description: `User ${userEmail} attempted login from a flagged suspicious device.`,
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.SECURITY,
          eventType: 'SUSPICIOUS_DEVICE',
          userId,
          userEmail,
          riskScore: 30,
          metadata: { browser, os, device, fingerprintHash },
        });

        return { state: DeviceState.SUSPICIOUS, riskDelta: 30 };
      }

      if (existing.trusted || existing.state === DeviceState.TRUSTED) {
        return { state: DeviceState.TRUSTED, riskDelta: -10 };
      }

      // Recognized known device
      return { state: DeviceState.KNOWN, riskDelta: 0 };
    } catch (err) {
      console.error('[DeviceIntelligenceService Error]', err);
      return { state: DeviceState.NEW, riskDelta: 15 };
    }
  }

  static async trustDevice(userId: string, fingerprintHash: string): Promise<void> {
    await db.deviceFingerprint.update({
      where: {
        userId_fingerprintHash: {
          userId,
          fingerprintHash,
        },
      },
      data: {
        state: DeviceState.TRUSTED,
        trusted: true,
      },
    });
  }

  static async flagDeviceSuspicious(userId: string, fingerprintHash: string): Promise<void> {
    await db.deviceFingerprint.update({
      where: {
        userId_fingerprintHash: {
          userId,
          fingerprintHash,
        },
      },
      data: {
        state: DeviceState.SUSPICIOUS,
        trusted: false,
      },
    });
  }
}
