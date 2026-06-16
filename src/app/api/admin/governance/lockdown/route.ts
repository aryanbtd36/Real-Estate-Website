import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { setGlobalLockdown } from '@/lib/governance';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate and enforce Founder only
    const authResult = await requireFounderSuperAdmin(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { userId: callerId } = authResult;
    const body = await request.json();
    const { lockdown, readOnly, maintenanceMode, reason } = body;

    if (lockdown !== undefined) {
      await setGlobalLockdown(lockdown, callerId, reason);
    }

    if (readOnly !== undefined) {
      await db.systemSetting.upsert({
        where: { key: 'read_only' },
        update: { value: readOnly ? 'true' : 'false' },
        create: { key: 'read_only', value: readOnly ? 'true' : 'false' },
      });
    }

    if (maintenanceMode !== undefined) {
      await db.systemSetting.upsert({
        where: { key: 'maintenance_mode' },
        update: { value: maintenanceMode ? 'true' : 'false' },
        create: { key: 'maintenance_mode', value: maintenanceMode ? 'true' : 'false' },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        global_lockdown: lockdown,
        read_only: readOnly,
        maintenance_mode: maintenanceMode
      }
    });
  } catch (error: any) {
    console.error('[API Governance Lockdown POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const list = await db.systemSetting.findMany();
    const settings = list.reduce((acc, curr) => {
      acc[curr.key] = curr.value === 'true';
      return acc;
    }, {} as Record<string, boolean>);

    return NextResponse.json({
      global_lockdown: !!settings['global_lockdown'],
      read_only: !!settings['read_only'],
      maintenance_mode: !!settings['maintenance_mode'],
    });
  } catch (error: any) {
    console.error('[API Governance Lockdown GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
