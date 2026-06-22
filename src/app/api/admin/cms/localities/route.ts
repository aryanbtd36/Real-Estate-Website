import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const localities = await db.cmsLocalityIntelligence.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    return NextResponse.json(localities);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve localities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, areaName, growthScore, demandScore, connectivityScore, investmentRating, displayOrder, visible } = body;

    if (!areaName) {
      return NextResponse.json({ error: 'Area Name is required' }, { status: 400 });
    }

    let locality;
    let isNew = false;

    if (id) {
      locality = await db.cmsLocalityIntelligence.update({
        where: { id },
        data: {
          areaName,
          growthScore: typeof growthScore === 'number' ? growthScore : 80,
          demandScore: typeof demandScore === 'number' ? demandScore : 80,
          connectivityScore: typeof connectivityScore === 'number' ? connectivityScore : 80,
          investmentRating: investmentRating || 'A',
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          visible: typeof visible === 'boolean' ? visible : true
        }
      });
    } else {
      isNew = true;
      locality = await db.cmsLocalityIntelligence.create({
        data: {
          areaName,
          growthScore: typeof growthScore === 'number' ? growthScore : 80,
          demandScore: typeof demandScore === 'number' ? demandScore : 80,
          connectivityScore: typeof connectivityScore === 'number' ? connectivityScore : 80,
          investmentRating: investmentRating || 'A',
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          visible: typeof visible === 'boolean' ? visible : true
        }
      });
    }

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Locality Scorecard ${isNew ? 'Created' : 'Updated'} for: ${areaName}`,
      details: { localityId: locality.id, areaName, isNew }
    });

    return NextResponse.json({ success: true, locality });
  } catch (err: any) {
    console.error('[LOCALITY_POST] Error:', err);
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Locality with this area name already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save locality scorecard' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing locality ID' }, { status: 400 });
    }

    const deleted = await db.cmsLocalityIntelligence.delete({
      where: { id }
    });

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Locality Scorecard Deleted for: ${deleted.areaName}`,
      details: { localityId: id, areaName: deleted.areaName }
    });

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error('[LOCALITY_DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to delete locality scorecard' }, { status: 500 });
  }
}
