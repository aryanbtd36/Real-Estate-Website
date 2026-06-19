import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';
import { CampaignReconstructionService } from '@/lib/security/campaign-reconstruction';

async function campaignHandler(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerId = (session.user as any).id;
  const callerRole = (session.user as any).role;
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || undefined;
  const sessionId = searchParams.get('sessionId') || undefined;

  try {
    const campaign = await CampaignReconstructionService.reconstructCampaign(userId, sessionId);
    return NextResponse.json(campaign);
  } catch (err: any) {
    console.error('[API Security Campaign GET] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = secureApiHandler(campaignHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-campaign' },
});
