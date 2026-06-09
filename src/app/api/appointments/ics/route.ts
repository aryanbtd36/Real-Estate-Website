import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateICSString } from '@/lib/mail';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing appointment ID' }, { status: 400 });
    }

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const icsContent = generateICSString(
      appointment.id,
      appointment.property.name,
      appointment.property.location,
      appointment.date,
      appointment.time
    );

    if (!icsContent) {
      return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 });
    }

    // Return the response with appropriate calendar headers
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="aura_visit_${id}.ics"`,
      },
    });
  } catch (error) {
    console.error('ICS download API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
