import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const increment = searchParams.get('increment');

    if (id) {
      if (increment === 'true') {
        const updated = await db.property.update({
          where: { id },
          data: { views: { increment: 1 } },
        });
        return NextResponse.json(updated);
      }
      const property = await db.property.findUnique({
        where: { id },
      });
      return NextResponse.json(property);
    }

    const properties = await db.property.findMany({
      orderBy: { price: 'desc' },
    });
    return NextResponse.json(properties);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}
