import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    console.log(`[GIS Diagnostics] API route hit with query: "${query}", lat: "${latStr}", lng: "${lngStr}"`);

    if (query) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
      console.log(`[GIS Diagnostics] Proxying Nominatim request for address search: ${url}`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AuraEstatesLocationIntelligence/1.0',
        },
      });
      if (!res.ok) {
        console.error(`[GIS Diagnostics] Nominatim address search proxy failed with status: ${res.status}`);
        return NextResponse.json({ error: `Nominatim failed with status ${res.status}` }, { status: res.status });
      }
      const data = await res.json();
      console.log(`[GIS Diagnostics] Nominatim address search proxy succeeded. Returned ${Array.isArray(data) ? data.length : 0} items.`);
      return NextResponse.json(data);
    }

    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      console.log(`[GIS Diagnostics] Proxying Nominatim request for reverse geocode: ${url}`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AuraEstatesLocationIntelligence/1.0',
        },
      });
      if (!res.ok) {
        console.error(`[GIS Diagnostics] Nominatim reverse proxy failed with status: ${res.status}`);
        return NextResponse.json({ error: `Nominatim failed with status ${res.status}` }, { status: res.status });
      }
      const data = await res.json();
      console.log(`[GIS Diagnostics] Nominatim reverse proxy succeeded for coords: ${lat}, ${lng}`);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Missing parameters q or lat/lng' }, { status: 400 });
  } catch (error: any) {
    console.error('[GIS Diagnostics] API Location Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
