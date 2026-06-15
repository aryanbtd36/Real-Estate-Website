import { db } from './db';
import { APPOINTMENT_CONFIG } from './config/appointments';

export type ConflictType = 'NO_CONFLICT' | 'ADMIN_CONFLICT' | 'PROPERTY_CONFLICT' | 'MULTIPLE_CONFLICTS';

/**
 * Normalizes Date and parses a date string ("YYYY-MM-DD") and time string ("HH:MM slot" or "10:00 AM")
 * into a valid JavaScript Date in the local timezone.
 */
export function parseDateTime(dateStr: string, timeStr: string): Date {
  const normalized = timeStr.trim().toUpperCase();
  // Match hours and minutes (e.g. "10:00", "09:30")
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);

  // Check AM/PM
  const isPm = normalized.includes('PM');
  const isAm = normalized.includes('AM');

  if (isPm && hours < 12) {
    hours += 12;
  } else if (isAm && hours === 12) {
    hours = 0;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Detects scheduling conflicts for a target showing block using overlapping time-range checks.
 */
export async function detectConflicts(
  appointmentId: string | null,
  startTime: Date,
  endTime: Date,
  adminId: string | null,
  propertyId: string
): Promise<ConflictType> {
  // Active statuses: PENDING, APPROVED, CONFIRMED, RESCHEDULED
  const activeStatuses = ['PENDING', 'APPROVED', 'CONFIRMED', 'RESCHEDULED'];

  const overlappingAppointments = await db.appointment.findMany({
    where: {
      id: appointmentId ? { not: appointmentId } : undefined,
      status: { in: activeStatuses },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: {
      id: true,
      adminId: true,
      propertyId: true,
      startTime: true,
      endTime: true,
    },
  });

  let adminConflict = false;
  let propertyConflict = false;

  for (const app of overlappingAppointments) {
    // Exact overlap: max(Start_A, Start_B) < min(End_A, End_B)
    const maxStart = Math.max(startTime.getTime(), app.startTime.getTime());
    const minEnd = Math.min(endTime.getTime(), app.endTime.getTime());

    if (maxStart < minEnd) {
      if (adminId && app.adminId === adminId) {
        adminConflict = true;
      }
      if (app.propertyId === propertyId) {
        propertyConflict = true;
      }
    }
  }

  if (adminConflict && propertyConflict) {
    return 'MULTIPLE_CONFLICTS';
  } else if (adminConflict) {
    return 'ADMIN_CONFLICT';
  } else if (propertyConflict) {
    return 'PROPERTY_CONFLICT';
  }

  return 'NO_CONFLICT';
}

/**
 * Helper to validate modifications on completed appointments and soft-deleted clients.
 */
export async function validateAppointmentModification(
  appointmentId: string | null,
  userId: string
) {
  // 1. Check soft deleted user
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  if (user && user.deletedAt !== null) {
    throw new Error('Cannot schedule appointments for a soft-deleted user.');
  }

  // 2. Check if modified appointment is completed
  if (appointmentId) {
    const existing = await db.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true },
    });
    if (existing && existing.status.toUpperCase() === 'COMPLETED') {
      throw new Error('Completed appointments cannot be modified.');
    }
  }
}
