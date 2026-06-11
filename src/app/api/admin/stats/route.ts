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
    const totalInquiries = await db.lead.count();
    const totalVisits = await db.appointment.count({
      where: {
        status: { in: ['APPROVED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED'] }
      }
    });
    const pendingAppointments = await db.appointment.count({ where: { status: 'PENDING' } });
    
    // Additional metrics for Section 2A
    const featuredProperties = await db.property.count({ where: { featured: true } });
    const availableProperties = await db.property.count({ where: { availability: 'AVAILABLE' } });
    const soldProperties = await db.property.count({ where: { availability: 'SOLD' } });

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

    // Recent lists
    const recentProperties = await db.property.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentInquiries = await db.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentAppointments = await db.appointment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        property: {
          select: { name: true, location: true }
        }
      }
    });

    return NextResponse.json({
      totalProperties,
      totalUsers,
      totalAppointments,
      totalInquiries,
      totalVisits,
      pendingAppointments,
      featuredProperties,
      availableProperties,
      soldProperties,
      mostViewedProperty,
      mostScheduledProperty: mostScheduledProperty ? {
        id: mostScheduledProperty.id,
        name: mostScheduledProperty.name,
        price: mostScheduledProperty.price,
        count: mostScheduledProperty._count.appointments
      } : null,
      recentProperties,
      recentInquiries,
      recentAppointments
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
