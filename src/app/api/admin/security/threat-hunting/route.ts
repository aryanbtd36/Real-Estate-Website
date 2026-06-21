import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ThreatHuntingService } from '@/lib/security/threat-hunting';
import { ThreatHuntType } from '@prisma/client';

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

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'executions'; // saved | executions

    if (mode === 'saved') {
      const saved = await db.savedThreatHunt.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(saved);
    } else {
      const executions = await db.threatHuntExecution.findMany({
        orderBy: { executedAt: 'desc' },
        take: 50
      });
      return NextResponse.json(executions);
    }
  } catch (error: any) {
    console.error('[API Admin Security Threat Hunting GET] Error:', error);
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
    const { action, name, huntType, queryDetails, description } = body;

    if (action === 'save') {
      if (!name || !huntType) {
        return NextResponse.json({ error: 'name and huntType are required to save a hunt' }, { status: 400 });
      }
      const saved = await ThreatHuntingService.saveHunt(
        name,
        huntType as ThreatHuntType,
        queryDetails,
        description
      );
      return NextResponse.json({ success: true, saved });
    } else {
      // Execute hunt query
      if (!name || !huntType) {
        return NextResponse.json({ error: 'name and huntType are required to execute a hunt' }, { status: 400 });
      }
      const execution = await ThreatHuntingService.executeHunt(
        name,
        huntType as ThreatHuntType,
        queryDetails
      );
      return NextResponse.json({ success: true, execution });
    }
  } catch (error: any) {
    console.error('[API Admin Security Threat Hunting POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
