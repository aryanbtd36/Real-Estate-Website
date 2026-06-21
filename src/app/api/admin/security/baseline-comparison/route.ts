import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BaselineComparisonService } from '@/lib/security/baseline-comparison';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const comparison = await BaselineComparisonService.detectDrifts();
    return NextResponse.json({ success: true, comparison });
  } catch (error: any) {
    console.error('[API Admin Security Baseline GET] Error:', error);
    return NextResponse.json({ error: 'Failed to detect security baseline drifts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const baseline = await BaselineComparisonService.captureBaseline(userId);
    return NextResponse.json({ success: true, baseline });
  } catch (error: any) {
    console.error('[API Admin Security Baseline POST] Error:', error);
    return NextResponse.json({ error: 'Failed to capture security baseline snapshot' }, { status: 500 });
  }
}
