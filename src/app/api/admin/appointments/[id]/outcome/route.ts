import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';
import { validateAppointmentModification } from '@/lib/appointment-conflicts';
import { APPOINTMENT_CONFIG } from '@/lib/config/appointments';
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
    const body = await request.json();
    const { outcome, notes } = body;

    if (!outcome) {
      return NextResponse.json({ error: 'Outcome selection is required' }, { status: 400 });
    }

    const validOutcomes = Object.values(AppointmentOutcome);
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: `Invalid outcome value: ${outcome}` }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { property: true }
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Lock validation: prevent modifications on completed visits
    try {
      await validateAppointmentModification(id, appointment.userId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Determine target Lead status based on outcome
    let targetLeadStatus: any = null;
    if (outcome === 'INTERESTED' || outcome === 'VERY_INTERESTED') {
      targetLeadStatus = 'QUALIFIED';
    } else if (outcome === 'FOLLOW_UP_REQUIRED') {
      targetLeadStatus = 'CONTACTED';
    } else if (outcome === 'NEGOTIATION_STARTED') {
      targetLeadStatus = 'NEGOTIATION';
    } else if (outcome === 'NOT_INTERESTED') {
      targetLeadStatus = 'LOST';
    } else if (outcome === 'SALE_COMPLETED') {
      targetLeadStatus = 'WON';
    }

    // Database transactions
    const result = await db.$transaction(async (tx) => {
      // 1. Record outcome history transition
      await tx.appointmentOutcomeHistory.create({
        data: {
          appointmentId: id,
          previousOutcome: appointment.outcome,
          newOutcome: outcome as AppointmentOutcome,
          changedById: actorId,
          notes: notes || null,
        }
      });

      // 2. Update appointment outcome
      const updatedApp = await tx.appointment.update({
        where: { id },
        data: { outcome: outcome as AppointmentOutcome },
        include: { property: true, user: true }
      });

      // 3. Activity Log showing outcome recorded
      await tx.activityLog.create({
        data: {
          actorId,
          targetUserId: appointment.userId,
          action: 'APPOINTMENT_OUTCOME',
          description: `Recorded outcome "${outcome}" for ${appointment.name}'s showing (Property: ${appointment.property.name})`,
          details: { appointmentId: id, outcome, notes }
        }
      });

      // 4. CRM Integration: Find lead and update status
      let linkedLead = null;
      if (appointment.leadId) {
        linkedLead = await tx.lead.findUnique({ where: { id: appointment.leadId } });
      } else {
        linkedLead = await tx.lead.findFirst({
          where: { email: { equals: appointment.email, mode: 'insensitive' } }
        });
      }

      if (linkedLead && targetLeadStatus) {
        // Update lead status
        await tx.lead.update({
          where: { id: linkedLead.id },
          data: { status: targetLeadStatus }
        });

        // Record lead status history
        await tx.leadStatusHistory.create({
          data: {
            leadId: linkedLead.id,
            fromStatus: linkedLead.status,
            toStatus: targetLeadStatus,
            changedById: actorId,
          }
        });

        // Log lead status activity
        await tx.activityLog.create({
          data: {
            actorId,
            action: 'LEAD_STATUS_CHANGE',
            description: `Lead status for ${linkedLead.name} automatically updated to ${targetLeadStatus} following appointment outcome: ${outcome}`,
            details: { leadId: linkedLead.id, fromStatus: linkedLead.status, toStatus: targetLeadStatus }
          }
        });
      }

      // 5. CRM follow-up auto generation
      let autoFollowUp = null;
      if (outcome === 'FOLLOW_UP_REQUIRED' && linkedLead) {
        const due = new Date();
        due.setDate(due.getDate() + APPOINTMENT_CONFIG.AUTO_FOLLOW_UP_DAYS);

        autoFollowUp = await tx.followUp.create({
          data: {
            leadId: linkedLead.id,
            title: `Visit Follow-Up: ${appointment.property.name}`,
            description: `Automated CRM follow-up task. Client showing outcome marked as follow-up required. Observation notes: ${notes || 'none'}`,
            dueDate: due,
            completed: false,
            assignedToId: appointment.adminId || actorId,
            createdById: actorId,
          }
        });

        // Log follow up creation
        await tx.activityLog.create({
          data: {
            actorId,
            action: 'FOLLOW_UP_CREATE',
            description: `Automated follow-up task created for lead ${linkedLead.name}: "Visit Follow-Up: ${appointment.property.name}"`,
            details: { leadId: linkedLead.id, followUpId: autoFollowUp.id }
          }
        });
      }

      return { updatedApp, linkedLead, targetLeadStatus, autoFollowUp };
    });

    // 6. Emit event hooks outside transaction
    eventEmitter.emit(EVENTS.APPOINTMENT_OUTCOME_RECORDED, {
      actorId,
      targetUserId: result.updatedApp.userId,
      appointmentId: id,
      outcome,
      notes,
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

    if (result.autoFollowUp && result.linkedLead) {
      eventEmitter.emit(EVENTS.FOLLOW_UP_CREATED, {
        actorId,
        leadId: result.linkedLead.id,
        followUpId: result.autoFollowUp.id,
        title: result.autoFollowUp.title,
        assignedToId: result.autoFollowUp.assignedToId,
      });
    }

    return NextResponse.json({
      success: true,
      appointment: result.updatedApp,
      leadUpdated: !!result.linkedLead,
      followUpCreated: !!result.autoFollowUp,
    });
  } catch (error: any) {
    console.error('[API Appointment Outcome POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record outcome' }, { status: 500 });
  }
}
