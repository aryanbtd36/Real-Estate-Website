import { db } from '../db';

export interface ForecastResults {
  leadForecast: {
    expectedMonthlyLeads: number;
    trendDirection: 'UP' | 'DOWN' | 'FLAT';
    confidence: number; // 0 to 100
  };
  revenueForecast: {
    expectedMonthlyRevenue: number;
    trendDirection: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
  };
  conversionForecast: {
    expectedLeadToWinRatio: number;
    trendDirection: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
  };
}

/**
 * Standard Simple Linear Regression
 * Calculates slope (m) and intercept (c) for y = mx + c.
 * x represents the month index (e.g., 0, 1, 2, 3), y represents the metric value.
 */
function calculateRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points[0]?.y || 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

export const ForecastingEngine = {
  /**
   * Generates next-month trend forecasts.
   */
  async generateForecasts(): Promise<ForecastResults> {
    try {
      const now = new Date();
      
      // We will look at the last 4 months (including the current month)
      const months: Date[] = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d);
      }

      // Query all leads and appointments to map deal values in memory
      const [leads, appointments, properties] = await Promise.all([
        db.lead.findMany({
          select: {
            id: true,
            createdAt: true,
            status: true,
            email: true,
          },
        }),
        db.appointment.findMany({
          select: {
            propertyId: true,
            email: true,
          },
        }),
        db.property.findMany({
          select: {
            id: true,
            price: true,
          },
        }),
      ]);

      // Create a quick lookup for property prices
      const priceLookup = new Map<string, number>();
      properties.forEach((p) => priceLookup.set(p.id, p.price));

      // Map lead email to their property prices via appointment
      const leadPropertyPrice = new Map<string, number>();
      appointments.forEach((app) => {
        const price = priceLookup.get(app.propertyId);
        if (price) {
          leadPropertyPrice.set(app.email.toLowerCase(), price);
        }
      });

      // Default fallback property price (average property price or 5,000,000 baseline)
      const defaultPrice = properties.length > 0
        ? properties.reduce((sum, p) => sum + p.price, 0) / properties.length
        : 5000000;

      // Group leads by month buckets
      const buckets = months.map((mStart, idx) => {
        const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 1);

        const monthlyLeads = leads.filter(
          (l) => l.createdAt >= mStart && l.createdAt < mEnd
        );

        const leadCount = monthlyLeads.length;
        const wonLeads = monthlyLeads.filter((l) => l.status === 'WON');
        const wonCount = wonLeads.length;

        // Revenue calculation: Sum of property prices for won leads
        const revenue = wonLeads.reduce((sum, wl) => {
          const price = leadPropertyPrice.get(wl.email.toLowerCase()) || defaultPrice;
          return sum + price;
        }, 0);

        const winRatio = leadCount > 0 ? (wonCount / leadCount) * 100 : 0;

        return {
          monthIndex: idx,
          leadCount,
          revenue,
          winRatio,
        };
      });

      // Run linear regression for each metric
      const leadPoints = buckets.map((b) => ({ x: b.monthIndex, y: b.leadCount }));
      const revenuePoints = buckets.map((b) => ({ x: b.monthIndex, y: b.revenue }));
      const ratioPoints = buckets.map((b) => ({ x: b.monthIndex, y: b.winRatio }));

      const leadReg = calculateRegression(leadPoints);
      const revenueReg = calculateRegression(revenuePoints);
      const ratioReg = calculateRegression(ratioPoints);

      // Project next month (index = 4)
      const nextMonthIdx = 4;
      const expectedLeads = Math.max(0, leadReg.slope * nextMonthIdx + leadReg.intercept);
      const expectedRevenue = Math.max(0, revenueReg.slope * nextMonthIdx + revenueReg.intercept);
      const expectedRatio = Math.max(0, Math.min(100, ratioReg.slope * nextMonthIdx + ratioReg.intercept));

      const getDirection = (slope: number): 'UP' | 'DOWN' | 'FLAT' => {
        if (Math.abs(slope) < 0.05) return 'FLAT';
        return slope > 0 ? 'UP' : 'DOWN';
      };

      // Confidence score is higher if we have stable, non-zero values
      const getConfidence = (points: number[]) => {
        const nonZero = points.filter(p => p > 0).length;
        if (nonZero === 0) return 30; // base confidence
        if (nonZero === 1) return 50;
        return 70 + (nonZero * 5); // 4 points -> 90% confidence
      };

      return {
        leadForecast: {
          expectedMonthlyLeads: Math.round(expectedLeads),
          trendDirection: getDirection(leadReg.slope),
          confidence: getConfidence(buckets.map((b) => b.leadCount)),
        },
        revenueForecast: {
          expectedMonthlyRevenue: parseFloat(expectedRevenue.toFixed(2)),
          trendDirection: getDirection(revenueReg.slope),
          confidence: getConfidence(buckets.map((b) => b.revenue)),
        },
        conversionForecast: {
          expectedLeadToWinRatio: parseFloat(expectedRatio.toFixed(2)),
          trendDirection: getDirection(ratioReg.slope),
          confidence: getConfidence(buckets.map((b) => b.winRatio)),
        },
      };
    } catch (error) {
      console.error('[ForecastingEngine.generateForecasts] Error:', error);
      return {
        leadForecast: { expectedMonthlyLeads: 0, trendDirection: 'FLAT', confidence: 0 },
        revenueForecast: { expectedMonthlyRevenue: 0, trendDirection: 'FLAT', confidence: 0 },
        conversionForecast: { expectedLeadToWinRatio: 0, trendDirection: 'FLAT', confidence: 0 },
      };
    }
  },
};
