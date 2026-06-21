import { db } from '../db';
import {
  FalsePositiveRecommendationType,
  SecurityAlertStatus,
  RuleState
} from '@prisma/client';

export class FalsePositiveAnalysisService {
  /**
   * Scans resolved security alerts to identify rules with high false positive counts.
   */
  static async runAnalysis(): Promise<any[]> {
    const rulesConfigs = await db.detectionRuleConfig.findMany();
    const recommendations: any[] = [];

    for (const rule of rulesConfigs) {
      // Find all resolved security alerts triggered by this rule category/name
      const resolvedAlerts = await db.securityAlert.findMany({
        where: {
          type: rule.name,
          status: { in: [SecurityAlertStatus.RESOLVED, SecurityAlertStatus.FALSE_POSITIVE] }
        }
      });

      if (resolvedAlerts.length === 0) continue;

      const falsePositiveCount = resolvedAlerts.filter(a => a.status === SecurityAlertStatus.FALSE_POSITIVE).length;
      const truePositiveCount = resolvedAlerts.filter(a => a.status === SecurityAlertStatus.RESOLVED).length;
      const falsePositiveRatio = falsePositiveCount / resolvedAlerts.length;

      let recommendation: FalsePositiveRecommendationType = FalsePositiveRecommendationType.KEEP_RULE;
      let reason = `Rule ${rule.name} shows normal validation behavior. Precision is stable.`;

      if (falsePositiveRatio >= 0.8 && resolvedAlerts.length >= 5) {
        recommendation = FalsePositiveRecommendationType.DISABLE_RULE;
        reason = `Rule ${rule.name} has a critical false positive rate of ${Math.round(falsePositiveRatio * 100)}% (out of ${resolvedAlerts.length} incidents). Disabling recommended.`;
      } else if (falsePositiveRatio >= 0.5 && resolvedAlerts.length >= 3) {
        recommendation = FalsePositiveRecommendationType.TUNE_RULE;
        reason = `Rule ${rule.name} triggers too frequently with false positive rate of ${Math.round(falsePositiveRatio * 100)}%. Adjusting thresholds is advised.`;
      } else if (falsePositiveRatio >= 0.3) {
        recommendation = FalsePositiveRecommendationType.LOWER_SEVERITY;
        reason = `Rule ${rule.name} has high false alarm volume. Suggest lowering alert severity.`;
      }

      // Check if recommendation already exists to avoid duplication
      const existing = await db.falsePositiveRecommendation.findFirst({
        where: { ruleConfigId: rule.id, recommendation, accepted: false, rejected: false }
      });

      if (!existing && recommendation !== FalsePositiveRecommendationType.KEEP_RULE) {
        const created = await db.falsePositiveRecommendation.create({
          data: {
            ruleConfigId: rule.id,
            ruleName: rule.name,
            recommendation,
            reason,
            analyzedAlerts: resolvedAlerts.length,
            resolvedOutcomes: { falsePositives: falsePositiveCount, truePositives: truePositiveCount }
          }
        });
        recommendations.push(created);
      }
    }

    return recommendations;
  }

  /**
   * Applies the false positive recommendation, adjusting rule config parameters.
   */
  static async applyRecommendation(recommendationId: string, approvedBy: string): Promise<any> {
    const rec = await db.falsePositiveRecommendation.findUnique({
      where: { id: recommendationId }
    });

    if (!rec) {
      throw new Error(`Recommendation ${recommendationId} not found.`);
    }

    if (rec.accepted || rec.rejected) {
      return rec;
    }

    const { DetectionRuleEngine } = await import('./detection-engine');

    // Mutate the Rule Config state
    switch (rec.recommendation) {
      case FalsePositiveRecommendationType.DISABLE_RULE:
        await DetectionRuleEngine.updateRuleConfig(rec.ruleConfigId, { state: RuleState.DISABLED });
        break;
      case FalsePositiveRecommendationType.TUNE_RULE: {
        const config = await db.detectionRuleConfig.findUnique({ where: { id: rec.ruleConfigId } });
        if (config) {
          const curThresholds = (config.thresholds as any) || {};
          const newThresholds = { ...curThresholds };
          // Loosen thresholds dynamically (increase threshold values to trigger less)
          if (newThresholds.failedLoginsMax) newThresholds.failedLoginsMax = Math.round(newThresholds.failedLoginsMax * 1.5);
          if (newThresholds.uniqueAccountsMax) newThresholds.uniqueAccountsMax = Math.round(newThresholds.uniqueAccountsMax * 1.5);
          if (newThresholds.speedThresholdKmh) newThresholds.speedThresholdKmh = Math.round(newThresholds.speedThresholdKmh * 1.2);
          await DetectionRuleEngine.updateRuleConfig(rec.ruleConfigId, { thresholds: newThresholds });
        }
        break;
      }
      case FalsePositiveRecommendationType.LOWER_SEVERITY: {
        const { SecurityEventSeverity } = await import('@prisma/client');
        await DetectionRuleEngine.updateRuleConfig(rec.ruleConfigId, { severity: SecurityEventSeverity.LOW });
        break;
      }
      default:
        break;
    }

    // Set implemented state
    return await db.falsePositiveRecommendation.update({
      where: { id: recommendationId },
      data: {
        accepted: true,
        implemented: true,
        implementedAt: new Date(),
        effectivenessScore: 100.0, // Initial target score
        history: { approvedBy, timestamp: new Date().toISOString() }
      }
    });
  }

  /**
   * Rejects/Declines a recommendation.
   */
  static async rejectRecommendation(recommendationId: string, rejectedBy: string): Promise<any> {
    return await db.falsePositiveRecommendation.update({
      where: { id: recommendationId },
      data: {
        rejected: true,
        history: { rejectedBy, timestamp: new Date().toISOString() }
      }
    });
  }
}
