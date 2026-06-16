import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    const hasAdminAccess = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!session || !hasAdminAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const actionStr = searchParams.get('action') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    let action: ActivityAction | undefined = undefined;
    if (actionStr) {
      if (Object.values(ActivityAction).includes(actionStr as any)) {
        action = actionStr as ActivityAction;
      } else {
        return NextResponse.json({ error: 'Invalid activity action' }, { status: 400 });
      }
    }

    const { logs, total } = await ActivityService.getAuditLogs({
      limit,
      offset: skip,
      action,
      search,
    });

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API Audit Logs GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!session || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, description, details } = body;

    if (!action || !Object.values(ActivityAction).includes(action as any)) {
      return NextResponse.json({ error: 'Invalid or missing action' }, { status: 400 });
    }

    const logEntry = await ActivityService.log({
      actorId: userId,
      action: action as ActivityAction,
      description: description || '',
      details: details || null,
    });

    return NextResponse.json({ success: true, logEntry }, { status: 201 });
  } catch (error) {
    console.error('[API Audit Logs POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
  }
}

