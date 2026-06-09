import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, location, price, bedrooms, area, floor, images } = body;

    if (!name || !location || !price || !bedrooms || !area || !floor) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const property = await db.property.create({
      data: {
        name,
        location,
        price: parseFloat(price),
        bedrooms: parseInt(bedrooms),
        area: parseFloat(area),
        floor: parseInt(floor),
        images: images || '/images/properties/prop1.jpg',
      },
    });

    return NextResponse.json({ success: true, property });
  } catch (error) {
    console.error('Create property error:', error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing property ID' }, { status: 400 });
    }

    await db.property.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete property error:', error);
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }
}
