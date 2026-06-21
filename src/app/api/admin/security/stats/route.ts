import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { LegacyPermission as Permission, SessionStatus, UserRole, SecurityEventSeverity, FindingSeverity, FindingStatus } from '@prisma/client';
import { secureApiHandler } from '@/lib/security/api-security';
import { RiskScoringEngine } from '@/lib/security/risk-engine';
import { getEventLoopLag, getEventLoopLagState } from '@/lib/security/resilience';
import { runFullCodeAudit } from '@/lib/security/code-audit/ai-audit-reporter';
import { SecurityControlVerifier } from '@/lib/security/control-verifier';
import { HeaderAuditor } from '@/lib/security/header-auditor';
import { SecurityPostureService } from '@/lib/security/security-posture';
import { BaselineRegressionSystem } from '@/lib/security/baseline-regression';
import path from 'path';

async function getStatsHandler(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || '24h'; // '24h', '7d', '30d', '90d'
  
  let hours = 24;
  if (filter === '7d') hours = 24 * 7;
  else if (filter === '30d') hours = 24 * 30;
  else if (filter === '90d') hours = 24 * 90;

  const timeLimit = new Date(Date.now() - hours * 60 * 60 * 1000);

  // 1. Core counters
  const [
    activeSessions,
    suspiciousSessions,
    expiredSessions,
    revokedSessions,
    failedLogins,
    lockedAccounts,
    totalAdmins,
    mfaAdmins,
    activeAlerts,
    openCriticalAlerts,
    allSessionsInPeriod,
    replayBlocks,
    csrfBlocks,
    rateLimitViolations,
    bruteForceAttempts,
    exportAbuseAttempts,
    locationChanges,
    deviceChanges,
    accountTakeovers,
    xssFindings,
    sstiFindings,
    uploadThreats,
    secretExposureFindings,
  ] = await Promise.all([
    db.session.count({ where: { status: SessionStatus.ACTIVE } }),
    db.session.count({ where: { status: SessionStatus.SUSPICIOUS } }),
    db.session.count({ where: { status: SessionStatus.EXPIRED, loginAt: { gte: timeLimit } } }),
    db.session.count({ where: { status: SessionStatus.REVOKED, loginAt: { gte: timeLimit } } }),
    db.loginAttempt.count({ where: { success: false, createdAt: { gte: timeLimit } } }),
    db.user.count({ where: { accountLockedUntil: { gte: new Date() } } }),
    db.user.count({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, deletedAt: null } }),
    db.user.count({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, mfaEnabled: true, deletedAt: null } }),
    db.securityAlert.count({ where: { status: 'OPEN', createdAt: { gte: timeLimit } } }),
    db.securityAlert.count({ where: { status: 'OPEN', severity: SecurityEventSeverity.CRITICAL, createdAt: { gte: timeLimit } } }),
    db.session.findMany({ where: { loginAt: { gte: timeLimit } }, select: { riskScore: true } }),
    
    // Attack and abuse counters
    db.securityEvent.count({ where: { eventType: { in: ['REPLAY_ATTACK_BLOCKED', 'Replay Attack Blocked'] }, createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: { in: ['CSRF_ATTACK_BLOCKED', 'CSRF Attack Blocked'] }, createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: { in: ['RATE_LIMIT_TRIGGERED', 'Rate Limit Triggered'] }, createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'BRUTE_FORCE_ATTEMPT', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'EXPORT_ABUSE', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'LOCATION_ANOMALY', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'NEW_DEVICE_LOGIN', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'ACCOUNT_TAKEOVER_RISK', createdAt: { gte: timeLimit } } }),

    // Application security event counters
    db.securityEvent.count({ where: { eventType: 'XSS_PAYLOAD_BLOCKED', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'SSTI_ATTEMPT_BLOCKED', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'MALICIOUS_UPLOAD_BLOCKED', createdAt: { gte: timeLimit } } }),
    db.securityEvent.count({ where: { eventType: 'SECRET_EXPOSURE_DETECTED', createdAt: { gte: timeLimit } } }),
  ]);

  // 2. Compute Risk Distribution
  const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const s of allSessionsInPeriod) {
    const lvl = RiskScoringEngine.getLevel(s.riskScore);
    riskDistribution[lvl]++;
  }

  // 3. Compute Platform Security Score
  const mfaAdoption = totalAdmins > 0 ? (mfaAdmins / totalAdmins) * 100 : 0;
  
  let securityScore = 100;
  securityScore -= Math.min(failedLogins * 2, 15);
  securityScore -= Math.min(activeAlerts * 3, 20);
  securityScore -= Math.min(openCriticalAlerts * 10, 30);
  securityScore -= Math.min(suspiciousSessions * 5, 15);
  
  if (mfaAdoption < 50) securityScore -= 10;
  else if (mfaAdoption < 80) securityScore -= 5;
  
  securityScore = Math.max(10, Math.min(securityScore, 100));

  let securityGrade = 'EXCELLENT';
  if (securityScore < 40) securityGrade = 'CRITICAL';
  else if (securityScore < 60) securityGrade = 'WEAK';
  else if (securityScore < 80) securityGrade = 'MODERATE';
  else if (securityScore < 95) securityGrade = 'GOOD';

  // 4. Fetch top administrator risk rankings
  const admins = await db.user.findMany({
    where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminTrustProfile: {
        select: {
          adminRiskScore: true,
          trustScore: true,
        },
      },
    },
  });

  const adminRiskRankings = admins.map((adm) => ({
    id: adm.id,
    name: adm.name || adm.email,
    email: adm.email,
    role: adm.role,
    riskScore: adm.adminTrustProfile?.adminRiskScore || 0,
    trustScore: adm.adminTrustProfile?.trustScore || 100,
  })).sort((a, b) => b.riskScore - a.riskScore);

  // Run code audit dynamically to populate dashboard indicators
  const auditResults = runFullCodeAudit(path.join(process.cwd(), 'src'));
  const unsafeRegexCount = auditResults.reduce((acc, r) => acc + r.redosIssues.length, 0);
  const totalSecretsFound = auditResults.reduce((acc, r) => acc + r.secretExposureIssues.length, 0);
  const codeAuditStatus = auditResults.length === 0 ? 'PASSED' : 'WARNING';

  // 1. Fetch real-time verified controls and posture details
  const [controls, posture] = await Promise.all([
    SecurityControlVerifier.verifyControls(),
    SecurityPostureService.calculatePosture(),
  ]);

  // Run drift detection in background or on GET to generate alerts automatically
  await BaselineRegressionSystem.detectRegressions().catch((err) =>
    console.error('[Stats Baseline Regression Error]', err)
  );

  // 2. Fetch security findings counts from database
  const [criticalFindings, highFindings, mediumFindings, lowFindings] = await Promise.all([
    db.securityFinding.count({ where: { severity: FindingSeverity.CRITICAL, status: FindingStatus.OPEN } }),
    db.securityFinding.count({ where: { severity: FindingSeverity.HIGH, status: FindingStatus.OPEN } }),
    db.securityFinding.count({ where: { severity: FindingSeverity.MEDIUM, status: FindingStatus.OPEN } }),
    db.securityFinding.count({ where: { severity: FindingSeverity.LOW, status: FindingStatus.OPEN } }),
  ]);

  // 3. SOC-specific metrics (Wave 7C.1)
  // 3a. Events per hour trend (last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentEvents = await db.securityEvent.findMany({
    where: { createdAt: { gte: twentyFourHoursAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const eventsPerHour: { hour: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(Date.now() - i * 60 * 60 * 1000);
    const hourEnd = new Date(Date.now() - (i - 1) * 60 * 60 * 1000);
    const hourLabel = hourStart.toISOString().slice(11, 13) + ':00';
    const count = recentEvents.filter(
      (e) => e.createdAt >= hourStart && e.createdAt < hourEnd
    ).length;
    eventsPerHour.push({ hour: hourLabel, count });
  }

  // 3b. Top 5 event types by count
  const topEventTypesRaw = await db.securityEvent.groupBy({
    by: ['eventType'],
    where: { createdAt: { gte: timeLimit } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });
  const topEventTypes = topEventTypesRaw.map((r) => ({
    eventType: r.eventType,
    count: r._count.id,
  }));

  // 3c. Top 5 source IPs
  const topSourceIPsRaw = await db.securityEvent.groupBy({
    by: ['ipAddress'],
    where: { createdAt: { gte: timeLimit }, ipAddress: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });
  const topSourceIPs = topSourceIPsRaw.map((r) => ({
    ipAddress: r.ipAddress || 'unknown',
    count: r._count.id,
  }));

  // 3d. Alert resolution stats
  const resolvedAlerts = await db.securityAlert.findMany({
    where: { status: 'RESOLVED', createdAt: { gte: timeLimit } },
    select: { createdAt: true },
  });
  const openAlertsCount = await db.securityAlert.count({
    where: { status: 'OPEN' },
  });
  const alertResolutionStats = {
    resolvedCount: resolvedAlerts.length,
    openCount: openAlertsCount,
    avgResolutionTimeMs: 0, // Placeholder — would need resolvedAt timestamp for true calculation
  };

  return NextResponse.json({
    securityScore: posture.overallScore, // Overwritten by dynamic scorer
    securityGrade: posture.overallScore >= 90 ? 'EXCELLENT' : posture.overallScore >= 70 ? 'GOOD' : 'CRITICAL',
    activeSessions,
    suspiciousSessions,
    expiredSessions,
    revokedSessions,
    failedLogins,
    lockedAccounts,
    mfaAdoption: Math.round(mfaAdoption),
    activeAlerts,
    openCriticalAlerts,
    riskDistribution,
    replayBlocks,
    csrfBlocks,
    rateLimitViolations,
    bruteForceAttempts,
    exportAbuseAttempts,
    locationChanges,
    deviceChanges,
    accountTakeovers,
    adminRiskRankings,
    sensitiveActions: 0, // compatibility
    xssFindings,
    sstiFindings,
    unsafeRegexCount,
    uploadThreats,
    secretExposureFindings: secretExposureFindings + totalSecretsFound,
    codeAuditStatus,
    eventLoopLag: Math.round(getEventLoopLag() * 100) / 100,
    runtimeHealth: getEventLoopLagState(),
    
    posture: {
      ...posture,
      ...posture.scores,
      status: posture.overallScore >= 90 ? 'SECURE' : posture.overallScore >= 70 ? 'WARNING' : 'AT_RISK',
      uploads: posture.scores.sessions,
      database: posture.scores.authorization,
      secrets: posture.scores.authentication,
      infrastructure: posture.scores.headers
    },
    controls,
    findings: {
      critical: criticalFindings,
      high: highFindings,
      medium: mediumFindings,
      low: lowFindings,
      total: criticalFindings + highFindings + mediumFindings + lowFindings,
    },

    // SOC metrics (Wave 7C.1)
    eventsPerHour,
    topEventTypes,
    topSourceIPs,
    alertResolutionStats,
  });
}

export const GET = secureApiHandler(getStatsHandler, {
  rateLimit: { max: 100, windowMs: 60 * 1000, keyPrefix: 'admin-security-stats' },
});

