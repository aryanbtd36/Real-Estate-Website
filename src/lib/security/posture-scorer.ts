import { db } from '../db';
import { UserRole, FindingStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export interface PostureScoreDetails {
  authentication: number;
  authorization: number;
  sessions: number;
  uploads: number;
  database: number;
  secrets: number;
  threatDetection: number;
  compliance: number;
  infrastructure: number;
  overallScore: number;
  status: 'SECURE' | 'WARNING' | 'AT_RISK';
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export class PostureScorer {
  static async calculateScore(): Promise<PostureScoreDetails> {
    // 1. Authentication Score (Weight: 15%)
    let authentication = 100;
    const adminsCount = await db.user.count({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, deletedAt: null },
    });
    const mfaAdminsCount = await db.user.count({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, mfaEnabled: true, deletedAt: null },
    });
    const mfaAdoption = adminsCount > 0 ? (mfaAdminsCount / adminsCount) * 100 : 0;
    if (mfaAdoption < 50) authentication -= 20;
    else if (mfaAdoption < 80) authentication -= 10;

    const failedLogins24h = await db.loginAttempt.count({
      where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    authentication -= Math.min(failedLogins24h * 2, 20);
    authentication = Math.max(0, authentication);

    // 2. Authorization Score (Weight: 15%)
    let authorization = 100;
    const authAlerts = await db.securityAlert.count({
      where: { status: 'OPEN', description: { contains: 'Authorization' } },
    });
    authorization -= Math.min(authAlerts * 15, 40);
    authorization = Math.max(0, authorization);

    // 3. Sessions Score (Weight: 10%)
    let sessions = 100;
    const suspiciousSessions = await db.session.count({ where: { status: 'SUSPICIOUS' } });
    sessions -= Math.min(suspiciousSessions * 10, 50);
    sessions = Math.max(0, sessions);

    // 4. Uploads Score (Weight: 10%)
    let uploads = 100;
    const blockedUploads = await db.securityEvent.count({
      where: { eventType: 'MALICIOUS_UPLOAD_BLOCKED', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    uploads -= Math.min(blockedUploads * 15, 50);
    uploads = Math.max(0, uploads);

    // 5. Database Score (Weight: 10%)
    let database = 100;
    // Deduct if database access audits failed or sensitive data access was unlogged
    const unloggedAlerts = await db.securityAlert.count({
      where: { status: 'OPEN', description: { contains: 'DATABASE' } },
    });
    database -= Math.min(unloggedAlerts * 15, 40);
    database = Math.max(0, database);

    // 6. Secrets Score (Weight: 15%)
    let secrets = 100;
    const openSecretsCount = await db.securityFinding.count({
      where: { category: 'SECRETS', status: FindingStatus.OPEN },
    });
    secrets -= openSecretsCount * 25;
    secrets = Math.max(0, secrets);

    // 7. Threat Detection Score (Weight: 10%)
    let threatDetection = 100;
    const openAlertsCount = await db.securityAlert.count({ where: { status: 'OPEN' } });
    const criticalAlertsCount = await db.securityAlert.count({
      where: { status: 'OPEN', severity: 'CRITICAL' },
    });
    threatDetection -= Math.min(openAlertsCount * 5 + criticalAlertsCount * 15, 60);
    threatDetection = Math.max(0, threatDetection);

    // 8. Compliance Score (Weight: 7%)
    let compliance = 100;
    const consentsCount = await db.userConsent.count();
    if (consentsCount === 0) compliance -= 10;
    const overduePrivacyRequests = await db.privacyRequest.count({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    compliance -= Math.min(overduePrivacyRequests * 15, 40);
    compliance = Math.max(0, compliance);

    // 9. Infrastructure Score (Weight: 8%)
    let infrastructure = 100;
    const openInfraFindings = await db.securityFinding.count({
      where: { category: 'INFRASTRUCTURE', status: FindingStatus.OPEN },
    });
    infrastructure -= Math.min(openInfraFindings * 10, 50);
    infrastructure = Math.max(0, infrastructure);

    // Weighted Overall Score
    const overallScore = Math.round(
      authentication * 0.15 +
      authorization * 0.15 +
      sessions * 0.10 +
      uploads * 0.10 +
      database * 0.10 +
      secrets * 0.15 +
      threatDetection * 0.10 +
      compliance * 0.07 +
      infrastructure * 0.08
    );

    let status: 'SECURE' | 'WARNING' | 'AT_RISK' = 'SECURE';
    if (overallScore < 70) status = 'AT_RISK';
    else if (overallScore < 90) status = 'WARNING';

    // Trend calculation comparing to security-baseline.json if it exists
    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    try {
      const baselinePath = path.resolve(process.cwd(), 'security-baseline.json');
      if (fs.existsSync(baselinePath)) {
        const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
        const baselineScore = baseline.scores?.overallScore ?? 97;
        if (overallScore > baselineScore) trend = 'UP';
        else if (overallScore < baselineScore) trend = 'DOWN';
      }
    } catch (err) {
      console.error('[PostureScorer Trend Load Error]', err);
    }

    return {
      authentication,
      authorization,
      sessions,
      uploads,
      database,
      secrets,
      threatDetection,
      compliance,
      infrastructure,
      overallScore,
      status,
      trend,
    };
  }
}
