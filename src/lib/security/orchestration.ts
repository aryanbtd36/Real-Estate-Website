import { db } from '../db';
import {
  PlaybookName,
  PlaybookExecutionStatus,
  ResponseActionType,
  SecurityEventSeverity,
  SecurityEventCategory
} from '@prisma/client';
import { AutomatedResponseService } from './automated-response';
import { IncidentResponseService } from './incident-response';
import { SecurityEventLogger } from './event-logger';

export class SecurityOrchestrationService {
  /**
   * Triggers a security orchestration playbook.
   */
  static async triggerPlaybook(playbookName: PlaybookName, trigger: string, targetId: string, metadata?: any): Promise<any> {
    const startTime = Date.now();

    // 1. Create a PlaybookExecution log
    const execution = await db.playbookExecution.create({
      data: {
        playbookName,
        trigger,
        status: PlaybookExecutionStatus.RUNNING,
        actionsExecuted: [],
      }
    });

    const actionsExecuted: string[] = [];

    try {
      // 2. Resolve target actions based on the playbook type
      switch (playbookName) {
        case PlaybookName.LOGIN_ATTACK_RESPONSE:
        case PlaybookName.BRUTE_FORCE_RESPONSE: {
          // Lock target IP and/or lock user account
          await AutomatedResponseService.requestResponse({
            actionType: ResponseActionType.BLOCK_MALICIOUS_IP,
            targetId,
            requestedBy: `PLAYBOOK:${playbookName}`,
          });
          actionsExecuted.push('BLOCK_MALICIOUS_IP');

          if (metadata?.userId) {
            await AutomatedResponseService.requestResponse({
              actionType: ResponseActionType.TEMPORARY_LOCKOUT,
              targetId: metadata.userId,
              requestedBy: `PLAYBOOK:${playbookName}`,
            });
            actionsExecuted.push('TEMPORARY_LOCKOUT');
          }
          break;
        }
        case PlaybookName.ACCOUNT_TAKEOVER_RESPONSE: {
          // Force password reset, lock account, notify admins
          if (metadata?.userId) {
            await AutomatedResponseService.requestResponse({
              actionType: ResponseActionType.FORCE_PASSWORD_RESET,
              targetId: metadata.userId,
              requestedBy: `PLAYBOOK:${playbookName}`,
            });
            actionsExecuted.push('FORCE_PASSWORD_RESET');

            await AutomatedResponseService.requestResponse({
              actionType: ResponseActionType.LOGOUT_ALL_DEVICES,
              targetId: metadata.userId,
              requestedBy: `PLAYBOOK:${playbookName}`,
            });
            actionsExecuted.push('LOGOUT_ALL_DEVICES');
          }

          // Escalate alert by creating incident
          await IncidentResponseService.createIncident({
            title: `Account Takeover Incident - Target User ${targetId}`,
            description: `Auto-escalation from playbooks trigger ${playbookName}. Target ID: ${targetId}`,
            severity: 'CRITICAL',
            category: 'AUTHENTICATION',
            eventIds: metadata?.eventIds || [],
            alertIds: metadata?.alertIds || [],
          });
          actionsExecuted.push('CREATE_INCIDENT');
          break;
        }
        case PlaybookName.SESSION_HIJACK_RESPONSE: {
          // Revoke specific session, rotate token
          if (metadata?.sessionId) {
            await AutomatedResponseService.requestResponse({
              actionType: ResponseActionType.REVOKE_SESSION,
              targetId: metadata.sessionId,
              requestedBy: `PLAYBOOK:${playbookName}`,
            });
            actionsExecuted.push('REVOKE_SESSION');
          }
          break;
        }
        case PlaybookName.CREDENTIAL_STUFFING_RESPONSE: {
          // Block target IP, notify administrator
          await AutomatedResponseService.requestResponse({
            actionType: ResponseActionType.BLOCK_MALICIOUS_IP,
            targetId,
            requestedBy: `PLAYBOOK:${playbookName}`,
          });
          actionsExecuted.push('BLOCK_MALICIOUS_IP');

          // Log warning alert
          await SecurityEventLogger.log({
            eventType: 'CREDENTIAL_STUFFING_MITIGATED',
            severity: SecurityEventSeverity.CRITICAL,
            category: SecurityEventCategory.SECURITY,
            title: 'Credential Stuffing Mitigated',
            description: `Credential stuffing response playbook blocked IP: ${targetId}`,
          });
          actionsExecuted.push('BLOCK_IP');
          break;
        }
        case PlaybookName.HIGH_RISK_DEVICE_RESPONSE: {
          // Revoke device trust
          if (metadata?.deviceFingerprintId) {
            await AutomatedResponseService.requestResponse({
              actionType: ResponseActionType.REMOVE_TRUST,
              targetId: metadata.deviceFingerprintId,
              requestedBy: `PLAYBOOK:${playbookName}`,
            });
            actionsExecuted.push('REMOVE_TRUST');
          }
          break;
        }
        case PlaybookName.THREAT_INTEL_MATCH_RESPONSE: {
          // Block IP immediately, revoke active sessions on this IP
          await AutomatedResponseService.requestResponse({
            actionType: ResponseActionType.BLOCK_MALICIOUS_IP,
            targetId,
            requestedBy: `PLAYBOOK:${playbookName}`,
          });
          actionsExecuted.push('BLOCK_MALICIOUS_IP');
          break;
        }
        case PlaybookName.INSIDER_THREAT_RESPONSE: {
          // Suspend administrator access, log exports justification check
          if (metadata?.userId) {
            await AutomatedResponseService.requestResponse({
              actionType: ResponseActionType.MARK_SUSPICIOUS,
              targetId: metadata.userId,
              requestedBy: `PLAYBOOK:${playbookName}`,
            });
            actionsExecuted.push('MARK_SUSPICIOUS');
          }
          break;
        }
        default:
          throw new Error(`Unsupported playbook run trigger: ${playbookName}`);
      }

      // Record metric updates
      try {
        const metric = await db.securityAutomationMetric.findUnique({
          where: { key: 'playbooksExecuted' }
        });
        if (metric) {
          await db.securityAutomationMetric.update({
            where: { key: 'playbooksExecuted' },
            data: { value: metric.value + 1 }
          });
        } else {
          await db.securityAutomationMetric.create({
            data: { key: 'playbooksExecuted', value: 1 }
          });
        }
      } catch (mErr) {
        console.error('Failed to increment playbooksExecuted metric:', mErr);
      }

      const durationMs = Date.now() - startTime;

      // Update PlaybookExecution success
      return await db.playbookExecution.update({
        where: { id: execution.id },
        data: {
          status: PlaybookExecutionStatus.COMPLETED,
          durationMs,
          actionsExecuted,
        }
      });
    } catch (err: any) {
      console.error(`[Playbook run fail: ${playbookName}]`, err);
      const durationMs = Date.now() - startTime;
      return await db.playbookExecution.update({
        where: { id: execution.id },
        data: {
          status: PlaybookExecutionStatus.FAILED,
          durationMs,
          actionsExecuted,
          failureReason: err.message || 'Playbook execution failure',
        }
      });
    }
  }
}
