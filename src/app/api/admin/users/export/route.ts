import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { UserStatus, SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';
import { calculateEngagementScore, getEngagementCategory } from '@/lib/engagement';
import { SecurityEventLogger } from '@/lib/security/event-logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actorRole = (session?.user as any)?.role;

    if (!session || (actorRole !== 'ADMIN' && actorRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users (excluding soft-deleted ones)
    const usersRaw = await db.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLogin: true,
        lastActivity: true,
        _count: {
          select: {
            propertyViews: true,
            savedProperties: true,
            appointments: true,
          },
        },
      },
    });

    const callerId = (session?.user as any)?.id;
    const callerEmail = session?.user?.email;
    const callerRole = (session?.user as any)?.role;

    await SecurityEventLogger.log({
      userId: callerId,
      userEmail: callerEmail || undefined,
      userRole: callerRole || undefined,
      eventType: 'DATABASE_ACCESS_AUDIT',
      severity: SecurityEventSeverity.LOW,
      category: SecurityEventCategory.EXPORT,
      title: 'Client Database Exported',
      description: `Admin exported all ${usersRaw.length} user intelligence records to CSV format.`,
      metadata: { recordCount: usersRaw.length }
    });

    // Fetch all leads count grouped by email to optimize and avoid N+1 queries
    const leadsCountGrouped = await db.lead.groupBy({
      by: ['email'],
      _count: {
        id: true,
      },
    });

    const leadsCountMap = new Map<string, number>();
    leadsCountGrouped.forEach((g) => {
      leadsCountMap.set(g.email.toLowerCase(), g._count.id);
    });

    // Helper function to escape CSV values
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = typeof val === 'object' ? val.toISOString() : String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    // CSV Headers
    const headers = [
      'User ID',
      'Name',
      'Email',
      'Phone',
      'Role',
      'Status',
      'Registration Date',
      'Last Login',
      'Last Activity',
      'Lifetime Views',
      'Lifetime Saves',
      'Lifetime Inquiries',
      'Lifetime Appointments',
      'Engagement Score',
      'Engagement Category',
      'Conversion Rate (%)',
    ];

    const rows = [headers.join(',')];

    usersRaw.forEach((u) => {
      const emailKey = u.email.toLowerCase();
      const viewsCount = u._count.propertyViews;
      const savesCount = u._count.savedProperties;
      const inquiriesCount = leadsCountMap.get(emailKey) || 0;
      const appointmentsCount = u._count.appointments;

      const isSuspended = u.status === UserStatus.SUSPENDED;
      const score = isSuspended
        ? 0
        : calculateEngagementScore({
            viewsCount,
            savesCount,
            inquiriesCount,
            appointmentsCount,
          });
      const category = getEngagementCategory(score);

      const conversionRate = inquiriesCount > 0
        ? ((appointmentsCount / inquiriesCount) * 100).toFixed(2)
        : '0.00';

      const row = [
        escapeCsv(u.id),
        escapeCsv(u.name),
        escapeCsv(u.email),
        escapeCsv(u.phone),
        escapeCsv(u.role),
        escapeCsv(u.status),
        escapeCsv(u.createdAt),
        escapeCsv(u.lastLogin),
        escapeCsv(u.lastActivity),
        escapeCsv(viewsCount),
        escapeCsv(savesCount),
        escapeCsv(inquiriesCount),
        escapeCsv(appointmentsCount),
        escapeCsv(score),
        escapeCsv(category),
        escapeCsv(conversionRate),
      ];

      rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="aura_estates_users_export.csv"',
      },
    });
  } catch (error) {
    console.error('[API Admin Users Export GET] Error:', error);
    return NextResponse.json({ error: 'Failed to export users data' }, { status: 500 });
  }
}
