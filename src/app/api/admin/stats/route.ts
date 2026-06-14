import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { DashboardAnalyticsService } from '@/lib/analytics';
import { ActivityService } from '@/lib/activity';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch KPI metrics from optimized service
    const stats = await DashboardAnalyticsService.getDashboardStats();

    // 2. Fetch other metrics for backward compatibility
    const pendingAppointments = await db.appointment.count({ where: { status: 'PENDING' } });
    
    const totalVisits = await db.appointment.count({
      where: {
        status: { in: ['APPROVED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED'] }
      }
    });

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

    // Recent properties list
    const recentProperties = await db.property.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Recent inquiries list
    const recentInquiries = await db.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Recent appointments list
    const recentAppointments = await db.appointment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        property: {
          select: { name: true, location: true }
        }
      }
    });

    // Recent registered users list (role: USER, not soft-deleted)
    const recentUsers = await db.user.findMany({
      where: {
        role: 'USER',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      }
    });

    // Recent system activity feed (limit 10)
    const { logs: recentActivities } = await ActivityService.getAuditLogs({
      limit: 10,
      offset: 0
    });

    // Upcoming visits list (appointments with active status: APPROVED, CONFIRMED, RESCHEDULED)
    const upcomingVisits = await db.appointment.findMany({
      where: {
        status: { in: ['APPROVED', 'CONFIRMED', 'RESCHEDULED'] },
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ],
      take: 5,
      include: {
        property: {
          select: { name: true, location: true }
        }
      }
    });

    return NextResponse.json({
      // KPI stats
      ...stats,

      // Additional legacy properties
      pendingAppointments,
      totalVisits,
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

      // Lists for dashboard widgets
      recentProperties,
      recentInquiries,
      recentAppointments,
      recentUsers,
      recentActivities,
      upcomingVisits
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
