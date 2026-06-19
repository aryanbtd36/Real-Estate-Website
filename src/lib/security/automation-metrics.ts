import { db } from '../db';

export class SecurityAutomationMetricsService {
  /**
   * Increment a specific security automation metric
   */
  static async incrementMetric(key: string, amount: number = 1): Promise<void> {
    try {
      await db.securityAutomationMetric.upsert({
        where: { key },
        update: {
          value: { increment: amount },
        },
        create: {
          key,
          value: amount,
        },
      });
    } catch (err) {
      console.error(`[SecurityAutomationMetricsService.incrementMetric Error for ${key}]`, err);
    }
  }

  /**
   * Get all tracked metrics (with dynamic fallbacks if needed)
   */
  static async getMetrics() {
    const keys = [
      'incidentsCreated',
      'incidentsAutoResolved',
      'alertsCorrelated',
      'playbooksExecuted',
      'falsePositives',
    ];

    try {
      const records = await db.securityAutomationMetric.findMany({
        where: { key: { in: keys } },
      });

      const metricsMap = records.reduce((acc, r) => {
        acc[r.key] = r.value;
        return acc;
      }, {} as Record<string, number>);

      // Fill in defaults for missing keys
      keys.forEach((key) => {
        if (metricsMap[key] === undefined) {
          metricsMap[key] = 0;
        }
      });

      return {
        incidentsCreated: metricsMap['incidentsCreated'],
        incidentsAutoResolved: metricsMap['incidentsAutoResolved'],
        alertsCorrelated: metricsMap['alertsCorrelated'],
        playbooksExecuted: metricsMap['playbooksExecuted'],
        falsePositives: metricsMap['falsePositives'],
      };
    } catch (err) {
      console.error('[SecurityAutomationMetricsService.getMetrics Error]', err);
      return {
        incidentsCreated: 0,
        incidentsAutoResolved: 0,
        alertsCorrelated: 0,
        playbooksExecuted: 0,
        falsePositives: 0,
      };
    }
  }
}
