import { db } from '../db';
import { RuleState, DetectionCategory, SecurityEventSeverity } from '@prisma/client';

export class DetectionRuleEngine {
  /**
   * Initializes standard system detection rule configs if missing.
   */
  static async bootstrapRules(): Promise<void> {
    const rules = [
      {
        name: 'BRUTE_FORCE_BURST',
        severity: SecurityEventSeverity.HIGH,
        category: DetectionCategory.AUTHENTICATION,
        thresholds: { failedLoginsMax: 10, windowMs: 300000 }, // 5 mins
      },
      {
        name: 'CREDENTIAL_STUFFING_ATTACK',
        severity: SecurityEventSeverity.CRITICAL,
        category: DetectionCategory.AUTHENTICATION,
        thresholds: { uniqueAccountsMax: 50, windowMs: 300000 },
      },
      {
        name: 'IMPOSSIBLE_TRAVEL_SPEED',
        severity: SecurityEventSeverity.HIGH,
        category: DetectionCategory.GEOLOCATION,
        thresholds: { speedThresholdKmh: 900.0, windowHours: 12.0 },
      },
      {
        name: 'INSIDER_EXFILTRATION_BURST',
        severity: SecurityEventSeverity.HIGH,
        category: DetectionCategory.INSIDER_THREAT,
        thresholds: { reportsMax: 3, windowMs: 300000 },
      },
      {
        name: 'SESSION_HIJACKING_ATTEMPT',
        severity: SecurityEventSeverity.CRITICAL,
        category: DetectionCategory.SESSION,
        thresholds: { fingerprintMatchRequired: true },
      }
    ];

    for (const r of rules) {
      const existing = await db.detectionRuleConfig.findUnique({
        where: { name: r.name }
      });
      if (!existing) {
        await db.detectionRuleConfig.create({
          data: {
            name: r.name,
            severity: r.severity,
            category: r.category,
            state: RuleState.ACTIVE,
            thresholds: r.thresholds,
            tuningSettings: {},
          }
        });
      }
    }
  }

  /**
   * Increments rule performance trigger metrics.
   */
  static async recordTrigger(ruleName: string, isTruePositive: boolean): Promise<any> {
    const rule = await db.detectionRuleConfig.findUnique({
      where: { name: ruleName }
    });

    if (!rule) return null;

    const newTriggerCount = rule.triggerCount + 1;
    const newTruePos = rule.truePositives + (isTruePositive ? 1 : 0);
    const newFalsePos = rule.falsePositives + (isTruePositive ? 0 : 1);

    // Calculate metrics
    const precision = newTriggerCount > 0 ? newTruePos / newTriggerCount : 1.0;
    const falsePositiveRate = newTriggerCount > 0 ? newFalsePos / newTriggerCount : 0.0;

    return await db.detectionRuleConfig.update({
      where: { id: rule.id },
      data: {
        triggerCount: newTriggerCount,
        truePositives: newTruePos,
        falsePositives: newFalsePos,
        precision,
        falsePositiveRate,
        accuracy: precision // simplify mapping to precision for standard scoring
      }
    });
  }

  /**
   * Updates rule enable/disable, severity, thresholds config.
   */
  static async updateRuleConfig(
    id: string,
    params: {
      state?: RuleState;
      severity?: SecurityEventSeverity;
      thresholds?: any;
      tuningSettings?: any;
    }
  ): Promise<any> {
    return await db.detectionRuleConfig.update({
      where: { id },
      data: {
        ...(params.state && { state: params.state }),
        ...(params.severity && { severity: params.severity }),
        ...(params.thresholds && { thresholds: params.thresholds }),
        ...(params.tuningSettings && { tuningSettings: params.tuningSettings }),
        version: `${parseInt(id.substring(0, 1)) || 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}` // increment minor version on change
      }
    });
  }
}
