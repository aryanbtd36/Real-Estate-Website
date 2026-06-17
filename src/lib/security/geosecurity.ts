import { db } from '../db';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { ThreatDetectionService } from './threat-detection';

export interface GeoLocationInput {
  country: string;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  asn: string;
  isp: string;
}

export class GeoSecurityEngine {
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  static async analyzeLocation(
    userId: string,
    userEmail: string,
    currentLoc: GeoLocationInput
  ): Promise<{ riskDelta: number; triggers: string[] }> {
    let riskDelta = 0;
    const triggers: string[] = [];

    try {
      // Find user's last session that has valid coordinates
      const lastSession = await db.session.findFirst({
        where: {
          userId,
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { lastActivityAt: 'desc' },
      });

      if (!lastSession) {
        return { riskDelta, triggers };
      }

      const lastLat = lastSession.latitude!;
      const lastLon = lastSession.longitude!;
      const lastTime = new Date(lastSession.lastActivityAt).getTime();
      const currentTime = Date.now();

      // Detect Location Changes
      const countryChanged = lastSession.country !== currentLoc.country;
      const stateChanged = lastSession.state !== currentLoc.state;
      const cityChanged = lastSession.city !== currentLoc.city;

      if (countryChanged) {
        riskDelta += 25;
        triggers.push('Country Change');
        await ThreatDetectionService.raiseAlert({
          title: 'Country Change Detected',
          description: `User ${userEmail} shifted country from ${lastSession.country || 'unknown'} to ${currentLoc.country}`,
          severity: SecurityEventSeverity.MEDIUM,
          category: SecurityEventCategory.SECURITY,
          eventType: 'LOCATION_ANOMALY',
          userId,
          userEmail,
          riskScore: 25,
          metadata: { previous: lastSession.country, current: currentLoc.country },
        });
      } else if (stateChanged || cityChanged) {
        riskDelta += 10;
        triggers.push('Location Change');
        await ThreatDetectionService.raiseAlert({
          title: 'Region/City Change Detected',
          description: `User ${userEmail} shifted location to ${currentLoc.city}, ${currentLoc.state}`,
          severity: SecurityEventSeverity.LOW,
          category: SecurityEventCategory.SECURITY,
          eventType: 'LOCATION_ANOMALY',
          userId,
          userEmail,
          riskScore: 10,
          metadata: { previous: `${lastSession.city}, ${lastSession.state}`, current: `${currentLoc.city}, ${currentLoc.state}` },
        });
      }

      // Detect Impossible Travel
      const distance = this.calculateDistance(lastLat, lastLon, currentLoc.latitude, currentLoc.longitude);
      const timeDiffHours = (currentTime - lastTime) / (1000 * 60 * 60);

      // Check if they traveled a non-trivial distance in a short period
      if (distance > 10 && timeDiffHours > 0) {
        const requiredSpeed = distance / timeDiffHours;
        const flightSpeedLimit = 900; // Commercial airline speed limit in km/h

        if (requiredSpeed > flightSpeedLimit && timeDiffHours < 12) {
          riskDelta += 40;
          triggers.push('Impossible Travel');
          await ThreatDetectionService.raiseAlert({
            title: 'Impossible Travel Flight Violation',
            description: `Impossible travel detected for ${userEmail} between ${lastSession.city || 'unknown'} and ${currentLoc.city}. Required speed: ${Math.round(requiredSpeed)} km/h (Distance: ${Math.round(distance)} km, Time: ${Math.round(timeDiffHours * 100) / 100} hours).`,
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.SECURITY,
            eventType: 'IMPOSSIBLE_TRAVEL',
            userId,
            userEmail,
            riskScore: 40,
            metadata: {
              previousLocation: { city: lastSession.city, country: lastSession.country, lat: lastLat, lon: lastLon },
              currentLocation: currentLoc,
              distanceKm: distance,
              timeDiffHours,
              requiredSpeedKmh: requiredSpeed,
            },
          });
        }
      }
    } catch (err) {
      console.error('[GeoSecurityEngine Error]', err);
    }

    return { riskDelta, triggers };
  }
}
