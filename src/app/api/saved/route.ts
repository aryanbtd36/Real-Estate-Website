import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

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

    if (existing) {
      await db.savedProperty.delete({
        where: {
          id: existing.id,
        },
      });
      return NextResponse.json({ saved: false });
    } else {
      await db.savedProperty.create({
        data: {
          userId,
          propertyId,
        },
      });
      return NextResponse.json({ saved: true });
    }
  } catch (error) {
    console.error('Toggle save error:', error);
    return NextResponse.json({ error: 'Failed to toggle saved state' }, { status: 500 });
  }
}
