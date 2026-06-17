export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskInputParams {
  failedLoginsCount: number;
  isNewDevice: boolean;
  isNewCountry: boolean;
  isImpossibleTravel: boolean;
  isBruteForce: boolean;
  isCredentialStuffing: boolean;
  isAccountTakeover: boolean;
  isTrustedDevice: boolean;
  isMfaEnabled: boolean;
  isVerifiedSession: boolean;
}

export class RiskScoringEngine {
  static getLevel(score: number): RiskLevel {
    if (score <= 24) return 'LOW';
    if (score <= 49) return 'MEDIUM';
    if (score <= 74) return 'HIGH';
    return 'CRITICAL';
  }

  static calculateScore(params: RiskInputParams): { score: number; level: RiskLevel } {
    let score = 0;

    // Incremental factors
    score += params.failedLoginsCount * 10;
    if (params.isNewDevice) score += 15;
    if (params.isNewCountry) score += 25;
    if (params.isImpossibleTravel) score += 40;
    if (params.isBruteForce) score += 50;
    if (params.isCredentialStuffing) score += 60;
    if (params.isAccountTakeover) score += 70;

    // Decremental modifiers
    if (params.isTrustedDevice) score -= 10;
    if (params.isMfaEnabled) score -= 10;
    if (params.isVerifiedSession) score -= 5;

    // Clamp score strictly between 0 and 100
    score = Math.max(0, Math.min(score, 100));

    return {
      score,
      level: this.getLevel(score),
    };
  }
}
