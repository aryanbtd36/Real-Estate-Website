import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

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

    const { id: appointmentId } = await params;
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const note = await db.appointmentNote.create({
      data: {
        appointmentId,
        createdById: actorId,
        content,
      },
    });

    // Log update
    await db.activityLog.create({
      data: {
        actorId,
        targetUserId: appointment.userId,
        action: ActivityAction.APPOINTMENT_UPDATE,
        description: `Added note to appointment for ${appointment.name}`,
        details: { appointmentId, noteId: note.id },
      },
    });

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error: any) {
    console.error('[API Appointment Notes POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create note' }, { status: 500 });
  }
}

export async function PUT(
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

    const { id: appointmentId } = await params;
    const { noteId, content } = await request.json();

    if (!noteId || !content || typeof content !== 'string') {
      return NextResponse.json({ error: 'noteId and content are required' }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const existingNote = await db.appointmentNote.findFirst({
      where: { id: noteId, appointmentId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const note = await db.appointmentNote.update({
      where: { id: noteId },
      data: { content },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    console.error('[API Appointment Notes PUT] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: appointmentId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'noteId parameter is required' }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const existingNote = await db.appointmentNote.findFirst({
      where: { id: noteId, appointmentId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await db.appointmentNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API Appointment Notes DELETE] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete note' }, { status: 500 });
  }
}
