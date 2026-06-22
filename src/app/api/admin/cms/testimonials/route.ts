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
    const testimonials = await db.cmsTestimonial.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    return NextResponse.json(testimonials);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve testimonials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, name, photo, location, propertyType, review, rating, displayOrder, visible, featured } = body;

    if (!name || !review || !location) {
      return NextResponse.json({ error: 'Name, Review, and Location are required' }, { status: 400 });
    }

    let testimonial;
    let isNew = false;

    if (id) {
      testimonial = await db.cmsTestimonial.update({
        where: { id },
        data: {
          name,
          photo: photo || '',
          location,
          propertyType: propertyType || 'Plot',
          review,
          rating: typeof rating === 'number' ? rating : 5,
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          visible: typeof visible === 'boolean' ? visible : true,
          featured: typeof featured === 'boolean' ? featured : false
        }
      });
    } else {
      isNew = true;
      testimonial = await db.cmsTestimonial.create({
        data: {
          name,
          photo: photo || '',
          location,
          propertyType: propertyType || 'Plot',
          review,
          rating: typeof rating === 'number' ? rating : 5,
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          visible: typeof visible === 'boolean' ? visible : true,
          featured: typeof featured === 'boolean' ? featured : false
        }
      });
    }

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Testimonial review ${isNew ? 'Created' : 'Updated'} for: ${name}`,
      details: { testimonialId: testimonial.id, name, isNew }
    });

    return NextResponse.json({ success: true, testimonial });
  } catch (err: any) {
    console.error('[TESTIMONIAL_POST] Error:', err);
    return NextResponse.json({ error: 'Failed to save testimonial review' }, { status: 500 });
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
      return NextResponse.json({ error: 'Missing testimonial ID' }, { status: 400 });
    }

    const deleted = await db.cmsTestimonial.delete({
      where: { id }
    });

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Testimonial review deleted for: ${deleted.name}`,
      details: { testimonialId: id, name: deleted.name }
    });

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error('[TESTIMONIAL_DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to delete testimonial review' }, { status: 500 });
  }
}
