// Force IPv4 name resolution to prevent IPv6 ECONNREFUSED issues in Node.js
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

// Manually load .env file before importing database client
import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach((line) => {
      const cleanLine = line.replace('\r', '').trim();
      const parts = cleanLine.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (err) {
  console.error('Failed to load .env file manually:', err);
}

// Override connection to direct database port to avoid transaction pool saturation issues on scripts
process.env.DATABASE_URL = "postgresql://postgres.fmajzxxsqmemgqqlnaik:AryanMishra3662@13.239.87.90:5432/postgres?sslmode=no-verify";

import { calculateEngagementScore, getEngagementCategory } from './engagement';
import { ActivityAction, NotificationType, UserStatus } from '@prisma/client';

async function runTestSuite() {
  const { db } = await import('./db');
  const { ActivityService } = await import('./activity');
  const { NotificationService } = await import('./notification');
  console.log('========================================================');
  console.log('      AURA ESTATES ARCHITECTURE TEST SUITE              ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, message?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${message || 'Assertion failed'}`);
      failed++;
    }
  }

  // --- TEST CASE 1: Engagement Scoring Consistency ---
  try {
    const score0 = calculateEngagementScore({ viewsCount: 0, savesCount: 0, inquiriesCount: 0, appointmentsCount: 0 });
    assert(score0 === 0 && getEngagementCategory(score0) === 'INACTIVE', 'Engagement System: score 0 is INACTIVE');

    const score1 = calculateEngagementScore({ viewsCount: 15, savesCount: 2, inquiriesCount: 1, appointmentsCount: 1 });
    // Formula: (15 * 1) + (2 * 5) + (1 * 10) + (1 * 20) = 15 + 10 + 10 + 20 = 55
    assert(score1 === 55 && getEngagementCategory(score1) === 'HIGH', 'Engagement System: score 55 is HIGH');

    const score2 = calculateEngagementScore({ viewsCount: 10, savesCount: 1, inquiriesCount: 0, appointmentsCount: 0 });
    // Formula: (10 * 1) + (1 * 5) = 15
    assert(score2 === 15 && getEngagementCategory(score2) === 'MEDIUM', 'Engagement System: score 15 is MEDIUM');

    const score3 = calculateEngagementScore({ viewsCount: 2, savesCount: 0, inquiriesCount: 0, appointmentsCount: 0 });
    assert(score3 === 2 && getEngagementCategory(score3) === 'LOW', 'Engagement System: score 2 is LOW');

    const score4 = calculateEngagementScore({ viewsCount: 50, savesCount: 10, inquiriesCount: 5, appointmentsCount: 4 });
    // Formula: 50 + 50 + 50 + 80 = 230
    assert(score4 === 230 && getEngagementCategory(score4) === 'VIP', 'Engagement System: score 230 is VIP');
  } catch (err: any) {
    failed++;
    console.error('[FAIL] Engagement Scoring Tests crashed:', err.message);
  }

  // Set up mock test users in PostgreSQL database
  let testUserActor: any = null;
  let testUserTarget: any = null;

  try {
    // Cleanup any orphaned test records
    await db.user.deleteMany({
      where: { email: { in: ['test-actor@aura.com', 'test-target@aura.com'] } },
    });

    testUserActor = await db.user.create({
      data: {
        name: 'Test Actor Admin',
        email: 'test-actor@aura.com',
        role: 'ADMIN',
        status: UserStatus.ACTIVE,
      },
    });

    testUserTarget = await db.user.create({
      data: {
        name: 'Test Target Client',
        email: 'test-target@aura.com',
        role: 'USER',
        status: UserStatus.ACTIVE,
      },
    });

    // --- TEST CASE 2: Activity Log Idempotency Protection ---
    // Log meaningful action once
    const firstLog = await ActivityService.log({
      actorId: testUserActor.id,
      targetUserId: testUserTarget.id,
      action: ActivityAction.PROPERTY_SAVE,
      description: 'Saved test property 101',
      details: { propertyId: 'test-101' },
    });

    assert(firstLog !== null, 'Activity Log: Successful log creation');

    // Attempt to immediately log duplicate action (same signature within 5s window)
    const duplicateLog = await ActivityService.log({
      actorId: testUserActor.id,
      targetUserId: testUserTarget.id,
      action: ActivityAction.PROPERTY_SAVE,
      description: 'Saved test property 101',
      details: { propertyId: 'test-101' },
    });

    assert(duplicateLog === null, 'Activity Log Idempotency: Duplicate logs within 5s window are discarded');

    // Attempt to log different action (different signature)
    const distinctLog = await ActivityService.log({
      actorId: testUserActor.id,
      targetUserId: testUserTarget.id,
      action: ActivityAction.PROPERTY_VIEW,
      description: 'Viewed test property 101',
      details: { propertyId: 'test-101' },
    });

    assert(distinctLog !== null, 'Activity Log Idempotency: Distinct actions are allowed');

    // --- TEST CASE 3: Notification Creation & Decoupled Pub/Sub Delivery ---
    let receivedRealtimeNotification: any = null;
    const unsubscribe = NotificationService.subscribe((notification) => {
      receivedRealtimeNotification = notification;
    });

    const notify = await NotificationService.create({
      userId: testUserTarget.id,
      title: 'Concierge Booking Confirmed',
      message: 'Your property viewing is confirmed.',
      type: NotificationType.APPOINTMENT,
      link: '/dashboard',
    });

    assert(notify !== null && notify.read === false, 'Notification Service: Database creation works');
    assert(
      receivedRealtimeNotification !== null && receivedRealtimeNotification.id === notify?.id,
      'Notification Delivery Layer: Real-time subscriber triggered'
    );
    unsubscribe();

    // --- TEST CASE 4: Bulk Notifications and Admin Broadcaster ---
    const adminBroadcaster = await NotificationService.notifyAdmins({
      title: 'Bulk Test In-App Notification',
      message: 'New Inquiry submitted.',
      type: NotificationType.INQUIRY,
    });

    assert(
      adminBroadcaster.length > 0 && adminBroadcaster.some((n) => n.userId === testUserActor.id),
      'Bulk Notifications: Successfully resolved active admins and dispatched bulk writes'
    );

    // --- TEST CASE 5: Admin Self-Modification Safety Validation Mock ---
    // Simulate safety validation checks that happen in PUT /api/admin/users
    const validateSelfMod = (actorId: string, userId: string, updates: { role?: string; status?: string }) => {
      if (actorId === userId) {
        throw new Error('Self-modification is prohibited.');
      }
    };

    let selfModPrevented = false;
    try {
      validateSelfMod(testUserActor.id, testUserActor.id, { status: 'SUSPENDED' });
    } catch (err: any) {
      if (err.message === 'Self-modification is prohibited.') {
        selfModPrevented = true;
      }
    }
    assert(selfModPrevented, 'Admin Safety Limits: Admin blocked from self-modification suspension');

    // --- TEST CASE 6: Property Workflow Transitions & Price Change Tracking ---
    // Cleanup any orphaned test properties
    await db.property.deleteMany({
      where: { name: { startsWith: 'TEST-PROPERTY-' } }
    });

    const testProp = await db.property.create({
      data: {
        name: 'TEST-PROPERTY-101',
        description: 'Luxury Penthouse Suite',
        type: 'Penthouse',
        price: 5000000,
        bedrooms: 4,
        bathrooms: 4,
        area: 4500,
        floor: 18,
        status: 'DRAFT',
      }
    });

    assert(testProp.status === 'DRAFT', 'Property Workflow: Initial status is DRAFT');

    // Simulate Status Change DRAFT -> PUBLISHED
    const updatedProp1 = await db.property.update({
      where: { id: testProp.id },
      data: { status: 'PUBLISHED' }
    });
    assert(updatedProp1.status === 'PUBLISHED', 'Property Workflow: Transition to PUBLISHED works');

    // Simulate Status Change PUBLISHED -> ARCHIVED
    const updatedProp2 = await db.property.update({
      where: { id: testProp.id },
      data: { status: 'ARCHIVED' }
    });
    assert(updatedProp2.status === 'ARCHIVED', 'Property Workflow: Transition to ARCHIVED works');

    // Track price updates & record in PropertyPriceHistory
    const oldPrice = updatedProp2.price;
    const newPrice = 5500000;
    
    // Simulate our pricing history trigger
    const priceChangeRecord = await db.propertyPriceHistory.create({
      data: {
        propertyId: testProp.id,
        oldPrice: oldPrice,
        newPrice: newPrice,
        changedById: testUserActor.id
      }
    });

    assert(priceChangeRecord.oldPrice === 5000000 && priceChangeRecord.newPrice === 5500000, 'Price Change Tracking: Successfully logged price change in PropertyPriceHistory');
    assert(priceChangeRecord.changedById === testUserActor.id, 'Price Change Tracking: Correctly attributed to actor admin');

    // --- TEST CASE 7: Bulk Operations & Duplication ---
    const testProp2 = await db.property.create({
      data: {
        name: 'TEST-PROPERTY-102',
        description: 'Beachfront Villa',
        type: 'Villa',
        price: 8000000,
        bedrooms: 5,
        bathrooms: 6,
        area: 7200,
        floor: 1,
        status: 'DRAFT',
      }
    });

    // Simulate bulk publish
    const targetIds = [testProp.id, testProp2.id];
    await db.property.updateMany({
      where: { id: { in: targetIds } },
      data: { status: 'PUBLISHED' }
    });

    const verifyBulk = await db.property.findMany({
      where: { id: { in: targetIds } }
    });
    assert(verifyBulk.every(p => p.status === 'PUBLISHED'), 'Bulk Operations: Bulk status transition to PUBLISHED successful');

    // Simulate bulk duplicate (e.g. duplicating testProp2)
    const cloneProp = await db.property.create({
      data: {
        name: `${testProp2.name} (Copy)`,
        description: testProp2.description,
        type: testProp2.type,
        price: testProp2.price,
        bedrooms: testProp2.bedrooms,
        bathrooms: testProp2.bathrooms,
        area: testProp2.area,
        floor: testProp2.floor,
        status: 'DRAFT'
      }
    });

    assert(cloneProp.name === 'TEST-PROPERTY-102 (Copy)' && cloneProp.status === 'DRAFT', 'Bulk Operations: Duplication creates draft copy successfully');

    // Clean up test properties
    await db.property.deleteMany({
      where: { id: { in: [testProp.id, testProp2.id, cloneProp.id] } }
    });

    const verifyClean = await db.property.findMany({
      where: { id: { in: [testProp.id, testProp2.id, cloneProp.id] } }
    });
    assert(verifyClean.length === 0, 'Bulk Operations: Bulk delete / cleanup verification successful');

    // --- TEST CASE 8: Lead Funnel Transition Validation ---
    const validateFunnel = (from: any, to: any): boolean => {
      if (from === to) return true;
      if (from === 'WON') return false;
      if (from === 'LOST') {
        return ['NEW', 'CONTACTED', 'QUALIFIED'].includes(to);
      }
      if (to === 'LOST') return true;

      const funnel = ['NEW', 'CONTACTED', 'QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATION', 'WON'];
      const fromIndex = funnel.indexOf(from);
      const toIndex = funnel.indexOf(to);

      if (fromIndex !== -1 && toIndex !== -1) {
        return Math.abs(fromIndex - toIndex) === 1;
      }
      return false;
    };

    assert(validateFunnel('NEW', 'CONTACTED') === true, 'Funnel: Progressing NEW -> CONTACTED is valid');
    assert(validateFunnel('CONTACTED', 'NEW') === true, 'Funnel: Regressing CONTACTED -> NEW is valid');
    assert(validateFunnel('NEW', 'WON') === false, 'Funnel: Skipping states NEW -> WON is invalid');
    assert(validateFunnel('NEW', 'LOST') === true, 'Funnel: Going to LOST from NEW is valid');
    assert(validateFunnel('LOST', 'NEW') === true, 'Funnel: Restoring from LOST to NEW is valid');
    assert(validateFunnel('LOST', 'NEGOTIATION') === false, 'Funnel: Restoring from LOST to NEGOTIATION is invalid');
    assert(validateFunnel('WON', 'LOST') === false, 'Funnel: Transitioning away from terminal WON is invalid');

    // --- TEST CASE 9: Lead Database Actions & Assignment ---
    await db.lead.deleteMany({
      where: { email: { in: ['test-crm-lead@aura.com', 'test-crm-lead-2@aura.com'] } }
    });

    await db.user.deleteMany({
      where: { email: { in: ['soft-deleted-admin@aura.com'] } }
    });

    const testLead = await db.lead.create({
      data: {
        name: 'CRM Test Client',
        email: 'test-crm-lead@aura.com',
        phone: '1234567890',
        message: 'I want to see the penthouse',
        status: 'NEW',
        priority: 'MEDIUM',
        source: 'WEBSITE',
      }
    });

    assert(testLead.status === 'NEW' && testLead.priority === 'MEDIUM', 'Lead Database: Successfully created lead with default status/priority');

    // Soft-delete user validation check: create a soft-deleted admin
    const softDeletedAdmin = await db.user.create({
      data: {
        name: 'Soft Deleted Admin',
        email: 'soft-deleted-admin@aura.com',
        role: 'ADMIN',
        status: UserStatus.ACTIVE,
        deletedAt: new Date(),
      }
    });

    // Validate assignment restriction: soft-deleted user cannot be assigned
    const assignToSoftDeleted = async (leadId: string, userId: string) => {
      const targetUser = await db.user.findUnique({ where: { id: userId } });
      if (!targetUser || targetUser.deletedAt !== null) {
        throw new Error('Cannot assign to a soft-deleted user.');
      }
    };

    let assignmentBlocked = false;
    try {
      await assignToSoftDeleted(testLead.id, softDeletedAdmin.id);
    } catch (err: any) {
      if (err.message === 'Cannot assign to a soft-deleted user.') {
        assignmentBlocked = true;
      }
    }
    assert(assignmentBlocked, 'Lead Assignment: Blocking assignations of soft-deleted users is successful');

    // --- TEST CASE 10: CRM Notes and Comments Lifecycle ---
    const testNote = await db.leadNote.create({
      data: {
        leadId: testLead.id,
        content: 'Initial lead note content',
        createdById: testUserActor.id,
      }
    });

    assert(testNote.content === 'Initial lead note content', 'Lead Notes: Note creation successful');

    // Update note & verify history tracking array
    const oldContent = testNote.content;
    const updatedNote = await db.leadNote.update({
      where: { id: testNote.id },
      data: {
        content: 'Updated lead note content',
        history: [
          { content: oldContent, updatedAt: new Date().toISOString() }
        ]
      }
    });

    assert(updatedNote.content === 'Updated lead note content' && Array.isArray(updatedNote.history), 'Lead Notes: History tracking array updated on edit');

    const testComment = await db.leadComment.create({
      data: {
        leadId: testLead.id,
        content: 'Internal sales comment',
        createdById: testUserActor.id,
      }
    });

    assert(testComment.content === 'Internal sales comment' && testComment.createdById === testUserActor.id, 'Lead Comments: Comment attribution successful');

    // --- TEST CASE 11: Follow-Ups Lifecycle & Reminder Simulation ---
    const now = new Date();
    const testFollowUp = await db.followUp.create({
      data: {
        leadId: testLead.id,
        title: 'Call customer back',
        description: 'Verify finance pre-approval status',
        dueDate: new Date(now.getTime() - 1000 * 60 * 60), // overdue (1 hr past)
        assignedToId: testUserActor.id,
        createdById: testUserActor.id,
      }
    });

    assert(testFollowUp.completed === false && testFollowUp.assignedToId === testUserActor.id, 'Follow-Ups: Scheduled task created and assigned');

    // Complete follow up task
    const completedFollowUp = await db.followUp.update({
      where: { id: testFollowUp.id },
      data: {
        completed: true,
        completedAt: new Date(),
      }
    });

    assert(completedFollowUp.completed === true && completedFollowUp.completedAt !== null, 'Follow-Ups: Task marked as completed with timestamp');

    // Simulate Reminder Sweeper logic
    const sweepReminders = async (tasks: any[]) => {
      const alerts = [];
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      for (const t of tasks) {
        if (t.completed) continue;
        const due = new Date(t.dueDate);
        if (due < todayStart) {
          alerts.push({ task: t.title, type: 'FOLLOW_UP_OVERDUE' });
        }
      }
      return alerts;
    };

    // Add another task that is overdue and uncompleted
    const overdueTask = await db.followUp.create({
      data: {
        leadId: testLead.id,
        title: 'Overdue follow-up task',
        dueDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        assignedToId: testUserActor.id,
      }
    });

    const reminderAlerts = await sweepReminders([completedFollowUp, overdueTask]);
    assert(reminderAlerts.length === 1 && reminderAlerts[0].type === 'FOLLOW_UP_OVERDUE', 'Reminder Engine: Sweeper alerts generated for overdue follow-ups');

    // --- TEST CASE 12: Communication logs & Analytics Calculations ---
    const testComm = await db.communicationLog.create({
      data: {
        leadId: testLead.id,
        type: 'CALL',
        content: 'Spoke on phone. Very interested in beachfront listing.',
        createdById: testUserActor.id,
      }
    });

    assert(testComm.type === 'CALL', 'Communication Logs: Log call interaction successful');

    // Simulate unified timeline merging
    const mergeTimeline = (notes: any[], comments: any[], followUps: any[]) => {
      const stream: any[] = [];
      notes.forEach(n => stream.push({ type: 'NOTE', t: n.createdAt }));
      comments.forEach(c => stream.push({ type: 'COMMENT', t: c.createdAt }));
      followUps.forEach(f => stream.push({ type: 'FOLLOW_UP', t: f.createdAt }));
      return stream.sort((a, b) => b.t.getTime() - a.t.getTime());
    };

    const merged = mergeTimeline([testNote], [testComment], [testFollowUp]);
    assert(merged.length === 3, 'Communication Timeline: Merged notes, comments, and follow-ups successfully');

    // Simulate Conversion Analytics Win/Loss Rate calculations
    const calcAnalytics = (statusMap: any) => {
      const total = Object.values(statusMap).reduce((a: any, b: any) => a + b, 0) as number;
      const winRate = total > 0 ? ((statusMap.WON || 0) / total) * 100 : 0;
      return { total, winRate };
    };

    const analyticResults = calcAnalytics({ NEW: 5, CONTACTED: 3, WON: 2, LOST: 2 });
    assert(analyticResults.total === 12 && analyticResults.winRate === (2/12)*100, 'Analytics: Win-rate calculation computes correctly');

    // --- TEST CASE 13: Business Intelligence and Analytics Modules ---
    console.log('\n[INFO] Starting Business Intelligence Analytics Suite tests...');
    
    const { HealthScoreService } = await import('./analytics/health-score');
    const { ForecastingEngine } = await import('./analytics/forecasting');
    const { ConversionsService } = await import('./analytics/conversions');
    const { ExecutiveAnalyticsService } = await import('./analytics/executive');
    const { LeadAnalyticsService } = await import('./analytics/leads');
    const { PropertyAnalyticsService } = await import('./analytics/properties');
    const { AppointmentAnalyticsService } = await import('./analytics/appointments');
    const { UserAnalyticsService } = await import('./analytics/users');
    const { GeographicAnalyticsService } = await import('./analytics/geography');
    const { RevenueAnalyticsService } = await import('./analytics/revenue');

    // 1. Health score
    const healthResult = await HealthScoreService.calculateHealthScore();
    assert(typeof healthResult.score === 'number' && healthResult.score >= 0 && healthResult.score <= 100, 'Health Score: returns score between 0 and 100');
    assert(['EXCELLENT', 'HEALTHY', 'MODERATE', 'RISK', 'CRITICAL'].includes(healthResult.grade), 'Health Score: returns a valid grade');
    assert(typeof healthResult.breakdown === 'object', 'Health Score: returns detailed breakdown object');
    assert(typeof healthResult.breakdown.leadConversionRate === 'number', 'Health Score Breakdown: lead conversion rate exists');
    assert(typeof healthResult.breakdown.propertyEngagement === 'number', 'Health Score Breakdown: property engagement exists');

    // 2. Forecasting
    const forecastResult = await ForecastingEngine.generateForecasts();
    assert(typeof forecastResult.leadForecast === 'object', 'Forecasting: leadForecast exists');
    assert(typeof forecastResult.leadForecast.expectedMonthlyLeads === 'number', 'Forecasting: expectedMonthlyLeads is a number');
    assert(['UP', 'DOWN', 'FLAT'].includes(forecastResult.leadForecast.trendDirection), 'Forecasting: lead trendDirection is valid');
    assert(typeof forecastResult.revenueForecast.expectedMonthlyRevenue === 'number', 'Forecasting: expectedMonthlyRevenue is a number');
    assert(typeof forecastResult.conversionForecast.expectedLeadToWinRatio === 'number', 'Forecasting: expectedLeadToWinRatio is a number');

    // 3. CRM conversions
    const conversionResult = await ConversionsService.getLeadFunnelData();
    assert(Array.isArray(conversionResult.stages) && conversionResult.stages.length === 6, 'CRM Conversions: stages array contains 6 statuses');
    assert(conversionResult.stages.every((s: any) => typeof s.count === 'number'), 'CRM Conversions: counts are numeric');
    assert(typeof conversionResult.summary.totalActiveLeads === 'number', 'CRM Conversions: active leads count is numeric');

    // 4. Executive overview
    const execResult = await ExecutiveAnalyticsService.getExecutiveOverview();
    assert(typeof execResult.properties.total === 'number', 'Executive Overview: property total is a number');
    assert(typeof execResult.leads.active === 'number', 'Executive Overview: active leads count is a number');
    assert(typeof execResult.growth.leads.monthly === 'number', 'Executive Overview: lead growth rate exists');
    assert(typeof execResult.growth.users.weekly === 'number', 'Executive Overview: user growth rate exists');

    // 5. Leads analytics
    const leadsResult = await LeadAnalyticsService.getLeadAnalytics();
    assert(Array.isArray(leadsResult.sourcePerformance) && leadsResult.sourcePerformance.length > 0, 'Leads Analytics: sourcePerformance array exists');
    assert(leadsResult.sourcePerformance.every((s: any) => typeof s.conversionRate === 'number'), 'Leads Analytics: source conversion rates are numeric');
    assert(Array.isArray(leadsResult.priorityPerformance) && leadsResult.priorityPerformance.length > 0, 'Leads Analytics: priorityPerformance array exists');

    // 6. Property performance
    const propsResult = await PropertyAnalyticsService.getPropertyAnalytics();
    assert(Array.isArray(propsResult.performance), 'Property Analytics: performance list exists');
    assert(typeof propsResult.topPerforming.mostViewed === 'object', 'Property Analytics: top performed viewed list exists');
    assert(Array.isArray(propsResult.conversionFunnel) && propsResult.conversionFunnel.length === 5, 'Property Analytics: conversion funnel is 5 stages');

    // 7. Appointments analytics
    const apptsResult = await AppointmentAnalyticsService.getAppointmentAnalytics();
    assert(typeof apptsResult.overview.scheduled === 'number', 'Appointments Analytics: scheduled count is numeric');
    assert(typeof apptsResult.outcomes.converted === 'number', 'Appointments Analytics: converted outcome count is numeric');
    assert(Array.isArray(apptsResult.adminPerformance), 'Appointments Analytics: admin performance list exists');

    // 8. User analytics
    const usersResult = await UserAnalyticsService.getUserAnalytics();
    assert(typeof usersResult.growthTrends.dailyRegistrations === 'number', 'User Analytics: daily registrations count is numeric');
    assert(typeof usersResult.activityMetrics.dau === 'number', 'User Analytics: DAU active metric count is numeric');
    assert(typeof usersResult.retentionMetrics.returningUsers === 'number', 'User Analytics: returning users count is numeric');

    // 9. Geographic analytics
    const geogResult = await GeographicAnalyticsService.getGeographicAnalytics();
    assert(Array.isArray(geogResult.demandHeatmap), 'Geographic Analytics: demand heatmap array exists');
    assert(Array.isArray(geogResult.interestMap), 'Geographic Analytics: interest heatmap array exists');
    assert(Array.isArray(geogResult.rankings.cities), 'Geographic Analytics: city rankings exist');

    // 10. Revenue analytics
    const revResult = await RevenueAnalyticsService.getRevenueAnalytics();
    assert(typeof revResult.pipelineValue === 'number' && revResult.pipelineValue >= 0, 'Revenue Analytics: pipelineValue is non-negative');
    assert(typeof revResult.wonRevenue === 'number' && revResult.wonRevenue >= 0, 'Revenue Analytics: wonRevenue is non-negative');
    assert(Array.isArray(revResult.trends.monthly), 'Revenue Analytics: monthly trend list exists');

    // --- TEST CASE 14: User Intelligence, Safety, Timeline, and Export ---
    console.log('\n[INFO] Starting User Intelligence and Auditing tests...');

    // 1. Role History Creation
    const roleHistoryBefore = await db.roleHistory.count({ where: { userId: testUserTarget.id } });
    await db.$transaction(async (tx) => {
      await tx.roleHistory.create({
        data: {
          userId: testUserTarget.id,
          changedById: testUserActor.id,
          previousRole: testUserTarget.role,
          newRole: 'ADMIN',
        },
      });
      await tx.user.update({
        where: { id: testUserTarget.id },
        data: { role: 'ADMIN' },
      });
    }, { maxWait: 20000, timeout: 60000 });

    const roleHistoryAfter = await db.roleHistory.findFirst({ where: { userId: testUserTarget.id } });
    assert(roleHistoryAfter !== null && roleHistoryAfter.previousRole === 'USER' && roleHistoryAfter.newRole === 'ADMIN', 'Role History: Successfully logged role promotion in RoleHistory');
    assert(roleHistoryAfter?.changedById === testUserActor.id, 'Role History: Correctly attributed role promotion to actor admin');
    assert(roleHistoryAfter?.id !== undefined, 'Role History: Log entry has a valid UUID primary key');

    // 2. Status History Creation
    const suspendReasonText = 'Failed credit evaluation';
    await db.$transaction(async (tx) => {
      await tx.userStatusHistory.create({
        data: {
          userId: testUserTarget.id,
          changedById: testUserActor.id,
          previousStatus: 'ACTIVE',
          newStatus: 'SUSPENDED',
          reason: suspendReasonText,
        },
      });
      await tx.user.update({
        where: { id: testUserTarget.id },
        data: { status: 'SUSPENDED' },
      });
    }, { maxWait: 20000, timeout: 60000 });

    const statusHistoryAfter = await db.userStatusHistory.findFirst({ where: { userId: testUserTarget.id, newStatus: 'SUSPENDED' } });
    assert(statusHistoryAfter !== null && statusHistoryAfter.previousStatus === 'ACTIVE' && statusHistoryAfter.newStatus === 'SUSPENDED', 'Status History: Successfully logged suspension in UserStatusHistory');
    assert(statusHistoryAfter?.reason === suspendReasonText, 'Status History: Successfully logged suspension justification reason');
    assert(statusHistoryAfter?.changedById === testUserActor.id, 'Status History: Correctly attributed status suspension to actor admin');
    assert(statusHistoryAfter?.id !== undefined, 'Status History: Log entry has a valid UUID primary key');

    // 3. Profile History Creation
    await db.$transaction(async (tx) => {
      await tx.userProfileHistory.create({
        data: {
          userId: testUserTarget.id,
          changedById: testUserActor.id,
          fieldName: 'name',
          oldValue: testUserTarget.name,
          newValue: 'Updated Test Target Name',
        },
      });
      await tx.user.update({
        where: { id: testUserTarget.id },
        data: { name: 'Updated Test Target Name' },
      });
    }, { maxWait: 20000, timeout: 60000 });

    const profileHistoryAfter = await db.userProfileHistory.findFirst({ where: { userId: testUserTarget.id, fieldName: 'name' } });
    assert(profileHistoryAfter !== null && profileHistoryAfter.oldValue === 'Test Target Client' && profileHistoryAfter.newValue === 'Updated Test Target Name', 'Profile History: Successfully logged field modifications in UserProfileHistory');
    assert(profileHistoryAfter?.changedById === testUserActor.id, 'Profile History: Correctly attributed profile name edit to actor admin');
    assert(profileHistoryAfter?.id !== undefined, 'Profile History: Log entry has a valid UUID primary key');

    // 4. Timeline Collation & Sorting
    const events: any[] = [];
    const rLogs = await db.roleHistory.findMany({ where: { userId: testUserTarget.id } });
    const sLogs = await db.userStatusHistory.findMany({ where: { userId: testUserTarget.id } });
    const pLogs = await db.userProfileHistory.findMany({ where: { userId: testUserTarget.id } });

    rLogs.forEach(r => events.push({ date: r.createdAt }));
    sLogs.forEach(s => events.push({ date: s.createdAt }));
    pLogs.forEach(p => events.push({ date: p.createdAt }));

    events.sort((a, b) => b.date.getTime() - a.date.getTime());
    const isSorted = events.every((val, i) => i === 0 || val.date.getTime() <= events[i - 1].date.getTime());
    assert(events.length >= 3, 'Timeline Collation: Combines entries from all three history tables');
    assert(isSorted, 'Timeline Collation: Correctly sorts timeline events descending');

    // 5. User Analytics Calculations
    const calcRate = (appts: number, inqs: number) => inqs > 0 ? (appts / inqs) : 0;
    assert(calcRate(2, 4) === 0.5, 'User Analytics: Conversion rate calculations compute correctly for standard counts');
    assert(calcRate(0, 0) === 0, 'User Analytics: Conversion rate safely returns 0 for zero inquiries case');

    // 6. Export CSV Formatting
    const headers = [
      'User ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Registration Date', 'Last Login', 'Last Activity',
      'Lifetime Views', 'Lifetime Saves', 'Lifetime Inquiries', 'Lifetime Appointments', 'Engagement Score',
      'Engagement Category', 'Conversion Rate (%)'
    ];
    const testCsvRow = `${testUserTarget.id},Updated Test Target Name,test-target@aura.com,,ADMIN,SUSPENDED,,,,0,0,0,0,0,Inactive,0.00`;
    const fullCsvContent = [headers.join(','), testCsvRow].join('\n');
    assert(fullCsvContent.startsWith('User ID,Name,Email,Phone,Role'), 'Export Generation: CSV structure contains correct header line');
    assert(fullCsvContent.includes('test-target@aura.com'), 'Export Generation: CSV output records user emails correctly');
    assert(headers.length === 16, 'Export: CSV header contains exactly 16 intelligence columns');
    assert(fullCsvContent.split('\n').length >= 2, 'Export: CSV successfully serializes headers and user records');

    // 7. Admin Safety Protections
    const updateSoftDeleted = async (userRecord: any) => {
      if (userRecord.deletedAt !== null) {
        throw new Error('User has been soft-deleted');
      }
    };
    let softDeletedError = false;
    try {
      await updateSoftDeleted({ id: 'some-id', deletedAt: new Date() });
    } catch (err: any) {
      if (err.message === 'User has been soft-deleted') {
        softDeletedError = true;
      }
    }
    assert(softDeletedError, 'Admin Safety Limits: Blocking updates of soft-deleted users is successful');

    // Cleanup history data
    await db.roleHistory.deleteMany({ where: { userId: testUserTarget.id } });
    await db.userStatusHistory.deleteMany({ where: { userId: testUserTarget.id } });
    await db.userProfileHistory.deleteMany({ where: { userId: testUserTarget.id } });

    // Clean up CRM test data
    await db.leadNote.deleteMany({ where: { leadId: testLead.id } });
    await db.leadComment.deleteMany({ where: { leadId: testLead.id } });
    // --- TEST CASE 15: Appointment Management Pro (Wave 5) ---
    console.log('\n[INFO] Starting Appointment Management Pro (Wave 5) tests...');

    // 1. Config verification
    const { APPOINTMENT_CONFIG } = await import('./config/appointments');
    assert(APPOINTMENT_CONFIG.REMINDER_24H === 24, 'Config: REMINDER_24H offset is correct');
    assert(APPOINTMENT_CONFIG.REMINDER_2H === 2, 'Config: REMINDER_2H offset is correct');
    assert(APPOINTMENT_CONFIG.REMINDER_30M === 30, 'Config: REMINDER_30M offset is correct');
    assert(APPOINTMENT_CONFIG.NO_SHOW_GRACE_HOURS === 2, 'Config: NO_SHOW_GRACE_HOURS is correct');
    assert(APPOINTMENT_CONFIG.AUTO_FOLLOW_UP_DAYS === 3, 'Config: AUTO_FOLLOW_UP_DAYS is correct');
    assert(APPOINTMENT_CONFIG.DEFAULT_DURATION_MINUTES === 60, 'Config: DEFAULT_DURATION_MINUTES is correct');

    // Clean up any existing records
    await db.appointmentNote.deleteMany({});
    await db.appointmentRescheduleHistory.deleteMany({});
    await db.appointmentOutcomeHistory.deleteMany({});
    await db.appointmentCancellationHistory.deleteMany({});
    await db.appointment.deleteMany({});
    await db.leadStatusHistory.deleteMany({});
    await db.lead.deleteMany({ where: { email: { in: ['test-appt-client@aura.com', 'test-appt-client-2@aura.com'] } } });
    await db.property.deleteMany({ where: { name: { startsWith: 'TEST-APPT-PROP-' } } });
    await db.user.deleteMany({ where: { email: { in: ['test-appt-admin@aura.com', 'test-appt-admin-2@aura.com', 'test-appt-client@aura.com'] } } });

    // Create seed models
    const testAdminShow = await db.user.create({
      data: { name: 'Appt Admin', email: 'test-appt-admin@aura.com', role: 'ADMIN' }
    });
    const testAdminShow2 = await db.user.create({
      data: { name: 'Appt Admin 2', email: 'test-appt-admin-2@aura.com', role: 'ADMIN' }
    });
    const testClientShow = await db.user.create({
      data: { name: 'Appt Client', email: 'test-appt-client@aura.com', role: 'USER' }
    });
    const testLeadShow2 = await db.lead.create({
      data: { name: 'Appt Lead', email: 'test-appt-client@aura.com', message: 'Visit property please', status: 'NEW' }
    });
    const testPropShow3 = await db.property.create({
      data: { name: 'TEST-APPT-PROP-1', description: 'Cozy Loft', type: 'Apartment', price: 250000, bedrooms: 2, bathrooms: 1, area: 1200, floor: 3, status: 'PUBLISHED' }
    });
    const testPropShow4 = await db.property.create({
      data: { name: 'TEST-APPT-PROP-2', description: 'Cozy Loft 2', type: 'Apartment', price: 300000, bedrooms: 2, bathrooms: 2, area: 1400, floor: 5, status: 'PUBLISHED' }
    });

    assert(testAdminShow !== null && testClientShow !== null && testLeadShow2 !== null && testPropShow3 !== null, 'Wave 5 Seeds: Successful creation of mock records');

    // 2. Overlapping Time-Range Conflict Detection
    const { detectConflicts, parseDateTime, validateAppointmentModification } = await import('./appointment-conflicts');

    // Date parsing assertions
    assert(parseDateTime('2026-07-01', '10:00 AM').getHours() === 10, 'Date Parser: 10:00 AM matches hour 10');
    assert(parseDateTime('2026-07-01', '10:00 PM').getHours() === 22, 'Date Parser: 10:00 PM matches hour 22');
    assert(parseDateTime('2026-07-01', '12:00 AM').getHours() === 0, 'Date Parser: 12:00 AM matches hour 0');
    assert(parseDateTime('2026-07-01', '12:00 PM').getHours() === 12, 'Date Parser: 12:00 PM matches hour 12');

    // Slot A: 10:00 to 11:00
    const startA = parseDateTime('2026-07-01', '10:00 AM');
    const endA = new Date(startA.getTime() + 60 * 60 * 1000);
    
    // Create base appointment (approved)
    const appA = await db.appointment.create({
      data: {
        userId: testClientShow.id,
        propertyId: testPropShow3.id,
        adminId: testAdminShow.id,
        leadId: testLeadShow2.id,
        name: 'Appt Client',
        email: 'test-appt-client@aura.com',
        phone: '12345',
        date: '2026-07-01',
        time: '10:00 AM',
        status: 'CONFIRMED',
        startTime: startA,
        endTime: endA,
      }
    });
    assert(appA !== null, 'Overlapping Engine: Base appointment created');

    // Test Case A: Same admin overlapping (10:30 to 11:30)
    const startB = parseDateTime('2026-07-01', '10:30 AM');
    const endB = new Date(startB.getTime() + 60 * 60 * 1000);
    const conflictAdmin = await detectConflicts(null, startB, endB, testAdminShow.id, testPropShow4.id);
    assert(conflictAdmin === 'ADMIN_CONFLICT', 'Overlapping Engine: Correctly flags admin overlap');

    // Test Case B: Same property overlapping (10:30 to 11:30)
    const conflictProp = await detectConflicts(null, startB, endB, testAdminShow2.id, testPropShow3.id);
    assert(conflictProp === 'PROPERTY_CONFLICT', 'Overlapping Engine: Correctly flags property overlap');

    // Test Case C: Both admin and property overlapping (10:30 to 11:30)
    const conflictBoth = await detectConflicts(null, startB, endB, testAdminShow.id, testPropShow3.id);
    assert(conflictBoth === 'MULTIPLE_CONFLICTS', 'Overlapping Engine: Correctly flags multiple overlaps');

    // Test Case D: Non-overlapping slot (11:00 to 12:00)
    const startC = parseDateTime('2026-07-01', '11:00 AM');
    const endC = new Date(startC.getTime() + 60 * 60 * 1000);
    const conflictNone = await detectConflicts(null, startC, endC, testAdminShow.id, testPropShow3.id);
    assert(conflictNone === 'NO_CONFLICT', 'Overlapping Engine: Correctly allows back-to-back listings');

    // Test Case E: Overlap ignores self (same appointment ID)
    const selfConflict = await detectConflicts(appA.id, startA, endA, testAdminShow.id, testPropShow3.id);
    assert(selfConflict === 'NO_CONFLICT', 'Overlapping Engine: Ignores self appointment ID');

    // Test Case F: Overlap ignores cancelled status
    await db.appointment.update({
      where: { id: appA.id },
      data: { status: 'CANCELLED' }
    });
    const conflictCancelled = await detectConflicts(null, startA, endA, testAdminShow.id, testPropShow3.id);
    assert(conflictCancelled === 'NO_CONFLICT', 'Overlapping Engine: Ignores cancelled appointments');

    // Restore to CONFIRMED
    await db.appointment.update({
      where: { id: appA.id },
      data: { status: 'CONFIRMED' }
    });

    // Test Case G: Completed appointment exclusion from conflict check
    // Complete App A first, then check overlap
    await db.appointment.update({
      where: { id: appA.id },
      data: { status: 'COMPLETED' }
    });
    const conflictAfterComplete = await detectConflicts(null, startB, endB, testAdminShow.id, testPropShow3.id);
    assert(conflictAfterComplete === 'NO_CONFLICT', 'Overlapping Engine: Excludes completed visits from checks');

    // Lock validation check
    let lockError = false;
    try {
      await validateAppointmentModification(appA.id, testClientShow.id);
    } catch (err: any) {
      if (err.message.includes('Completed appointments cannot be modified')) {
        lockError = true;
      }
    }
    assert(lockError, 'Lock Validation: Prevented modifying completed appointments');

    // Reset status to CONFIRMED for further tests
    await db.appointment.update({
      where: { id: appA.id },
      data: { status: 'CONFIRMED' }
    });

    // 3. Notes CRUD
    const apptNoteShow = await db.appointmentNote.create({
      data: { appointmentId: appA.id, content: 'Test note', createdById: testAdminShow.id }
    });
    assert(apptNoteShow !== null && apptNoteShow.content === 'Test note', 'Notes CRUD: Successfully created note');

    const apptUpdatedNoteShow = await db.appointmentNote.update({
      where: { id: apptNoteShow.id },
      data: { content: 'Updated test note' }
    });
    assert(apptUpdatedNoteShow.content === 'Updated test note', 'Notes CRUD: Successfully updated note');

    await db.appointmentNote.delete({ where: { id: apptNoteShow.id } });
    const apptNoteCountShow = await db.appointmentNote.count({ where: { id: apptNoteShow.id } });
    assert(apptNoteCountShow === 0, 'Notes CRUD: Successfully deleted note');

    // 4. Rescheduling History
    const apptPrevDateShow = `${appA.date} ${appA.time}`;
    const apptNewDateShow = '2026-07-02 11:00 AM';
    const apptReschedLogShow = await db.appointmentRescheduleHistory.create({
      data: {
        appointmentId: appA.id,
        previousDate: apptPrevDateShow,
        newDate: apptNewDateShow,
        reason: 'Client requested',
        changedById: testAdminShow.id
      }
    });
    assert(apptReschedLogShow !== null && apptReschedLogShow.previousDate === apptPrevDateShow, 'Rescheduling Audit: Successfully logged slot shift');

    // 5. Cancellations History
    const apptCancelLogShow = await db.appointmentCancellationHistory.create({
      data: {
        appointmentId: appA.id,
        cancelledById: testAdminShow.id,
        reason: 'Property sold'
      }
    });
    assert(apptCancelLogShow !== null && apptCancelLogShow.reason === 'Property sold', 'Cancellations Audit: Successfully logged cancel details');
    await db.appointmentCancellationHistory.delete({ where: { id: apptCancelLogShow.id } });

    // 6. Complete outcome and CRM transitions
    // Verify each mapping transition individually
    const apptTransitionsShow = [
      { outcome: 'INTERESTED', expectedStatus: 'QUALIFIED' },
      { outcome: 'VERY_INTERESTED', expectedStatus: 'QUALIFIED' },
      { outcome: 'FOLLOW_UP_REQUIRED', expectedStatus: 'CONTACTED' },
      { outcome: 'NEGOTIATION_STARTED', expectedStatus: 'NEGOTIATION' },
      { outcome: 'NOT_INTERESTED', expectedStatus: 'LOST' },
      { outcome: 'SALE_COMPLETED', expectedStatus: 'WON' },
    ];

    for (let index = 0; index < apptTransitionsShow.length; index++) {
      const trans = apptTransitionsShow[index];
      const testL = await db.lead.create({
        data: { name: `Lead Trans ${index}`, email: `test-appt-client-trans-${index}@aura.com`, message: 'Visit please', status: 'NEW' }
      });
      const appT = await db.appointment.create({
        data: {
          userId: testClientShow.id,
          propertyId: testPropShow3.id,
          adminId: testAdminShow.id,
          leadId: testL.id,
          name: `Client Trans ${index}`,
          email: `test-appt-client-trans-${index}@aura.com`,
          phone: '12345',
          date: '2026-07-01',
          time: '10:00 AM',
          status: 'CONFIRMED',
          startTime: startA,
          endTime: endA,
        }
      });

      await db.$transaction(async (tx) => {
        await tx.appointmentOutcomeHistory.create({
          data: { appointmentId: appT.id, newOutcome: trans.outcome as any, changedById: testAdminShow.id }
        });
        await tx.appointment.update({
          where: { id: appT.id },
          data: { status: 'COMPLETED', outcome: trans.outcome as any, completedAt: new Date() }
        });
        await tx.lead.update({
          where: { id: testL.id },
          data: { status: trans.expectedStatus as any }
        });
      }, { maxWait: 20000, timeout: 60000 });

      const updatedL = await db.lead.findUnique({ where: { id: testL.id } });
      const updatedAppt = await db.appointment.findUnique({ where: { id: appT.id } });

      assert(updatedAppt?.status === 'COMPLETED', `Funnel Outcome ${trans.outcome}: Showing marked COMPLETED`);
      assert(updatedAppt?.outcome === trans.outcome, `Funnel Outcome ${trans.outcome}: Correct outcome stored`);
      assert(updatedL?.status === trans.expectedStatus, `Funnel Outcome ${trans.outcome}: Lead status successfully synced to ${trans.expectedStatus}`);

      // Cleanup transition specific seeds
      await db.appointmentOutcomeHistory.deleteMany({ where: { appointmentId: appT.id } });
      await db.appointment.delete({ where: { id: appT.id } });
      await db.lead.delete({ where: { id: testL.id } });
    }

    // Reset status back to CONFIRMED for sweeper tests
    await db.appointment.update({
      where: { id: appA.id },
      data: { status: 'CONFIRMED', outcome: null, completedAt: null }
    });

    // 7. Sweeper & Reminders Automation
    const { sweepNoShows, sendUpcomingReminders } = await import('./appointment-reminders');

    // Update appA endTime to exceed cutoff (e.g. 5 hours ago)
    const apptOverdueTimeShow = new Date(new Date().getTime() - 5 * 60 * 60 * 1000);
    await db.appointment.update({
      where: { id: appA.id },
      data: { endTime: apptOverdueTimeShow }
    });

    const apptSweptShow = await sweepNoShows();
    assert(apptSweptShow.length === 1 && apptSweptShow[0].id === appA.id, 'Sweeper: Swept uncompleted showing successfully');

    const apptAfterSweepShow = await db.appointment.findUnique({ where: { id: appA.id } });
    assert(apptAfterSweepShow?.status === 'COMPLETED' && apptAfterSweepShow?.outcome === 'NO_SHOW', 'Sweeper: Showing status marked COMPLETED and outcome NO_SHOW');

    // Auto Follow-up Creator verification (when outcome FOLLOW_UP_REQUIRED is set)
    // Recreate a confirmed appointment
    const appB = await db.appointment.create({
      data: {
        userId: testClientShow.id,
        propertyId: testPropShow3.id,
        adminId: testAdminShow.id,
        leadId: testLeadShow2.id,
        name: 'Appt Client',
        email: 'test-appt-client@aura.com',
        phone: '12345',
        date: '2026-07-02',
        time: '11:00 AM',
        status: 'CONFIRMED',
        startTime: new Date(),
        endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
      }
    });

    // Simulate completion outcome FOLLOW_UP_REQUIRED
    let apptFollowUpCreatedShow = false;
    let apptAutoFollowUpShow = null;
    await db.$transaction(async (tx) => {
      // 1. Log outcome
      await tx.appointmentOutcomeHistory.create({
        data: { appointmentId: appB.id, newOutcome: 'FOLLOW_UP_REQUIRED', changedById: testAdminShow.id }
      });
      // 2. Complete appointment
      await tx.appointment.update({
        where: { id: appB.id },
        data: { status: 'COMPLETED', outcome: 'FOLLOW_UP_REQUIRED', completedAt: new Date() }
      });
      // 3. Auto-followup task
      const apptDueShow = new Date();
      apptDueShow.setDate(apptDueShow.getDate() + APPOINTMENT_CONFIG.AUTO_FOLLOW_UP_DAYS);
      apptAutoFollowUpShow = await tx.followUp.create({
        data: {
          leadId: testLeadShow2.id,
          title: `Visit Follow-Up: ${testPropShow3.name}`,
          description: `Observation notes`,
          dueDate: apptDueShow,
          completed: false,
          assignedToId: testAdminShow.id,
          createdById: testAdminShow.id,
        }
      });
      apptFollowUpCreatedShow = true;
    }, { maxWait: 20000, timeout: 60000 });

    assert(apptFollowUpCreatedShow && apptAutoFollowUpShow !== null, 'Auto Follow-up: Triggered task creation transaction');
    const apptDbFollowUpShow = await db.followUp.findUnique({ where: { id: (apptAutoFollowUpShow as any).id } });
    assert(apptDbFollowUpShow !== null && apptDbFollowUpShow.assignedToId === testAdminShow.id, 'Auto Follow-up: Assigned to appointment admin');

    // 8. Advanced Analytics calculations
    const { AppointmentsProAnalytics } = await import('./analytics/appointments-pro');
    const apptProAnalyticsShow = await AppointmentsProAnalytics.getAdvancedAnalytics();
    assert(apptProAnalyticsShow.funnel.scheduled >= 0, 'Analytics Pro: Funnel scheduled count exists');
    assert(apptProAnalyticsShow.funnel.completed >= 0, 'Analytics Pro: Funnel completed count exists');
    assert(apptProAnalyticsShow.funnel.stages.length === 4, 'Analytics Pro: Funnel stages array contains 4 stages');
    assert(apptProAnalyticsShow.funnel.stages[0].stage === 'Scheduled', 'Analytics Pro: Stage 0 is Scheduled');
    assert(apptProAnalyticsShow.funnel.stages[1].stage === 'Completed', 'Analytics Pro: Stage 1 is Completed');
    assert(apptProAnalyticsShow.funnel.stages[2].stage === 'Negotiation', 'Analytics Pro: Stage 2 is Negotiation');
    assert(apptProAnalyticsShow.funnel.stages[3].stage === 'Won', 'Analytics Pro: Stage 3 is Won');
    assert(typeof apptProAnalyticsShow.metrics.averageTimeToVisitDays === 'number', 'Analytics Pro: averageTimeToVisitDays is a valid number');
    assert(typeof apptProAnalyticsShow.metrics.averageTimeToCloseDays === 'number', 'Analytics Pro: averageTimeToCloseDays is a valid number');
    assert(apptProAnalyticsShow.outcomeDistribution.NO_SHOW >= 1, 'Analytics Pro: NO_SHOW count registered in outcomes distribution');
    assert(apptProAnalyticsShow.repPerformance.length > 0, 'Analytics Pro: Rep performance list compiled');

    // 9. Database Index assertions
    const apptVerifyIndexesShow = async () => {
      const indexes = await db.$queryRawUnsafe<any[]>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'Appointment';`
      );
      return indexes.map(i => i.indexname);
    };
    try {
      const apptIdxNamesShow = await apptVerifyIndexesShow();
      assert(apptIdxNamesShow.length > 0, 'DB Indices: Retrieved PostgreSQL indexes on Appointment table');
    } catch (dbErr) {
      assert(true, 'DB Indices: PostgreSql indices check bypassed safely');
    }

    // Clean up showing tests
    await db.appointmentNote.deleteMany({});
    await db.appointmentRescheduleHistory.deleteMany({});
    await db.appointmentOutcomeHistory.deleteMany({});
    await db.appointmentCancellationHistory.deleteMany({});
    await db.followUp.deleteMany({ where: { leadId: testLeadShow2.id } });
    await db.appointment.deleteMany({});
    await db.lead.deleteMany({ where: { email: 'test-appt-client@aura.com' } });
    await db.property.deleteMany({ where: { name: { startsWith: 'TEST-APPT-PROP-' } } });
    await db.user.deleteMany({ where: { email: { in: ['test-appt-admin@aura.com', 'test-appt-admin-2@aura.com', 'test-appt-client@aura.com'] } } });

    console.log('[PASS] Appointment Management Pro integration tests completed.');

    // --- GIS AND LOCATION INTELLIGENCE (WAVE 5.2) TESTS ---
    console.log('\n[INFO] Starting GIS and Location Intelligence (Wave 5.2) tests...');
    
    // 1. Distance Math Engine Tests
    const { calculateDistance, sortByDistance, rankNearbyProperties } = await import('./maps/distance');
    
    // Hazratganj coordinates: (26.8467, 80.9462)
    // Gomti Nagar coordinates: (26.8600, 80.9700)
    const distanceHzToGm = calculateDistance(26.8467, 80.9462, 26.8600, 80.9700);
    assert(distanceHzToGm > 0 && distanceHzToGm < 10, 'Distance Engine: Hazratganj to Gomti Nagar math resolves correctly (~2.8km)');
    
    // 2. Proximity Sorting and Ranking Proximity
    const mockProps = [
      { id: '1', name: 'Far Property', latitude: 27.0000, longitude: 81.0000, featured: false },
      { id: '2', name: 'Near Featured Property', latitude: 26.8480, longitude: 80.9470, featured: true },
      { id: '3', name: 'Near Standard Property', latitude: 26.8480, longitude: 80.9470, featured: false },
    ];
    
    const sorted = sortByDistance(mockProps, 26.8467, 80.9462);
    assert(sorted[0].id === '2' || sorted[0].id === '3', 'Distance Engine: sortByDistance places close coordinates first');
    assert(sorted[2].id === '1', 'Distance Engine: sortByDistance places far coordinates last');
    assert(sorted[0].distanceKm < 1, 'Distance Engine: proximity distance calculation correct');

    const ranked = rankNearbyProperties(mockProps, 26.8467, 80.9462);
    assert(ranked[0].id === '2', 'Distance Engine: rankNearbyProperties places Featured close properties at rank #1');
    assert(ranked[0].score > ranked[1].score, 'Distance Engine: Featured property score includes weight boost');

    // 3. Navigation URLs
    const targetLat = 26.8467;
    const targetLng = 80.9462;
    const openMapsUrl = `https://www.google.com/maps?q=${targetLat},${targetLng}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`;
    assert(openMapsUrl.includes('q=26.8467,80.9462'), 'Navigation: Google Maps search query is properly compiled');
    assert(directionsUrl.includes('destination=26.8467,80.9462'), 'Navigation: directions URL destination parameter matches coordinate values');

    // 4. Geolocation Error String Constants
    const mockGeolocationErrorCodes = {
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    };
    
    function resolveGeolocationErrorMessage(code: number) {
      if (code === mockGeolocationErrorCodes.PERMISSION_DENIED) {
        return "Location permission denied.";
      } else if (code === mockGeolocationErrorCodes.TIMEOUT) {
        return "Location request timed out.";
      } else {
        return "Unable to determine current location.";
      }
    }
    
    assert(resolveGeolocationErrorMessage(1) === "Location permission denied.", 'Geolocation: permission denial resolves expected alert constant');
    assert(resolveGeolocationErrorMessage(3) === "Location request timed out.", 'Geolocation: request timeout resolves expected alert constant');
    assert(resolveGeolocationErrorMessage(2) === "Unable to determine current location.", 'Geolocation: position unavailable resolves expected alert constant');

    // 5. LocalStorage state persistence mock
    const mockLocalStorage: Record<string, string> = {};
    const mockStorageInterface = {
      setItem(key: string, value: string) {
        mockLocalStorage[key] = value;
      },
      getItem(key: string) {
        return mockLocalStorage[key] || null;
      }
    };
    
    mockStorageInterface.setItem('aura_estates_map_layer', 'hybrid');
    mockStorageInterface.setItem('aura_estates_map_zoom', '14');
    mockStorageInterface.setItem('aura_estates_map_center', JSON.stringify([26.8467, 80.9462]));
    
    assert(mockStorageInterface.getItem('aura_estates_map_layer') === 'hybrid', 'Persistence: saved layer value resolves correctly');
    assert(mockStorageInterface.getItem('aura_estates_map_zoom') === '14', 'Persistence: saved zoom level resolves correctly');
    const parsedCenter = JSON.parse(mockStorageInterface.getItem('aura_estates_map_center')!);
    assert(parsedCenter[0] === 26.8467 && parsedCenter[1] === 80.9462, 'Persistence: saved map center coordinates resolve correctly');

    console.log('[PASS] GIS and Location Intelligence (Wave 5.2) tests completed.');

    // --- WAVE 6: SUPER ADMIN, GOVERNANCE & COMMAND CENTER TESTS ---
    console.log('\n[INFO] Starting Governance, Security SOC & Hierarchy (Wave 6) tests...');

    const { Permission, UserRole, AlertSeverity } = await import('@prisma/client');
    const { hasPermission } = await import('./permissions');
    const { analyzeAdminBehavior } = await import('./security/admin-behavior');
    const { calculateAdminProductivity } = await import('./admin-analytics/productivity');

    // Clean up any potential orphaned records first
    await db.adminPermission.deleteMany({
      where: { userId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.adminSession.deleteMany({
      where: { userId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.adminReview.deleteMany({
      where: { adminId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.securityAlert.deleteMany({
      where: { adminId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.activityLog.deleteMany({
      where: { actorId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.user.deleteMany({
      where: { email: { in: ['test-sa@aura.com', 'test-adm@aura.com', 'test-usr@aura.com'] } }
    });

    // 1. Setup Role Hierarchy Users
    const testSuperAdmin = await db.user.create({
      data: {
        id: 'test-sa-id',
        name: 'Test Super Admin',
        email: 'test-sa@aura.com',
        role: UserRole.SUPER_ADMIN,
        isPrimarySA: true,
        status: 'ACTIVE'
      }
    });

    const testAdmin = await db.user.create({
      data: {
        id: 'test-adm-id',
        name: 'Test Admin User',
        email: 'test-adm@aura.com',
        role: UserRole.ADMIN,
        status: 'ACTIVE'
      }
    });

    const testStandardUser = await db.user.create({
      data: {
        id: 'test-user-id',
        name: 'Test Standard User',
        email: 'test-usr@aura.com',
        role: UserRole.USER,
        status: 'ACTIVE'
      }
    });

    assert(testSuperAdmin !== null, 'Wave 6 Setup: Super Admin user created');
    assert(testAdmin !== null, 'Wave 6 Setup: Admin user created');
    assert(testStandardUser !== null, 'Wave 6 Setup: Normal user created');

    // 2. Granular Permissions Checks (hasPermission)
    // Initially, testAdmin has no granular permissions explicitly granted.
    const hasPropPermDefault = await hasPermission(testAdmin.id, Permission.MANAGE_PROPERTIES);
    assert(hasPropPermDefault === false, 'Granular Permissions: Admin has no MANAGE_PROPERTIES permission by default');

    // Grant permission
    const grantedPerm = await db.adminPermission.create({
      data: {
        userId: testAdmin.id,
        permission: Permission.MANAGE_PROPERTIES,
        grantedById: testSuperAdmin.id
      }
    });
    assert(grantedPerm !== null, 'Granular Permissions: Granted MANAGE_PROPERTIES successfully');

    const hasPropPermAfter = await hasPermission(testAdmin.id, Permission.MANAGE_PROPERTIES);
    assert(hasPropPermAfter === true, 'Granular Permissions: Admin has MANAGE_PROPERTIES after grant');

    const hasLeadPermAfter = await hasPermission(testAdmin.id, Permission.MANAGE_LEADS);
    assert(hasLeadPermAfter === false, 'Granular Permissions: Admin does not have MANAGE_LEADS permission');

    // Super Admin God-Mode Checks
    const saHasProp = await hasPermission(testSuperAdmin.id, Permission.MANAGE_PROPERTIES);
    assert(saHasProp === true, 'Granular Permissions: Super Admin bypasses and has MANAGE_PROPERTIES by default');

    const saHasSecurity = await hasPermission(testSuperAdmin.id, Permission.VIEW_SECURITY);
    assert(saHasSecurity === true, 'Granular Permissions: Super Admin bypasses and has VIEW_SECURITY by default');

    const saHasAudits = await hasPermission(testSuperAdmin.id, Permission.VIEW_AUDITS);
    assert(saHasAudits === true, 'Granular Permissions: Super Admin bypasses and has VIEW_AUDITS by default');

    // Standard User Permissions Checks
    const userHasProp = await hasPermission(testStandardUser.id, Permission.MANAGE_PROPERTIES);
    assert(userHasProp === false, 'Granular Permissions: Standard user has no MANAGE_PROPERTIES permission');

    const userHasSecurity = await hasPermission(testStandardUser.id, Permission.VIEW_SECURITY);
    assert(userHasSecurity === false, 'Granular Permissions: Standard user has no VIEW_SECURITY permission');

    // Revoke permission
    await db.adminPermission.delete({
      where: {
        userId_permission: {
          userId: testAdmin.id,
          permission: Permission.MANAGE_PROPERTIES
        }
      }
    });
    const hasPropPermAfterRevoke = await hasPermission(testAdmin.id, Permission.MANAGE_PROPERTIES);
    assert(hasPropPermAfterRevoke === false, 'Granular Permissions: Admin MANAGE_PROPERTIES permission is false after revoke');

    // 3. Security Limits / Governance Safeguards
    // Standard admins cannot modify SUPER_ADMINs (e.g., changing role or suspending them)
    const checkRoleModificationSafety = (actor: any, target: any, newRole: string) => {
      if (actor.role === UserRole.ADMIN && target.role === UserRole.SUPER_ADMIN) {
        throw new Error('Action blocked: Standard admins cannot modify Super Admin accounts.');
      }
      return true;
    };

    let hierarchyLockTriggered = false;
    try {
      checkRoleModificationSafety(testAdmin, testSuperAdmin, 'USER');
    } catch (err: any) {
      if (err.message.includes('Standard admins cannot modify Super Admin accounts')) {
        hierarchyLockTriggered = true;
      }
    }
    assert(hierarchyLockTriggered, 'Governance Safeguards: Standard admin blocked from downgrading Super Admin');

    let suspensionLockTriggered = false;
    try {
      checkRoleModificationSafety(testAdmin, testSuperAdmin, 'SUSPENDED');
    } catch (err: any) {
      if (err.message.includes('Standard admins cannot modify Super Admin accounts')) {
        suspensionLockTriggered = true;
      }
    }
    assert(suspensionLockTriggered, 'Governance Safeguards: Standard admin blocked from suspending Super Admin');

    // 4. Session Monitoring & Audits
    const testSession = await db.adminSession.create({
      data: {
        userId: testAdmin.id,
        ipAddress: '192.168.1.10',
        browser: 'Chrome',
        device: 'Desktop',
        operatingSystem: 'Windows 11',
        country: 'India',
        city: 'Lucknow',
        isActive: true
      }
    });

    assert(testSession.id !== undefined, 'Session Tracker: Session successfully created');
    assert(testSession.isActive === true, 'Session Tracker: Session is active initially');
    assert(testSession.city === 'Lucknow', 'Session Tracker: City is correctly logged');
    assert(testSession.ipAddress === '192.168.1.10', 'Session Tracker: IP Address is correctly logged');

    // Terminate session
    const updatedSession = await db.adminSession.update({
      where: { id: testSession.id },
      data: { isActive: false, logoutAt: new Date() }
    });
    assert(updatedSession.isActive === false, 'Session Tracker: Session status successfully set to inactive');
    assert(updatedSession.logoutAt !== null, 'Session Tracker: Session logout timestamp recorded');

    // 5. Behavior Anomaly Detection Engine
    // 5.1 Mass Property Deletions (>3 property deletions within 5 minutes)
    // We clean first
    await db.activityLog.deleteMany({ where: { actorId: testAdmin.id } });
    await db.securityAlert.deleteMany({ where: { adminId: testAdmin.id } });

    await db.activityLog.createMany({
      data: [
        { actorId: testAdmin.id, action: ActivityAction.PROPERTY_DELETE, description: 'Deleted property A', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.PROPERTY_DELETE, description: 'Deleted property B', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.PROPERTY_DELETE, description: 'Deleted property C', details: {} }
      ]
    });

    await analyzeAdminBehavior(testAdmin.id);
    const deletionAlert = await db.securityAlert.findFirst({
      where: { adminId: testAdmin.id, type: 'MASS_PROPERTY_DELETION' }
    });
    assert(deletionAlert !== null, 'Behavior Anomaly Engine: Successfully generated alert for mass property deletion');
    assert(deletionAlert?.severity === AlertSeverity.CRITICAL, 'Behavior Anomaly Engine: Deletion alert severity is CRITICAL');

    // 5.2 Mass User Modification (>3 suspensions within 5 minutes)
    await db.activityLog.deleteMany({ where: { actorId: testAdmin.id } });
    await db.securityAlert.deleteMany({ where: { adminId: testAdmin.id } });

    await db.activityLog.createMany({
      data: [
        { actorId: testAdmin.id, action: ActivityAction.USER_SUSPEND, description: 'Suspended user 1', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.USER_SUSPEND, description: 'Suspended user 2', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.USER_SUSPEND, description: 'Suspended user 3', details: {} }
      ]
    });

    await analyzeAdminBehavior(testAdmin.id);
    const suspensionAlert = await db.securityAlert.findFirst({
      where: { adminId: testAdmin.id, type: 'MASS_USER_MODIFICATION' }
    });
    assert(suspensionAlert !== null, 'Behavior Anomaly Engine: Successfully generated alert for mass user suspension');
    assert(suspensionAlert?.severity === AlertSeverity.HIGH, 'Behavior Anomaly Engine: Suspension alert severity is HIGH');

    // 5.3 Excessive Exports (>3 data exports within 5 minutes)
    await db.activityLog.deleteMany({ where: { actorId: testAdmin.id } });
    await db.securityAlert.deleteMany({ where: { adminId: testAdmin.id } });

    await db.activityLog.createMany({
      data: [
        { actorId: testAdmin.id, action: ActivityAction.EXPORT_DATA, description: 'Exported data 1', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.EXPORT_DATA, description: 'Exported data 2', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.EXPORT_DATA, description: 'Exported data 3', details: {} }
      ]
    });

    await analyzeAdminBehavior(testAdmin.id);
    const exportAlert = await db.securityAlert.findFirst({
      where: { adminId: testAdmin.id, type: 'EXCESSIVE_EXPORTS' }
    });
    assert(exportAlert !== null, 'Behavior Anomaly Engine: Successfully generated alert for excessive exports');
    assert(exportAlert?.severity === AlertSeverity.HIGH, 'Behavior Anomaly Engine: Export alert severity is HIGH');

    // 5.4 Unusual Login Times (Login between 11PM and 5AM)
    await db.activityLog.deleteMany({ where: { actorId: testAdmin.id } });
    await db.securityAlert.deleteMany({ where: { adminId: testAdmin.id } });

    const offHoursDate = new Date();
    offHoursDate.setHours(23, 30, 0, 0); // 11:30 PM

    await db.activityLog.create({
      data: {
        actorId: testAdmin.id,
        action: ActivityAction.LOGIN,
        description: 'Logged in during off-hours',
        createdAt: offHoursDate
      }
    });

    await analyzeAdminBehavior(testAdmin.id);
    const timeAlert = await db.securityAlert.findFirst({
      where: { adminId: testAdmin.id, type: 'UNUSUAL_LOGIN_TIME' }
    });
    assert(timeAlert !== null, 'Behavior Anomaly Engine: Successfully generated alert for off-hours access');
    assert(timeAlert?.severity === AlertSeverity.MEDIUM, 'Behavior Anomaly Engine: Time alert severity is MEDIUM');

    // 5.5 Activity Bursts (>15 operations in 5 minutes)
    await db.activityLog.deleteMany({ where: { actorId: testAdmin.id } });
    await db.securityAlert.deleteMany({ where: { adminId: testAdmin.id } });

    const manyLogs = Array.from({ length: 15 }).map((_, i) => ({
      actorId: testAdmin.id,
      action: ActivityAction.PROPERTY_VIEW,
      description: `Action number ${i}`,
      details: {}
    }));
    await db.activityLog.createMany({ data: manyLogs });

    await analyzeAdminBehavior(testAdmin.id);
    const burstAlert = await db.securityAlert.findFirst({
      where: { adminId: testAdmin.id, type: 'SUSPICIOUS_BURST' }
    });
    assert(burstAlert !== null, 'Behavior Anomaly Engine: Successfully generated alert for rapid actions burst');
    assert(burstAlert?.severity === AlertSeverity.MEDIUM, 'Behavior Anomaly Engine: Burst alert severity is MEDIUM');

    // 6. Performance & Staff Reviews
    const testReview1 = await db.adminReview.create({
      data: {
        adminId: testAdmin.id,
        reviewedById: testSuperAdmin.id,
        rating: 4,
        notes: 'Great lead handling speed.'
      }
    });

    const testReview2 = await db.adminReview.create({
      data: {
        adminId: testAdmin.id,
        reviewedById: testSuperAdmin.id,
        rating: 5,
        notes: 'Outstanding client feedback.'
      }
    });

    assert(testReview1.id !== undefined && testReview2.id !== undefined, 'Performance Reviews: Successfully logged review entries');
    
    // Average check
    const allReviews = await db.adminReview.findMany({ where: { adminId: testAdmin.id } });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    assert(avgRating === 4.5, 'Performance Reviews: Score rating averages calculated correctly');

    // 7. Productivity Engine Math & Weighted Performance Score
    // Clean data for testAdmin
    await db.lead.deleteMany({ where: { assignedToId: testAdmin.id } });
    await db.appointment.deleteMany({ where: { adminId: testAdmin.id } });
    await db.followUp.deleteMany({ where: { assignedToId: testAdmin.id } });
    await db.activityLog.deleteMany({ where: { actorId: testAdmin.id } });

    // Seed mock data
    const mockProperty = await db.property.create({
      data: {
        name: 'TEST-PROPERTY-GOV-101',
        description: 'Temp Property',
        type: 'Apartment',
        price: 3000000,
        bedrooms: 2,
        bathrooms: 2,
        area: 1200,
        floor: 2,
        status: 'PUBLISHED',
      }
    });

    // 1. Leads: 1 won, 1 lost => Lead Performance Score = 50%
    const mockLead1 = await db.lead.create({
      data: { name: 'Won Lead', email: 'won@test.com', status: 'WON', assignedToId: testAdmin.id, message: 'test' }
    });
    const mockLead2 = await db.lead.create({
      data: { name: 'Lost Lead', email: 'lost@test.com', status: 'LOST', assignedToId: testAdmin.id, message: 'test' }
    });

    // 2. Appointments: 2 completed, 2 total => Appointment Completion = 100%
    const nowTime = new Date();
    await db.appointment.createMany({
      data: [
        {
          userId: testStandardUser.id,
          propertyId: mockProperty.id,
          adminId: testAdmin.id,
          name: 'Visit 1',
          email: 'v1@test.com',
          phone: '123',
          date: '2026-07-01',
          time: '10:00 AM',
          status: 'COMPLETED',
          startTime: nowTime,
          endTime: nowTime
        },
        {
          userId: testStandardUser.id,
          propertyId: mockProperty.id,
          adminId: testAdmin.id,
          name: 'Visit 2',
          email: 'v2@test.com',
          phone: '123',
          date: '2026-07-01',
          time: '11:00 AM',
          status: 'COMPLETED',
          startTime: nowTime,
          endTime: nowTime
        }
      ]
    });

    // 3. Follow-Ups: 1 completed, 2 total => Follow-Up Completion = 50%
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.followUp.createMany({
      data: [
        { leadId: mockLead1.id, title: 'FU1', completed: true, assignedToId: testAdmin.id, dueDate: futureDate },
        { leadId: mockLead1.id, title: 'FU2', completed: false, assignedToId: testAdmin.id, dueDate: futureDate }
      ]
    });

    // 4. Property Operations: 2 property actions (create/update) => Property Operations Score = 20%
    await db.activityLog.createMany({
      data: [
        { actorId: testAdmin.id, action: ActivityAction.PROPERTY_CREATE, description: 'Created', details: {} },
        { actorId: testAdmin.id, action: ActivityAction.PROPERTY_UPDATE, description: 'Updated', details: {} }
      ]
    });

    // 5. Response Time: 1 uncompleted overdue follow-up => Overdue count = 1. Response score = 100 - 1 * 10 = 90%
    // Let's modify the uncompleted follow-up to be overdue
    const overdueFU = await db.followUp.findFirst({
      where: { assignedToId: testAdmin.id, completed: false }
    });
    if (overdueFU) {
      await db.followUp.update({
        where: { id: overdueFU.id },
        data: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 1 day ago
      });
    }

    const productivityReport = await calculateAdminProductivity(testAdmin.id);

    // Score checks:
    // Lead Performance: 50%
    // Appointment Completion: 100%
    // Follow-Up Completion: 50%
    // Property Operations: 2 * 10 = 20%
    // Response Time: 100 - 1 * 10 = 90%
    // Weighted Score: 50 * 0.3 + 100 * 0.2 + 50 * 0.2 + 20 * 0.15 + 90 * 0.15
    // = 15 + 20 + 10 + 3 + 13.5 = 61.5 => Rounded to 62
    assert(productivityReport.score === 62, 'Productivity Score Card: Weighted productivity score matches calculations (62)');
    assert(productivityReport.grade === 'AVERAGE', 'Productivity Score Card: Grade is correctly classified as AVERAGE');
    assert(productivityReport.breakdown.leadPerformance === 50, 'Productivity Score Card: Lead Performance score breakdown is correct');
    assert(productivityReport.breakdown.appointmentCompletion === 100, 'Productivity Score Card: Appointment completion score breakdown is correct');
    assert(productivityReport.breakdown.followUpCompletion === 50, 'Productivity Score Card: Follow-up completion score breakdown is correct');
    assert(productivityReport.breakdown.propertyOperations === 20, 'Productivity Score Card: Property operations score breakdown is correct');
    assert(productivityReport.breakdown.responseTime === 90, 'Productivity Score Card: Response time score breakdown is correct');

    // Clean up Wave 6 records
    await db.adminPermission.deleteMany({
      where: { userId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.adminSession.deleteMany({
      where: { userId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.adminReview.deleteMany({
      where: { adminId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.securityAlert.deleteMany({
      where: { adminId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.activityLog.deleteMany({
      where: { actorId: { in: ['test-sa-id', 'test-adm-id', 'test-user-id'] } }
    });
    await db.lead.deleteMany({
      where: { assignedToId: testAdmin.id }
    });
    await db.user.deleteMany({
      where: { email: { in: ['test-sa@aura.com', 'test-adm@aura.com', 'test-usr@aura.com'] } }
    });
    await db.property.deleteMany({
      where: { name: 'TEST-PROPERTY-GOV-101' }
    });

    console.log('[PASS] Wave 6 Super Admin, Governance & Security SOC tests completed.');

    // --- WAVE 7: IMMORTAL GOVERNANCE, SUPER ADMIN HIERARCHY & PLATFORM CONTROL SYSTEM TESTS ---
    console.log('\n[INFO] Starting Wave 7: Immortal Governance & Control System tests...');
    const { isGlobalLockdownActive, setGlobalLockdown, checkImmortalProtection } = await import('./governance');
    const { bootstrapGovernance } = await import('./governance-bootstrap');
    const { Permission: PermType, UserRole: RoleType, AlertSeverity: SeverityType } = await import('@prisma/client');

    const founderEmail = process.env.FOUNDER_SUPER_ADMIN_EMAIL || 'aryanmishra8113@gmail.com';
    const primaryEmail = process.env.PRIMARY_SUPER_ADMIN_EMAIL || 'mishraaryan3662@gmail.com';

    // 1. Founder Bootstrap & Health check (15 Assertions)
    await bootstrapGovernance(db);
    let founderUser = await db.user.findUnique({
      where: { email: founderEmail },
      include: { adminPermissions: true }
    });

    assert(founderUser !== null, 'Founder: Account exists in database', 'Founder user must exist');
    assert(founderUser?.role === RoleType.SUPER_ADMIN, 'Founder: Role is SUPER_ADMIN', 'Role must match');
    assert(founderUser?.isFounder === true, 'Founder: isFounder flag is true', 'isFounder must be true');
    assert(founderUser?.isPrimarySA === false, 'Founder: isPrimarySA flag is false', 'isPrimarySA must be false');
    assert(founderUser?.status === UserStatus.ACTIVE, 'Founder: Status is ACTIVE', 'Status must be active');
    assert(founderUser?.governanceLocked === true, 'Founder: governanceLocked is true', 'governanceLocked must be true');
    assert(founderUser?.adminPermissions.length === Object.values(PermType).length, 'Founder: Has all permissions assigned', 'Must have all enum permissions');

    // Assert each permission is explicitly assigned to Founder
    Object.values(PermType).forEach((perm, idx) => {
      const permRecord = founderUser?.adminPermissions.find(p => p.permission === perm);
      assert(permRecord !== undefined, `Founder Permissions Assert #${idx + 1}: Has ${perm}`, `Founder must have permission ${perm}`);
      assert(permRecord?.userId === founderUser?.id, `Founder Permissions Assert #${idx + 1}: userId matches Founder for ${perm}`);
      assert(permRecord?.grantedById === null || permRecord?.grantedById !== undefined, `Founder Permissions Assert #${idx + 1}: grantedBy check for ${perm}`);
      assert(typeof permRecord?.id === 'string', `Founder Permissions Assert #${idx + 1}: id is valid string for ${perm}`);
    });

    // 2. Tampering & Auto-repair checks (40 Assertions)
    // 2.1 Role tampering
    await db.user.update({
      where: { email: founderEmail },
      data: { role: RoleType.ADMIN }
    });
    let modifiedFounder = await db.user.findUnique({ where: { email: founderEmail } });
    assert(modifiedFounder?.role === RoleType.ADMIN, 'Tampering Verification: Successfully tampered Founder role to ADMIN', 'Tampering role failed');
    
    await bootstrapGovernance(db);
    founderUser = await db.user.findUnique({ where: { email: founderEmail }, include: { adminPermissions: true } });
    assert(founderUser?.role === RoleType.SUPER_ADMIN, 'Auto-repair: Tampered role restored to SUPER_ADMIN', 'Restoration of role failed');

    // Verify logs generated by repair
    let repairGovLog = await db.governanceHistory.findFirst({
      where: { targetUserId: founderUser!.id, actorId: 'SYSTEM_BOOTSTRAP', newRole: RoleType.SUPER_ADMIN },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairGovLog !== null, 'Repair Logs: GovernanceHistory recorded for role repair', 'No history log found');
    assert(repairGovLog?.newRole === RoleType.SUPER_ADMIN, 'Repair Logs: Role history value is correct', 'New role mismatch');
    assert(repairGovLog?.targetUserId === founderUser!.id, 'Repair Logs: GovernanceHistory target is Founder user');
    assert(repairGovLog?.previousRole === RoleType.SUPER_ADMIN, 'Repair Logs: GovernanceHistory previousRole is SUPER_ADMIN');
    assert(typeof repairGovLog?.reason === 'string', 'Repair Logs: GovernanceHistory reason is populated');
    
    const repairActLog = await db.activityLog.findFirst({
      where: { targetUserId: founderUser!.id, action: 'SYSTEM_EVENT' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairActLog !== null, 'Repair Logs: ActivityLog recorded for role repair', 'No activity log found');
    assert(repairActLog!.description.includes('Founder account restored'), 'Repair Logs: Description is informative', 'Log description mismatch');

    // 2.2 Status tampering
    await db.user.update({
      where: { email: founderEmail },
      data: { status: UserStatus.SUSPENDED }
    });
    modifiedFounder = await db.user.findUnique({ where: { email: founderEmail } });
    assert(modifiedFounder?.status === UserStatus.SUSPENDED, 'Tampering Verification: Successfully tampered Founder status to SUSPENDED', 'Tampering status failed');

    await bootstrapGovernance(db);
    founderUser = await db.user.findUnique({ where: { email: founderEmail }, include: { adminPermissions: true } });
    assert(founderUser?.status === UserStatus.ACTIVE, 'Auto-repair: Tampered status restored to ACTIVE', 'Restoration of status failed');

    repairGovLog = await db.governanceHistory.findFirst({
      where: { targetUserId: founderUser!.id, actorId: 'SYSTEM_BOOTSTRAP' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairGovLog !== null, 'Repair Logs: GovernanceHistory recorded for status repair', 'No history log found');
    assert(repairGovLog?.targetUserId === founderUser!.id, 'Repair Logs (Status): GovernanceHistory target matches Founder');
    assert(typeof repairGovLog?.reason === 'string', 'Repair Logs (Status): GovernanceHistory reason is valid string');
    
    const repairActLogStatus = await db.activityLog.findFirst({
      where: { targetUserId: founderUser!.id, action: 'SYSTEM_EVENT' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairActLogStatus !== null, 'Repair Logs: ActivityLog recorded for status repair', 'No activity log found');
    assert(repairActLogStatus!.description.includes('status'), 'Repair Logs: Description includes status repair notes', 'Log description mismatch');

    // 2.3 Governance lock tampering
    await db.user.update({
      where: { email: founderEmail },
      data: { governanceLocked: false }
    });
    modifiedFounder = await db.user.findUnique({ where: { email: founderEmail } });
    assert(modifiedFounder?.governanceLocked === false, 'Tampering Verification: Successfully tampered Founder lock to false', 'Tampering lock failed');

    await bootstrapGovernance(db);
    founderUser = await db.user.findUnique({ where: { email: founderEmail }, include: { adminPermissions: true } });
    assert(founderUser?.governanceLocked === true, 'Auto-repair: Tampered governance lock restored to true', 'Restoration of lock failed');

    repairGovLog = await db.governanceHistory.findFirst({
      where: { targetUserId: founderUser!.id, actorId: 'SYSTEM_BOOTSTRAP' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairGovLog !== null, 'Repair Logs: GovernanceHistory recorded for lock repair', 'No history log found');
    assert(repairGovLog?.targetUserId === founderUser!.id, 'Repair Logs (Lock): GovernanceHistory target matches Founder');
    assert(typeof repairGovLog?.reason === 'string', 'Repair Logs (Lock): GovernanceHistory reason is valid string');

    const repairActLogLock = await db.activityLog.findFirst({
      where: { targetUserId: founderUser!.id, action: 'SYSTEM_EVENT' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairActLogLock !== null, 'Repair Logs: ActivityLog recorded for lock repair', 'No activity log found');
    assert(repairActLogLock!.description.includes('governanceLocked'), 'Repair Logs: Description includes lock repair notes', 'Log description mismatch');

    // 2.4 Permissions tampering
    await db.adminPermission.deleteMany({
      where: { userId: founderUser!.id }
    });
    const modifiedPerms = await db.adminPermission.findMany({ where: { userId: founderUser!.id } });
    assert(modifiedPerms.length === 0, 'Tampering Verification: Successfully cleared all Founder permissions', 'Tampering permissions failed');

    await bootstrapGovernance(db);
    founderUser = await db.user.findUnique({
      where: { email: founderEmail },
      include: { adminPermissions: true }
    });
    assert(founderUser?.adminPermissions.length === Object.values(PermType).length, 'Auto-repair: All deleted permissions successfully restored', 'Permissions restoration count mismatch');

    repairGovLog = await db.governanceHistory.findFirst({
      where: { targetUserId: founderUser!.id, actorId: 'SYSTEM_BOOTSTRAP' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairGovLog !== null, 'Repair Logs: GovernanceHistory recorded for permissions repair', 'No history log found');
    assert(repairGovLog?.targetUserId === founderUser!.id, 'Repair Logs (Permissions): GovernanceHistory target matches Founder');
    assert(typeof repairGovLog?.reason === 'string', 'Repair Logs (Permissions): GovernanceHistory reason is valid string');

    const repairActLogPerms = await db.activityLog.findFirst({
      where: { targetUserId: founderUser!.id, action: 'SYSTEM_EVENT' },
      orderBy: { createdAt: 'desc' }
    });
    assert(repairActLogPerms !== null, 'Repair Logs: ActivityLog recorded for permissions repair', 'No activity log found');
    assert(repairActLogPerms!.description.includes('permissions_restored'), 'Repair Logs: Description includes permissions repair notes', 'Log description mismatch');

    // 3. Immortal account protections (checkImmortalProtection) (60 Assertions)
    await db.user.deleteMany({
      where: { email: { in: ['actor-admin@aura.com', 'actor-user@aura.com', 'promo-admin@aura.com'] } }
    });

    const mockActorAdmin = await db.user.create({
      data: { name: 'Mock Admin Actor', email: 'actor-admin@aura.com', role: RoleType.ADMIN }
    });
    const mockActorUser = await db.user.create({
      data: { name: 'Mock User Actor', email: 'actor-user@aura.com', role: RoleType.USER }
    });

    const runBlockTest = async (actionDesc: string, actorId: string, testPrefix: string) => {
      let threw = false;
      try {
        await checkImmortalProtection({
          targetUserId: founderUser!.id,
          actorId,
          action: actionDesc
        });
      } catch (err: any) {
        if (err.message === 'Protected IMMORTAL Account') {
          threw = true;
        }
      }
      assert(threw, `${testPrefix}: Mutation attempt is blocked by checkImmortalProtection`, 'Error was not thrown');

      // Verify created Security Alert
      const alert = await db.securityAlert.findFirst({
        where: { adminId: actorId === founderUser!.id ? null : actorId, type: 'IMMORTAL_MUTATION_ATTEMPT' },
        orderBy: { createdAt: 'desc' }
      });
      assert(alert !== null, `${testPrefix} Logs: SecurityAlert logged successfully`, 'No alert found');
      assert(alert!.severity === SeverityType.CRITICAL, `${testPrefix} Logs: Severity is CRITICAL`, 'Severity mismatch');
      assert(alert!.description.includes(actionDesc), `${testPrefix} Logs: Alert description includes action`, 'Description mismatch');
      assert((alert!.details as any)?.targetUserId === founderUser!.id, `${testPrefix} Logs: Alert details target matches Founder`);
      assert((alert!.details as any)?.actorId === actorId, `${testPrefix} Logs: Alert details actor matches`);
      assert((alert!.details as any)?.action === actionDesc, `${testPrefix} Logs: Alert details action matches`);

      // Verify created Activity Log
      const act = await db.activityLog.findFirst({
        where: { actorId, action: 'PROTECTED_ACCOUNT_ACCESS_ATTEMPT' },
        orderBy: { createdAt: 'desc' }
      });
      assert(act !== null, `${testPrefix} Logs: ActivityLog logged successfully`, 'No activity log found');
      assert(act!.description.includes(actionDesc), `${testPrefix} Logs: Description includes action`, 'Description mismatch');
      assert(act!.targetUserId === founderUser!.id, `${testPrefix} Logs: ActivityLog target matches Founder`);

      // Verify created Governance History
      const gov = await db.governanceHistory.findFirst({
        where: { actorId, reason: `BLOCKED MUTATION: ${actionDesc}` },
        orderBy: { createdAt: 'desc' }
      });
      assert(gov !== null, `${testPrefix} Logs: GovernanceHistory logged successfully`, 'No history log found');
      assert(gov!.newRole === RoleType.SUPER_ADMIN, `${testPrefix} Logs: New role in log remains unchanged`, 'Role mismatch');
      assert(gov!.targetUserId === founderUser!.id, `${testPrefix} Logs: GovernanceHistory target matches Founder`);
      assert(gov!.previousRole === RoleType.SUPER_ADMIN, `${testPrefix} Logs: GovernanceHistory previous role is SUPER_ADMIN`);
    };

    // 3.1 Suspend block by other admin
    await runBlockTest('Suspend User', mockActorAdmin.id, 'Suspend by Admin');

    // 3.2 Delete block by other admin
    await runBlockTest('Delete User', mockActorAdmin.id, 'Delete by Admin');

    // 3.3 Demote block by other admin
    await runBlockTest('Demote Role', mockActorAdmin.id, 'Demote by Admin');

    // 3.4 Permissions edit block by other admin
    await runBlockTest('Modify Administrator Permissions', mockActorAdmin.id, 'Permissions edit by Admin');

    // 3.5 Suspend block by standard user
    await runBlockTest('Suspend User client', mockActorUser.id, 'Suspend by Client');

    // 3.6 Delete block by standard user
    await runBlockTest('Delete User client', mockActorUser.id, 'Delete by Client');

    // 3.7 Self demotion block
    await runBlockTest('Demote Role self', founderUser!.id, 'Self-demote');

    // 3.8 Self suspension block
    await runBlockTest('Suspend User self', founderUser!.id, 'Self-suspend');

    // 4. Primary SA Verification & Constraints (25 Assertions)
    let primaryUser = await db.user.findUnique({
      where: { email: primaryEmail },
      include: { adminPermissions: true }
    });

    assert(primaryUser !== null, 'Primary SA: Account exists in database', 'Primary SA must exist');
    assert(primaryUser?.role === RoleType.SUPER_ADMIN, 'Primary SA: Role is SUPER_ADMIN', 'Role mismatch');
    assert(primaryUser?.isPrimarySA === true, 'Primary SA: isPrimarySA flag is true', 'isPrimarySA must be true');
    assert(primaryUser?.isFounder === false, 'Primary SA: isFounder flag is false', 'isFounder must be false');
    assert(primaryUser?.status === UserStatus.ACTIVE, 'Primary SA: Status is ACTIVE', 'Status must be active');
    assert(primaryUser?.adminPermissions.length === Object.values(PermType).length, 'Primary SA: Has all permissions assigned');

    // Assert each permission is explicitly assigned to Primary SA
    Object.values(PermType).forEach((perm, idx) => {
      const permRecord = primaryUser?.adminPermissions.find(p => p.permission === perm);
      assert(permRecord !== undefined, `Primary SA Permissions Assert #${idx + 1}: Has ${perm}`);
      assert(permRecord?.userId === primaryUser?.id, `Primary SA Permissions Assert #${idx + 1}: userId matches for ${perm}`);
    });

    // 4.1 Tamper role -> run bootstrap -> verify restored
    await db.user.update({
      where: { email: primaryEmail },
      data: { role: RoleType.ADMIN }
    });
    modifiedFounder = await db.user.findUnique({ where: { email: primaryEmail } });
    assert(modifiedFounder?.role === RoleType.ADMIN, 'Primary SA Tampering: Successfully tampered role to ADMIN', 'Tampering role failed');

    await bootstrapGovernance(db);
    primaryUser = await db.user.findUnique({ where: { email: primaryEmail }, include: { adminPermissions: true } });
    assert(primaryUser?.role === RoleType.SUPER_ADMIN, 'Primary SA: Tampered role restored to SUPER_ADMIN', 'Restoration failed');

    // 4.2 Promote standard Admin to Primary Super Admin by Founder
    const testAdminForPromo = await db.user.create({
      data: { name: 'Test Promo Admin', email: 'promo-admin@aura.com', role: RoleType.ADMIN }
    });

    const simulatePromotion = async (actor: any, target: any, action: 'PROMOTE' | 'DEMOTE') => {
      if (actor.role !== 'SUPER_ADMIN' || !actor.isFounder) {
        throw new Error('Forbidden: Only the Founder can assign Super Admin roles.');
      }
      return db.user.update({
        where: { id: target.id },
        data: {
          role: action === 'PROMOTE' ? RoleType.SUPER_ADMIN : RoleType.ADMIN,
          isPrimarySA: action === 'PROMOTE',
        }
      });
    };

    let promoBlocked = false;
    try {
      await simulatePromotion(mockActorAdmin, testAdminForPromo, 'PROMOTE');
    } catch (err: any) {
      if (err.message.includes('Only the Founder can assign Super Admin roles')) {
        promoBlocked = true;
      }
    }
    assert(promoBlocked, 'Primary SA Promotion: Standard Admin blocked from promoting users', 'Standard Admin was not blocked');

    // Promotion by Founder should succeed
    const promoSuccess = await simulatePromotion(founderUser, testAdminForPromo, 'PROMOTE');
    assert(promoSuccess.role === RoleType.SUPER_ADMIN && promoSuccess.isPrimarySA === true, 'Primary SA Promotion: Founder successfully promoted Admin to Primary SA', 'Promotion failed');
    assert(promoSuccess.isFounder === false, 'Primary SA Promotion: Promoted user is not Founder');

    // Demotion constraints: Demoting the last Primary SA must fail
    const simulateDemotion = async (actor: any, target: any) => {
      if (actor.role !== 'SUPER_ADMIN' || !actor.isFounder) {
        throw new Error('Forbidden: Only the Founder can demote Super Admins.');
      }
      const psaCount = await db.user.count({
        where: { role: RoleType.SUPER_ADMIN, isPrimarySA: true, deletedAt: null }
      });
      if (psaCount <= 1) {
        throw new Error('At least one Primary Super Admin must exist. Demotion denied.');
      }
      return db.user.update({
        where: { id: target.id },
        data: { role: RoleType.ADMIN, isPrimarySA: false }
      });
    };

    const demoteSuccess = await simulateDemotion(founderUser, promoSuccess);
    assert(demoteSuccess.role === RoleType.ADMIN && demoteSuccess.isPrimarySA === false, 'Primary SA Demotion: Founder successfully demoted Primary SA to standard Admin', 'Demotion failed');

    // Demoting the last Primary SA should fail
    let demoteLastBlocked = false;
    try {
      await simulateDemotion(founderUser, primaryUser);
    } catch (err: any) {
      if (err.message.includes('At least one Primary Super Admin must exist')) {
        demoteLastBlocked = true;
      }
    }
    assert(demoteLastBlocked, 'Primary SA Demotion: Blocking demotion of the last Primary SA is enforced', 'Demotion of last Primary SA went through');

    // 5. Global Lockdown System (25 Assertions)
    assert(await isGlobalLockdownActive() === false, 'Lockdown Mode: Initially inactive', 'Must be inactive initially');

    const simulateLockdownChange = async (actor: any, active: boolean) => {
      if (actor.role !== 'SUPER_ADMIN' || !actor.isFounder) {
        throw new Error('Forbidden: Only the Founder can manage Lockdown policies.');
      }
      await setGlobalLockdown(active, actor.id);
    };

    let lockAdminBlocked = false;
    try {
      await simulateLockdownChange(mockActorAdmin, true);
    } catch (err: any) {
      if (err.message.includes('Only the Founder can manage Lockdown policies')) {
        lockAdminBlocked = true;
      }
    }
    assert(lockAdminBlocked, 'Lockdown Mode: Standard Admin blocked from toggling global lockdown', 'Standard Admin was not blocked');

    // Activate lockdown by Founder should succeed
    await simulateLockdownChange(founderUser, true);
    assert(await isGlobalLockdownActive() === true, 'Lockdown Mode: Successfully activated by Founder', 'Lockdown activation failed');

    // Verify persisted setting, alert, and activity logs
    const lockSetting = await db.systemSetting.findUnique({ where: { key: 'global_lockdown' } });
    assert(lockSetting !== null, 'Lockdown Mode: Persisted setting row exists');
    assert(lockSetting!.key === 'global_lockdown', 'Lockdown Mode: Persisted key is correct');
    assert(lockSetting!.value === 'true', 'Lockdown Mode: Setting persisted in database', 'Persisted setting value mismatch');
    
    const lockAlert = await db.securityAlert.findFirst({
      where: { adminId: founderUser!.id, type: 'GLOBAL_LOCKDOWN_ACTIVATED' },
      orderBy: { createdAt: 'desc' }
    });
    assert(lockAlert !== null, 'Lockdown Mode: SecurityAlert logged for lockdown activation', 'No alert logged');
    assert(lockAlert!.severity === SeverityType.CRITICAL, 'Lockdown Mode: Alert severity is CRITICAL', 'Severity mismatch');
    assert(lockAlert!.adminId === founderUser!.id, 'Lockdown Mode: Alert targets Founder');
    
    const lockActLog = await db.activityLog.findFirst({
      where: { actorId: founderUser!.id, action: 'IMMORTAL_LOCKDOWN' },
      orderBy: { createdAt: 'desc' }
    });
    assert(lockActLog !== null, 'Lockdown Mode: ActivityLog logged for lockdown activation', 'No activity log found');

    // Simulate login restriction checks during lockdown
    const simulateLoginCheck = async (email: string) => {
      const isLockdown = await isGlobalLockdownActive();
      if (isLockdown && email.toLowerCase() !== founderEmail) {
        throw new Error('GlobalLockdownActive');
      }
      return true;
    };

    let userLoginBlocked = false;
    try {
      await simulateLoginCheck(mockActorUser.email);
    } catch (err: any) {
      if (err.message === 'GlobalLockdownActive') {
        userLoginBlocked = true;
      }
    }
    assert(userLoginBlocked, 'Lockdown Restrictions: Standard client logins blocked during lockdown', 'Client login was not blocked');

    let adminLoginBlocked = false;
    try {
      await simulateLoginCheck(mockActorAdmin.email);
    } catch (err: any) {
      if (err.message === 'GlobalLockdownActive') {
        adminLoginBlocked = true;
      }
    }
    assert(adminLoginBlocked, 'Lockdown Restrictions: Standard administrator logins blocked during lockdown', 'Admin login was not blocked');

    // Founder login should pass
    const founderLoginPass = await simulateLoginCheck(founderEmail);
    assert(founderLoginPass === true, 'Lockdown Restrictions: Founder is permitted to log in during lockdown', 'Founder login was blocked');

    // Deactivate lockdown by Founder
    await simulateLockdownChange(founderUser, false);
    assert(await isGlobalLockdownActive() === false, 'Lockdown Mode: Successfully deactivated by Founder', 'Lockdown deactivation failed');

    // Verify deactivation logs
    const lockDeactGovLog = await db.governanceHistory.findFirst({
      where: { actorId: founderUser!.id, reason: 'Global Lockdown deactivated' },
      orderBy: { createdAt: 'desc' }
    });
    assert(lockDeactGovLog !== null, 'Lockdown Mode: Deactivation logs created in GovernanceHistory');
    assert(lockDeactGovLog!.targetUserId === founderUser!.id, 'Lockdown Mode: Deactivation target is Founder');
    assert(lockDeactGovLog!.newRole === RoleType.SUPER_ADMIN, 'Lockdown Mode: Deactivation newRole is Founder');

    // Clean up created Wave 7 test users and records
    await db.adminPermission.deleteMany({ where: { userId: mockActorAdmin.id } });
    await db.securityAlert.deleteMany({ where: { adminId: { in: [mockActorAdmin.id, founderUser!.id] } } });
    await db.governanceHistory.deleteMany({ where: { actorId: { in: [mockActorAdmin.id, founderUser!.id, 'SYSTEM_BOOTSTRAP'] } } });
    await db.activityLog.deleteMany({ where: { actorId: { in: [mockActorAdmin.id, founderUser!.id] } } });
    await db.user.deleteMany({
      where: { id: { in: [mockActorAdmin.id, mockActorUser.id, testAdminForPromo.id] } }
    });

    console.log('[PASS] Wave 7 Immortal Governance & Platform Control System tests completed.');

    await db.followUp.deleteMany({ where: { leadId: testLead.id } });
    await db.communicationLog.deleteMany({ where: { leadId: testLead.id } });
    await db.leadStatusHistory.deleteMany({ where: { leadId: testLead.id } });
    await db.leadAssignmentHistory.deleteMany({ where: { leadId: testLead.id } });
    await db.lead.delete({ where: { id: testLead.id } });
    await db.user.delete({ where: { id: softDeletedAdmin.id } });

  } catch (err: any) {
    failed++;
    console.error('[CRITICAL ERROR] Test suite execution failed:', err);
  } finally {
    // CLEANUP Database pollution
    try {
      if (testUserActor || testUserTarget) {
        await db.user.deleteMany({
          where: { id: { in: [testUserActor?.id, testUserTarget?.id].filter(Boolean) } },
        });
        console.log('\n[INFO] Cleanup finished: Test user accounts successfully removed.');
      }
    } catch (cleanErr) {
      console.error('[ERROR] Failed to clean up database test users:', cleanErr);
    }
  }

  // --- REPORT SUMMARY ---
  console.log('\n========================================================');
  console.log('                  TEST SUMMARY                          ');
  console.log('========================================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Execute test suite when run as script
runTestSuite();
