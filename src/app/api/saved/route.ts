import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventEmitter, EVENTS } from '@/lib/events';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const saved = await db.savedProperty.findMany({
      where: { userId },
      select: { propertyId: true },
    });

    return NextResponse.json(saved.map((s) => s.propertyId));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch saved properties' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });
    }

    const existing = await db.savedProperty.findUnique({
      where: {
        userId_propertyId: { userId, propertyId },
      },
    });

    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { name: true }
    });
    const propertyName = property?.name || 'Property';

    if (existing) {
      await db.savedProperty.delete({
        where: {
          id: existing.id,
        },
      });
      
      // Emit event
      eventEmitter.emit(EVENTS.PROPERTY_UNSAVED, {
        userId,
        propertyId,
        propertyName,
      });

      return NextResponse.json({ saved: false });
    } else {
      await db.savedProperty.create({
        data: {
          userId,
          propertyId,
        },
      });

      // Emit event
      eventEmitter.emit(EVENTS.PROPERTY_SAVED, {
        userId,
        propertyId,
        propertyName,
      });

      return NextResponse.json({ saved: true });
    }
  } catch (error) {
    console.error('Toggle save error:', error);
    return NextResponse.json({ error: 'Failed to toggle saved state' }, { status: 500 });
  }
}
