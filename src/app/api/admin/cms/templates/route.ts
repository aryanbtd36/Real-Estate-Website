import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

async function bootstrapDefaultTemplates() {
  const defaults = [
    {
      name: 'Plot Template',
      type: 'PLOT',
      fields: [
        { name: 'roadWidth', label: 'Road Width (Ft)', type: 'number', required: false },
        { name: 'facing', label: 'Facing', type: 'dropdown', required: false, options: ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'] },
        { name: 'registryStatus', label: 'Registry Status', type: 'dropdown', required: true, options: ['Freehold', 'Leasehold', 'Power of Attorney'] },
        { name: 'boundaryCoordinates', label: 'Boundary Coordinates', type: 'text', required: false },
        { name: 'cornerPlot', label: 'Corner Plot', type: 'checkbox', required: false },
        { name: 'dimensions', label: 'Dimensions', type: 'text', required: false }
      ]
    },
    {
      name: 'Apartment Template',
      type: 'APARTMENT',
      fields: [
        { name: 'bhk', label: 'BHK', type: 'dropdown', required: true, options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK+'] },
        { name: 'floor', label: 'Floor', type: 'number', required: false },
        { name: 'tower', label: 'Tower', type: 'text', required: false },
        { name: 'amenities', label: 'Amenities', type: 'multiselect', required: false, options: ['Lift', 'Gym', 'Swimming Pool', 'Clubhouse', 'Power Backup'] },
        { name: 'balcony', label: 'Balcony', type: 'number', required: false }
      ]
    },
    {
      name: 'Residency Template',
      type: 'RESIDENCY',
      fields: [
        { name: 'bedrooms', label: 'Bedrooms', type: 'number', required: true },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', required: true },
        { name: 'parking', label: 'Parking', type: 'number', required: false },
        { name: 'garden', label: 'Garden', type: 'checkbox', required: false }
      ]
    },
    {
      name: 'Commercial Template',
      type: 'COMMERCIAL',
      fields: [
        { name: 'officeArea', label: 'Office Area', type: 'number', required: true },
        { name: 'floor', label: 'Floor', type: 'number', required: false },
        { name: 'powerBackup', label: 'Power Backup', type: 'checkbox', required: false },
        { name: 'parkingCapacity', label: 'Parking Capacity', type: 'number', required: false }
      ]
    }
  ];

  for (const item of defaults) {
    const existing = await db.propertyTemplate.findUnique({
      where: { type: item.type }
    });

    if (!existing) {
      const template = await db.propertyTemplate.create({
        data: {
          name: item.name,
          type: item.type,
          fields: item.fields,
          version: 1
        }
      });
      // Seed first version
      await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          fields: item.fields,
          changedBy: 'System Bootstrapper'
        }
      });
    } else {
      // Synchronize standard templates fields & name
      await db.propertyTemplate.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          fields: item.fields
        }
      });
    }
  }
}

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await bootstrapDefaultTemplates();
    const templates = await db.propertyTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: { version: true, createdAt: true, changedBy: true }
        }
      }
    });
    return NextResponse.json(templates);
  } catch (err: any) {
    console.error('[TEMPLATES_GET] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, name, type, fields, cloneFromId } = body;

    if (!name || !type || !fields) {
      return NextResponse.json({ error: 'Name, Type, and Fields are required fields' }, { status: 400 });
    }

    let template;
    let isNew = false;
    let newVersion = 1;

    if (id) {
      // Update template: increment version and append history
      const current = await db.propertyTemplate.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      newVersion = current.version + 1;
      template = await db.propertyTemplate.update({
        where: { id },
        data: {
          name,
          type,
          fields,
          version: newVersion
        }
      });

      // Save version history record
      await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: newVersion,
          fields,
          changedBy: auth.user.email || 'Admin'
        }
      });
    } else {
      isNew = true;
      let finalFields = fields;

      // Handle cloning functionality
      if (cloneFromId) {
        const source = await db.propertyTemplate.findUnique({ where: { id: cloneFromId } });
        if (source) {
          finalFields = source.fields;
        }
      }

      template = await db.propertyTemplate.create({
        data: {
          name,
          type: type.toUpperCase(),
          fields: finalFields,
          version: 1
        }
      });

      await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          fields: finalFields,
          changedBy: auth.user.email || 'Admin'
        }
      });
    }

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Property Template ${isNew ? 'Created' : 'Updated'}: ${name} (${type}) v${newVersion}`,
      details: { templateId: template.id, name, type, isNew, version: newVersion }
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    console.error('[TEMPLATE_POST] Error:', err);
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'A template with this code type already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save property template' }, { status: 500 });
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
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    const current = await db.propertyTemplate.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Standard templates cannot be deleted to avoid breaking listing forms
    const systemTypes = ['PLOT', 'APARTMENT', 'RESIDENCY', 'COMMERCIAL'];
    if (systemTypes.includes(current.type)) {
      return NextResponse.json({ error: 'System standard templates cannot be deleted.' }, { status: 400 });
    }

    const deleted = await db.propertyTemplate.delete({
      where: { id }
    });

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Property Template Deleted: ${deleted.name} (${deleted.type})`,
      details: { templateId: id, name: deleted.name, type: deleted.type }
    });

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error('[TEMPLATE_DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to delete property template' }, { status: 500 });
  }
}
