import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { SecurityOrchestrationService } from '@/lib/security/orchestration';
import { PlaybookName } from '@prisma/client';

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

    const executions = await db.playbookExecution.findMany({
      orderBy: { executedAt: 'desc' },
      take: 100
    });

    return NextResponse.json(executions);
  } catch (error: any) {
    console.error('[API Admin Security Playbooks GET] Error:', error);
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
    const { playbookName, trigger, targetId, metadata } = body;

    if (!playbookName || !targetId) {
      return NextResponse.json({ error: 'playbookName and targetId are required' }, { status: 400 });
    }

    const playbookEnum = playbookName as PlaybookName;
    const execution = await SecurityOrchestrationService.triggerPlaybook(
      playbookEnum,
      trigger || 'Manual trigger by admin',
      targetId,
      metadata
    );

    return NextResponse.json({ success: true, execution });
  } catch (error: any) {
    console.error('[API Admin Security Playbooks POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
