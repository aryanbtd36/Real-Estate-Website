import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';
import { validateAppointmentModification } from '@/lib/appointment-conflicts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { property: true }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Lock validations
    try {
      await validateAppointmentModification(id, appointment.userId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      // 1. Log cancellation to CancellationHistory
      await tx.appointmentCancellationHistory.create({
        data: {
          appointmentId: id,
          cancelledById: actorId,
          reason,
        }
      });

      // 2. Log ActivityLog entry
      await tx.activityLog.create({
        data: {
          actorId,
          targetUserId: appointment.userId,
          action: 'APPOINTMENT_CANCEL',
          description: `Cancelled appointment for ${appointment.name} (Property: ${appointment.property.name}). Reason: ${reason}`,
          details: { appointmentId: id, reason }
        }
      });

      // 3. Update status
      return await tx.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
        include: { property: true, user: true }
      });
    });

    // Emit event
    eventEmitter.emit(EVENTS.APPOINTMENT_CANCELLED, {
      actorId,
      targetUserId: updated.userId,
      appointmentId: id,
      propertyName: updated.property.name,
      clientName: updated.name,
      status: 'CANCELLED',
      reason,
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    console.error('[API Appointment Cancel POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel appointment' }, { status: 500 });
  }
}
