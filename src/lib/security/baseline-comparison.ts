import { db } from '../db';
import fs from 'fs';
import path from 'path';
import { SecurityPostureService } from './security-posture';
import { SecurityControlVerifier } from './control-verifier';
import { SecurityEventSeverity, SecurityEventCategory } from '@prisma/client';

export interface DriftDetail {
  component: string;
  parameter: string;
  expected: any;
  actual: any;
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface BaselineComparisonResult {
  baselineTimestamp: string | null;
  driftsCount: number;
  driftLevel: 'NO_DRIFT' | 'MINOR_DRIFT' | 'MAJOR_DRIFT' | 'CRITICAL_DRIFT';
  drifts: DriftDetail[];
  recommendedRemediation: string;
}

export class BaselineComparisonService {
  static getBaselinePath(): string {
    return path.resolve(process.cwd(), 'security-baseline.json');
  }

  static async captureBaseline(actorId?: string): Promise<any> {
    const posture = await SecurityPostureService.calculatePosture();
    const controls = await SecurityControlVerifier.verifyControls();

    const baseline = {
      timestamp: new Date().toISOString(),
      scores: posture.scores,
      overallScore: posture.overallScore,
      controls: controls.map(c => ({ name: c.name, status: c.status })),
      policies: {
        passwordMaxAgeDays: 90,
        inactivityTimeoutMinutes: 15,
        mfaRequiredForAdmin: true,
      },
      capturedBy: actorId || 'SYSTEM',
    };

    fs.writeFileSync(this.getBaselinePath(), JSON.stringify(baseline, null, 2), 'utf8');

    // Audit log the capture action
    await db.activityLog.create({
      data: {
        actorId: actorId || null,
        action: 'SYSTEM_EVENT',
        description: 'Captured new security baseline configuration snapshot.',
        details: { overallScore: posture.overallScore } as any,
      }
    });

    return baseline;
  }

  static async detectDrifts(): Promise<BaselineComparisonResult> {
    const baselinePath = this.getBaselinePath();
    if (!fs.existsSync(baselinePath)) {
      return {
        baselineTimestamp: null,
        driftsCount: 0,
        driftLevel: 'NO_DRIFT',
        drifts: [],
        recommendedRemediation: 'No configuration baseline has been frozen yet. Please freeze the current security baseline.',
      };
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const currentPosture = await SecurityPostureService.calculatePosture();
    const currentControls = await SecurityControlVerifier.verifyControls();

    const drifts: DriftDetail[] = [];

    // 1. Score Regression Check
    if (currentPosture.overallScore < baseline.overallScore) {
      const drop = baseline.overallScore - currentPosture.overallScore;
      const severity = drop >= 10 ? 'CRITICAL' : drop >= 5 ? 'HIGH' : 'WARNING';
      drifts.push({
        component: 'Overall Posture',
        parameter: 'Overall Score',
        expected: baseline.overallScore,
        actual: currentPosture.overallScore,
        severity,
        description: `Security posture score dropped by ${drop} points from baseline.`,
      });
    }

    // 2. Control Status Failures Check
    for (const currentCtrl of currentControls) {
      const baseCtrl = baseline.controls?.find((c: any) => c.name === currentCtrl.name);
      if (baseCtrl) {
        if (currentCtrl.status === 'FAILED' && baseCtrl.status !== 'FAILED') {
          drifts.push({
            component: 'Security Controls',
            parameter: `${currentCtrl.name} status`,
            expected: baseCtrl.status,
            actual: currentCtrl.status,
            severity: 'CRITICAL',
            description: `Security control ${currentCtrl.name} degraded from ${baseCtrl.status} to FAILED.`,
          });
        } else if (currentCtrl.status === 'WARNING' && baseCtrl.status === 'ACTIVE') {
          drifts.push({
            component: 'Security Controls',
            parameter: `${currentCtrl.name} status`,
            expected: baseCtrl.status,
            actual: currentCtrl.status,
            severity: 'WARNING',
            description: `Security control ${currentCtrl.name} drifted from ACTIVE to WARNING.`,
          });
        }
      }
    }

    // Determine overall drift level
    let driftLevel: 'NO_DRIFT' | 'MINOR_DRIFT' | 'MAJOR_DRIFT' | 'CRITICAL_DRIFT' = 'NO_DRIFT';
    if (drifts.some(d => d.severity === 'CRITICAL')) {
      driftLevel = 'CRITICAL_DRIFT';
    } else if (drifts.some(d => d.severity === 'HIGH')) {
      driftLevel = 'MAJOR_DRIFT';
    } else if (drifts.some(d => d.severity === 'WARNING')) {
      driftLevel = 'MINOR_DRIFT';
    }

    // Generate remediation recommendation text
    let recommendedRemediation = 'Platform configuration is healthy and fully compliant with baseline standards.';
    if (drifts.length > 0) {
      const criticalRemediations = drifts
        .filter(d => d.severity === 'CRITICAL')
        .map(d => `Restore ${d.component} (${d.parameter}) immediately to resolve failure.`);
      const warningRemediations = drifts
        .filter(d => d.severity === 'HIGH' || d.severity === 'WARNING')
        .map(d => `Investigate parameter ${d.parameter} drift.`);
      
      recommendedRemediation = [...criticalRemediations, ...warningRemediations].join(' ');
    }

    // Log a SecurityEvent and SecurityAlert on detection of drifts
    if (drifts.length > 0) {
      try {
        const severity = driftLevel === 'CRITICAL_DRIFT' ? SecurityEventSeverity.CRITICAL : SecurityEventSeverity.HIGH;

        // Check if an open drift alert already exists to prevent duplicate alert pollution
        const existingAlert = await db.securityAlert.findFirst({
          where: {
            title: 'Security Configuration Regression Detected',
            status: 'OPEN',
          }
        });

        if (!existingAlert) {
          const newEvent = await db.securityEvent.create({
            data: {
              eventType: 'SECURITY_BASELINE_REGRESSION',
              severity,
              category: SecurityEventCategory.GOVERNANCE,
              title: 'Security Posture Drift Alert',
              description: `Detected ${drifts.length} regression(s) from security baseline snapshot. Drift Level: ${driftLevel}.`,
              metadata: { drifts } as any,
            },
          });

          await db.securityAlert.create({
            data: {
              title: 'Security Configuration Regression Detected',
              description: `Security verification engine reported configuration drift. Scores or verification controls have regressed.`,
              severity,
              status: 'OPEN',
              sourceEventId: newEvent.id,
            },
          });
        }
      } catch (dbErr) {
        console.error('[BaselineComparisonService Alert Error]', dbErr);
      }
    }

    return {
      baselineTimestamp: baseline.timestamp,
      driftsCount: drifts.length,
      driftLevel,
      drifts,
      recommendedRemediation,
    };
  }
}
