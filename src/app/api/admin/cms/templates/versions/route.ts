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
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    const versions = await db.propertyTemplateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' }
    });

    return NextResponse.json(versions);
  } catch (err: any) {
    console.error('[TEMPLATE_VERSIONS_GET] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve template versions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { templateId, version } = body;

    if (!templateId || typeof version !== 'number') {
      return NextResponse.json({ error: 'templateId and version number are required' }, { status: 400 });
    }

    const template = await db.propertyTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return NextResponse.json({ error: 'Property template not found' }, { status: 404 });
    }

    const targetVersion = await db.propertyTemplateVersion.findUnique({
      where: {
        templateId_version: {
          templateId,
          version
        }
      }
    });

    if (!targetVersion) {
      return NextResponse.json({ error: `Version ${version} does not exist for this template` }, { status: 404 });
    }

    const nextVersionNumber = template.version + 1;

    // Rollback is performed by setting the template fields to target fields,
    // incrementing the version, and creating a new version history entry.
    const updatedTemplate = await db.propertyTemplate.update({
      where: { id: templateId },
      data: {
        fields: targetVersion.fields as any,
        version: nextVersionNumber
      }
    });

    await db.propertyTemplateVersion.create({
      data: {
        templateId,
        version: nextVersionNumber,
        fields: targetVersion.fields as any,
        changedBy: `Rollback to v${version} by ${auth.user.email || 'Admin'}`
      }
    });

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Property Template ${template.name} rolled back to v${version} (Now at v${nextVersionNumber})`,
      details: { templateId, name: template.name, type: template.type, rolledBackTo: version, currentVersion: nextVersionNumber }
    });

    return NextResponse.json({ success: true, template: updatedTemplate });
  } catch (err: any) {
    console.error('[TEMPLATE_ROLLBACK_POST] Error:', err);
    return NextResponse.json({ error: 'Failed to perform version rollback' }, { status: 500 });
  }
}
