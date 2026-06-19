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

export interface RiskInputParamsV2 {
  // 1. Authentication Risk inputs
  failedLoginsCount?: number;
  isBruteForce?: boolean;
  isCredentialStuffing?: boolean;
  isAccountTakeover?: boolean;
  isMfaEnabled?: boolean;

  // 2. Session Risk inputs
  isSuspiciousSession?: boolean;
  isUnverifiedSession?: boolean;
  sessionAgeHours?: number;
  mustRotate?: boolean;

  // 3. Device Risk inputs
  isNewDevice?: boolean;
  isSuspiciousDevice?: boolean;
  isTrustedDevice?: boolean;

  // 4. Geo Risk inputs
  isNewCountry?: boolean;
  isNewRegion?: boolean;
  isImpossibleTravel?: boolean;

  // 5. Behavior Risk inputs
  isUnusualLoginTime?: boolean;
  isUnusualCountry?: boolean;
  isUnusualDevice?: boolean;
  isAdminAnomaly?: boolean;

  // 6. Threat Intelligence Risk inputs
  isKnownMaliciousIP?: boolean;
  isTorExitNode?: boolean;
  isProxy?: boolean;

  // 7. Correlation Risk inputs
  hasCorrelatedThreats?: boolean;
  correlatedAlertsCount?: number;
  sessionHijackingSuspected?: boolean;
}

export interface RiskResultV2 {
  score: number;
  level: RiskLevel;
  breakdown: {
    authenticationRisk: number;
    sessionRisk: number;
    deviceRisk: number;
    geoRisk: number;
    behaviorRisk: number;
    threatIntelRisk: number;
    correlationRisk: number;
  };
}

export class RiskScoringEngine {
  static getLevel(score: number): RiskLevel {
    if (score <= 24) return 'LOW';
    if (score <= 49) return 'MEDIUM';
    if (score <= 74) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Legacy calculateScore with breakdown attachment for full backward compatibility
   */
  static calculateScore(params: RiskInputParams): { score: number; level: RiskLevel; breakdown: any } {
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

    // Derive a matched component breakdown representing these inputs
    const authenticationRisk = Math.max(0, Math.min(
      (params.failedLoginsCount * 15) +
      (params.isBruteForce ? 50 : 0) +
      (params.isCredentialStuffing ? 60 : 0) +
      (params.isAccountTakeover ? 70 : 0) -
      (params.isMfaEnabled ? 10 : 0),
      100
    ));
    const sessionRisk = Math.max(0, Math.min(params.isVerifiedSession ? 0 : 30, 100));
    const deviceRisk = Math.max(0, Math.min((params.isNewDevice ? 30 : 0) - (params.isTrustedDevice ? 20 : 0), 100));
    const geoRisk = Math.max(0, Math.min((params.isNewCountry ? 40 : 0) + (params.isImpossibleTravel ? 80 : 0), 100));
    const behaviorRisk = Math.max(0, Math.min(params.isImpossibleTravel ? 20 : 0, 100));
    const threatIntelRisk = Math.max(0, Math.min(params.isImpossibleTravel ? 20 : 0, 100));
    const correlationRisk = Math.max(0, Math.min(params.isAccountTakeover ? 80 : 0, 100));

    return {
      score,
      level: this.getLevel(score),
      breakdown: {
        authenticationRisk,
        sessionRisk,
        deviceRisk,
        geoRisk,
        behaviorRisk,
        threatIntelRisk,
        correlationRisk
      }
    };
  }

  /**
   * New V2 risk calculation introducing component-level risks
   */
  static calculateScoreV2(params: RiskInputParamsV2): RiskResultV2 {
    const authenticationRisk = Math.max(0, Math.min(
      (params.failedLoginsCount || 0) * 15 +
      (params.isBruteForce ? 50 : 0) +
      (params.isCredentialStuffing ? 60 : 0) +
      (params.isAccountTakeover ? 70 : 0) -
      (params.isMfaEnabled ? 20 : 0),
      100
    ));

    const sessionRisk = Math.max(0, Math.min(
      (params.isSuspiciousSession ? 50 : 0) +
      (params.isUnverifiedSession ? 30 : 0) +
      ((params.sessionAgeHours || 0) > 24 ? 20 : 0) +
      (params.mustRotate ? 20 : 0),
      100
    ));

    const deviceRisk = Math.max(0, Math.min(
      (params.isNewDevice ? 30 : 0) +
      (params.isSuspiciousDevice ? 80 : 0) -
      (params.isTrustedDevice ? 20 : 0),
      100
    ));

    const geoRisk = Math.max(0, Math.min(
      (params.isNewCountry ? 40 : 0) +
      (params.isNewRegion ? 20 : 0) +
      (params.isImpossibleTravel ? 80 : 0),
      100
    ));

    const behaviorRisk = Math.max(0, Math.min(
      (params.isUnusualLoginTime ? 30 : 0) +
      (params.isUnusualCountry ? 40 : 0) +
      (params.isUnusualDevice ? 20 : 0) +
      (params.isAdminAnomaly ? 50 : 0),
      100
    ));

    const threatIntelRisk = Math.max(0, Math.min(
      (params.isKnownMaliciousIP ? 70 : 0) +
      (params.isTorExitNode ? 50 : 0) +
      (params.isProxy ? 30 : 0),
      100
    ));

    const correlationRisk = Math.max(0, Math.min(
      (params.hasCorrelatedThreats ? 40 : 0) +
      (params.correlatedAlertsCount || 0) * 15 +
      (params.sessionHijackingSuspected ? 80 : 0),
      100
    ));

    // Final score combines all components (using max value for overall posture status)
    const score = Math.max(
      authenticationRisk,
      sessionRisk,
      deviceRisk,
      geoRisk,
      behaviorRisk,
      threatIntelRisk,
      correlationRisk
    );

    return {
      score,
      level: this.getLevel(score),
      breakdown: {
        authenticationRisk,
        sessionRisk,
        deviceRisk,
        geoRisk,
        behaviorRisk,
        threatIntelRisk,
        correlationRisk
      }
    };
  }
}
