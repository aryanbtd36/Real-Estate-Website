import { db } from '../db';
import { ThreatHuntType } from '@prisma/client';

export interface HuntFinding {
  type: string;
  target: string;
  riskScore: number;
  details: any;
}

export class ThreatHuntingService {
  /**
   * Executes a proactive threat hunt query.
   */
  static async executeHunt(huntName: string, huntType: ThreatHuntType, queryDetails: any): Promise<any> {
    const startTime = Date.now();
    let findingsCount = 0;
    let riskScore = 0;
    let summary = '';
    const findings: HuntFinding[] = [];

    try {
      switch (huntType) {
        case ThreatHuntType.ACCOUNT_TAKEOVER: {
          // Look for login failure burst followed by a successful login
          const failuresSpikes = await db.loginAttempt.groupBy({
            by: ['email'],
            where: { success: false },
            _count: { email: true },
            having: { email: { _count: { gte: 5 } } }
          });

          for (const item of failuresSpikes) {
            const successAfter = await db.loginAttempt.findFirst({
              where: {
                email: item.email,
                success: true,
                createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // last 1 hour
              }
            });

            if (successAfter) {
              findings.push({
                type: 'FAILURE_SPICK_SUCCESS',
                target: item.email,
                riskScore: 70,
                details: { failuresCount: item._count.email, successIP: successAfter.ipAddress }
              });
            }
          }
          break;
        }
        case ThreatHuntType.SESSION_HIJACK: {
          // Look for active sessions where the client browser/device changed mid-flight
          const activeSessions = await db.session.findMany({
            where: { status: 'ACTIVE' },
          });

          // Check if any user has multiple active sessions from different countries or IPs
          const usersWithMultiple = await db.session.groupBy({
            by: ['userId'],
            where: { status: 'ACTIVE' },
            _count: { userId: true },
            having: { userId: { _count: { gte: 2 } } }
          });

          for (const u of usersWithMultiple) {
            const userSessions = await db.session.findMany({
              where: { userId: u.userId, status: 'ACTIVE' }
            });
            const ips = new Set(userSessions.map(s => s.ipAddress));
            if (ips.size > 1) {
              findings.push({
                type: 'MULTI_IP_ACTIVE_SESSIONS',
                target: u.userId,
                riskScore: 60,
                details: { sessionsCount: userSessions.length, ips: Array.from(ips) }
              });
            }
          }
          break;
        }
        case ThreatHuntType.PRIVILEGE_ESCALATION: {
          // Look for role history changes promoted by unauthorized actors
          const recentPromo = await db.roleHistory.findMany({
            where: {
              newRole: 'ADMIN',
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          });

          for (const p of recentPromo) {
            // Verify if actor holds SUPER_ADMIN
            if (p.changedById) {
              const actor = await db.user.findUnique({ where: { id: p.changedById } });
              if (actor && actor.role !== 'SUPER_ADMIN') {
                findings.push({
                  type: 'NON_SA_ROLE_PROMOTION',
                  target: p.userId,
                  riskScore: 90,
                  details: { actorId: p.changedById, previousRole: p.previousRole, newRole: p.newRole }
                });
              }
            }
          }
          break;
        }
        case ThreatHuntType.INSIDER_THREAT: {
          // Find admins with excessive DataAccessLog exports (e.g. > 3 exports in 24 hours)
          const thresholdTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const excessiveExports = await db.dataAccessLog.groupBy({
            by: ['accessorId', 'accessorEmail'],
            where: {
              actionType: 'SENSITIVE_EXPORT',
              createdAt: { gte: thresholdTime }
            },
            _count: { accessorId: true },
            having: { accessorId: { _count: { gte: 3 } } }
          });

          for (const item of excessiveExports) {
            findings.push({
              type: 'EXCESSIVE_DATA_EXPORT',
              target: item.accessorEmail,
              riskScore: 80,
              details: { exportCount: item._count.accessorId }
            });
          }
          break;
        }
        case ThreatHuntType.GEO_ANOMALY: {
          // Impossible travel scans in active session metadata
          const sessions = await db.session.findMany({
            where: { status: 'ACTIVE' }
          });

          // Check if any user has sessions from different cities within 1 hour
          const userGroup = await db.session.groupBy({
            by: ['userId'],
            where: { status: 'ACTIVE' },
            _count: { userId: true },
            having: { userId: { _count: { gte: 2 } } }
          });

          for (const ug of userGroup) {
            const userSess = await db.session.findMany({
              where: { userId: ug.userId, status: 'ACTIVE' },
              orderBy: { loginAt: 'desc' }
            });

            for (let i = 0; i < userSess.length - 1; i++) {
              const s1 = userSess[i];
              const s2 = userSess[i + 1];
              if (s1.country && s2.country && s1.country !== s2.country) {
                findings.push({
                  type: 'IMPOSSIBLE_TRAVEL_HUNT',
                  target: s1.userId,
                  riskScore: 85,
                  details: {
                    s1: { ip: s1.ipAddress, country: s1.country, loginAt: s1.loginAt },
                    s2: { ip: s2.ipAddress, country: s2.country, loginAt: s2.loginAt }
                  }
                });
              }
            }
          }
          break;
        }
        case ThreatHuntType.THREAT_INTEL: {
          // Look for active sessions matching VPN, proxy or TOR addresses
          const activeSessions = await db.session.findMany({
            where: { status: 'ACTIVE' }
          });

          for (const s of activeSessions) {
            const match = await db.threatIndicator.findUnique({
              where: {
                type_value: {
                  type: 'IP',
                  value: s.ipAddress
                }
              }
            });

            if (match) {
              findings.push({
                type: 'THREAT_INTEL_IP_MATCH',
                target: s.ipAddress,
                riskScore: s.userRole === 'ADMIN' ? 95 : 70,
                details: { userId: s.userId, userRole: s.userRole, indicatorDescription: match.description }
              });
            }
          }
          break;
        }
        default:
          throw new Error(`Unsupported hunt query type: ${huntType}`);
      }

      findingsCount = findings.length;
      if (findingsCount > 0) {
        riskScore = Math.max(...findings.map(f => f.riskScore));
        summary = `Hunt ${huntName} completed successfully. Identified ${findingsCount} suspicious matching findings.`;
      } else {
        riskScore = 0;
        summary = `Hunt ${huntName} completed successfully. No threat matches identified.`;
      }

      // Link findings in ThreatHuntExecution structure
      const durationMs = Date.now() - startTime;
      const execution = await db.threatHuntExecution.create({
        data: {
          huntName,
          huntType,
          queryDetails: queryDetails || {},
          executedAt: new Date(),
          durationMs,
          findingsCount,
          riskScore,
          summary,
          findingsLink: { findings } as any
        }
      });

      return execution;
    } catch (err: any) {
      console.error(`[ThreatHuntingService.executeHunt fail: ${huntName}]`, err);
      const durationMs = Date.now() - startTime;
      return await db.threatHuntExecution.create({
        data: {
          huntName,
          huntType,
          queryDetails: queryDetails || {},
          executedAt: new Date(),
          durationMs,
          findingsCount: 0,
          riskScore: 0,
          summary: `Failed to execute hunt: ${err.message || err}`
        }
      });
    }
  }

  /**
   * Saves a hunt query for recurrent schedule configurations.
   */
  static async saveHunt(name: string, huntType: ThreatHuntType, queryDetails: any, description?: string): Promise<any> {
    return await db.savedThreatHunt.create({
      data: {
        name,
        huntType,
        queryDetails: queryDetails || {},
        description,
      }
    });
  }
}
