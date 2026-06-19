import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SecurityEventSeverity, SecurityEventCategory, IncidentStatus } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';
import { IncidentResponseService } from '@/lib/security/incident-response';
import { SecurityPlaybooks } from '@/lib/security/playbooks';

async function incidentsHandler(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerId = (session.user as any).id;
  const callerRole = (session.user as any).role;
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const isAllowed = isSuperAdmin || (await hasPermission(callerId, Permission.VIEW_SECURITY));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  const method = request.method;

  if (method === 'GET') {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const includeMetrics = searchParams.get('metrics') === 'true';

    try {
      const whereClause: any = {};
      if (status) whereClause.status = status as IncidentStatus;
      if (severity) whereClause.severity = severity as SecurityEventSeverity;

      const incidents = await db.incident.findMany({
        where: whereClause,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          alerts: true,
          events: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (includeMetrics) {
        const metrics = await IncidentResponseService.getOperationalMetrics();
        return NextResponse.json({ incidents, metrics });
      }

      return NextResponse.json(incidents);
    } catch (err: any) {
      console.error('[API Security Incidents GET] Error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      const { incidentId, status, notes, title, description, severity, category, alertIds, eventIds } = body;

      // Update incident status directly if requested
      if (incidentId && status) {
        const updated = await IncidentResponseService.updateIncidentStatus(incidentId, status as IncidentStatus, notes, callerId);
        return NextResponse.json({ success: true, incident: updated });
      }

      // Or create a new manual incident
      if (!title || !description || !severity || !category) {
        return NextResponse.json({ error: 'Missing required creation fields' }, { status: 400 });
      }

      const incident = await IncidentResponseService.createIncident({
        title,
        description,
        severity: severity as SecurityEventSeverity,
        category: category as SecurityEventCategory,
        alertIds,
        eventIds,
      });

      return NextResponse.json({ success: true, incident });
    } catch (err: any) {
      console.error('[API Security Incidents POST] Error:', err);
      return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  if (method === 'PATCH') {
    try {
      const body = await request.json();
      const { action, incidentId, analystId, newAnalystId, reason, playbookName, ipAddress, email, sessionId } = body;

      if (!incidentId && action !== 'run_playbook') {
        return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
      }

      let result: any = null;

      switch (action) {
        case 'claim':
          result = await IncidentResponseService.claimIncident(incidentId, analystId || callerId);
          break;
        case 'unassign':
          result = await IncidentResponseService.unassignIncident(incidentId, callerId);
          break;
        case 'transfer':
          if (!newAnalystId) return NextResponse.json({ error: 'New Analyst ID is required' }, { status: 400 });
          result = await IncidentResponseService.transferIncident(incidentId, newAnalystId, callerId, reason);
          break;
        case 'run_playbook':
          if (playbookName === 'credential_stuffing' && ipAddress) {
            result = await SecurityPlaybooks.runCredentialStuffingPlaybook(ipAddress, email || '');
          } else if (playbookName === 'brute_force' && email && ipAddress) {
            result = await SecurityPlaybooks.runBruteForcePlaybook(email, ipAddress);
          } else if (playbookName === 'session_hijacking' && sessionId && analystId && email) {
            result = await SecurityPlaybooks.runSessionHijackingPlaybook(sessionId, analystId, email);
          } else {
            return NextResponse.json({ error: 'Invalid playbook parameters' }, { status: 400 });
          }
          break;
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }

      if (!result) {
        return NextResponse.json({ error: 'Operation failed or incident not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, result });
    } catch (err: any) {
      console.error('[API Security Incidents PATCH] Error:', err);
      return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export const GET = secureApiHandler(incidentsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-incidents-get' },
});

export const POST = secureApiHandler(incidentsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-incidents-post' },
});

export const PATCH = secureApiHandler(incidentsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-incidents-patch' },
});
