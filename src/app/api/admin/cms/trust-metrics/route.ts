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
    const metrics = await db.cmsTrustMetric.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    return NextResponse.json(metrics);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve trust metrics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, title, value, suffix, icon, displayOrder, visible } = body;

    if (!title || !value) {
      return NextResponse.json({ error: 'Title and Value are required fields' }, { status: 400 });
    }

    let metric;
    let isNew = false;

    if (id) {
      metric = await db.cmsTrustMetric.update({
        where: { id },
        data: {
          title,
          value,
          suffix: suffix || '',
          icon: icon || 'CheckCircle',
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          visible: typeof visible === 'boolean' ? visible : true
        }
      });
    } else {
      isNew = true;
      metric = await db.cmsTrustMetric.create({
        data: {
          title,
          value,
          suffix: suffix || '',
          icon: icon || 'CheckCircle',
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          visible: typeof visible === 'boolean' ? visible : true
        }
      });
    }

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Trust Metric ${isNew ? 'Created' : 'Updated'}: ${title} (${value}${suffix})`,
      details: { metricId: metric.id, title, value, isNew }
    });

    return NextResponse.json({ success: true, metric });
  } catch (err: any) {
    console.error('[TRUST_METRIC_POST] Error:', err);
    return NextResponse.json({ error: 'Failed to save trust metric' }, { status: 500 });
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
      return NextResponse.json({ error: 'Missing metric ID' }, { status: 400 });
    }

    const deleted = await db.cmsTrustMetric.delete({
      where: { id }
    });

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Trust Metric Deleted: ${deleted.title}`,
      details: { metricId: id, title: deleted.title }
    });

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error('[TRUST_METRIC_DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to delete trust metric' }, { status: 500 });
  }
}
