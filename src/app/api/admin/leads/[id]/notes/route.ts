import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

// POST: Add a new note
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: leadId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const note = await db.leadNote.create({
      data: {
        leadId,
        content,
        createdById: actorId,
      },
    });

    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Added note to lead "${lead.name}"`,
      details: { leadId, noteId: note.id },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error('Create note error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

// PUT: Edit a note (implements history tracking)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: leadId } = await params;
    const body = await req.json();
    const { noteId, content } = body;

    if (!noteId || !content || content.trim() === '') {
      return NextResponse.json({ error: 'Note ID and content are required' }, { status: 400 });
    }

    const note = await db.leadNote.findUnique({ where: { id: noteId } });
    if (!note || note.leadId !== leadId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Capture history
    const previousHistory = Array.isArray(note.history) ? note.history : [];
    const updatedHistory = [
      ...previousHistory,
      {
        content: note.content,
        updatedAt: note.updatedAt.toISOString(),
      },
    ];

    const updatedNote = await db.leadNote.update({
      where: { id: noteId },
      data: {
        content,
        history: updatedHistory,
      },
    });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Edited note on lead "${lead?.name}"`,
      details: { leadId, noteId },
    });

    return NextResponse.json({ success: true, note: updatedNote });
  } catch (error) {
    console.error('Update note error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE: Delete a note
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: leadId } = await params;
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const note = await db.leadNote.findUnique({ where: { id: noteId } });
    if (!note || note.leadId !== leadId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await db.leadNote.delete({ where: { id: noteId } });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Deleted note from lead "${lead?.name}"`,
      details: { leadId, noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
