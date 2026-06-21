import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { detectConflicts, parseDateTime, validateAppointmentModification } from '@/lib/appointment-conflicts';
import { eventEmitter, EVENTS } from '@/lib/events';
import { APPOINTMENT_CONFIG } from '@/lib/config/appointments';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, date, time, reason, adminId } = body;

    if (!id || !date || !time || !reason) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { property: true }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Lock validations: prevent modifying completed visits
    try {
      await validateAppointmentModification(id, appointment.userId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Resolve target assigned admin
    const targetAdminId = adminId !== undefined ? (adminId === 'unassigned' ? null : adminId) : appointment.adminId;

    // Parse showing target ranges
    const startTime = parseDateTime(date, time);
    const duration = APPOINTMENT_CONFIG.DEFAULT_DURATION_MINUTES;
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    // Overlapping conflict detection checks
    const conflict = await detectConflicts(id, startTime, endTime, targetAdminId, appointment.propertyId);
    if (conflict !== 'NO_CONFLICT') {
      return NextResponse.json({ error: `Overlap detected: ${conflict}` }, { status: 409 });
    }

    // Database modifications in transaction
    const updated = await db.$transaction(async (tx) => {
      // 1. Log slot modifications to RescheduleHistory
      await tx.appointmentRescheduleHistory.create({
        data: {
          appointmentId: id,
          previousDate: `${appointment.date} ${appointment.time}`,
          newDate: `${date} ${time}`,
          reason,
          changedById: actorId,
        }
      });

      // 2. Log ActivityLog entry
      await tx.activityLog.create({
        data: {
          actorId,
          targetUserId: appointment.userId,
          action: 'APPOINTMENT_RESCHEDULE',
          description: `Rescheduled appointment for ${appointment.name} (Property: ${appointment.property.name}) to ${date} at ${time}. Reason: ${reason}`,
          details: { appointmentId: id, previousDate: appointment.date, newDate: date, time }
        }
      });

      // 3. Update appointment
      return await tx.appointment.update({
        where: { id },
        data: {
          status: 'RESCHEDULED',
          date,
          time,
          startTime,
          endTime,
          adminId: targetAdminId,
        },
        include: { property: true, user: true }
      });
    });

    // Emit event
    eventEmitter.emit(EVENTS.APPOINTMENT_RESCHEDULED, {
      actorId,
      targetUserId: updated.userId,
      appointmentId: id,
      propertyName: updated.property.name,
      clientName: updated.name,
      status: 'RESCHEDULED',
      date: updated.date,
      time: updated.time,
      reason,
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    console.error('[API Appointment Reschedule PUT] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reschedule appointment' }, { status: 500 });
  }
}
