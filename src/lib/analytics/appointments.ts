import { db } from '../db';
import { ActivityAction } from '@prisma/client';

export interface AdminAppointmentPerformance {
  adminId: string;
  adminName: string;
  appointmentsManaged: number;
  completionRate: number;
  conversionRate: number;
}

export interface AppointmentAnalyticsData {
  overview: {
    scheduled: number;
    completed: number;
    cancelled: number;
    rescheduled: number;
  };
  outcomes: {
    converted: number;
    followUpNeeded: number;
    notInterested: number;
  };
  adminPerformance: AdminAppointmentPerformance[];
}

export const AppointmentAnalyticsService = {
  /**
   * Aggregates appointment states and maps outcomes and admin metrics.
   */
  async getAppointmentAnalytics(): Promise<AppointmentAnalyticsData> {
    try {
      const [appointments, leads, followUps, admins, activityLogs] = await Promise.all([
        db.appointment.findMany({
          select: { id: true, userId: true, email: true, status: true, propertyId: true },
        }),
        db.lead.findMany({
          select: { id: true, email: true, status: true, assignedToId: true },
        }),
        db.followUp.findMany({
          where: { completed: false },
          select: { leadId: true },
        }),
        db.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true, name: true, email: true },
        }),
        db.activityLog.findMany({
          where: { action: ActivityAction.APPOINTMENT_UPDATE },
          select: { actorId: true, details: true },
        }),
      ]);

      const adminMap = new Map<string, string>();
      admins.forEach((a) => adminMap.set(a.id, a.name || a.email));

      // 1. Overview counts
      let scheduled = 0;
      let completed = 0;
      let cancelled = 0;
      let rescheduled = 0;

      appointments.forEach((app) => {
        const status = app.status.toUpperCase();
        if (status === 'COMPLETED') completed++;
        else if (status === 'CANCELLED') cancelled++;
        else if (status === 'RESCHEDULED') rescheduled++;
        else scheduled++; // PENDING, CONFIRMED, APPROVED
      });

      // 2. Outcomes mappings
      let converted = 0;
      let followUpNeeded = 0;
      let notInterested = 0;

      appointments.forEach((app) => {
        const appEmail = app.email.toLowerCase();
        const clientLead = leads.find((l) => l.email.toLowerCase() === appEmail);

        if (clientLead) {
          if (clientLead.status === 'WON') {
            converted++;
          } else if (clientLead.status === 'LOST') {
            notInterested++;
          } else {
            const hasFollowUp = followUps.some((f) => f.leadId === clientLead.id);
            if (hasFollowUp) {
              followUpNeeded++;
            } else {
              notInterested++;
            }
          }
        } else {
          // If no lead exists, map based on appointment status
          if (app.status === 'COMPLETED') converted++;
          else if (app.status === 'CANCELLED') notInterested++;
          else followUpNeeded++;
        }
      });

      // 3. Admin Performance calculations
      // Map appointment ID to admin who acted on it via ActivityLog details
      const appActionAdminMap = new Map<string, string>();
      activityLogs.forEach((log) => {
        if (log.actorId) {
          const details = log.details as any;
          if (details && details.appointmentId) {
            appActionAdminMap.set(details.appointmentId, log.actorId);
          }
        }
      });

      // Group appointments by managing admin
      const adminAppsMap = new Map<string, typeof appointments>();
      admins.forEach((admin) => adminAppsMap.set(admin.id, []));

      appointments.forEach((app) => {
        const appEmail = app.email.toLowerCase();
        const clientLead = leads.find((l) => l.email.toLowerCase() === appEmail);
        
        // Find managing admin actor
        let managerId = appActionAdminMap.get(app.id);
        
        // Fallback to lead assigned admin
        if (!managerId && clientLead?.assignedToId) {
          managerId = clientLead.assignedToId;
        }

        if (managerId && adminAppsMap.has(managerId)) {
          adminAppsMap.get(managerId)!.push(app);
        }
      });

      const adminPerformance: AdminAppointmentPerformance[] = admins.map((admin) => {
        const adminApps = adminAppsMap.get(admin.id) || [];
        const total = adminApps.length;
        const comp = adminApps.filter((a) => a.status === 'COMPLETED').length;
        
        // Conversion: Converted outcome count
        let conv = 0;
        adminApps.forEach((app) => {
          const clientLead = leads.find((l) => l.email.toLowerCase() === app.email.toLowerCase());
          if (clientLead?.status === 'WON' || app.status === 'COMPLETED') {
            conv++;
          }
        });

        const completionRate = total > 0 ? (comp / total) * 100 : 0;
        const conversionRate = total > 0 ? (conv / total) * 100 : 0;

        return {
          adminId: admin.id,
          adminName: admin.name || admin.email,
          appointmentsManaged: total,
          completionRate: parseFloat(completionRate.toFixed(2)),
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        };
      });

      // Include unassigned/system appointments performance
      const unassignedApps = appointments.filter((app) => {
        const appEmail = app.email.toLowerCase();
        const clientLead = leads.find((l) => l.email.toLowerCase() === appEmail);
        const managerId = appActionAdminMap.get(app.id) || clientLead?.assignedToId;
        return !managerId || !adminMap.has(managerId);
      });

      if (unassignedApps.length > 0) {
        const total = unassignedApps.length;
        const comp = unassignedApps.filter((a) => a.status === 'COMPLETED').length;
        const conv = unassignedApps.filter((a) => a.status === 'COMPLETED').length; // simple mapping for unassigned

        adminPerformance.push({
          adminId: 'unassigned',
          adminName: 'Unassigned/System',
          appointmentsManaged: total,
          completionRate: parseFloat(((comp / total) * 100).toFixed(2)),
          conversionRate: parseFloat(((conv / total) * 100).toFixed(2)),
        });
      }

      return {
        overview: { scheduled, completed, cancelled, rescheduled },
        outcomes: { converted, followUpNeeded, notInterested },
        adminPerformance,
      };
    } catch (error) {
      console.error('[AppointmentAnalyticsService.getAppointmentAnalytics] Error:', error);
      throw error;
    }
  },
};
