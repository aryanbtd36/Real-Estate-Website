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

    const savedCount = await db.savedProperty.count({ where: { userId } });
    const appointmentsCount = await db.appointment.count({ where: { userId } });
    
    const upcomingAppointments = await db.appointment.findMany({
      where: { userId, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { date: 'asc' },
      take: 3,
      include: { property: true },
    });

    const savedProperties = await db.savedProperty.findMany({
      where: { userId },
      take: 4,
      include: { property: true },
    });

    return NextResponse.json({
      savedCount,
      appointmentsCount,
      upcomingAppointments,
      savedProperties: savedProperties.map(s => s.property),
    });
  } catch (error) {
    console.error('Dashboard stats fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
