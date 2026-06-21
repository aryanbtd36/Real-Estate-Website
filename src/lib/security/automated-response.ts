import { db } from '../db';
import {
  ResponseActionType,
  ResponseActionStatus,
  ResponseExecutionMode,
  SecurityEventSeverity,
  SecurityEventCategory
} from '@prisma/client';
import { SecurityEventLogger } from './event-logger';

export class AutomatedResponseService {
  /**
   * Evaluates and logs/executes a containment response action.
   */
  static async requestResponse(params: {
    actionType: ResponseActionType;
    targetId: string;
    requestedBy: string;
    metadata?: any;
  }): Promise<any> {
    const isAutoAllowed = [
      ResponseActionType.REVOKE_SESSION,
      ResponseActionType.ROTATE_SESSION,
      ResponseActionType.REMOVE_TRUST,
      ResponseActionType.BLOCK_MALICIOUS_IP,
      ResponseActionType.BLOCK_TOR_NODE,
      ResponseActionType.BLOCK_PROXY_SOURCE
    ].includes(params.actionType);

    // High privilege modifications must be downgraded to approval required
    const executionMode = isAutoAllowed
      ? ResponseExecutionMode.AUTO_EXECUTE
      : ResponseExecutionMode.APPROVAL_REQUIRED;

    const initialStatus = executionMode === ResponseExecutionMode.AUTO_EXECUTE
      ? ResponseActionStatus.APPROVED
      : ResponseActionStatus.PENDING_APPROVAL;

    // Log target execution entry
    const action = await db.automatedResponseAction.create({
      data: {
        actionType: params.actionType,
        targetId: params.targetId,
        executionMode,
        status: initialStatus,
        requestedBy: params.requestedBy,
        requestedAt: new Date(),
        metadata: params.metadata || null,
      }
    });

    if (executionMode === ResponseExecutionMode.AUTO_EXECUTE) {
      // Run containment action immediately
      return await this.executeAction(action.id, 'SYSTEM');
    }

    // Require manual approval alert
    await SecurityEventLogger.log({
      eventType: 'PENDING_CONTAINMENT_APPROVAL',
      severity: SecurityEventSeverity.HIGH,
      category: SecurityEventCategory.SECURITY,
      title: 'Manual Containment Approval Required',
      description: `Containment action ${params.actionType} on target ${params.targetId} is pending administrator validation.`,
      metadata: { actionId: action.id, actionType: params.actionType, targetId: params.targetId }
    });

    return action;
  }

  /**
   * Executes a approved action and mutates status.
   */
  static async executeAction(actionId: string, approvedBy: string): Promise<any> {
    const action = await db.automatedResponseAction.findUnique({
      where: { id: actionId }
    });

    if (!action) {
      throw new Error(`Response action ${actionId} not found.`);
    }

    if (action.status === ResponseActionStatus.EXECUTED) {
      return action;
    }

    try {
      await db.automatedResponseAction.update({
        where: { id: actionId },
        data: {
          status: ResponseActionStatus.APPROVED,
          approvedBy,
          approvedAt: new Date()
        }
      });

      // Apply the actual mutation logic
      switch (action.actionType) {
        case ResponseActionType.REVOKE_SESSION: {
          const { SessionManager } = await import('./session-manager');
          await SessionManager.revokeSession(action.targetId);
          break;
        }
        case ResponseActionType.ROTATE_SESSION: {
          const { SessionManager } = await import('./session-manager');
          await SessionManager.rotateSession(action.targetId);
          break;
        }
        case ResponseActionType.LOGOUT_ALL_DEVICES: {
          const { SessionManager } = await import('./session-manager');
          await SessionManager.revokeUserSessions(action.targetId);
          break;
        }
        case ResponseActionType.FORCE_PASSWORD_RESET: {
          await db.user.update({
            where: { id: action.targetId },
            data: { mustChangePassword: true }
          });
          break;
        }
        case ResponseActionType.TEMPORARY_LOCKOUT: {
          const lockTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
          await db.user.update({
            where: { id: action.targetId },
            data: { accountLockedUntil: lockTime }
          });
          break;
        }
        case ResponseActionType.MARK_SUSPICIOUS: {
          await db.user.update({
            where: { id: action.targetId },
            data: { status: 'SUSPENDED' } // downgrade state
          });
          break;
        }
        case ResponseActionType.REMOVE_TRUST: {
          await db.deviceFingerprint.update({
            where: { id: action.targetId },
            data: { trusted: false, state: 'SUSPICIOUS' }
          });
          break;
        }
        case ResponseActionType.BLOCK_MALICIOUS_IP:
        case ResponseActionType.BLOCK_TOR_NODE:
        case ResponseActionType.BLOCK_PROXY_SOURCE: {
          const { ThreatIntelligenceService } = await import('./threat-intelligence');
          const threatType = action.actionType === ResponseActionType.BLOCK_TOR_NODE ? 'TOR' : 'IP';
          await ThreatIntelligenceService.addIndicator(threatType, action.targetId, 100, `SOAR block: ${action.actionType}`);
          break;
        }
        default:
          throw new Error(`Unsupported containment target action: ${action.actionType}`);
      }

      const updated = await db.automatedResponseAction.update({
        where: { id: actionId },
        data: {
          status: ResponseActionStatus.EXECUTED,
          executedBy: 'SYSTEM',
          executedAt: new Date()
        }
      });

      await SecurityEventLogger.log({
        eventType: 'AUTOMATED_CONTAINMENT_EXECUTED',
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SECURITY,
        title: 'Containment Action Executed',
        description: `Successfully executed automated response ${action.actionType} on target ${action.targetId}.`,
        metadata: { actionId, actionType: action.actionType }
      });

      return updated;
    } catch (err: any) {
      console.error('[AutomatedResponseService.executeAction Error]', err);
      return await db.automatedResponseAction.update({
        where: { id: actionId },
        data: {
          status: ResponseActionStatus.FAILED,
          errorMessage: err.message || 'Unknown execution crash'
        }
      });
    }
  }

  /**
   * Rejects/Cancels a pending response action.
   */
  static async rejectAction(actionId: string, rejectedBy: string): Promise<any> {
    return await db.automatedResponseAction.update({
      where: { id: actionId },
      data: {
        status: ResponseActionStatus.FAILED,
        errorMessage: `Rejected by administrator ${rejectedBy}`,
        metadata: { rejectedBy, rejectedAt: new Date().toISOString() }
      }
    });
  }
}
