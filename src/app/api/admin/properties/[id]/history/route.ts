import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/currency';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing property ID' }, { status: 400 });
    }

    // 1. Fetch property to confirm existence
    const property = await db.property.findUnique({
      where: { id },
      select: { name: true, createdAt: true }
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // 2. Fetch price changes from PropertyPriceHistory
    const priceHistory = await db.propertyPriceHistory.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        changedBy: {
          select: { name: true, email: true }
        }
      }
    });

    // 3. Fetch relevant activity logs from ActivityLog
    const activityLogsRaw = await db.activityLog.findMany({
      where: {
        action: {
          in: [
            'PROPERTY_CREATE',
            'PROPERTY_UPDATE',
            'PROPERTY_PUBLISH',
            'PROPERTY_ARCHIVE',
            'PROPERTY_RESTORE',
            'PROPERTY_DELETE'
          ]
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { name: true, email: true }
        }
      }
    });

    // Filter logs for this specific property in JavaScript for DB-agnostic compatibility
    const filteredLogs = activityLogsRaw.filter((log) => {
      if (!log.details) return false;
      const detailsObj = log.details as any;
      return (
        detailsObj.propertyId === id ||
        detailsObj.originalId === id ||
        detailsObj.duplicatedId === id
      );
    });

    // 4. Map and format both timelines
    const timelineItems: any[] = [];

    // Add price histories
    priceHistory.forEach((ph) => {
      timelineItems.push({
        id: ph.id,
        type: 'PRICE_CHANGE',
        timestamp: ph.createdAt,
        description: `Price changed from ${formatCurrency(ph.oldPrice)} to ${formatCurrency(ph.newPrice)}`,
        actor: ph.changedBy ? { name: ph.changedBy.name, email: ph.changedBy.email } : null,
        details: { oldPrice: ph.oldPrice, newPrice: ph.newPrice }
      });
    });

    // Add activity logs
    filteredLogs.forEach((log) => {
      timelineItems.push({
        id: log.id,
        type: log.action,
        timestamp: log.createdAt,
        description: log.description,
        actor: log.actor ? { name: log.actor.name, email: log.actor.email } : null,
        details: log.details
      });
    });

    // Sort combined timeline by timestamp descending
    timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      property: {
        id,
        name: property.name,
        createdAt: property.createdAt
      },
      timeline: timelineItems
    });
  } catch (error) {
    console.error('[API Property History GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch property history' }, { status: 500 });
  }
}
