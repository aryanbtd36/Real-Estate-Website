import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SecurityPostureService } from '@/lib/security/security-posture';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const posture = await SecurityPostureService.calculatePosture();
    return NextResponse.json({ success: true, posture });
  } catch (error: any) {
    console.error('[API Admin Security Posture GET] Error:', error);
    return NextResponse.json({ error: 'Failed to calculate security posture metrics' }, { status: 500 });
  }
}
