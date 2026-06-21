import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { AutomatedResponseService } from '@/lib/security/automated-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = (session.user as any).role;
    if (callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const actions = await db.automatedResponseAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json(actions);
  } catch (error: any) {
    console.error('[API Admin Security Automated Responses GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = (session.user as any).role;
    if (callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { actionId, action } = body; // action: approve | reject

    if (!actionId || !action) {
      return NextResponse.json({ error: 'actionId and action are required' }, { status: 400 });
    }

    let result: any = null;
    const adminEmail = session.user.email || 'admin@luxury.com';

    if (action === 'approve') {
      result = await AutomatedResponseService.executeAction(actionId, adminEmail);
    } else {
      result = await AutomatedResponseService.rejectAction(actionId, adminEmail);
    }

    return NextResponse.json({ success: true, responseAction: result });
  } catch (error: any) {
    console.error('[API Admin Security Automated Responses POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
