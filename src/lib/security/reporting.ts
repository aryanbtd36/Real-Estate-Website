import { db } from '../db';

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
