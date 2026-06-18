import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

// GET: Retrieve all Data Access Logs (restricted to SUPER_ADMIN only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { accessorEmail: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { justification: { contains: search, mode: 'insensitive' } },
        { targetModel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.dataAccessLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.dataAccessLog.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[API Admin Governance GET] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve data governance logs' }, { status: 500 });
  }
}

// POST: Log a new high-privilege/sensitive data access event (accessible to ADMIN and SUPER_ADMIN)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;
    const actorEmail = (session?.user as any)?.email;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { actionType, targetModel, targetIds, description, justification } = body;

    if (!actionType || !targetModel || !description || !justification) {
      return NextResponse.json({ error: 'Missing required logging fields' }, { status: 400 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || (request as any).ip || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    const accessLog = await db.dataAccessLog.create({
      data: {
        accessorId: actorId,
        accessorEmail: actorEmail || 'Unknown',
        accessorRole: role,
        actionType,
        targetModel,
        targetIds: targetIds || [],
        description,
        justification,
        ipAddress,
        userAgent,
      },
    });

    // Create a governance auditing SecurityEvent
    await db.securityEvent.create({
      data: {
        eventType: 'SENSITIVE_DATA_ACCESSED',
        severity: SecurityEventSeverity.MEDIUM,
        category: SecurityEventCategory.EXPORT,
        title: 'Sensitive Data Audited Read',
        description: `Admin ${actorEmail} accessed ${targetModel} records. Justification: ${justification}`,
        userId: actorId,
        ipAddress,
        metadata: { accessLogId: accessLog.id, targetModel, actionType },
      },
    });

    return NextResponse.json({ success: true, accessLog }, { status: 201 });
  } catch (error: any) {
    console.error('[API Admin Governance POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record data access log' }, { status: 500 });
  }
}
