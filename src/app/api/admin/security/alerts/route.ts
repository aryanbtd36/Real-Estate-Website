import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SecurityAlertStatus, SecurityEventSeverity } from '@prisma/client';
import { ThreatDetectionService } from '@/lib/security/threat-detection';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    // Extended filters
    const { searchParams } = new URL(request.url);
    const severityFilter = searchParams.get('severity');
    const statusFilter = searchParams.get('status');

    const whereClause: any = {};
    if (severityFilter) {
      whereClause.severity = severityFilter as SecurityEventSeverity;
    }
    if (statusFilter) {
      whereClause.status = statusFilter as SecurityAlertStatus;
    }

    const alerts = await db.securityAlert.findMany({
      where: whereClause,
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('[API Admin Security Alerts GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { alertId, status, assignedToId } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status as SecurityAlertStatus;
      updateData.resolved = status === SecurityAlertStatus.RESOLVED;
    } else {
      updateData.status = SecurityAlertStatus.RESOLVED;
      updateData.resolved = true;
    }

    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId;
    }

    const updatedAlert = await db.securityAlert.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({ success: true, alert: updatedAlert });
  } catch (error: any) {
    console.error('[API Admin Security Alerts POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH: Alert lifecycle transitions via ThreatDetectionService.
 * Supports actions: acknowledge, resolve, false_positive, escalate
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerId = (session.user as any).id;
    const callerRole = (session.user as any).role;
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { alertId, action, assignedToId, notes, newSeverity } = body;

    if (!alertId || !action) {
      return NextResponse.json({ error: 'alertId and action are required' }, { status: 400 });
    }

    let result: any = null;

    switch (action) {
      case 'acknowledge':
        result = await ThreatDetectionService.acknowledgeAlert(alertId, assignedToId || callerId);
        break;
      case 'resolve':
        result = await ThreatDetectionService.resolveAlert(alertId, notes || 'Resolved via SOC Dashboard', callerId);
        break;
      case 'false_positive':
        result = await ThreatDetectionService.markFalsePositive(alertId, notes || 'Marked as false positive', callerId);
        break;
      case 'escalate':
        if (!newSeverity) {
          return NextResponse.json({ error: 'newSeverity is required for escalation' }, { status: 400 });
        }
        result = await ThreatDetectionService.escalateAlert(alertId, newSeverity as SecurityEventSeverity);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ error: 'Alert not found or operation failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert: result });
  } catch (error: any) {
    console.error('[API Admin Security Alerts PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

