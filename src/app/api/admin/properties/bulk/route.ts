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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, ids } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing action or target IDs' }, { status: 400 });
    }

    const actorId = (session?.user as any)?.id;
    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      try {
        switch (action) {
          case 'publish': {
            const property = await db.property.update({
              where: { id },
              data: { status: 'PUBLISHED' }
            });
            eventEmitter.emit(EVENTS.PROPERTY_PUBLISHED, {
              actorId,
              propertyId: id,
              propertyName: property.name
            });
            results.push({ id, success: true });
            successCount++;
            break;
          }

          case 'archive': {
            const property = await db.property.update({
              where: { id },
              data: { status: 'ARCHIVED' }
            });
            eventEmitter.emit(EVENTS.PROPERTY_ARCHIVED, {
              actorId,
              propertyId: id,
              propertyName: property.name
            });
            results.push({ id, success: true });
            successCount++;
            break;
          }

          case 'feature': {
            const property = await db.property.update({
              where: { id },
              data: { featured: true }
            });
            await ActivityService.log({
              actorId,
              action: ActivityAction.PROPERTY_UPDATE,
              description: `Featured property "${property.name}" (Bulk)`,
              details: { propertyId: id, propertyName: property.name, featured: true }
            });
            results.push({ id, success: true });
            successCount++;
            break;
          }

          case 'unfeature': {
            const property = await db.property.update({
              where: { id },
              data: { featured: false }
            });
            await ActivityService.log({
              actorId,
              action: ActivityAction.PROPERTY_UPDATE,
              description: `Unfeatured property "${property.name}" (Bulk)`,
              details: { propertyId: id, propertyName: property.name, featured: false }
            });
            results.push({ id, success: true });
            successCount++;
            break;
          }

          case 'duplicate': {
            const prop = await db.property.findUnique({
              where: { id },
              include: { imagesRelation: true }
            });
            if (!prop) {
              throw new Error('Listing not found');
            }
            const cloned = await db.property.create({
              data: {
                name: `${prop.name} (Copy)`,
                description: prop.description,
                type: prop.type,
                category: prop.category,
                price: prop.price,
                bedrooms: prop.bedrooms,
                bathrooms: prop.bathrooms,
                area: prop.area,
                areaUnit: prop.areaUnit,
                floor: prop.floor,
                availability: prop.availability,
                images: prop.images,
                floorPlan: prop.floorPlan,
                state: prop.state,
                city: prop.city,
                address: prop.address,
                latitude: prop.latitude,
                longitude: prop.longitude,
                boundary: prop.boundary,
                boundaryZones: prop.boundaryZones || undefined,
                amenities: prop.amenities,
                featured: prop.featured,
                status: 'DRAFT',
                videoUrl: prop.videoUrl,
                brochureUrl: prop.brochureUrl,
                virtualTourUrl: prop.virtualTourUrl,
                imagesRelation: {
                  create: prop.imagesRelation.map((img) => ({
                    publicId: img.publicId,
                    url: img.url,
                    order: img.order,
                    isCover: img.isCover,
                  })),
                },
              },
            });
            await ActivityService.log({
              actorId,
              action: ActivityAction.PROPERTY_CREATE,
              description: `Duplicated property "${prop.name}" as "${cloned.name}" (Bulk)`,
              details: { originalId: id, duplicatedId: cloned.id }
            });
            results.push({ id, success: true, duplicatedId: cloned.id });
            successCount++;
            break;
          }

          case 'delete': {
            // Find and delete images from Cloudinary
            const imagesToDelete = await db.propertyImage.findMany({
              where: { propertyId: id }
            });
            for (const img of imagesToDelete) {
              try {
                await cloudinary.uploader.destroy(img.publicId);
              } catch (cErr) {
                console.error(`Failed to delete Cloudinary image: ${img.publicId}`, cErr);
              }
            }

            const prop = await db.property.delete({
              where: { id }
            });

            await ActivityService.log({
              actorId,
              action: ActivityAction.PROPERTY_DELETE,
              description: `Deleted property "${prop.name}" (Bulk)`,
              details: { propertyId: id, propertyName: prop.name }
            });
            results.push({ id, success: true });
            successCount++;
            break;
          }

          default:
            throw new Error(`Unsupported action: ${action}`);
        }
      } catch (err: any) {
        console.error(`Bulk operation failed for ID ${id}:`, err);
        results.push({ id, success: false, error: err.message || 'Unknown operational failure' });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      action,
      successCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error('[API Admin Properties Bulk POST] Error:', error);
    return NextResponse.json({ error: 'Failed to process bulk operations' }, { status: 500 });
  }
}
