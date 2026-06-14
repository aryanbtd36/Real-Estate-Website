import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

// POST: Create a follow-up task
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: leadId } = await params;
    const body = await req.json();
    const { title, description, dueDate, assignedToId } = body;

    if (!title || !dueDate) {
      return NextResponse.json({ error: 'Title and due date are required' }, { status: 400 });
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Assignment soft-delete/active status check
    if (assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || assignee.deletedAt !== null || assignee.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Cannot assign follow-up to a soft-deleted or inactive administrator.' },
          { status: 400 }
        );
      }
    }

    const followUp = await db.followUp.create({
      data: {
        leadId,
        title,
        description,
        dueDate: new Date(dueDate),
        assignedToId: assignedToId || null,
        createdById: actorId,
      },
    });

    eventEmitter.emit(EVENTS.FOLLOW_UP_CREATED, {
      actorId,
      leadId,
      followUpId: followUp.id,
      title: followUp.title,
      assignedToId: followUp.assignedToId,
    });

    return NextResponse.json({ success: true, followUp });
  } catch (error) {
    console.error('Create follow-up error:', error);
    return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 });
  }
}

// PUT: Edit/Complete a follow-up task
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: leadId } = await params;
    const body = await req.json();
    const { followUpId, title, description, dueDate, completed, assignedToId } = body;

    if (!followUpId) {
      return NextResponse.json({ error: 'Follow-Up ID is required' }, { status: 400 });
    }

    const followUp = await db.followUp.findUnique({ where: { id: followUpId } });
    if (!followUp || followUp.leadId !== leadId) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    const updateData: any = {};
    const historyEntries: any[] = Array.isArray(followUp.history) ? followUp.history : [];

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);

    // Assignment change checking
    let reassigned = false;
    if (assignedToId !== undefined && followUp.assignedToId !== assignedToId) {
      if (assignedToId) {
        const assignee = await db.user.findUnique({ where: { id: assignedToId } });
        if (!assignee || assignee.deletedAt !== null || assignee.status !== 'ACTIVE') {
          return NextResponse.json(
            { error: 'Cannot assign follow-up to a soft-deleted or inactive administrator.' },
            { status: 400 }
          );
        }
      }
      updateData.assignedToId = assignedToId;
      reassigned = true;
      historyEntries.push({
        action: 'REASSIGNED',
        from: followUp.assignedToId,
        to: assignedToId,
        at: new Date().toISOString(),
        by: actorId,
      });
    }

    // Completion status check
    let newlyCompleted = false;
    if (completed !== undefined && followUp.completed !== completed) {
      updateData.completed = completed;
      updateData.completedAt = completed ? new Date() : null;
      if (completed) {
        newlyCompleted = true;
      }
      historyEntries.push({
        action: completed ? 'COMPLETED' : 'REOPENED',
        at: new Date().toISOString(),
        by: actorId,
      });
    }

    updateData.history = historyEntries;

    const updatedFollowUp = await db.followUp.update({
      where: { id: followUpId },
      data: updateData,
    });

    const lead = await db.lead.findUnique({ where: { id: leadId } });

    if (newlyCompleted) {
      eventEmitter.emit(EVENTS.FOLLOW_UP_COMPLETED, {
        actorId,
        leadId,
        followUpId,
        title: updatedFollowUp.title,
        assignedToId: updatedFollowUp.assignedToId,
      });
    } else if (reassigned) {
      await ActivityService.log({
        actorId,
        targetUserId: assignedToId || null,
        action: ActivityAction.LEAD_UPDATE,
        description: `Reassigned follow-up "${updatedFollowUp.title}" for lead "${lead?.name}"`,
        details: { leadId, followUpId },
      });
    } else {
      await ActivityService.log({
        actorId,
        action: ActivityAction.LEAD_UPDATE,
        description: `Updated follow-up "${updatedFollowUp.title}" details`,
        details: { leadId, followUpId },
      });
    }

    return NextResponse.json({ success: true, followUp: updatedFollowUp });
  } catch (error) {
    console.error('Update follow-up error:', error);
    return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 });
  }
}

// DELETE: Delete a follow-up task
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: leadId } = await params;
    const { searchParams } = new URL(req.url);
    const followUpId = searchParams.get('followUpId');

    if (!followUpId) {
      return NextResponse.json({ error: 'Follow-Up ID is required' }, { status: 400 });
    }

    const followUp = await db.followUp.findUnique({ where: { id: followUpId } });
    if (!followUp || followUp.leadId !== leadId) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    await db.followUp.delete({ where: { id: followUpId } });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Deleted follow-up task "${followUp.title}" from lead "${lead?.name}"`,
      details: { leadId, followUpId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete follow-up error:', error);
    return NextResponse.json({ error: 'Failed to delete follow-up' }, { status: 500 });
  }
}
