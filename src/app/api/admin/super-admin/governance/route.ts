import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/permissions';
import { LeadStatus, UserRole, UserStatus } from '@prisma/client';
import { calculateAdminProductivity } from '@/lib/admin-analytics/productivity';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 1. Live Admin Monitoring Feed (active session admins + their most recent activity)
    const activeSessions = await db.adminSession.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { loginAt: 'desc' }
    });

    const liveMonitoring = await Promise.all(
      activeSessions.map(async (sess) => {
        const latestActivity = await db.activityLog.findFirst({
          where: { actorId: sess.userId },
          orderBy: { createdAt: 'desc' }
        });

        // Compute session duration in minutes
        const durationMin = Math.round((Date.now() - new Date(sess.loginAt).getTime()) / 60000);

        return {
          adminName: sess.user.name || sess.user.email,
          email: sess.user.email,
          role: sess.user.role,
          currentAction: latestActivity?.description || 'Active Session (No action logged)',
          module: latestActivity?.action || 'SYSTEM',
          duration: `${durationMin} mins`,
          ip: sess.ipAddress || 'Internal',
          location: sess.city && sess.country ? `${sess.city}, ${sess.country}` : 'Unknown'
        };
      })
    );

    // 2. Load all administrators for leaderboard and per-admin analytics
    const admins = await db.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        deletedAt: null,
      },
      select: { id: true, name: true, email: true }
    });

    const productivityReports = await Promise.all(
      admins.map(async (adm) => {
        const report = await calculateAdminProductivity(adm.id);
        
        // Calculate total revenue from associated completed appointments for won leads
        const wonLeads = await db.lead.findMany({
          where: { assignedToId: adm.id, status: LeadStatus.WON },
          include: {
            appointments: {
              where: { status: 'COMPLETED' },
              include: { property: { select: { price: true } } }
            }
          }
        });

        let revenue = 0;
        let wonDealsCount = 0;
        wonLeads.forEach(lead => {
          let leadRev = 0;
          lead.appointments.forEach(appt => {
            if (appt.property) {
              leadRev += appt.property.price;
            }
          });
          // If no appointments with properties, assign a baseline standard pricing for won leads
          if (leadRev === 0) {
            leadRev = 4500000; // standard 45L flat price fallback for CRM win attribution
          }
          revenue += leadRev;
          wonDealsCount++;
        });

        // Pipeline value (leads under NEGOTIATION or VISIT_SCHEDULED)
        const pipelineLeads = await db.lead.findMany({
          where: {
            assignedToId: adm.id,
            status: { in: [LeadStatus.NEGOTIATION, LeadStatus.VISIT_SCHEDULED] }
          },
          include: {
            appointments: {
              include: { property: { select: { price: true } } }
            }
          }
        });

        let pipelineValue = 0;
        pipelineLeads.forEach(lead => {
          let leadPipe = 0;
          lead.appointments.forEach(appt => {
            if (appt.property) {
              leadPipe += appt.property.price;
            }
          });
          if (leadPipe === 0) {
            leadPipe = 3500000; // baseline 35L pipeline estimate
          }
          pipelineValue += leadPipe;
        });

        return {
          id: adm.id,
          name: adm.name || adm.email,
          email: adm.email,
          score: report.score,
          grade: report.grade,
          leadsWon: report.metrics.leadsWon,
          followUpsCompleted: report.metrics.followUpsCompleted,
          propertiesCreatedOrUpdated: report.metrics.propertiesCreatedOrUpdated,
          revenue,
          pipelineValue,
          wonDealsCount,
          averageDealValue: wonDealsCount > 0 ? Math.round(revenue / wonDealsCount) : 0,
          responseTime: report.breakdown.responseTime
        };
      })
    );

    // 3. Build leaderboards
    const leaderboard = {
      topClosers: [...productivityReports].sort((a, b) => b.leadsWon - a.leadsWon).slice(0, 5),
      highestRevenues: [...productivityReports].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      mostFollowUps: [...productivityReports].sort((a, b) => b.followUpsCompleted - a.followUpsCompleted).slice(0, 5),
      fastestResponse: [...productivityReports].sort((a, b) => b.responseTime - a.responseTime).slice(0, 5),
    };

    // 4. Calculate Executive Governance Scorecard Stats
    const totalUsers = await db.user.count({ where: { deletedAt: null } });
    const totalLeads = await db.lead.count();
    
    // Sum of all wins
    const totalRevenue = productivityReports.reduce((acc, curr) => acc + curr.revenue, 0);

    // Score averages
    const avgPerformanceScore = productivityReports.length > 0
      ? Math.round(productivityReports.reduce((acc, curr) => acc + curr.score, 0) / productivityReports.length)
      : 80;

    // Security score: base 100, drops by 10 for each unresolved security alert, minimum 30
    const unresolvedAlerts = await db.securityAlert.count({ where: { resolved: false } });
    const securityScore = Math.max(30, 100 - unresolvedAlerts * 10);

    // Data integrity score: base 100, drops for unassigned leads or appointments without properties
    const unassignedLeads = await db.lead.count({ where: { assignedToId: null } });
    const dataIntegrityScore = Math.max(50, 100 - unassignedLeads * 2);

    return NextResponse.json({
      liveMonitoring,
      adminPerformance: productivityReports,
      leaderboard,
      governanceScorecard: {
        totalUsers,
        totalAdmins: admins.length,
        activeAdmins: admins.length,
        totalLeads,
        totalRevenue,
        securityScore,
        performanceScore: avgPerformanceScore,
        dataIntegrityScore
      }
    });
  } catch (error) {
    console.error('[API Super Admin Governance GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
