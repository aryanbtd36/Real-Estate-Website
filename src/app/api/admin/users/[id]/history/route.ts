import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const actorRole = (session?.user as any)?.role;

    if (!session || actorRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch user basic data first to get email
    const user = await db.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt !== null) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Run parallel queries to gather timeline details
    const [
      activityLogs,
      roleHistory,
      statusHistory,
      profileHistory,
      savedProperties,
      propertyViews,
      inquiries,
      appointments,
    ] = await Promise.all([
      db.activityLog.findMany({
        where: {
          OR: [
            { actorId: id },
            { targetUserId: id },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.roleHistory.findMany({
        where: { userId: id },
        include: {
          changedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.userStatusHistory.findMany({
        where: { userId: id },
        include: {
          changedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.userProfileHistory.findMany({
        where: { userId: id },
        include: {
          changedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.savedProperty.findMany({
        where: { userId: id },
        include: {
          property: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.propertyView.findMany({
        where: { userId: id },
        include: {
          property: { select: { name: true } },
        },
        orderBy: { viewedAt: 'desc' },
      }),
      db.lead.findMany({
        where: { email: user.email },
        orderBy: { createdAt: 'desc' },
      }),
      db.appointment.findMany({
        where: { userId: id },
        include: {
          property: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Format all events into a unified structure
    const timelineEvents: any[] = [];

    // 1. Role History
    roleHistory.forEach((rh) => {
      timelineEvents.push({
        id: `role-${rh.id}`,
        type: 'ROLE_CHANGE',
        date: rh.createdAt.toISOString(),
        title: 'Role Updated',
        description: `Role changed from "${rh.previousRole}" to "${rh.newRole}" by ${rh.changedBy?.name || rh.changedBy?.email || 'System'}`,
        icon: 'Shield',
        badge: rh.newRole,
        details: {
          previousRole: rh.previousRole,
          newRole: rh.newRole,
          changedBy: rh.changedBy?.name || rh.changedBy?.email,
        },
      });
    });

    // 2. Status History
    statusHistory.forEach((sh) => {
      timelineEvents.push({
        id: `status-${sh.id}`,
        type: 'STATUS_CHANGE',
        date: sh.createdAt.toISOString(),
        title: sh.newStatus === 'SUSPENDED' ? 'Account Suspended' : 'Account Restored',
        description: `Status changed from "${sh.previousStatus}" to "${sh.newStatus}" by ${sh.changedBy?.name || sh.changedBy?.email || 'System'}${sh.reason ? `. Reason: "${sh.reason}"` : ''}`,
        icon: sh.newStatus === 'SUSPENDED' ? 'UserMinus' : 'UserCheck',
        badge: sh.newStatus,
        details: {
          previousStatus: sh.previousStatus,
          newStatus: sh.newStatus,
          reason: sh.reason,
          changedBy: sh.changedBy?.name || sh.changedBy?.email,
        },
      });
    });

    // 3. Profile History
    profileHistory.forEach((ph) => {
      timelineEvents.push({
        id: `profile-${ph.id}`,
        type: 'PROFILE_UPDATE',
        date: ph.createdAt.toISOString(),
        title: `Profile ${ph.fieldName.toUpperCase()} Updated`,
        description: `Field "${ph.fieldName}" modified from "${ph.oldValue || ''}" to "${ph.newValue || ''}" by ${ph.changedBy?.name || ph.changedBy?.email || 'System'}`,
        icon: 'User',
        badge: 'PROFILE',
        details: {
          fieldName: ph.fieldName,
          oldValue: ph.oldValue,
          newValue: ph.newValue,
          changedBy: ph.changedBy?.name || ph.changedBy?.email,
        },
      });
    });

    // 4. Saved Properties
    savedProperties.forEach((sp) => {
      timelineEvents.push({
        id: `save-${sp.id}`,
        type: 'PROPERTY_SAVE',
        date: sp.createdAt.toISOString(),
        title: 'Property Saved',
        description: `Saved "${sp.property.name}" (${sp.property.type})`,
        icon: 'Heart',
        badge: 'SAVE',
        details: {
          propertyId: sp.propertyId,
          propertyName: sp.property.name,
        },
      });
    });

    // 5. Property Views
    propertyViews.forEach((pv) => {
      timelineEvents.push({
        id: `view-${pv.id}`,
        type: 'PROPERTY_VIEW',
        date: pv.viewedAt.toISOString(),
        title: 'Property Viewed',
        description: `Viewed property "${pv.property.name}"`,
        icon: 'Eye',
        badge: 'VIEW',
        details: {
          propertyId: pv.propertyId,
          propertyName: pv.property.name,
        },
      });
    });

    // 6. Inquiries
    inquiries.forEach((lead) => {
      timelineEvents.push({
        id: `lead-${lead.id}`,
        type: 'INQUIRY',
        date: lead.createdAt.toISOString(),
        title: 'CRM Inquiry Created',
        description: `Submitted lead inquiry via ${lead.source}. Message: "${lead.message.substring(0, 120)}${lead.message.length > 120 ? '...' : ''}"`,
        icon: 'MessageSquare',
        badge: lead.status,
        details: {
          leadId: lead.id,
          status: lead.status,
          priority: lead.priority,
          source: lead.source,
        },
      });
    });

    // 7. Appointments
    appointments.forEach((appt) => {
      timelineEvents.push({
        id: `appt-${appt.id}`,
        type: 'APPOINTMENT',
        date: appt.createdAt.toISOString(),
        title: 'Appointment Booked',
        description: `Scheduled viewing of "${appt.property.name}" on ${appt.date} at ${appt.time} (Status: ${appt.status})`,
        icon: 'Calendar',
        badge: appt.status,
        details: {
          appointmentId: appt.id,
          date: appt.date,
          time: appt.time,
          status: appt.status,
        },
      });
    });

    // 8. General Activity Logs (excluding actions that are already recorded by status, role, and profile history tables)
    const trackedActions = ['USER_SUSPEND', 'USER_RESTORE', 'ROLE_PROMOTE', 'ROLE_REVOKE'];
    activityLogs.forEach((log) => {
      // Avoid doubling log entries for status / role histories
      if (trackedActions.includes(log.action) || log.action === 'PROFILE_UPDATE') return;

      timelineEvents.push({
        id: `act-${log.id}`,
        type: 'ACTIVITY',
        date: log.createdAt.toISOString(),
        title: log.action.replace(/_/g, ' '),
        description: log.description,
        icon: log.action.includes('LOGIN') ? 'LogIn' : log.action.includes('LOGOUT') ? 'LogOut' : 'Activity',
        badge: 'LOG',
        details: log.details,
      });
    });

    // Sort newest first (chronologically descending)
    timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ timeline: timelineEvents });
  } catch (error) {
    console.error('[API Admin User History Timeline GET] Error:', error);
    return NextResponse.json({ error: 'Failed to construct user timeline' }, { status: 500 });
  }
}
