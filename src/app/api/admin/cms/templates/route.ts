import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

async function bootstrapDefaultTemplates() {
  const defaults = [
    {
      name: 'Apartment Template',
      type: 'APARTMENT',
      fields: [
        { name: 'bhk', label: 'BHK', type: 'dropdown', required: true, options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK+'], group: 'Building Details' },
        { name: 'superBuiltupArea', label: 'Super Built-up Area (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'carpetArea', label: 'Carpet Area (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'floor', label: 'Floor', type: 'number', required: false, group: 'Building Details' },
        { name: 'totalFloors', label: 'Total Floors', type: 'number', required: false, group: 'Building Details' },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', required: false, group: 'Building Details' },
        { name: 'balconies', label: 'Balconies', type: 'number', required: false, group: 'Building Details' },
        { name: 'furnishedStatus', label: 'Furnished Status', type: 'dropdown', required: false, options: ['Furnished', 'Semi-Furnished', 'Unfurnished'], group: 'Additional Features' },
        { name: 'parking', label: 'Parking', type: 'dropdown', required: false, options: ['None', '1 Covered', '2 Covered', 'Open'], group: 'Additional Features' },
        { name: 'facing', label: 'Facing', type: 'dropdown', required: false, options: ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'], group: 'Additional Features' },
        { name: 'ageOfProperty', label: 'Age of Property', type: 'text', required: false, group: 'Ownership' },
        { name: 'tower', label: 'Tower', type: 'text', required: false, group: 'Building Details' },
        { name: 'amenities', label: 'Amenities', type: 'multiselect', required: false, options: ['Lift', 'Gym', 'Swimming Pool', 'Clubhouse', 'Power Backup'], group: 'Additional Features' },
        { name: 'balcony', label: 'Balcony', type: 'number', required: false, group: 'Building Details' }
      ]
    },
    {
      name: 'Independent House Template',
      type: 'INDEPENDENT_HOUSE',
      fields: [
        { name: 'bedrooms', label: 'Bedrooms', type: 'number', required: true, group: 'Building Details' },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', required: true, group: 'Building Details' },
        { name: 'plotArea', label: 'Plot Area (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'builtUpArea', label: 'Built-up Area (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'floors', label: 'Floors', type: 'number', required: false, group: 'Building Details' },
        { name: 'parking', label: 'Parking', type: 'dropdown', required: false, options: ['None', '1 Covered', '2 Covered', 'Open'], group: 'Additional Features' },
        { name: 'garden', label: 'Garden', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'terrace', label: 'Terrace', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'facing', label: 'Facing', type: 'dropdown', required: false, options: ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'], group: 'Additional Features' },
        { name: 'furnishing', label: 'Furnishing', type: 'dropdown', required: false, options: ['Furnished', 'Semi-Furnished', 'Unfurnished'], group: 'Additional Features' }
      ]
    },
    {
      name: 'Villa Template',
      type: 'VILLA',
      fields: [
        { name: 'bedrooms', label: 'Bedrooms', type: 'number', required: true, group: 'Building Details' },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', required: true, group: 'Building Details' },
        { name: 'plotSize', label: 'Plot Size (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'builtUpArea', label: 'Built-up Area (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'privateGarden', label: 'Private Garden', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'pool', label: 'Pool', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'parking', label: 'Parking', type: 'dropdown', required: false, options: ['None', '1 Covered', '2 Covered', 'Open'], group: 'Additional Features' },
        { name: 'furnishing', label: 'Furnishing', type: 'dropdown', required: false, options: ['Furnished', 'Semi-Furnished', 'Unfurnished'], group: 'Additional Features' },
        { name: 'facing', label: 'Facing', type: 'dropdown', required: false, options: ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'], group: 'Additional Features' }
      ]
    },
    {
      name: 'Residential Plot Template',
      type: 'PLOT',
      fields: [
        { name: 'plotArea', label: 'Plot Area', type: 'number', required: true, group: 'Dimensions' },
        { name: 'areaUnit', label: 'Area Unit', type: 'dropdown', required: true, options: ['Sq Ft', 'Sq Yard', 'Acre', 'Hectare', 'Bigha'], group: 'Dimensions' },
        { name: 'width', label: 'Width (Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'length', label: 'Length (Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'roadWidth', label: 'Front Road Width (Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'cornerPlot', label: 'Corner Plot', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'facing', label: 'Facing', type: 'dropdown', required: false, options: ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'], group: 'Additional Features' },
        { name: 'gatedCommunity', label: 'Gated Community', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'waterConnection', label: 'Water Connection', type: 'checkbox', required: false, group: 'Utilities' },
        { name: 'electricity', label: 'Electricity', type: 'checkbox', required: false, group: 'Utilities' },
        { name: 'registryAvailable', label: 'Registry Available', type: 'checkbox', required: false, group: 'Ownership' },
        { name: 'registryStatus', label: 'Registry Status', type: 'dropdown', required: true, options: ['Freehold', 'Leasehold', 'Power of Attorney'], group: 'Ownership' },
        { name: 'boundaryCoordinates', label: 'Boundary Coordinates', type: 'text', required: false, group: 'Additional Features' },
        { name: 'dimensions', label: 'Dimensions', type: 'text', required: false, group: 'Additional Features' }
      ]
    },
    {
      name: 'Agricultural Land Template',
      type: 'AGRICULTURAL_LAND',
      fields: [
        { name: 'totalArea', label: 'Total Area', type: 'number', required: true, group: 'Dimensions' },
        { name: 'areaUnit', label: 'Area Unit', type: 'dropdown', required: true, options: ['Sq Ft', 'Sq Yard', 'Acre', 'Hectare', 'Bigha'], group: 'Dimensions' },
        { name: 'irrigation', label: 'Irrigation', type: 'dropdown', required: true, options: ['Canal', 'Tube Well', 'Rainfed', 'Drip', 'None'], group: 'Utilities' },
        { name: 'soilType', label: 'Soil Type', type: 'dropdown', required: true, options: ['Alluvial', 'Black', 'Red', 'Laterite', 'Sandy', 'Clayey'], group: 'Additional Features' },
        { name: 'waterSource', label: 'Water Source', type: 'text', required: false, group: 'Utilities' },
        { name: 'electricity', label: 'Electricity', type: 'checkbox', required: false, group: 'Utilities' },
        { name: 'roadAccess', label: 'Road Access', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'ownership', label: 'Ownership', type: 'text', required: false, group: 'Ownership' },
        { name: 'registry', label: 'Registry', type: 'checkbox', required: false, group: 'Ownership' }
      ]
    },
    {
      name: 'Commercial Office Template',
      type: 'COMMERCIAL',
      fields: [
        { name: 'officeArea', label: 'Built-up Area (Sq Ft)', type: 'number', required: true, group: 'Dimensions' },
        { name: 'floor', label: 'Floor', type: 'number', required: false, group: 'Building Details' },
        { name: 'totalFloors', label: 'Total Floors', type: 'number', required: false, group: 'Building Details' },
        { name: 'washrooms', label: 'Washrooms', type: 'number', required: false, group: 'Building Details' },
        { name: 'cabinCount', label: 'Cabin Count', type: 'number', required: true, group: 'Building Details' },
        { name: 'conferenceRoom', label: 'Conference Room', type: 'checkbox', required: false, group: 'Building Details' },
        { name: 'parking', label: 'Parking', type: 'dropdown', required: false, options: ['None', '1 Covered', '2 Covered', 'Open'], group: 'Additional Features' },
        { name: 'lift', label: 'Lift', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'furnished', label: 'Furnished Status', type: 'dropdown', required: false, options: ['Furnished', 'Semi-Furnished', 'Unfurnished'], group: 'Additional Features' },
        { name: 'powerBackup', label: 'Power Backup', type: 'checkbox', required: false, group: 'Utilities' },
        { name: 'parkingCapacity', label: 'Parking Capacity', type: 'number', required: false, group: 'Additional Features' }
      ]
    },
    {
      name: 'Shop Template',
      type: 'SHOP',
      fields: [
        { name: 'carpetArea', label: 'Carpet Area (Sq Ft)', type: 'number', required: true, group: 'Dimensions' },
        { name: 'frontWidth', label: 'Front Width (Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'floor', label: 'Floor', type: 'number', required: false, group: 'Building Details' },
        { name: 'washroom', label: 'Washroom', type: 'checkbox', required: false, group: 'Building Details' },
        { name: 'parking', label: 'Parking', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'mainRoadFacing', label: 'Main Road Facing', type: 'checkbox', required: false, group: 'Additional Features' }
      ]
    },
    {
      name: 'Warehouse Template',
      type: 'WAREHOUSE',
      fields: [
        { name: 'builtUpArea', label: 'Built-up Area (Sq Ft)', type: 'number', required: true, group: 'Dimensions' },
        { name: 'clearHeight', label: 'Clear Height (Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'dockDoors', label: 'Dock Doors', type: 'number', required: false, group: 'Building Details' },
        { name: 'truckAccess', label: 'Truck Access', type: 'checkbox', required: false, group: 'Additional Features' },
        { name: 'powerLoad', label: 'Power Load (kW)', type: 'number', required: false, group: 'Utilities' },
        { name: 'parking', label: 'Parking', type: 'checkbox', required: false, group: 'Additional Features' }
      ]
    },
    {
      name: 'Industrial Property Template',
      type: 'INDUSTRIAL_PROPERTY',
      fields: [
        { name: 'plotArea', label: 'Plot Area (Sq Ft)', type: 'number', required: false, group: 'Dimensions' },
        { name: 'builtUpArea', label: 'Built-up Area (Sq Ft)', type: 'number', required: true, group: 'Dimensions' },
        { name: 'powerCapacity', label: 'Power Capacity (HP/kW)', type: 'number', required: false, group: 'Utilities' },
        { name: 'factoryShed', label: 'Factory Shed', type: 'checkbox', required: false, group: 'Building Details' },
        { name: 'officeSpace', label: 'Office Space', type: 'checkbox', required: false, group: 'Building Details' },
        { name: 'craneFacility', label: 'Crane Facility', type: 'checkbox', required: false, group: 'Additional Features' }
      ]
    },
    {
      name: 'Residency Template',
      type: 'RESIDENCY',
      fields: [
        { name: 'bedrooms', label: 'Bedrooms', type: 'number', required: true, group: 'Building Details' },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', required: true, group: 'Building Details' },
        { name: 'parking', label: 'Parking', type: 'number', required: false, group: 'Additional Features' },
        { name: 'garden', label: 'Garden', type: 'checkbox', required: false, group: 'Additional Features' }
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
