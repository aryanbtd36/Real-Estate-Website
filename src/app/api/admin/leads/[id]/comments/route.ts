import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

// POST: Add a new comment
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

    const comment = await db.leadComment.create({
      data: {
        leadId,
        content,
        createdById: actorId,
      },
    });

    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Added comment to lead "${lead.name}"`,
      details: { leadId, commentId: comment.id },
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

// PUT: Edit a comment
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
    const { commentId, content } = body;

    if (!commentId || !content || content.trim() === '') {
      return NextResponse.json({ error: 'Comment ID and content are required' }, { status: 400 });
    }

    const comment = await db.leadComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.leadId !== leadId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const updatedComment = await db.leadComment.update({
      where: { id: commentId },
      data: { content },
    });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Edited comment on lead "${lead?.name}"`,
      details: { leadId, commentId },
    });

    return NextResponse.json({ success: true, comment: updatedComment });
  } catch (error) {
    console.error('Update comment error:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

// DELETE: Delete a comment
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
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    const comment = await db.leadComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.leadId !== leadId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    await db.leadComment.delete({ where: { id: commentId } });

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Deleted comment from lead "${lead?.name}"`,
      details: { leadId, commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
