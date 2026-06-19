import { db } from '../db';
import { IncidentResponseService } from './incident-response';
import { SecurityAutomationMetricsService } from './automation-metrics';

export class SecurityReportGenerator {
  static async generateReport(type: string, format: string, timeFilterHours = 24): Promise<{ content: string; filename: string }> {
    const timeLimit = new Date(Date.now() - timeFilterHours * 60 * 60 * 1000);
    let rows: string[][] = [];
    let headers: string[] = [];
    let filename = `security_${type}_report_${Date.now()}.csv`;

    switch (type.toLowerCase()) {
      case 'threat':
        headers = ['Alert ID', 'Title', 'Description', 'Severity', 'Status', 'Event Type', 'Triggered At'];
        const alerts = await db.securityAlert.findMany({
          where: { createdAt: { gte: timeLimit } },
          orderBy: { createdAt: 'desc' },
        });
        rows = alerts.map((a) => [
          a.id,
          a.title,
          a.description,
          a.severity,
          a.status,
          a.type || 'unknown',
          a.createdAt.toISOString(),
        ]);
        break;

      case 'risk':
        headers = ['Session ID', 'User Email', 'Role', 'IP Address', 'Country', 'City', 'Risk Score', 'Status', 'Login At'];
        const sessions = await db.session.findMany({
          where: { loginAt: { gte: timeLimit } },
          orderBy: { riskScore: 'desc' },
        });
        rows = sessions.map((s) => [
          s.id,
          s.userEmail,
          s.userRole,
          s.ipAddress,
          s.country || '',
          s.city || '',
          s.riskScore.toString(),
          s.status,
          s.loginAt.toISOString(),
        ]);
        break;

      case 'geosecurity':
        headers = ['Event ID', 'Event Type', 'Country', 'State', 'City', 'Description', 'Risk Score', 'Triggered At'];
        const geoEvents = await db.securityEvent.findMany({
          where: {
            createdAt: { gte: timeLimit },
            eventType: { in: ['IMPOSSIBLE_TRAVEL', 'LOCATION_ANOMALY'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        rows = geoEvents.map((e) => [
          e.id,
          e.eventType,
          e.country || '',
          e.state || '',
          e.city || '',
          e.description,
          e.riskScore.toString(),
          e.createdAt.toISOString(),
        ]);
        break;

      case 'admin':
        headers = ['Log ID', 'Admin ID', 'Action', 'Description', 'IP Address', 'Timestamp'];
        const logs = await db.activityLog.findMany({
          where: {
            createdAt: { gte: timeLimit },
            action: {
              in: [
                'PROPERTY_UPDATE',
                'PROPERTY_DELETE',
                'USER_SUSPEND',
                'ROLE_PROMOTE',
                'ROLE_REVOKE',
                'PERMISSION_GRANTED',
                'PERMISSION_REVOKED',
                'EXPORT_DATA',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        rows = logs.map((l) => [
          l.id,
          l.actorId || 'System',
          l.action,
          l.description,
          (l.details as any)?.ipAddress || 'unknown',
          l.createdAt.toISOString(),
        ]);
        break;

      case 'incident':
        headers = ['Incident ID', 'Title', 'Description', 'Severity', 'Status', 'Triggered At'];
        const incidents = await db.securityAlert.findMany({
          where: {
            createdAt: { gte: timeLimit },
            severity: { in: ['HIGH', 'CRITICAL'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        rows = incidents.map((i) => [
          i.id,
          i.title,
          i.description,
          i.severity,
          i.status,
          i.createdAt.toISOString(),
        ]);
        break;

      case 'security_intelligence':
        headers = ['Report Section', 'Metric / Type', 'Value / Details', 'Severity / Status', 'Timestamp'];
        const metrics = await IncidentResponseService.getOperationalMetrics();
        const automations = await SecurityAutomationMetricsService.getMetrics();
        
        rows.push(['Performance', 'Mean Time To Detect (MTTD)', `${metrics.meanTimeToDetectMinutes.toFixed(2)} Minutes`, 'N/A', 'N/A']);
        rows.push(['Performance', 'Mean Time To Resolve (MTTR)', `${metrics.meanTimeToResolveMinutes.toFixed(2)} Minutes`, 'N/A', 'N/A']);
        rows.push(['Performance', 'Open Incidents', metrics.openIncidents.toString(), 'N/A', 'N/A']);
        rows.push(['Performance', 'Closed Incidents', metrics.closedIncidents.toString(), 'N/A', 'N/A']);
        rows.push(['Playbooks', 'Playbooks Executed', metrics.playbooksExecuted.toString(), 'N/A', 'N/A']);
        rows.push(['Playbooks', 'Alerts Correlated', metrics.alertsCorrelated.toString(), 'N/A', 'N/A']);
        rows.push(['Playbooks', 'False Positives', metrics.falsePositives.toString(), 'N/A', 'N/A']);

        const topTypes = await db.securityEvent.groupBy({
          by: ['eventType'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        });
        topTypes.forEach((t) => {
          rows.push(['Top Attack Type', t.eventType, t._count.id.toString(), 'N/A', 'N/A']);
        });

        const topIPs = await db.securityEvent.groupBy({
          by: ['ipAddress'],
          where: { ipAddress: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        });
        topIPs.forEach((ip) => {
          rows.push(['Active Threat Source', ip.ipAddress || 'unknown', ip._count.id.toString(), 'N/A', 'N/A']);
        });

        const openIncList = await db.incident.findMany({
          where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        openIncList.forEach((inc) => {
          rows.push([
            'Open Incident',
            inc.id,
            (inc.metadata as any)?.title || 'No Title',
            `${inc.severity} / ${inc.status}`,
            inc.createdAt.toISOString(),
          ]);
        });
        break;

      case 'session':
        headers = ['Session ID', 'User ID', 'User Email', 'IP Address', 'Browser', 'OS', 'Status', 'Expires At'];
        const sessionHistory = await db.session.findMany({
          where: { loginAt: { gte: timeLimit } },
          orderBy: { loginAt: 'desc' },
        });
        rows = sessionHistory.map((s) => [
          s.id,
          s.userId,
          s.userEmail,
          s.ipAddress,
          s.browser || '',
          s.operatingSystem || '',
          s.status,
          s.expiresAt.toISOString(),
        ]);
        break;

      default:
        headers = ['Report Info'];
        rows = [[`Unknown report type requested: ${type}`]];
    }

    if (format.toLowerCase() === 'pdf' || format.toLowerCase() === 'excel') {
      // Simulate PDF or Excel using text formatting in CSV wrapper for output consistency
      filename = filename.replace('.csv', format.toLowerCase() === 'pdf' ? '.pdf' : '.xlsx');
    }

    // Convert rows to CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return {
      content: csvContent,
      filename,
    };
  }
}
