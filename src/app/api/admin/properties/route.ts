import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { v2 as cloudinary } from 'cloudinary';
import { eventEmitter, EVENTS } from '@/lib/events';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

// Configure Cloudinary for deletion
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      type,
      category,
      price,
      bedrooms,
      bathrooms,
      area,
      areaUnit,
      floor,
      location,
      state,
      city,
      address,
      latitude,
      longitude,
      boundary,
      amenities,
      featured,
      imagesList, // Array of { publicId, url, order, isCover }
      status,
      videoUrl,
      brochureUrl,
      virtualTourUrl,
      boundaryZones,
      templateId,
      templateFields,
      floorPlan
    } = body;

    if (!name || !price || !area || (bedrooms === undefined || bedrooms === null || bedrooms === '')) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Helper: join image URLs for backwards compatibility
    const joinedImages = Array.isArray(imagesList) 
      ? imagesList.map((img: any) => img.url).join(',')
      : '';

    const property = await db.property.create({
      data: {
        name,
        description: description || '',
        type: type || 'Apartment',
        category: category || 'Buy',
        price: parseFloat(price),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms || 1),
        area: parseFloat(area),
        areaUnit: areaUnit || 'Sq Ft',
        floor: parseInt(floor || 1),
        location: location || '',
        state: state || '',
        city: city || '',
        address: address || '',
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        boundary: boundary || null,
        amenities: Array.isArray(amenities) ? amenities : [],
        featured: Boolean(featured),
        images: joinedImages,
        status: status || 'DRAFT',
        videoUrl: videoUrl || null,
        brochureUrl: brochureUrl || null,
        virtualTourUrl: virtualTourUrl || null,
        boundaryZones: boundaryZones || null,
        templateId: templateId || null,
        templateFields: templateFields || null,
        floorPlan: floorPlan || null,
        imagesRelation: {
          create: Array.isArray(imagesList) ? imagesList.map((img: any) => ({
            publicId: img.publicId,
            url: img.url,
            order: parseInt(img.order || 0),
            isCover: Boolean(img.isCover),
          })) : []
        }
      },
      include: {
        imagesRelation: true
      }
    });

    const actorId = (session?.user as any)?.id;

    // Log property creation
    await ActivityService.log({
      actorId,
      action: ActivityAction.PROPERTY_CREATE,
      description: `Created property "${property.name}"`,
      details: { propertyId: property.id, propertyName: property.name }
    });

    // Trigger publish event if created as published
    if (property.status === 'PUBLISHED') {
      eventEmitter.emit(EVENTS.PROPERTY_PUBLISHED, {
        actorId,
        propertyId: property.id,
        propertyName: property.name
      });
    }

    return NextResponse.json({ success: true, property });
  } catch (error) {
    console.error('Create property error:', error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      name,
      description,
      type,
      category,
      price,
      bedrooms,
      bathrooms,
      area,
      areaUnit,
      floor,
      location,
      state,
      city,
      address,
      latitude,
      longitude,
      boundary,
      amenities,
      featured,
      imagesList,
      status,
      videoUrl,
      brochureUrl,
      virtualTourUrl,
      boundaryZones,
      templateId,
      templateFields,
      floorPlan
    } = body;

    if (!id || !name || !price || !area || (bedrooms === undefined || bedrooms === null || bedrooms === '')) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Retrieve the existing property state
    const oldProperty = await db.property.findUnique({
      where: { id },
      select: { price: true, status: true, name: true }
    });

    if (!oldProperty) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const actorId = (session?.user as any)?.id;
    const newPriceVal = parseFloat(price);

    // Track price changes
    if (oldProperty.price !== newPriceVal) {
      await db.propertyPriceHistory.create({
        data: {
          propertyId: id,
          oldPrice: oldProperty.price,
          newPrice: newPriceVal,
          changedById: actorId,
        }
      });
    }

    // 1. Delete all existing related images in Prisma first
    await db.propertyImage.deleteMany({
      where: { propertyId: id }
    });

    const joinedImages = Array.isArray(imagesList) 
      ? imagesList.map((img: any) => img.url).join(',')
      : '';

    // 2. Update the property details and recreate related images
    const property = await db.property.update({
      where: { id },
      data: {
        name,
        description: description || '',
        type: type || 'Apartment',
        category: category || 'Buy',
        price: newPriceVal,
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms || 1),
        area: parseFloat(area),
        areaUnit: areaUnit || 'Sq Ft',
        floor: parseInt(floor || 1),
        location: location || '',
        state: state || '',
        city: city || '',
        address: address || '',
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        boundary: boundary || null,
        amenities: Array.isArray(amenities) ? amenities : [],
        featured: Boolean(featured),
        images: joinedImages,
        status: status || 'DRAFT',
        videoUrl: videoUrl || null,
        brochureUrl: brochureUrl || null,
        virtualTourUrl: virtualTourUrl || null,
        boundaryZones: boundaryZones || null,
        templateId: templateId || null,
        templateFields: templateFields || null,
        floorPlan: floorPlan || null,
        imagesRelation: {
          create: Array.isArray(imagesList) ? imagesList.map((img: any) => ({
            publicId: img.publicId,
            url: img.url,
            order: parseInt(img.order || 0),
            isCover: Boolean(img.isCover),
          })) : []
        }
      },
      include: {
        imagesRelation: true
      }
    });

    // Log the details update
    await ActivityService.log({
      actorId,
      action: ActivityAction.PROPERTY_UPDATE,
      description: `Updated listing details for "${property.name}"`,
      details: { propertyId: id, propertyName: property.name }
    });

    // Handle status workflow transition events
    if (oldProperty.status !== status) {
      if (status === 'PUBLISHED') {
        eventEmitter.emit(EVENTS.PROPERTY_PUBLISHED, {
          actorId,
          propertyId: id,
          propertyName: property.name
        });
      } else if (status === 'ARCHIVED') {
        eventEmitter.emit(EVENTS.PROPERTY_ARCHIVED, {
          actorId,
          propertyId: id,
          propertyName: property.name
        });
      } else if (oldProperty.status === 'ARCHIVED' && (status === 'DRAFT' || status === 'PUBLISHED')) {
        eventEmitter.emit(EVENTS.PROPERTY_RESTORED, {
          actorId,
          propertyId: id,
          propertyName: property.name
        });
        if (status === 'PUBLISHED') {
          eventEmitter.emit(EVENTS.PROPERTY_PUBLISHED, {
            actorId,
            propertyId: id,
            propertyName: property.name
          });
        }
      }
    }

    return NextResponse.json({ success: true, property });
  } catch (error) {
    console.error('Update property error:', error);
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing property ID' }, { status: 400 });
    }

    // 1. Find all related images to delete from Cloudinary
    const imagesToDelete = await db.propertyImage.findMany({
      where: { propertyId: id }
    });

    for (const img of imagesToDelete) {
      try {
        await cloudinary.uploader.destroy(img.publicId);
      } catch (cloudinaryErr) {
        console.error(`Failed to delete image ${img.publicId} from Cloudinary:`, cloudinaryErr);
      }
    }

    // Fetch the property to get the name before deletion
    const property = await db.property.findUnique({
      where: { id },
      select: { name: true }
    });

    // 2. Delete the property (cascade will delete related images in DB)
    await db.property.delete({
      where: { id },
    });

    const actorId = (session?.user as any)?.id;
    if (property) {
      await ActivityService.log({
        actorId,
        action: ActivityAction.PROPERTY_DELETE,
        description: `Deleted property "${property.name}"`,
        details: { propertyId: id, propertyName: property.name }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete property error:', error);
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }
}
