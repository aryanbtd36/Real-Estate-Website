import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { calculateEngagementScore, getEngagementCategory } from '@/lib/engagement';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const actorRole = (session?.user as any)?.role;

    if (!session || (actorRole !== 'ADMIN' && actorRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch user basic data first
    const user = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            propertyViews: true,
            savedProperties: true,
            appointments: true,
          },
        },
      },
    });

    if (!user || user.deletedAt !== null) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Run parallel queries to gather other fields
    const [
      savedProperties,
      appointments,
      inquiries,
      roleHistory,
      statusHistory,
      profileHistory,
      activityLogs,
    ] = await Promise.all([
      db.savedProperty.findMany({
        where: { userId: id },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              type: true,
              price: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.appointment.findMany({
        where: { userId: id },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      db.lead.findMany({
        where: { email: user.email },
        include: {
          assignedTo: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.roleHistory.findMany({
        where: { userId: id },
        include: {
          changedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.userStatusHistory.findMany({
        where: { userId: id },
        include: {
          changedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.userProfileHistory.findMany({
        where: { userId: id },
        include: {
          changedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.activityLog.findMany({
        where: {
          OR: [
            { actorId: id },
            { targetUserId: id },
          ],
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const viewsCount = user._count.propertyViews;
    const savesCount = savedProperties.length;
    const inquiriesCount = inquiries.length;
    const appointmentsCount = appointments.length;

    const engagementScore = calculateEngagementScore({
      viewsCount,
      savesCount,
      inquiriesCount,
      appointmentsCount,
    });
    const engagementCategory = getEngagementCategory(engagementScore);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        lastActivity: user.lastActivity,
      },
      metrics: {
        viewsCount,
        savesCount,
        inquiriesCount,
        appointmentsCount,
        engagementScore,
        engagementCategory,
      },
      savedProperties,
      appointments,
      inquiries,
      roleHistory,
      statusHistory,
      profileHistory,
      activityLogs,
    });
  } catch (error) {
    console.error('[API Admin User Details GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}
