import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { FalsePositiveAnalysisService } from '@/lib/security/false-positive-analysis';

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

    // Run scans dynamically to generate fresh recommendations if applicable
    await FalsePositiveAnalysisService.runAnalysis();

    const recommendations = await db.falsePositiveRecommendation.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(recommendations);
  } catch (error: any) {
    console.error('[API Admin Security False Positives GET] Error:', error);
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
    const { recommendationId, action } = body; // action: accept | reject

    if (!recommendationId || !action) {
      return NextResponse.json({ error: 'recommendationId and action are required' }, { status: 400 });
    }

    let result: any = null;
    const adminEmail = session.user.email || 'admin@luxury.com';

    if (action === 'accept') {
      result = await FalsePositiveAnalysisService.applyRecommendation(recommendationId, adminEmail);
    } else {
      result = await FalsePositiveAnalysisService.rejectRecommendation(recommendationId, adminEmail);
    }

    return NextResponse.json({ success: true, recommendation: result });
  } catch (error: any) {
    console.error('[API Admin Security False Positives POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
