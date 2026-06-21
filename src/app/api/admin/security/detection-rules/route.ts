import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { DetectionRuleEngine } from '@/lib/security/detection-engine';
import { RuleState, SecurityEventSeverity } from '@prisma/client';

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

    // Bootstrap default rules if empty
    await DetectionRuleEngine.bootstrapRules();

    const rules = await db.detectionRuleConfig.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(rules);
  } catch (error: any) {
    console.error('[API Admin Security Detection Rules GET] Error:', error);
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
    const { id, state, severity, thresholds, tuningSettings } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const updated = await DetectionRuleEngine.updateRuleConfig(id, {
      state: state as RuleState,
      severity: severity as SecurityEventSeverity,
      thresholds,
      tuningSettings
    });

    return NextResponse.json({ success: true, rule: updated });
  } catch (error: any) {
    console.error('[API Admin Security Detection Rules POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
