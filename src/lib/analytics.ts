import { db } from './db';
import { PropertyStatus } from '@prisma/client';

export interface DashboardStats {
  totalProperties: number;
  publishedProperties: number;
  draftProperties: number;
  archivedProperties: number;
  totalInquiries: number;
  totalAppointments: number;
  totalUsers: number;
  activeUsers: number;
  conversionRate: number;
}

export const DashboardAnalyticsService = {
  /**
   * Aggregates all KPI statistics for the admin dashboard in parallel.
   * Uses optimized queries and aggregation to avoid N+1 queries.
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [
        totalProperties,
        propertiesByStatus,
        totalInquiries,
        totalAppointments,
        successfulAppointments,
        totalUsers,
        activeUsers,
      ] = await Promise.all([
        // 1. Total Properties count
        db.property.count(),

        // 2. Group by status to get counts of Published, Draft, Archived in one query
        db.property.groupBy({
          by: ['status'],
          _count: {
            id: true,
          },
        }),

        // 3. Total Inquiries (leads)
        db.lead.count(),

        // 4. Total Appointments
        db.appointment.count(),

        // 5. Successful Appointments (Approved, Confirmed, Completed, Rescheduled)
        db.appointment.count({
          where: {
            status: { in: ['APPROVED', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'] },
          },
        }),

        // 6. Registered Clients (role: USER, not soft-deleted)
        db.user.count({
          where: {
            role: 'USER',
            deletedAt: null,
          },
        }),

        // 7. Active Clients (role: USER, status: ACTIVE, not soft-deleted)
        db.user.count({
          where: {
            role: 'USER',
            status: 'ACTIVE',
            deletedAt: null,
          },
        }),
      ]);

      // Map grouped status counts
      let publishedProperties = 0;
      let draftProperties = 0;
      let archivedProperties = 0;

      propertiesByStatus.forEach((group) => {
        if (group.status === PropertyStatus.PUBLISHED) {
          publishedProperties = group._count.id;
        } else if (group.status === PropertyStatus.DRAFT) {
          draftProperties = group._count.id;
        } else if (group.status === PropertyStatus.ARCHIVED) {
          archivedProperties = group._count.id;
        }
      });

      // Calculate conversion rate (percentage of appointments that are successful / confirmed)
      const conversionRate = totalAppointments > 0 
        ? parseFloat(((successfulAppointments / totalAppointments) * 100).toFixed(2))
        : 0;

      return {
        totalProperties,
        publishedProperties,
        draftProperties,
        archivedProperties,
        totalInquiries,
        totalAppointments,
        totalUsers,
        activeUsers,
        conversionRate,
      };
    } catch (error) {
      console.error('[DashboardAnalyticsService.getDashboardStats] Error:', error);
      return {
        totalProperties: 0,
        publishedProperties: 0,
        draftProperties: 0,
        archivedProperties: 0,
        totalInquiries: 0,
        totalAppointments: 0,
        totalUsers: 0,
        activeUsers: 0,
        conversionRate: 0,
      };
    }
  },
};
