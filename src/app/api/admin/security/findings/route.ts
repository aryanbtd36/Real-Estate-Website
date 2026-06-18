import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { FindingSeverity, FindingStatus, FindingCategory } from '@prisma/client';

// GET: Retrieve all security findings (restricted to SUPER_ADMIN only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') as FindingSeverity | null;
    const status = searchParams.get('status') as FindingStatus | null;
    const category = searchParams.get('category') as FindingCategory | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const whereClause: any = {};

    if (severity) {
      whereClause.severity = severity;
    }
    if (status) {
      whereClause.status = status;
    }
    if (category) {
      whereClause.category = category;
    }

    if (startDateStr || endDateStr) {
      whereClause.detectedAt = {};
      if (startDateStr) {
        whereClause.detectedAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        whereClause.detectedAt.lte = new Date(endDateStr);
      }
    }

    const findings = await db.securityFinding.findMany({
      where: whereClause,
      orderBy: { detectedAt: 'desc' },
    });

    // Compute metrics breakdown
    const [critical, high, medium, low] = await Promise.all([
      db.securityFinding.count({ where: { severity: FindingSeverity.CRITICAL, status: FindingStatus.OPEN } }),
      db.securityFinding.count({ where: { severity: FindingSeverity.HIGH, status: FindingStatus.OPEN } }),
      db.securityFinding.count({ where: { severity: FindingSeverity.MEDIUM, status: FindingStatus.OPEN } }),
      db.securityFinding.count({ where: { severity: FindingSeverity.LOW, status: FindingStatus.OPEN } }),
    ]);

    return NextResponse.json({
      success: true,
      findings,
      metrics: {
        critical,
        high,
        medium,
        low,
        totalOpen: critical + high + medium + low,
      },
    });
  } catch (error: any) {
    console.error('[API Admin Findings GET] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve security findings' }, { status: 500 });
  }
}

// POST: Resolve or create manually logged security findings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const actorId = (session?.user as any)?.id;
    const actorEmail = (session?.user as any)?.email;

    if (!session || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, findingId, title, description, severity, category, status, notes } = body;

    const ipAddress = request.headers.get('x-forwarded-for') || (request as any).ip || '127.0.0.1';

    if (action === 'create') {
      if (!title || !description || !severity || !category) {
        return NextResponse.json({ error: 'Missing required finding creation fields' }, { status: 400 });
      }

      const newFinding = await db.securityFinding.create({
        data: {
          title,
          description,
          severity: severity as FindingSeverity,
          category: category as FindingCategory,
          status: FindingStatus.OPEN,
          source: 'Manual Super Admin Entry',
          notes: notes || null,
          createdBy: actorEmail || 'Unknown',
        },
      });

      // Audit manually created finding
      await db.securityEvent.create({
        data: {
          eventType: 'SECURITY_FINDING_CREATED',
          severity: 'HIGH',
          category: 'SECURITY',
          title: 'Manual Security Finding Created',
          description: `Super Admin created security finding: ${title} (${severity})`,
          userId: actorId,
          ipAddress,
          metadata: { findingId: newFinding.id },
        },
      });

      return NextResponse.json({ success: true, finding: newFinding }, { status: 201 });
    }

    if (action === 'update') {
      if (!findingId || !status || !Object.values(FindingStatus).includes(status)) {
        return NextResponse.json({ error: 'Invalid findingId or status' }, { status: 400 });
      }

      const updateData: any = {
        status: status as FindingStatus,
        updatedBy: actorEmail || 'Unknown',
      };

      if (status === FindingStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      }
      if (notes) {
        updateData.notes = notes;
      }

      const updatedFinding = await db.securityFinding.update({
        where: { id: findingId },
        data: updateData,
      });

      // Audit update
      await db.securityEvent.create({
        data: {
          eventType: 'SECURITY_FINDING_RESOLVED',
          severity: 'MEDIUM',
          category: 'SECURITY',
          title: 'Security Finding Resolved',
          description: `Super Admin marked finding ${findingId} as ${status}`,
          userId: actorId,
          ipAddress,
          metadata: { findingId, status },
        },
      });

      return NextResponse.json({ success: true, finding: updatedFinding });
    }

    return NextResponse.json({ error: 'Invalid findings action' }, { status: 400 });
  } catch (error: any) {
    console.error('[API Admin Findings POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to manage security findings' }, { status: 500 });
  }
}
