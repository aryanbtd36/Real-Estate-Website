import { db } from '../db';

export class ThreatIntelligenceService {
  /**
   * Add a threat indicator to the database
   */
  static async addIndicator(type: string, value: string, riskScore: number, description?: string) {
    try {
      const indicator = await db.threatIndicator.upsert({
        where: {
          type_value: {
            type: type.toUpperCase(),
            value: value.trim(),
          },
        },
        update: {
          riskScore,
          description: description || null,
        },
        create: {
          type: type.toUpperCase(),
          value: value.trim(),
          riskScore,
          description: description || null,
        },
      });
      return indicator;
    } catch (err) {
      console.error('[ThreatIntelligenceService.addIndicator Error]', err);
      return null;
    }
  }

  /**
   * Remove a threat indicator from the database
   */
  static async removeIndicator(type: string, value: string) {
    try {
      await db.threatIndicator.delete({
        where: {
          type_value: {
            type: type.toUpperCase(),
            value: value.trim(),
          },
        },
      });
      return true;
    } catch (err) {
      console.error('[ThreatIntelligenceService.removeIndicator Error]', err);
      return false;
    }
  }

  /**
   * Check if an IP address matches threat indicators (IP, VPN, TOR, PROXY)
   */
  static async checkIP(ipAddress: string): Promise<{ matches: any[]; totalRisk: number }> {
    try {
      const matches = await db.threatIndicator.findMany({
        where: {
          type: { in: ['IP', 'VPN', 'TOR', 'PROXY'] },
          value: ipAddress.trim(),
        },
      });

      const totalRisk = matches.reduce((sum, m) => sum + m.riskScore, 0);
      return { matches, totalRisk };
    } catch (err) {
      console.error('[ThreatIntelligenceService.checkIP Error]', err);
      return { matches: [], totalRisk: 0 };
    }
  }

  /**
   * Check if a country code matches high-risk country indicators
   */
  static async checkCountry(countryCode: string): Promise<{ isHighRisk: boolean; riskScore: number }> {
    try {
      const match = await db.threatIndicator.findUnique({
        where: {
          type_value: {
            type: 'COUNTRY',
            value: countryCode.toUpperCase().trim(),
          },
        },
      });

      if (match) {
        return { isHighRisk: true, riskScore: match.riskScore };
      }
      return { isHighRisk: false, riskScore: 0 };
    } catch (err) {
      console.error('[ThreatIntelligenceService.checkCountry Error]', err);
      return { isHighRisk: false, riskScore: 0 };
    }
  }

  /**
   * Calculate cumulative risk adjustments based on threat intelligence
   */
  static async getRiskAdjustment(params: {
    ipAddress?: string;
    country?: string;
    isTrustedDevice?: boolean;
  }): Promise<{ score: number; triggers: string[] }> {
    let score = 0;
    const triggers: string[] = [];

    try {
      if (params.ipAddress) {
        const { matches, totalRisk } = await this.checkIP(params.ipAddress);
        if (matches.length > 0) {
          score += totalRisk;
          matches.forEach((m) => triggers.push(`Threat Intel: ${m.type} matches ${m.value} (+${m.riskScore})`));
        }
      }

      if (params.country) {
        const { isHighRisk, riskScore } = await this.checkCountry(params.country);
        if (isHighRisk) {
          score += riskScore;
          triggers.push(`Threat Intel: High Risk Country ${params.country} (+${riskScore})`);
        }
      }

      if (params.isTrustedDevice) {
        score -= 10;
        triggers.push('Threat Intel: Trusted Device (-10)');
      }
    } catch (err) {
      console.error('[ThreatIntelligenceService.getRiskAdjustment Error]', err);
    }

    return { score, triggers };
  }
}
