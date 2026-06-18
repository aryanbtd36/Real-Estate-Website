import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { PrivacyRequestStatus, SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    // 1. Consent stats
    const totalConsents = await db.userConsent.count();
    const termsAccepted = await db.userConsent.count({ where: { termsAccepted: true } });
    const privacyPolicyAccepted = await db.userConsent.count({ where: { privacyPolicyAccepted: true } });

    // 2. Privacy requests queue
    const privacyRequests = await db.privacyRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Resolve user details for each request
    const privacyRequestsWithUsers = await Promise.all(
      privacyRequests.map(async (req) => {
        const user = await db.user.findUnique({
          where: { id: req.userId },
          select: { name: true, email: true },
        });
        return {
          ...req,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
        };
      })
    );

    // 3. Log retention settings from SystemSettings
    let retentionSetting = await db.systemSetting.findUnique({
      where: { key: 'audit_logs_retention_days' },
    });
    if (!retentionSetting) {
      retentionSetting = await db.systemSetting.create({
        data: { key: 'audit_logs_retention_days', value: '365' },
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalConsents,
        termsAcceptedRate: totalConsents > 0 ? Math.round((termsAccepted / totalConsents) * 100) : 0,
        privacyPolicyAcceptedRate: totalConsents > 0 ? Math.round((privacyPolicyAccepted / totalConsents) * 100) : 0,
      },
      privacyRequests: privacyRequestsWithUsers,
      retentionDays: retentionSetting.value,
    });
  } catch (error: any) {
    console.error('[API Admin Compliance GET] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve compliance information' }, { status: 500 });
  }
}

// POST: Modify compliance parameters (update privacy request status OR update log retention policy)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, requestId, status, retentionDays } = body;

    const ipAddress = request.headers.get('x-forwarded-for') || (request as any).ip || '127.0.0.1';

    if (action === 'update_request') {
      if (!requestId || !status || !Object.values(PrivacyRequestStatus).includes(status)) {
        return NextResponse.json({ error: 'Invalid requestId or status' }, { status: 400 });
      }

      const updatedRequest = await db.privacyRequest.update({
        where: { id: requestId },
        data: {
          status: status as PrivacyRequestStatus,
          completedAt: status === PrivacyRequestStatus.COMPLETED ? new Date() : null,
        },
      });

      // Audit compliance request resolution
      await db.securityEvent.create({
        data: {
          eventType: 'PRIVACY_REQUEST_RESOLVED',
          severity: SecurityEventSeverity.MEDIUM,
          category: SecurityEventCategory.COMPLIANCE,
          title: 'Privacy Request State Updated',
          description: `Super Admin resolved privacy request ${requestId} with status ${status}`,
          userId: actorId,
          ipAddress,
          metadata: { requestId, status },
        },
      });

      // If status is COMPLETED and type is DELETE, schedule or perform data deletion
      if (status === PrivacyRequestStatus.COMPLETED) {
        const targetReq = await db.privacyRequest.findUnique({ where: { id: requestId } });
        if (targetReq?.requestType === 'DELETE') {
          // Soft delete target user
          await db.user.update({
            where: { id: targetReq.userId },
            data: {
              deletedAt: new Date(),
              status: 'SUSPENDED',
            },
          });

          await db.securityEvent.create({
            data: {
              eventType: 'GDPR_DATA_DELETION_EXECUTED',
              severity: SecurityEventSeverity.HIGH,
              category: SecurityEventCategory.COMPLIANCE,
              title: 'GDPR User Profile Deletion Executed',
              description: `User profile soft deleted successfully as per GDPR request compliance. Target User ID: ${targetReq.userId}`,
              userId: actorId,
              ipAddress,
              metadata: { targetUserId: targetReq.userId },
            },
          });
        }
      }

      return NextResponse.json({ success: true, request: updatedRequest });
    }

    if (action === 'update_retention') {
      if (!retentionDays || !['90', '180', '365', 'indefinite'].includes(retentionDays)) {
        return NextResponse.json({ error: 'Invalid retention configuration' }, { status: 400 });
      }

      const updatedSetting = await db.systemSetting.upsert({
        where: { key: 'audit_logs_retention_days' },
        update: { value: retentionDays },
        create: { key: 'audit_logs_retention_days', value: retentionDays },
      });

      // Audit retention setting change
      await db.securityEvent.create({
        data: {
          eventType: 'RETENTION_POLICY_CHANGED',
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.COMPLIANCE,
          title: 'Audit Logs Retention Modified',
          description: `Audit retention duration configured to: ${retentionDays} days.`,
          userId: actorId,
          ipAddress,
          metadata: { retentionDays },
        },
      });

      return NextResponse.json({ success: true, setting: updatedSetting });
    }

    return NextResponse.json({ error: 'Invalid compliance action' }, { status: 400 });
  } catch (error: any) {
    console.error('[API Admin Compliance POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update compliance settings' }, { status: 500 });
  }
}
