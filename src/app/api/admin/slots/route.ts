import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const where: any = {};
    if (date) {
      where.date = date;
    }

    const slots = await db.availableSlot.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ]
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error('Fetch slots error:', error);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { date, time } = body; // YYYY-MM-DD, e.g., "14:00" or "02:00 PM"

    if (!date || !time) {
      return NextResponse.json({ error: 'Missing date or time' }, { status: 400 });
    }

    // Check if slot already exists
    const existing = await db.availableSlot.findFirst({
      where: { date, time }
    });

    if (existing) {
      return NextResponse.json({ error: 'Slot already exists' }, { status: 400 });
    }

    const newSlot = await db.availableSlot.create({
      data: {
        date,
        time,
        isBooked: false
      }
    });

    return NextResponse.json({ success: true, slot: newSlot });
  } catch (error) {
    console.error('Create slot error:', error);
    return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing slot ID' }, { status: 400 });
    }

    await db.availableSlot.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete slot error:', error);
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
