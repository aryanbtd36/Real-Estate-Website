/**
 * Engagement Service for Aura Estates CRM.
 * Provides functions to calculate client engagement metrics and classifications.
 */

interface EngagementParams {
  viewsCount: number;
  savesCount: number;
  inquiriesCount: number;
  appointmentsCount: number;
}

export type EngagementCategory = 'VIP' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INACTIVE';

export const ENGAGEMENT_THRESHOLDS = {
  VIP: 150,
  HIGH: 50,
  MEDIUM: 15,
  LOW: 1,
};

/**
 * Calculates the numeric engagement score for a user based on platform interactions.
 * Formula:
 * - View Property: 1 pt
 * - Save Property: 5 pts
 * - Inquiry Created: 10 pts
 * - Appointment Booked: 20 pts
 */
export function calculateEngagementScore({
  viewsCount = 0,
  savesCount = 0,
  inquiriesCount = 0,
  appointmentsCount = 0,
}: EngagementParams): number {
  return (
    viewsCount * 1 +
    savesCount * 5 +
    inquiriesCount * 10 +
    appointmentsCount * 20
  );
}

/**
 * Categorizes a user based on their engagement score using centralized thresholds.
 */
export function getEngagementCategory(score: number): EngagementCategory {
  if (score >= ENGAGEMENT_THRESHOLDS.VIP) return 'VIP';
  if (score >= ENGAGEMENT_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= ENGAGEMENT_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (score >= ENGAGEMENT_THRESHOLDS.LOW) return 'LOW';
  return 'INACTIVE';
}
