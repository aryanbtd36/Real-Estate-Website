import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'month';
    const adminId = searchParams.get('adminId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const outcome = searchParams.get('outcome');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: any = {};

    if (adminId) {
      whereClause.adminId = adminId === 'unassigned' ? null : adminId;
    }
    if (propertyId) {
      whereClause.propertyId = propertyId;
    }
    if (status) {
      whereClause.status = status;
    }
    if (outcome) {
      whereClause.outcome = outcome as any;
    }

    // Apply date range filter using startTime
    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) {
        whereClause.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.startTime.lte = end;
      }
    }

    const appointments = await db.appointment.findMany({
      where: whereClause,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            type: true,
            price: true,
            location: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ appointments, view });
  } catch (error) {
    console.error('[API Calendar GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar appointments' }, { status: 500 });
  }
}
