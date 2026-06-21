import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';
import { validateAppointmentModification } from '@/lib/appointment-conflicts';
import { AppointmentOutcome } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { outcome, notes } = body;

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

    // Resolve outcome: must be sent in body or already exist on appointment
    const targetOutcome = outcome || appointment.outcome;
    if (!targetOutcome) {
      return NextResponse.json({ error: 'An outcome must be specified to complete this appointment.' }, { status: 400 });
    }

    const validOutcomes = Object.values(AppointmentOutcome);
    if (!validOutcomes.includes(targetOutcome)) {
      return NextResponse.json({ error: `Invalid outcome value: ${targetOutcome}` }, { status: 400 });
    }

    // Determine target Lead status based on outcome
    let targetLeadStatus: any = null;
    if (targetOutcome === 'INTERESTED' || targetOutcome === 'VERY_INTERESTED') {
      targetLeadStatus = 'QUALIFIED';
    } else if (targetOutcome === 'FOLLOW_UP_REQUIRED') {
      targetLeadStatus = 'CONTACTED';
    } else if (targetOutcome === 'NEGOTIATION_STARTED') {
      targetLeadStatus = 'NEGOTIATION';
    } else if (targetOutcome === 'NOT_INTERESTED') {
      targetLeadStatus = 'LOST';
    } else if (targetOutcome === 'SALE_COMPLETED') {
      targetLeadStatus = 'WON';
    }

    // Database updates in transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Log previous and new outcome to OutcomeHistory if changed or newly set
      if (appointment.outcome !== targetOutcome) {
        await tx.appointmentOutcomeHistory.create({
          data: {
            appointmentId: id,
            previousOutcome: appointment.outcome,
            newOutcome: targetOutcome as AppointmentOutcome,
            changedById: actorId,
            notes: notes || 'Set on completion',
          }
        });
      }

      // 2. Update status and outcome on appointment
      const updatedApp = await tx.appointment.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          outcome: targetOutcome as AppointmentOutcome,
          completedAt: new Date(),
        },
        include: { property: true, user: true }
      });

      // 3. Log ActivityLog entry
      await tx.activityLog.create({
        data: {
          actorId,
          targetUserId: appointment.userId,
          action: 'APPOINTMENT_UPDATE',
          description: `Completed visit showing for ${appointment.name} (Property: ${appointment.property.name}) with outcome "${targetOutcome}"`,
          details: { appointmentId: id, outcome: targetOutcome, status: 'COMPLETED' }
        }
      });

      // 4. Lead CRM sync
      let linkedLead = null;
      if (appointment.leadId) {
        linkedLead = await tx.lead.findUnique({ where: { id: appointment.leadId } });
      } else {
        linkedLead = await tx.lead.findFirst({
          where: { email: { equals: appointment.email, mode: 'insensitive' } }
        });
      }

      if (linkedLead && targetLeadStatus) {
        await tx.lead.update({
          where: { id: linkedLead.id },
          data: { status: targetLeadStatus }
        });

        await tx.leadStatusHistory.create({
          data: {
            leadId: linkedLead.id,
            fromStatus: linkedLead.status,
            toStatus: targetLeadStatus,
            changedById: actorId,
          }
        });

        await tx.activityLog.create({
          data: {
            actorId,
            action: 'LEAD_STATUS_CHANGE',
            description: `Lead status for ${linkedLead.name} automatically updated to ${targetLeadStatus} on visit completion with outcome: ${targetOutcome}`,
            details: { leadId: linkedLead.id, fromStatus: linkedLead.status, toStatus: targetLeadStatus }
          }
        });
      }

      return { updatedApp, linkedLead, targetLeadStatus };
    });

    // 5. Emit event hooks
    eventEmitter.emit(EVENTS.APPOINTMENT_UPDATED, {
      actorId,
      targetUserId: result.updatedApp.userId,
      appointmentId: id,
      propertyName: result.updatedApp.property.name,
      clientName: result.updatedApp.name,
      status: 'COMPLETED',
      date: result.updatedApp.date,
      time: result.updatedApp.time,
    });

    if (result.linkedLead && result.targetLeadStatus) {
      eventEmitter.emit(EVENTS.LEAD_STATUS_CHANGED, {
        actorId,
        leadId: result.linkedLead.id,
        name: result.linkedLead.name,
        email: result.linkedLead.email,
        fromStatus: result.linkedLead.status,
        toStatus: result.targetLeadStatus,
      });
    }

    return NextResponse.json({
      success: true,
      appointment: result.updatedApp,
      leadUpdated: !!result.linkedLead,
    });
  } catch (error: any) {
    console.error('[API Appointment Complete POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete appointment' }, { status: 500 });
  }
}
