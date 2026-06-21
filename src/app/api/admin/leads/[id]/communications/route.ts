import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';
import { CommunicationType } from '@prisma/client';

// POST: Log a new communication log
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
    const { type, content } = body;

    if (!type || !content || content.trim() === '') {
      return NextResponse.json({ error: 'Type and content are required' }, { status: 400 });
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify valid communication type enum
    const validTypes = Object.values(CommunicationType);
    if (!validTypes.includes(type as CommunicationType)) {
      return NextResponse.json({ error: 'Invalid communication type' }, { status: 400 });
    }

    const comm = await db.communicationLog.create({
      data: {
        leadId,
        type: type as CommunicationType,
        content,
        createdById: actorId,
      },
    });

    // Extract snippet for summary description
    const snippet = content.length > 50 ? `${content.substring(0, 50)}...` : content;

    eventEmitter.emit(EVENTS.COMMUNICATION_LOGGED, {
      actorId,
      leadId,
      type,
      contentSummary: snippet,
    });

    return NextResponse.json({ success: true, communication: comm });
  } catch (error) {
    console.error('Log communication error:', error);
    return NextResponse.json({ error: 'Failed to log communication' }, { status: 500 });
  }
}
