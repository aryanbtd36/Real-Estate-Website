import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { calculateAdminProductivity } from '@/lib/admin-analytics/productivity';
import { Permission, UserRole } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: adminId } = await params;
    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.MANAGE_ADMINS));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    // Fetch the admin user
    const admin = await db.user.findUnique({
      where: { id: adminId },
      include: {
        adminPermissions: true,
        reviewsReceived: {
          include: {
            reviewedBy: {
              select: { name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!admin || admin.deletedAt !== null) {
      return NextResponse.json({ error: 'Administrator not found' }, { status: 404 });
    }

    if (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Selected user is not an administrator' }, { status: 400 });
    }

    // Calculate productivity score
    const productivity = await calculateAdminProductivity(adminId);

    // Fetch CRM Leads
    const leads = await db.lead.findMany({
      where: { assignedToId: adminId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Fetch Appointments
    const appointments = await db.appointment.findMany({
      where: { adminId },
      select: {
        id: true,
        name: true,
        date: true,
        time: true,
        status: true,
        outcome: true,
        createdAt: true,
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Collate activity timeline (combining general activity logs, role histories, status histories, profile edits)
    const [activityLogs, roleLogs, statusLogs, profileLogs] = await Promise.all([
      db.activityLog.findMany({
        where: { actorId: adminId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      db.roleHistory.findMany({
        where: { userId: adminId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.userStatusHistory.findMany({
        where: { userId: adminId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.userProfileHistory.findMany({
        where: { userId: adminId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const timeline: any[] = [];
    activityLogs.forEach((log) => {
      timeline.push({
        id: log.id,
        type: 'ACTIVITY',
        action: log.action,
        description: log.description,
        createdAt: log.createdAt,
      });
    });

    roleLogs.forEach((log) => {
      timeline.push({
        id: log.id,
        type: 'ROLE_CHANGE',
        action: 'ROLE_HISTORY_CREATE',
        description: `Role shifted from ${log.previousRole} to ${log.newRole}`,
        createdAt: log.createdAt,
      });
    });

    statusLogs.forEach((log) => {
      timeline.push({
        id: log.id,
        type: 'STATUS_CHANGE',
        action: 'STATUS_HISTORY_CREATE',
        description: `Account status set to ${log.newStatus} (Reason: ${log.reason || 'None'})`,
        createdAt: log.createdAt,
      });
    });

    profileLogs.forEach((log) => {
      timeline.push({
        id: log.id,
        type: 'PROFILE_CHANGE',
        action: 'PROFILE_UPDATE',
        description: `Edited profile field "${log.fieldName}" from "${log.oldValue || ''}" to "${log.newValue || ''}"`,
        createdAt: log.createdAt,
      });
    });

    // Sort timeline descending by createdAt date
    timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      profile: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        status: admin.status,
        lastLogin: admin.lastLogin,
        lastActivity: admin.lastActivity,
        createdAt: admin.createdAt,
        permissions: admin.adminPermissions.map((ap) => ap.permission),
      },
      productivity,
      leads,
      appointments,
      reviews: admin.reviewsReceived.map((r) => ({
        id: r.id,
        rating: r.rating,
        notes: r.notes,
        createdAt: r.createdAt,
        reviewer: r.reviewedBy?.name || r.reviewedBy?.email || 'System',
      })),
      timeline: timeline.slice(0, 25), // return top 25 records
    });
  } catch (error) {
    console.error('[API Admin Admins ID GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
