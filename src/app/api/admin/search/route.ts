import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all'; // 'all', 'properties', 'users', 'inquiries', 'appointments'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const queryLower = q.toLowerCase().trim();

    // 1. Fetch matching entities in parallel
    const [properties, users, inquiries, appointments] = await Promise.all([
      // Properties
      (type === 'all' || type === 'properties') ? db.property.findMany({
        where: q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { location: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { state: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ]
        } : {},
        include: { imagesRelation: true }
      }) : [],

      // Users (clients, not soft-deleted)
      (type === 'all' || type === 'users') ? db.user.findMany({
        where: {
          role: 'USER',
          deletedAt: null,
          ...(q ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ]
          } : {})
        }
      }) : [],

      // Inquiries (leads)
      (type === 'all' || type === 'inquiries') ? db.lead.findMany({
        where: q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
          ]
        } : {}
      }) : [],

      // Appointments
      (type === 'all' || type === 'appointments') ? db.appointment.findMany({
        where: q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
            { specialRequests: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
          ]
        } : {},
        include: {
          property: {
            select: { name: true, location: true }
          }
        }
      }) : [],
    ]);

    // 2. Map and calculate relevance scores in JS
    const scoredResults: any[] = [];

    const getScore = (text: string | null | undefined, weight: number): number => {
      if (!text || !queryLower) return 0;
      const val = text.toLowerCase();
      if (val === queryLower) return weight * 3;
      if (val.startsWith(queryLower)) return weight * 2;
      if (val.includes(queryLower)) return weight;
      return 0;
    };

    // Properties
    properties.forEach((p) => {
      let score = 0;
      if (queryLower) {
        score += getScore(p.name, 15);
        score += getScore(p.city, 8);
        score += getScore(p.location, 8);
        score += getScore(p.address, 5);
        score += getScore(p.description, 2);
      }
      scoredResults.push({
        id: p.id,
        entityType: 'property',
        title: p.name,
        subtitle: `${p.type} in ${p.city || p.location || 'Unknown'} - ${formatCurrency(p.price)}`,
        status: p.status,
        createdAt: p.createdAt,
        relevance: score,
        data: p,
      });
    });

    // Users
    users.forEach((u) => {
      let score = 0;
      if (queryLower) {
        score += getScore(u.name, 15);
        score += getScore(u.email, 15);
        score += getScore(u.phone, 10);
      }
      scoredResults.push({
        id: u.id,
        entityType: 'user',
        title: u.name || 'Anonymous User',
        subtitle: `${u.email} • ${u.phone || 'No phone'}`,
        status: u.status,
        createdAt: u.createdAt,
        relevance: score,
        data: u,
      });
    });

    // Inquiries
    inquiries.forEach((l) => {
      let score = 0;
      if (queryLower) {
        score += getScore(l.name, 15);
        score += getScore(l.email, 15);
        score += getScore(l.phone, 10);
        score += getScore(l.message, 2);
      }
      scoredResults.push({
        id: l.id,
        entityType: 'inquiry',
        title: `Inquiry from ${l.name}`,
        subtitle: `${l.email} • "${l.message.substring(0, 80)}..."`,
        status: l.status,
        createdAt: l.createdAt,
        relevance: score,
        data: l,
      });
    });

    // Appointments
    appointments.forEach((a) => {
      let score = 0;
      if (queryLower) {
        score += getScore(a.name, 15);
        score += getScore(a.email, 15);
        score += getScore(a.phone, 10);
        score += getScore(a.message, 2);
        score += getScore(a.specialRequests, 2);
        score += getScore(a.status, 5);
      }
      scoredResults.push({
        id: a.id,
        entityType: 'appointment',
        title: `Viewing for ${a.name}`,
        subtitle: `Property: ${a.property?.name || 'Unknown'} on ${a.date} at ${a.time}`,
        status: a.status,
        createdAt: a.createdAt,
        relevance: score,
        data: a,
      });
    });

    // 3. Sort by relevance (descending) and then by creation date (descending)
    scoredResults.sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 4. Apply pagination
    const total = scoredResults.length;
    const paginatedResults = scoredResults.slice(skip, skip + limit);

    // 5. Group by entity type
    const grouped: Record<string, any[]> = {
      property: [],
      user: [],
      inquiry: [],
      appointment: [],
    };

    scoredResults.forEach((r) => {
      if (grouped[r.entityType]) {
        grouped[r.entityType].push(r);
      }
    });

    return NextResponse.json({
      results: paginatedResults,
      grouped: {
        property: grouped.property.slice(0, 5),
        user: grouped.user.slice(0, 5),
        inquiry: grouped.inquiry.slice(0, 5),
        appointment: grouped.appointment.slice(0, 5),
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API Admin Search GET] Error:', error);
    return NextResponse.json({ error: 'Failed to execute global search' }, { status: 500 });
  }
}
