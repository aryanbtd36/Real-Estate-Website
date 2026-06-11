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
        include: { imagesRelation: true }
      });
      return NextResponse.json(property);
    }

    const properties = await db.property.findMany({
      orderBy: { price: 'desc' },
      include: { imagesRelation: true }
    });
    return NextResponse.json(properties);
  } catch (error) {
    console.error("Production database connection or schema error:", error);
    return NextResponse.json([]);
  }
}
