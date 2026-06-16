import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sortByDistance } from '@/lib/maps/distance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radius') || '25';
    const limitStr = searchParams.get('limit') || '20';

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: 'Missing lat or lng query parameters' }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const radius = parseFloat(radiusStr);
    const limit = parseInt(limitStr, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius) || isNaN(limit)) {
      return NextResponse.json({ error: 'Invalid numeric parameters' }, { status: 400 });
    }

    // Fetch all published and available properties
    const properties = await db.property.findMany({
      where: {
        status: 'PUBLISHED',
        availability: 'AVAILABLE',
      },
      include: {
        imagesRelation: true,
      },
    });

    // Sort by distance and filter by radius
    const sorted = sortByDistance(properties, lat, lng);
    const filtered = sorted.filter((p) => p.distanceKm <= radius).slice(0, limit);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[API Nearby GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch nearby properties' }, { status: 500 });
  }
}
