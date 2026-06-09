import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const totalProperties = await db.property.count();
    const totalUsers = await db.user.count({ where: { role: 'USER' } });
    const totalAppointments = await db.appointment.count();
    const totalVisits = await db.appointment.count({
      where: {
        status: { in: ['APPROVED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED'] }
      }
    });
    const pendingAppointments = await db.appointment.count({ where: { status: 'PENDING' } });

    // Most viewed property
    const mostViewedProperty = await db.property.findFirst({
      orderBy: { views: 'desc' }
    });

    // Most scheduled property
    const properties = await db.property.findMany({
      include: {
        _count: {
          select: { appointments: true }
        }
      }
    });
    const sortedByScheduled = [...properties].sort((a, b) => b._count.appointments - a._count.appointments);
    const mostScheduledProperty = sortedByScheduled[0] && sortedByScheduled[0]._count.appointments > 0 ? sortedByScheduled[0] : null;

    return NextResponse.json({
      totalProperties,
      totalUsers,
      totalAppointments,
      totalVisits,
      pendingAppointments,
      mostViewedProperty,
      mostScheduledProperty: mostScheduledProperty ? {
        id: mostScheduledProperty.id,
        name: mostScheduledProperty.name,
        price: mostScheduledProperty.price,
        count: mostScheduledProperty._count.appointments
      } : null
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
