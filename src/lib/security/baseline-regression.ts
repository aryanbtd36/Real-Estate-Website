import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { PostureScorer } from './posture-scorer';
import { SecurityControlVerifier } from './control-verifier';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export interface DriftDifference {
  component: string;
  parameter: string;
  expected: any;
  actual: any;
  severity: 'HIGH' | 'CRITICAL' | 'WARNING';
}

export class BaselineRegressionSystem {
  static getBaselinePath(): string {
    return path.resolve(process.cwd(), 'security-baseline.json');
  }

  static async captureSnapshot(): Promise<any> {
    const scores = await PostureScorer.calculateScore();
    const controls = await SecurityControlVerifier.verifyControls();
    
    // Fetch user permissions for drift detection
    const permissions = await db.adminPermission.findMany({
      select: { userId: true, permission: true },
    });

    const snapshot = {
      timestamp: new Date().toISOString(),
      scores,
      controls: controls.map(c => ({ name: c.name, status: c.status })),
      permissions,
      policies: {
        passwordMaxAgeDays: 90,
        inactivityTimeoutMinutes: 15,
        mfaRequiredForAdmin: true,
      },
    };

    fs.writeFileSync(this.getBaselinePath(), JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  }

  static async detectRegressions(): Promise<DriftDifference[]> {
    const baselinePath = this.getBaselinePath();
    if (!fs.existsSync(baselinePath)) {
      return [];
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const currentScores = await PostureScorer.calculateScore();
    const currentControls = await SecurityControlVerifier.verifyControls();
    const currentPermissions = await db.adminPermission.findMany({
      select: { userId: true, permission: true },
    });

    const differences: DriftDifference[] = [];

    // 1. Check Score Drop
    if (currentScores.overallScore < baseline.scores.overallScore) {
      differences.push({
        component: 'Overall Posture',
        parameter: 'Overall Score',
        expected: baseline.scores.overallScore,
        actual: currentScores.overallScore,
        severity: 'CRITICAL',
      });
    }

    // 2. Check Control Status Failures
    for (const ctrl of currentControls) {
      const baseCtrl = baseline.controls.find((c: any) => c.name === ctrl.name);
      if (baseCtrl) {
        if (ctrl.status === 'FAILED' && baseCtrl.status !== 'FAILED') {
          differences.push({
            component: 'Security Controls',
            parameter: `${ctrl.name} status`,
            expected: baseCtrl.status,
            actual: ctrl.status,
            severity: 'CRITICAL',
          });
        } else if (ctrl.status === 'WARNING' && baseCtrl.status === 'ACTIVE') {
          differences.push({
            component: 'Security Controls',
            parameter: `${ctrl.name} status`,
            expected: baseCtrl.status,
            actual: ctrl.status,
            severity: 'WARNING',
          });
        }
      }
    }

    // 3. Check Permissions Drift
    const baselineUserPermKeys = new Set(baseline.permissions.map((p: any) => `${p.userId}:${p.permission}`));
    const currentUserPermKeys = new Set(currentPermissions.map(p => `${p.userId}:${p.permission}`));

    // Detect new permissions granted
    for (const p of currentPermissions) {
      const key = `${p.userId}:${p.permission}`;
      if (!baselineUserPermKeys.has(key)) {
        differences.push({
          component: 'Access Control',
          parameter: `Permission ${p.permission} granted`,
          expected: 'NOT_GRANTED',
          actual: `GRANTED_TO:${p.userId}`,
          severity: 'HIGH',
        });
      }
    }

    // Detect baseline permissions missing
    for (const p of baseline.permissions) {
      const key = `${p.userId}:${p.permission}`;
      if (!currentUserPermKeys.has(key)) {
        differences.push({
          component: 'Access Control',
          parameter: `Permission ${p.permission} missing`,
          expected: `GRANTED_TO:${p.userId}`,
          actual: 'MISSING',
          severity: 'HIGH',
        });
      }
    }

    // If regressions were found, log a SecurityEvent and raise a SecurityAlert
    if (differences.length > 0) {
      try {
        const criticalCount = differences.filter(d => d.severity === 'CRITICAL').length;
        const severity = criticalCount > 0 ? SecurityEventSeverity.CRITICAL : SecurityEventSeverity.HIGH;

        const newEvent = await db.securityEvent.create({
          data: {
            eventType: 'SECURITY_BASELINE_REGRESSION',
            severity,
            category: SecurityEventCategory.GOVERNANCE,
            title: 'Security Posture Drift Alert',
            description: `Detected ${differences.length} regression(s) from security baseline snapshot.`,
            metadata: { drifts: differences } as any,
          },
        });

        await db.securityAlert.create({
          data: {
            title: 'Security Configuration Regression Detected',
            description: `Security verification engine reported configuration drift. Scores or permission rules have drifted.`,
            severity,
            status: 'OPEN',
            sourceEventId: newEvent.id,
          },
        });
      } catch (dbErr) {
        console.error('[BaselineRegressionSystem Alert Error]', dbErr);
      }
    }

    return differences;
  }
}
