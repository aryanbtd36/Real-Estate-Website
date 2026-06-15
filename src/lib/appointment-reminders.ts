import { db } from './db';
import { APPOINTMENT_CONFIG } from './config/appointments';
import { AppointmentOutcome } from '@prisma/client';
import { NotificationService } from './notification';
import { NotificationType, ActivityAction } from '@prisma/client';
import { eventEmitter, EVENTS } from './events';

/**
 * Automatically sweeps uncompleted showings past the end-time + grace period.
 * Changes outcome to NO_SHOW and status to COMPLETED.
 */
export async function sweepNoShows() {
  const now = new Date();
  const graceHours = APPOINTMENT_CONFIG.NO_SHOW_GRACE_HOURS;
  const cutoff = new Date(now.getTime() - graceHours * 60 * 60 * 1000);

  // Find active appointments past cutoff
  const noShowApps = await db.appointment.findMany({
    where: {
      status: { in: ['PENDING', 'APPROVED', 'CONFIRMED', 'RESCHEDULED'] },
      endTime: { lt: cutoff },
    },
    include: { property: true, user: true },
  });

  const results = [];
  for (const app of noShowApps) {
    const result = await db.$transaction(async (tx) => {
      // 1. Create outcome history
      await tx.appointmentOutcomeHistory.create({
        data: {
          appointmentId: app.id,
          previousOutcome: app.outcome,
          newOutcome: AppointmentOutcome.NO_SHOW,
          notes: 'Auto-swept by system due to no-show grace period expiry.',
        },
      });

      // 2. Update appointment status & outcome
      const updated = await tx.appointment.update({
        where: { id: app.id },
        data: {
          status: 'COMPLETED',
          outcome: AppointmentOutcome.NO_SHOW,
          completedAt: now,
        },
        include: { property: true, user: true },
      });

      // 3. Create activity log
      await tx.activityLog.create({
        data: {
          actorId: null,
          targetUserId: app.userId,
          action: 'APPOINTMENT_OUTCOME',
          description: `System auto-marked showing for ${app.name} as NO_SHOW (Property: ${app.property.name})`,
          details: { appointmentId: app.id, outcome: 'NO_SHOW', systemTriggered: true },
        },
      });

      return updated;
    });

    // 4. Send Notification Alert to client
    await NotificationService.create({
      userId: app.userId,
      title: 'Showing Marked as No-Show',
      message: `Your scheduled viewing of "${app.property.name}" on ${app.date} was marked as a no-show.`,
      type: NotificationType.APPOINTMENT,
      link: '/dashboard',
    });

    // 5. Send Notification Alert to managing admin
    if (app.adminId) {
      await NotificationService.create({
        userId: app.adminId,
        title: 'Showing Auto-marked No-Show',
        message: `Showing for ${app.name} (Property: ${app.property.name}) was auto-swept to NO_SHOW.`,
        type: NotificationType.APPOINTMENT,
        link: '/admin/appointments',
      });
    }

    eventEmitter.emit(EVENTS.APPOINTMENT_UPDATED, {
      actorId: null,
      targetUserId: app.userId,
      appointmentId: app.id,
      propertyName: app.property.name,
      clientName: app.name,
      status: 'COMPLETED',
      date: app.date,
      time: app.time,
    });

    results.push(result);
  }

  return results;
}

/**
 * Checks for upcoming showings and dispatches reminders to clients
 * at 24 hours, 2 hours, and 30 minutes before visit startTime.
 */
export async function sendUpcomingReminders() {
  const now = new Date();
  const oneDayPlus = new Date(now.getTime() + 25 * 60 * 60 * 1000); // look 25 hours ahead

  // Query active upcoming appointments
  const upcomingApps = await db.appointment.findMany({
    where: {
      status: { in: ['APPROVED', 'CONFIRMED', 'RESCHEDULED'] },
      startTime: {
        gte: now,
        lte: oneDayPlus,
      },
    },
    include: { property: true, user: true },
  });

  if (upcomingApps.length === 0) return [];

  // Query existing activity logs of reminder type to avoid duplicates
  const reminderLogs = await db.activityLog.findMany({
    where: {
      action: ActivityAction.APPOINTMENT_REMINDER,
    },
    select: { details: true },
  });

  const sentMap = new Set<string>(); // "appId:tier"
  reminderLogs.forEach((log) => {
    const details = log.details as any;
    if (details && details.appointmentId && details.tier) {
      sentMap.add(`${details.appointmentId}:${details.tier}`);
    }
  });

  const sentReminders = [];

  for (const app of upcomingApps) {
    const timeDiffMs = app.startTime.getTime() - now.getTime();
    const timeDiffMins = Math.floor(timeDiffMs / (60 * 1000));

    let targetTier: '24H' | '2H' | '30M' | null = null;

    // Determine target tier
    if (timeDiffMins <= 35 && timeDiffMins >= 0) {
      targetTier = '30M';
    } else if (timeDiffMins <= 125 && timeDiffMins >= 110) {
      targetTier = '2H';
    } else if (timeDiffMins <= 1450 && timeDiffMins >= 1390) {
      targetTier = '24H';
    }

    if (targetTier && !sentMap.has(`${app.id}:${targetTier}`)) {
      // 1. Log reminder activity
      await db.activityLog.create({
        data: {
          actorId: null,
          targetUserId: app.userId,
          action: ActivityAction.APPOINTMENT_REMINDER,
          description: `Sent showing reminder (${targetTier} ahead) to ${app.name} for property "${app.property.name}"`,
          details: { appointmentId: app.id, tier: targetTier },
        },
      });

      // 2. Dispatch reminder notification to client
      const friendlyTimeStr = targetTier === '30M' ? '30 minutes' : targetTier === '2H' ? '2 hours' : '24 hours';
      await NotificationService.create({
        userId: app.userId,
        title: 'Property Viewing Reminder',
        message: `Reminder: Your private viewing of "${app.property.name}" is scheduled in ${friendlyTimeStr} (at ${app.time}).`,
        type: NotificationType.APPOINTMENT,
        link: '/dashboard',
      });

      // 3. Emit showing reminder event
      eventEmitter.emit(EVENTS.APPOINTMENT_REMINDER_SENT, {
        targetUserId: app.userId,
        appointmentId: app.id,
        propertyName: app.property.name,
        clientName: app.name,
        date: app.date,
        time: app.time,
      });

      sentReminders.push({ appointmentId: app.id, tier: targetTier });
    }
  }

  return sentReminders;
}
