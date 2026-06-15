import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';
import { LeadStatus, LeadPriority, LeadSource } from '@prisma/client';

// Helper to validate status transitions
function validateLeadStatusTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  if (from === 'WON') return false;
  if (from === 'LOST') {
    return ['NEW', 'CONTACTED', 'QUALIFIED'].includes(to);
  }
  if (to === 'LOST') return true;

  const funnel: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATION', 'WON'];
  const fromIndex = funnel.indexOf(from);
  const toIndex = funnel.indexOf(to);

  if (fromIndex !== -1 && toIndex !== -1) {
    return Math.abs(fromIndex - toIndex) === 1;
  }
  return false;
}

// GET: Fetch lead details and build chronological timeline
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        notes: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        followUps: {
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
        communications: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        assignmentHistory: {
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            assignedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        statusHistory: {
          include: {
            changedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch appointments matching this lead by id or email
    const appointments = await db.appointment.findMany({
      where: {
        OR: [
          { leadId: id },
          { email: { equals: lead.email, mode: 'insensitive' } },
        ],
      },
      include: {
        property: { select: { name: true } },
        rescheduleHistory: {
          include: { changedBy: { select: { name: true, email: true } } },
        },
        outcomeHistory: {
          include: { changedBy: { select: { name: true, email: true } } },
        },
        cancellationHistory: {
          include: { cancelledBy: { select: { name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Dynamic Engagement Score calculation
    const user = await db.user.findUnique({
      where: { email: lead.email },
      include: {
        _count: {
          select: {
            propertyViews: true,
            savedProperties: true,
            appointments: true,
          },
        },
      },
    });

    const inquiriesCount = await db.lead.count({ where: { email: lead.email } });
    const viewsCount = user?._count.propertyViews || 0;
    const savesCount = user?._count.savedProperties || 0;
    const appointmentsCount = user?._count.appointments || 0;

    const engagementScore = (viewsCount * 1) + (savesCount * 5) + (inquiriesCount * 10) + (appointmentsCount * 20);

    // Merge entities to build unified chronological timeline
    const timeline: any[] = [];

    lead.notes.forEach((note) => {
      timeline.push({
        id: note.id,
        type: 'NOTE',
        timestamp: note.createdAt,
        content: note.content,
        createdBy: note.createdBy,
        details: { history: note.history },
      });
    });

    lead.comments.forEach((comment) => {
      timeline.push({
        id: comment.id,
        type: 'COMMENT',
        timestamp: comment.createdAt,
        content: comment.content,
        createdBy: comment.createdBy,
      });
    });

    lead.communications.forEach((comm) => {
      timeline.push({
        id: comm.id,
        type: 'COMMUNICATION',
        timestamp: comm.createdAt,
        content: comm.content,
        createdBy: comm.createdBy,
        details: { communicationType: comm.type },
      });
    });

    lead.followUps.forEach((task) => {
      timeline.push({
        id: task.id,
        type: 'FOLLOW_UP',
        timestamp: task.createdAt,
        content: `Follow-up: "${task.title}" (Due: ${new Date(task.dueDate).toLocaleDateString()})`,
        createdBy: task.createdBy,
        details: {
          dueDate: task.dueDate,
          completed: task.completed,
          completedAt: task.completedAt,
          assignedTo: task.assignedTo,
        },
      });
    });

    lead.statusHistory.forEach((statusLog) => {
      timeline.push({
        id: statusLog.id,
        type: 'STATUS_CHANGE',
        timestamp: statusLog.changedAt,
        content: `Status updated from ${statusLog.fromStatus} to ${statusLog.toStatus}`,
        createdBy: statusLog.changedBy,
      });
    });

    lead.assignmentHistory.forEach((assignLog) => {
      const assigneeName = assignLog.assignedTo ? (assignLog.assignedTo.name || assignLog.assignedTo.email) : 'Unassigned';
      timeline.push({
        id: assignLog.id,
        type: 'ASSIGNMENT',
        timestamp: assignLog.assignedAt,
        content: `Assigned to ${assigneeName}`,
        createdBy: assignLog.assignedBy,
      });
    });

    // Append showing & showing history logs to timeline
    appointments.forEach((appt) => {
      timeline.push({
        id: `appt-${appt.id}`,
        type: 'APPOINTMENT',
        timestamp: appt.createdAt,
        content: `Showing booked for "${appt.property.name}" on ${appt.date} at ${appt.time} (Status: ${appt.status})`,
        details: { appointmentId: appt.id, status: appt.status, date: appt.date, time: appt.time },
      });

      appt.rescheduleHistory.forEach((rh) => {
        timeline.push({
          id: `appt-resched-${rh.id}`,
          type: 'APPOINTMENT_RESCHEDULE',
          timestamp: rh.createdAt,
          content: `Showing for "${appt.property.name}" rescheduled to ${rh.newDate}. Reason: ${rh.reason || 'None'}`,
          createdBy: rh.changedBy,
          details: { appointmentId: appt.id, previousDate: rh.previousDate, newDate: rh.newDate, reason: rh.reason },
        });
      });

      appt.outcomeHistory.forEach((oh) => {
        timeline.push({
          id: `appt-outcome-${oh.id}`,
          type: 'APPOINTMENT_OUTCOME',
          timestamp: oh.createdAt,
          content: `Showing outcome recorded: "${oh.newOutcome}". Notes: ${oh.notes || 'None'}`,
          createdBy: oh.changedBy,
          details: { appointmentId: appt.id, previousOutcome: oh.previousOutcome, newOutcome: oh.newOutcome, notes: oh.notes },
        });
      });

      if (appt.cancellationHistory) {
        timeline.push({
          id: `appt-cancel-${appt.cancellationHistory.id}`,
          type: 'APPOINTMENT_CANCEL',
          timestamp: appt.cancellationHistory.createdAt,
          content: `Showing for "${appt.property.name}" cancelled. Reason: ${appt.cancellationHistory.reason || 'None'}`,
          createdBy: appt.cancellationHistory.cancelledBy,
          details: { appointmentId: appt.id, reason: appt.cancellationHistory.reason },
        });
      }
    });

    // Sort timeline chronologically (newest first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      lead,
      engagementScore,
      timeline,
    });
  } catch (error) {
    console.error('Fetch lead details error:', error);
    return NextResponse.json({ error: 'Failed to fetch lead details' }, { status: 500 });
  }
}

// PUT: Update lead details (fields: name, phone, status, priority, source, tags, assignedToId)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, phone, status, priority, source, tags, assignedToId } = body;

    const lead = await db.lead.findUnique({
      where: { id },
      include: { assignedTo: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const updateData: any = {};
    const changes: any = {};

    if (name !== undefined) {
      updateData.name = name;
      if (lead.name !== name) changes.name = { from: lead.name, to: name };
    }
    if (phone !== undefined) {
      updateData.phone = phone;
      if (lead.phone !== phone) changes.phone = { from: lead.phone, to: phone };
    }
    if (priority !== undefined) {
      updateData.priority = priority as LeadPriority;
      if (lead.priority !== priority) changes.priority = { from: lead.priority, to: priority };
    }
    if (source !== undefined) {
      updateData.source = source as LeadSource;
      if (lead.source !== source) changes.source = { from: lead.source, to: source };
    }
    if (tags !== undefined) {
      updateData.tags = tags;
      changes.tags = { from: lead.tags, to: tags };
    }

    // 1. Validate status transition
    if (status !== undefined && lead.status !== status) {
      const isValidTransition = validateLeadStatusTransition(lead.status, status as LeadStatus);
      if (!isValidTransition) {
        return NextResponse.json(
          { error: `Invalid status transition from ${lead.status} to ${status}` },
          { status: 400 }
        );
      }
      updateData.status = status as LeadStatus;
      changes.status = { from: lead.status, to: status };
    }

    // 2. Validate assignment
    let assignmentChanged = false;
    let newAdmin: any = null;
    if (assignedToId !== undefined && lead.assignedToId !== assignedToId) {
      if (assignedToId !== null) {
        // Enforce soft delete and active status validation
        const targetUser = await db.user.findUnique({
          where: { id: assignedToId },
        });

        if (!targetUser || targetUser.deletedAt !== null || targetUser.status !== 'ACTIVE') {
          return NextResponse.json(
            { error: 'Cannot assign to a soft-deleted or inactive administrator.' },
            { status: 400 }
          );
        }
        newAdmin = targetUser;
      }
      updateData.assignedToId = assignedToId;
      assignmentChanged = true;
      changes.assignment = { from: lead.assignedToId, to: assignedToId };
    }

    // Execute updates
    const updatedLead = await db.lead.update({
      where: { id },
      data: updateData,
    });

    // Record status history if changed
    if (changes.status) {
      await db.leadStatusHistory.create({
        data: {
          leadId: id,
          fromStatus: lead.status,
          toStatus: status as LeadStatus,
          changedById: actorId,
        },
      });

      eventEmitter.emit(EVENTS.LEAD_STATUS_CHANGED, {
        actorId,
        leadId: id,
        name: updatedLead.name,
        email: updatedLead.email,
        fromStatus: lead.status,
        toStatus: status,
      });
    }

    // Record assignment history and emit assignment events if changed
    if (assignmentChanged) {
      await db.leadAssignmentHistory.create({
        data: {
          leadId: id,
          assignedToId,
          assignedById: actorId,
        },
      });

      if (assignedToId) {
        if (lead.assignedToId) {
          eventEmitter.emit(EVENTS.LEAD_REASSIGNED, {
            actorId,
            leadId: id,
            name: updatedLead.name,
            assignedToId,
            assignedToName: newAdmin?.name || newAdmin?.email || 'Admin',
            previousAdminName: lead.assignedTo?.name || lead.assignedTo?.email || undefined,
          });
        } else {
          eventEmitter.emit(EVENTS.LEAD_ASSIGNED, {
            actorId,
            leadId: id,
            name: updatedLead.name,
            assignedToId,
            assignedToName: newAdmin?.name || newAdmin?.email || 'Admin',
          });
        }
      }
    }

    // Emit generic update event
    if (Object.keys(changes).length > 0) {
      eventEmitter.emit(EVENTS.LEAD_UPDATED, {
        actorId,
        leadId: id,
        name: updatedLead.name,
        details: changes,
      });
    }

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json({ error: 'Failed to update lead details' }, { status: 500 });
  }
}

// DELETE: Delete lead and its cascade items
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    await db.lead.delete({ where: { id } });

    eventEmitter.emit(EVENTS.INQUIRY_DELETED, {
      actorId,
      leadId: id,
      name: lead.name,
      email: lead.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
