import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ActivityService } from '@/lib/activity';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const timeline = await ActivityService.getUserTimeline(id);

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('[API User Timeline GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch user timeline' }, { status: 500 });
  }
}
