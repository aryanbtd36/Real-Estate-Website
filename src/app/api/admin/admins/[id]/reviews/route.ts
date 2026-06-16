import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: adminId } = await params;
    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;

    // Restriction: Only Super Admins (Founder or Primary SA) can submit reviews
    if (callerRole !== 'PRIMARY_SUPER_ADMIN' && callerRole !== 'FOUNDER_SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const targetAdmin = await db.user.findUnique({
      where: { id: adminId },
    });

    if (!targetAdmin || targetAdmin.deletedAt !== null) {
      return NextResponse.json({ error: 'Administrator not found' }, { status: 404 });
    }

    const body = await request.json();
    const { rating, notes } = body;

    const numericRating = parseInt(rating, 10);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const review = await db.$transaction(async (tx) => {
      // 1. Create review entry
      const rev = await tx.adminReview.create({
        data: {
          adminId,
          reviewedById: callerId,
          rating: numericRating,
          notes: notes || '',
        },
      });

      // 2. Add activity log
      await tx.activityLog.create({
        data: {
          actorId: callerId,
          targetUserId: adminId,
          action: 'ADMIN_REVIEW',
          description: `Logged performance review for admin ${targetAdmin.email} with rating ${numericRating}/5`,
          details: { rating: numericRating, notesSnippet: (notes || '').substring(0, 100) },
        },
      });

      return rev;
    }, { maxWait: 10000, timeout: 30000 });

    // Emit event
    eventEmitter.emit(EVENTS.ADMIN_REVIEW_CREATED, {
      actorId: callerId,
      targetUserId: adminId,
      rating: numericRating,
    });

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error('[API Admin Admins ID Reviews POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
