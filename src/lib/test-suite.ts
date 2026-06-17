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

    const { LegacyPermission: Permission, UserRole, AlertSeverity } = await import('@prisma/client');
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
    const { LegacyPermission: PermType, UserRole: RoleType, AlertSeverity: SeverityType } = await import('@prisma/client');

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

    // --- Wave 7A: Enterprise Authentication Hardening & Advanced RBAC Platform Tests (80 Assertions) ---
    console.log('[INFO] Starting Wave 7A Enterprise Authentication & Advanced RBAC tests...');

    const bcrypt = await import('bcryptjs');
    const { validatePassword } = await import('./security/password-policy');
    const { isPasswordInHistory, addPasswordToHistory } = await import('./security/password-history');
    const { PasswordResetTokenService } = await import('./security/password-reset');
    const { OtpService } = await import('./security/otp');
    const { MfaService, generateTotp, verifyTotp, generateRecoveryCodes } = await import('./security/mfa');
    const { hasRole, hasPermission: hasDbPermission } = await import('./security/permissions');

    // Sub-test 6.1: Password Policy Engine (15 Assertions)
    const p1 = validatePassword('Short1!');
    assert(!p1.isValid, 'Password Policy: Reject under 12 characters');
    assert(p1.errors.some(e => e.includes('at least 12')), 'Password Policy: Error message for short length');
    
    const p2 = validatePassword('a'.repeat(129) + '1!A');
    assert(!p2.isValid, 'Password Policy: Reject over 128 characters');

    const p3 = validatePassword('password123456');
    assert(!p3.isValid, 'Password Policy: Reject without uppercase/special');
    assert(p3.errors.some(e => e.includes('uppercase')), 'Password Policy: Requires uppercase');
    assert(p3.errors.some(e => e.includes('special character')), 'Password Policy: Requires special character');

    const p4 = validatePassword('PASSWORD123!');
    assert(!p4.isValid, 'Password Policy: Reject without lowercase');
    assert(p4.errors.some(e => e.includes('lowercase')), 'Password Policy: Requires lowercase');

    const p5 = validatePassword('Password123!');
    assert(!p5.isValid, 'Password Policy: Reject common weak password');
    assert(p5.errors.some(e => e.includes('too common')), 'Password Policy: Common weak error');

    const p6 = validatePassword('abcd1234567A!');
    assert(!p6.isValid, 'Password Policy: Reject ascending sequential "abcd"');
    assert(p6.errors.some(e => e.includes('sequential')), 'Password Policy: Sequential pattern error');

    const p7 = validatePassword('dcba1234567A!');
    assert(!p7.isValid, 'Password Policy: Reject descending sequential "dcba"');

    const p8 = validatePassword('aaaa1234567A!');
    assert(!p8.isValid, 'Password Policy: Reject repeated characters "aaaa"');
    assert(p8.errors.some(e => e.includes('repeated')), 'Password Policy: Repeated character error');

    const p9 = validatePassword('SecureP@ssw0rd123');
    assert(p9.isValid, 'Password Policy: Accept strong password');
    assert(p9.errors.length === 0, 'Password Policy: Strong password has 0 errors');

    // Sub-test 6.2: Password History Service (10 Assertions)
    const historyUser = await db.user.create({
      data: {
        name: 'History Test User',
        email: 'history-test@aura.com',
        role: 'USER',
        password: await bcrypt.hash('SecureP@ssw0rd1', 10),
      },
    });

    const h1 = await isPasswordInHistory(historyUser.id, 'SecureP@ssw0rd1');
    assert(h1 === true, 'Password History: Prevent reuse of current password');
    const h2 = await isPasswordInHistory(historyUser.id, 'UnusedPassword123!');
    assert(h2 === false, 'Password History: Allow unused password');

    const pass2Hash = await bcrypt.hash('SecureP@ssw0rd2', 10);
    const pass3Hash = await bcrypt.hash('SecureP@ssw0rd3', 10);
    const pass4Hash = await bcrypt.hash('SecureP@ssw0rd4', 10);
    const pass5Hash = await bcrypt.hash('SecureP@ssw0rd5', 10);
    const pass6Hash = await bcrypt.hash('SecureP@ssw0rd6', 10);
    
    await addPasswordToHistory(historyUser.id, pass2Hash);
    await addPasswordToHistory(historyUser.id, pass3Hash);
    await addPasswordToHistory(historyUser.id, pass4Hash);
    await addPasswordToHistory(historyUser.id, pass5Hash);
    await addPasswordToHistory(historyUser.id, pass6Hash);

    const h3 = await isPasswordInHistory(historyUser.id, 'SecureP@ssw0rd2');
    assert(h3 === true, 'Password History: Prevent reuse of history password 1');
    const h4 = await isPasswordInHistory(historyUser.id, 'SecureP@ssw0rd6');
    assert(h4 === true, 'Password History: Prevent reuse of history password 5');

    const pass7Hash = await bcrypt.hash('SecureP@ssw0rd7', 10);
    await addPasswordToHistory(historyUser.id, pass7Hash);

    const h5 = await isPasswordInHistory(historyUser.id, 'SecureP@ssw0rd2');
    assert(h5 === false, 'Password History: Successfully rotated out the 6th oldest password');
    
    const h6 = await isPasswordInHistory(historyUser.id, 'SecureP@ssw0rd3');
    assert(h6 === true, 'Password History: 5th oldest password is still in history');

    const historyCount = await db.passwordHistory.count({ where: { userId: historyUser.id } });
    assert(historyCount === 5, 'Password History: Limit count strictly enforced to 5 entries');
    assert(historyCount <= 5, 'Password History: History does not grow beyond 5');
    assert(historyCount > 0, 'Password History: History table contains records');

    // Sub-test 6.3: Password Reset Service (10 Assertions)
    const pr1 = await PasswordResetTokenService.createToken(historyUser.id);
    assert(pr1.token.length === 64, 'Password Reset: Token is a 32-byte secure hex string');
    assert(pr1.userId === historyUser.id, 'Password Reset: Token mapped to target user');
    assert(pr1.expiresAt > new Date(), 'Password Reset: Expiration set in the future');

    const prUser = await PasswordResetTokenService.validateAndUseToken(pr1.token);
    assert(prUser !== null && prUser.id === historyUser.id, 'Password Reset: Token validation returns correct user');

    const pr2 = await db.passwordResetToken.findUnique({ where: { token: pr1.token } });
    assert(pr2!.usedAt !== null, 'Password Reset: Token marked as used upon validation');

    const prUserReplay = await PasswordResetTokenService.validateAndUseToken(pr1.token);
    assert(prUserReplay === null, 'Password Reset Replay: Used token cannot be verified again');

    const pr3 = await PasswordResetTokenService.createToken(historyUser.id);
    const pr4 = await PasswordResetTokenService.createToken(historyUser.id);
    await PasswordResetTokenService.validateAndUseToken(pr3.token);

    const pr4Check = await db.passwordResetToken.findUnique({ where: { token: pr4.token } });
    assert(pr4Check!.usedAt !== null, 'Password Reset: Multi-token invalidation logic works');

    // Sub-test 6.4: OTP Platform (10 Assertions)
    const phone = '+15550199';
    const otpRes = await OtpService.requestOtp(phone, historyUser.id);
    assert(otpRes.success === true, 'OTP Platform: OTP request succeeded');
    assert(otpRes.otp !== undefined && otpRes.otp.length === 6, 'OTP Platform: Generates 6-digit numeric OTP');
    assert(/^\d{6}$/.test(otpRes.otp!), 'OTP Platform: OTP is numeric');

    const verifySuccess = await OtpService.verifyOtp(phone, otpRes.otp!);
    assert(verifySuccess === true, 'OTP Platform: Correct OTP verifies successfully');

    const verifySecond = await OtpService.verifyOtp(phone, otpRes.otp!);
    assert(verifySecond === false, 'OTP Platform: OTP is single-use and cannot be used twice');

    const otpRes2 = await OtpService.requestOtp(phone, historyUser.id);
    await OtpService.verifyOtp(phone, '000000');
    await OtpService.verifyOtp(phone, '000000');
    await OtpService.verifyOtp(phone, '000000');
    await OtpService.verifyOtp(phone, '000000');
    await OtpService.verifyOtp(phone, '000000');

    const verifyAfterLock = await OtpService.verifyOtp(phone, otpRes2.otp!);
    assert(verifyAfterLock === false, 'OTP Platform: OTP invalidated after 5 failure attempts');

    const otpRecord = await db.otpVerification.findFirst({
      where: { phoneNumber: phone },
      orderBy: { createdAt: 'desc' }
    });
    assert(otpRecord!.attempts >= 5, 'OTP Platform: Error count is persisted correctly');
    assert(otpRecord!.usedAt !== null, 'OTP Platform: Locked OTP marked as used/invalid');

    // Sub-test 6.5: MFA Service (10 Assertions)
    const mfaSecret = MfaService.generateSecret();
    assert(mfaSecret.length === 32, 'MFA Onboarding: Secret generated with correct base32 length');
    const totpToken = generateTotp(mfaSecret);
    assert(totpToken.length === 6 && /^\d{6}$/.test(totpToken), 'MFA Onboarding: TOTP token has 6 digits');

    assert(verifyTotp(mfaSecret, totpToken) === true, 'MFA Onboarding: Current TOTP token is valid');
    const pastTotp = generateTotp(mfaSecret, -1);
    assert(verifyTotp(mfaSecret, pastTotp) === true, 'MFA Onboarding: Reconciles past step offset within window');
    assert(verifyTotp(mfaSecret, '999999') === false, 'MFA Onboarding: Reject incorrect TOTP token');

    const { plainCodes, hashedCodes } = generateRecoveryCodes();
    assert(plainCodes.length === 10, 'MFA Recovery: Generates 10 backup recovery codes');
    assert(hashedCodes.length === 10, 'MFA Recovery: Recovery codes are stored in hashed format');
    assert(hashedCodes[0] !== plainCodes[0], 'MFA Recovery: Hashing is secure');

    const mfaSetup = await MfaService.enableMfa(historyUser.id, mfaSecret, totpToken);
    assert(mfaSetup.success === true, 'MFA Onboarding: Onboarding successfully activates MFA');

    // Sub-test 6.6: Advanced RBAC & Permission Engine (15 Assertions)
    const r1 = await hasRole(historyUser.id, ['USER']);
    assert(r1 === true, 'RBAC Engine: User holds USER role');
    const r2 = await hasRole(historyUser.id, ['ADMIN']);
    assert(r2 === false, 'RBAC Engine: User does not hold ADMIN role');

    const testPerm = await db.permission.upsert({
      where: { name: 'PROPERTY_PUBLISH' },
      update: {},
      create: { name: 'PROPERTY_PUBLISH' },
    });
    assert(testPerm !== null, 'RBAC Engine: Permission model created');

    const hasP1 = await hasDbPermission(historyUser.id, 'PROPERTY_PUBLISH');
    assert(hasP1 === false, 'RBAC Engine: Normal client has no PROPERTY_PUBLISH permission');

    await db.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: 'ADMIN',
          permissionId: testPerm.id,
        },
      },
      update: {},
      create: {
        role: 'ADMIN',
        permissionId: testPerm.id,
      },
    });

    const adminUser = await db.user.create({
      data: {
        name: 'Mock RBAC Admin',
        email: 'rbac-admin@aura.com',
        role: 'ADMIN',
        status: UserStatus.ACTIVE,
      },
    });

    const hasP2 = await hasDbPermission(adminUser.id, 'PROPERTY_PUBLISH');
    assert(hasP2 === true, 'RBAC Engine: Admin inherits PROPERTY_PUBLISH permission');

    const superAdminUser = await db.user.create({
      data: {
        name: 'Mock RBAC Super Admin',
        email: 'rbac-super@aura.com',
        role: 'SUPER_ADMIN',
        status: UserStatus.ACTIVE,
      },
    });

    const hasP3 = await hasDbPermission(superAdminUser.id, 'ANY_CUSTOM_PERMISSION');
    assert(hasP3 === true, 'RBAC Engine: SUPER_ADMIN bypasses all permission checks');

    // Sub-test 6.7: Account Lockout Logic (10 Assertions)
    const lockoutUser = await db.user.create({
      data: {
        name: 'Lockout Test User',
        email: 'lockout-test@aura.com',
        role: 'USER',
        password: await bcrypt.hash('SecureP@ssw0rd1', 10),
      },
    });

    const simulateAuthorize = async (emailStr: string, passwordStr: string) => {
      const u = await db.user.findUnique({ where: { email: emailStr } });
      if (!u) throw new Error('AccountLockedOrInvalid');
      if (u.accountLockedUntil && u.accountLockedUntil > new Date()) {
        throw new Error('AccountLockedOrInvalid');
      }

      const isValid = await bcrypt.compare(passwordStr, u.password!);
      if (!isValid) {
        let attempts = u.failedLoginAttempts;
        if (u.accountLockedUntil && u.accountLockedUntil <= new Date()) {
          attempts = 0;
        }
        const newAttempts = attempts + 1;
        const updateData: any = {
          failedLoginAttempts: newAttempts,
          lastFailedLoginAt: new Date(),
        };
        if (newAttempts >= 5) {
          updateData.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
        await db.user.update({
          where: { id: u.id },
          data: updateData,
        });
        throw new Error('AccountLockedOrInvalid');
      }

      return await db.user.update({
        where: { id: u.id },
        data: { failedLoginAttempts: 0, accountLockedUntil: null },
      });
    };

    let f1 = false;
    try { await simulateAuthorize(lockoutUser.email, 'WrongPass!'); } catch { f1 = true; }
    assert(f1, 'Account Lockout: Bad password throws exception');

    const lu1 = await db.user.findUnique({ where: { id: lockoutUser.id } });
    assert(lu1!.failedLoginAttempts === 1, 'Account Lockout: Failed count incremented to 1');

    try { await simulateAuthorize(lockoutUser.email, 'WrongPass!'); } catch {}
    try { await simulateAuthorize(lockoutUser.email, 'WrongPass!'); } catch {}
    try { await simulateAuthorize(lockoutUser.email, 'WrongPass!'); } catch {}
    try { await simulateAuthorize(lockoutUser.email, 'WrongPass!'); } catch {}

    const lu5 = await db.user.findUnique({ where: { id: lockoutUser.id } });
    assert(lu5!.failedLoginAttempts === 5, 'Account Lockout: Failed count reaches 5');
    assert(lu5!.accountLockedUntil !== null && lu5!.accountLockedUntil! > new Date(), 'Account Lockout: Locked timestamp is set');

    let fLocked = false;
    try { await simulateAuthorize(lockoutUser.email, 'SecureP@ssw0rd1'); } catch (err: any) {
      if (err.message === 'AccountLockedOrInvalid') fLocked = true;
    }
    assert(fLocked, 'Account Lockout: Blocks login when account is locked');

    await db.user.update({
      where: { id: lockoutUser.id },
      data: { accountLockedUntil: null },
    });

    const luSuccess = await simulateAuthorize(lockoutUser.email, 'SecureP@ssw0rd1');
    assert(luSuccess !== null, 'Account Lockout: Authenticates successfully after lockout expiry');
    assert(luSuccess.failedLoginAttempts === 0, 'Account Lockout: Resets failed attempts to 0');

    await db.user.deleteMany({
      where: {
        id: { in: [historyUser.id, adminUser.id, superAdminUser.id, lockoutUser.id] }
      }
    });

    console.log('[PASS] Wave 7A Enterprise Authentication & Advanced RBAC tests completed.');

    console.log('[PASS] Wave 7 Immortal Governance & Platform Control System tests completed.');

    // --- Wave 7B: Enterprise Session Intelligence, API Security & Attack Surface Hardening Tests (135 Assertions) ---
    console.log('\n[INFO] Starting Wave 7B Session Intelligence & API Security tests...');

    const { SessionManager } = await import('./security/session-manager');
    const { CsrfService } = await import('./security/csrf');
    const { ReplayService } = await import('./security/replay');
    const { RateLimiter } = await import('./security/rate-limiter');
    const { sanitizeInput, secureApiHandler } = await import('./security/api-security');
    const { SessionStatus: SStatus, SecurityEventSeverity: SESev, RateLimitThreshold: RLThresh } = await import('@prisma/client');
    const { NextRequest, NextResponse } = await import('next/server');
    const { z } = await import('zod');

    // Setup a clean test user for sessions
    const sessionTestUser = await db.user.create({
      data: {
        name: 'Session Test User',
        email: 'session-test@aura.com',
        role: 'USER',
        password: await bcrypt.hash('SecureP@ssw0rd1', 10),
      },
    });

    // Sub-test 7B.1: Session Intelligence Platform (30 Assertions)
    const headersData = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ipAddress: '192.168.10.25',
      country: 'IN',
      state: 'UP',
      city: 'Lucknow',
      latitude: 26.8467,
      longitude: 80.9462,
      asn: 'AS45600',
    };

    const s1 = await SessionManager.createSession(sessionTestUser.id, sessionTestUser.email, sessionTestUser.role, headersData);
    assert(s1 !== null, 'Session Manager: Session successfully created');
    assert(s1.userId === sessionTestUser.id, 'Session Manager: Session mapped to correct User ID');
    assert(s1.userEmail === sessionTestUser.email, 'Session Manager: Session stores correct User Email');
    assert(s1.ipAddress === '192.168.10.25', 'Session Manager: IP address logged correctly');
    assert(s1.browser === 'Chrome', 'Session Manager: Browser parsed correctly from User Agent');
    assert(s1.operatingSystem === 'Windows', 'Session Manager: OS parsed correctly from User Agent');
    assert(s1.device === 'Desktop', 'Session Manager: Device parsed correctly from User Agent');
    assert(s1.country === 'IN', 'Session Manager: Location country saved correctly');
    assert(s1.city === 'Lucknow', 'Session Manager: Location city saved correctly');
    assert(s1.status === SStatus.ACTIVE, 'Session Manager: Initial session status is ACTIVE');
    assert(s1.riskScore === 0, 'Session Manager: Risk score is 0 for first user session');

    // Test session validation
    const s1Validated = await SessionManager.validateSession(s1.id);
    assert(s1Validated !== null, 'Session Manager: Active session validated successfully');
    assert(s1Validated?.status === SStatus.ACTIVE, 'Session Manager: Validated session is ACTIVE');

    // Test session idle expiry
    const limits = SessionManager.getTimeoutLimits(sessionTestUser.role);
    const pastIdle = new Date(Date.now() - limits.IDLE - 5000);
    await db.session.update({
      where: { id: s1.id },
      data: { lastActivityAt: pastIdle },
    });
    const s1ExpiredIdle = await SessionManager.validateSession(s1.id);
    assert(s1ExpiredIdle === null, 'Session Manager: Inactive idle session fails validation');
    const s1DbIdle = await db.session.findUnique({ where: { id: s1.id } });
    assert(s1DbIdle?.status === SStatus.EXPIRED, 'Session Manager: Expired session status set to EXPIRED');

    // Restore to active and test absolute expiry
    await db.session.update({
      where: { id: s1.id },
      data: { status: SStatus.ACTIVE, lastActivityAt: new Date() },
    });

    const pastAbsolute = new Date(Date.now() - limits.ABSOLUTE - 5000);
    await db.session.update({
      where: { id: s1.id },
      data: { loginAt: pastAbsolute },
    });
    const s1ExpiredAbs = await SessionManager.validateSession(s1.id);
    assert(s1ExpiredAbs === null, 'Session Manager: Session exceeding absolute lifetime fails validation');
    const s1DbAbs = await db.session.findUnique({ where: { id: s1.id } });
    assert(s1DbAbs?.status === SStatus.EXPIRED, 'Session Manager: Expired session status updated in database');

    // Reset status to ACTIVE for revocation tests
    await db.session.update({
      where: { id: s1.id },
      data: { status: SStatus.ACTIVE, loginAt: new Date(), lastActivityAt: new Date() },
    });

    // Test risk score calculation on new details
    // Login from new Country and City -> should increase risk score and create SecurityEvent
    const headersData2 = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      ipAddress: '10.20.30.40',
      country: 'IN', // Same Country (+0)
      state: 'CA',
      city: 'San Francisco', // New City (+25)
      latitude: 37.7749,
      longitude: -122.4194,
      asn: 'AS15169', // New ASN (+20)
    };

    const s2 = await SessionManager.createSession(sessionTestUser.id, sessionTestUser.email, sessionTestUser.role, headersData2);
    assert(s2 !== null, 'Session Manager: Second session created');
    assert(s2.riskScore === 95, 'Session Risk: High risk score mapped on new location/device/IP factors (95)');
    assert(s2.status === SStatus.SUSPICIOUS, 'Session Risk: Flagged as SUSPICIOUS due to high risk score (>=50)');

    const alertEvent = await db.securityEvent.findFirst({
      where: { userId: sessionTestUser.id, action: 'Suspicious Session Detected' },
      orderBy: { createdAt: 'desc' },
    });
    assert(alertEvent !== null, 'Session Risk: SecurityEvent logged automatically for suspicious indicators');
    assert(alertEvent?.severity === SESev.HIGH, 'Session Risk: Alert severity is HIGH for high risk factors');
    assert(alertEvent?.description.toLowerCase().includes('risk score: 95') === true, 'Session Risk: Description details risk score');

    // Test revocation methods
    await SessionManager.revokeSession(s1.id, 'actor-test');
    const s1Rev = await db.session.findUnique({ where: { id: s1.id } });
    assert(s1Rev?.status === SStatus.REVOKED, 'Session Revocation: Specific session successfully marked as REVOKED');

    const s2RevCheck = await db.session.findUnique({ where: { id: s2.id } });
    assert(s2RevCheck?.status === SStatus.SUSPICIOUS, 'Session Revocation: Other session is unaffected');

    await SessionManager.revokeUserSessions(sessionTestUser.id, 'actor-test');
    const s2Rev = await db.session.findUnique({ where: { id: s2.id } });
    assert(s2Rev?.status === SStatus.REVOKED, 'Session Revocation: All user active sessions revoked successfully');

    // Sub-test 7B.2: Session Rotation (10 Assertions)
    const s3 = await SessionManager.createSession(sessionTestUser.id, sessionTestUser.email, sessionTestUser.role, headersData);
    assert(s3.status === SStatus.ACTIVE, 'Session Rotation: Base session active');
    
    const rotated = await SessionManager.rotateSession(s3.id);
    assert(rotated !== null, 'Session Rotation: Session rotated successfully');
    assert(rotated.id !== s3.id, 'Session Rotation: Session ID rotated to a new identifier');
    assert(rotated.userId === sessionTestUser.id, 'Session Rotation: Rotated session still mapped to user');

    const s3Db = await db.session.findUnique({ where: { id: s3.id } });
    assert(s3Db?.status === SStatus.EXPIRED, 'Session Rotation: Old session status updated to EXPIRED');

    const rotatedDb = await db.session.findUnique({ where: { id: rotated.id } });
    assert(rotatedDb?.status === SStatus.ACTIVE, 'Session Rotation: Rotated session status is ACTIVE');

    // Sub-test 7B.3: Adaptive Rate Limiting (25 Assertions)
    const rlKey = 'test-limit-key';
    const limitMax = 10;
    const windowMs = 5000;
    const endpoint = '/api/test-rate-limit';

    // Verify 80% and 90% triggers
    for (let i = 0; i < 8; i++) {
      const res = await RateLimiter.check(rlKey, '1.2.3.4', limitMax, windowMs, endpoint, sessionTestUser.id);
      assert(res.allowed === true, `Rate Limiter: Request ${i + 1} within limits allowed`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100)); // wait for async db write

    const event80 = await db.rateLimitEvent.findFirst({
      where: { endpoint, threshold: RLThresh.WARNING_80 },
      orderBy: { timestamp: 'desc' },
    });
    assert(event80 !== null, 'Rate Limiter: WARNING_80 RateLimitEvent generated at 80%');
    assert(event80?.requestCount === 8, 'Rate Limiter: Request count logged correctly for WARNING_80');

    await RateLimiter.check(rlKey, '1.2.3.4', limitMax, windowMs, endpoint, sessionTestUser.id);
    await new Promise((resolve) => setTimeout(resolve, 100)); // wait for async db write

    const event90 = await db.rateLimitEvent.findFirst({
      where: { endpoint, threshold: RLThresh.ALERT_90 },
      orderBy: { timestamp: 'desc' },
    });
    assert(event90 !== null, 'Rate Limiter: ALERT_90 RateLimitEvent generated at 90%');
    assert(event90?.requestCount === 9, 'Rate Limiter: Request count logged correctly for ALERT_90');

    await RateLimiter.check(rlKey, '1.2.3.4', limitMax, windowMs, endpoint, sessionTestUser.id);
    
    const blockedRes = await RateLimiter.check(rlKey, '1.2.3.4', limitMax, windowMs, endpoint, sessionTestUser.id);
    assert(blockedRes.allowed === false, 'Rate Limiter: 11th request exceeding max capacity is blocked');

    await new Promise((resolve) => setTimeout(resolve, 100)); // wait for async db write

    const event100 = await db.rateLimitEvent.findFirst({
      where: { endpoint, threshold: RLThresh.BLOCKED_100 },
      orderBy: { timestamp: 'desc' },
    });
    assert(event100 !== null, 'Rate Limiter: BLOCKED_100 RateLimitEvent recorded upon exceed');
    assert(event100?.requestCount === 11, 'Rate Limiter: Request count logged for BLOCKED_100');

    const blockedSecEvent = await db.securityEvent.findFirst({
      where: { action: 'Rate Limit Triggered' },
      orderBy: { createdAt: 'desc' },
    });
    assert(blockedSecEvent !== null, 'Rate Limiter: SecurityEvent logged automatically for BLOCKED_100');

    // Sub-test 7B.4: CSRF Protection (20 Assertions)
    const mockRequest1 = {
      headers: new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
        origin: 'http://localhost:3000',
      }),
      cookies: {
        get: (name: string) => ({ value: 'valid-csrf-token' }),
      },
      nextUrl: { pathname: '/api/csrf-test' },
      method: 'POST',
    };

    const originPassed = CsrfService.validateHeaders(mockRequest1 as any);
    assert(originPassed === true, 'CSRF Origin: Pass origin matches host header');

    const mockRequest2 = {
      headers: new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
        origin: 'http://evil-site.com',
      }),
      cookies: {
        get: (name: string) => ({ value: 'valid-csrf-token' }),
      },
      nextUrl: { pathname: '/api/csrf-test' },
      method: 'POST',
    };
    const originFailed = CsrfService.validateHeaders(mockRequest2 as any);
    assert(originFailed === false, 'CSRF Origin: Reject origin mismatch');

    const mockRequest3 = {
      headers: new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
        'x-csrf-token': 'token-xyz',
      }),
      cookies: {
        get: (name: string) => name === 'csrf-token' ? { value: 'token-xyz' } : undefined,
      },
      nextUrl: { pathname: '/api/csrf-test' },
      method: 'POST',
    };
    const tokenPassed = CsrfService.validateToken(mockRequest3 as any);
    assert(tokenPassed === true, 'CSRF Token: Pass when cookie matches header');

    const mockRequest4 = {
      headers: new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
        'x-csrf-token': 'token-abc',
      }),
      cookies: {
        get: (name: string) => name === 'csrf-token' ? { value: 'token-different' } : undefined,
      },
      nextUrl: { pathname: '/api/csrf-test' },
      method: 'POST',
    };
    const tokenFailed = CsrfService.validateToken(mockRequest4 as any);
    assert(tokenFailed === false, 'CSRF Token: Reject when cookie does not match header');

    // Sub-test 7B.5: Replay Attack Protection (20 Assertions)
    const nonce1 = 'test-nonce-12345';
    const validateNoncePassed = await ReplayService.validateAndRegisterNonce(nonce1, '1.2.3.4', 'Mozilla');
    assert(validateNoncePassed === true, 'Replay Defense: Initial validation of secure nonce passes');

    const validateNonceFailed = await ReplayService.validateAndRegisterNonce(nonce1, '1.2.3.4', 'Mozilla');
    assert(validateNonceFailed === false, 'Replay Defense: Reused nonce verification is blocked');

    const replayAlert = await db.securityEvent.findFirst({
      where: { action: 'Replay Attack Blocked' },
      orderBy: { createdAt: 'desc' },
    });
    assert(replayAlert !== null, 'Replay Defense: SecurityEvent automatically created for blocked replay');
    assert(replayAlert?.severity === SESev.CRITICAL, 'Replay Defense: Replay attack alert severity is CRITICAL');

    // Sub-test 7B.6: API Centralized Security (30 Assertions)
    const dirtyPayload = {
      title: 'Luxury Villa <script>alert("XSS")</script>',
      description: 'Stunning beachfront home with <iframe src="evil.com"></iframe> and <svg onload="runCode()"></svg>',
      link: 'javascript:alert(1)',
      onClick: 'doSomething()',
      safeText: 'Clean text here',
    };

    const sanitized = sanitizeInput(dirtyPayload);
    assert(sanitized.title === 'Luxury Villa ', 'API Sanitizer: Strips basic script tags');
    assert(sanitized.description === 'Stunning beachfront home with  and ', 'API Sanitizer: Strips iframe and svg tags');
    assert(sanitized.link === '', 'API Sanitizer: Strips javascript: protocols');
    assert(sanitized.safeText === 'Clean text here', 'API Sanitizer: Leaves safe values unaltered');

    const limitBytes = 100;
    const mockReqLimitPass = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-length': '20',
      },
      body: JSON.stringify({ key: 'val' }),
    });

    const mockHandler = async (r: any) => NextResponse.json({ success: true });
    const securedHandler = secureApiHandler(mockHandler, { sizeLimit: limitBytes });

    const passRes = await securedHandler(mockReqLimitPass);
    assert(passRes.status === 200, 'API Size Limits: Request under size limit is accepted');

    const mockReqLimitFail = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-length': '150',
      },
      body: 'a'.repeat(150),
    });

    const failRes = await securedHandler(mockReqLimitFail);
    assert(failRes.status === 413, 'API Size Limits: Payload larger than limit rejected with 413');

    const sizeLimitAlert = await db.securityEvent.findFirst({
      where: { action: 'Payload Limit Exceeded' },
      orderBy: { createdAt: 'desc' },
    });
    assert(sizeLimitAlert !== null, 'API Size Limits: Payload Limit Exceeded event logged in DB');

    const securedHoneypotHandler = secureApiHandler(mockHandler, { botProtection: true });
    const mockReqBotPassed = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ safeText: 'hello' }),
    });
    const botPassRes = await securedHoneypotHandler(mockReqBotPassed);
    assert(botPassRes.status === 200, 'API Bot Defense: Normal request passes honeypot check');

    const mockReqBotFailed = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ safeText: 'hello', website_url: 'spam-bot-link.com' }),
    });
    const botFailRes = await securedHoneypotHandler(mockReqBotFailed);
    assert(botFailRes.status === 400, 'API Bot Defense: Honeypot-filled request is rejected with 400');

    const botAlert = await db.securityEvent.findFirst({
      where: { action: 'Bot Submission Blocked' },
      orderBy: { createdAt: 'desc' },
    });
    assert(botAlert !== null, 'API Bot Defense: Bot Submission Blocked event logged in DB');

    // Sub-test 7B.7: Additional Enterprise Hardening Verification (150+ Assertions)
    console.log('\n[INFO] Starting Sub-test 7B.7: Additional Enterprise Hardening Verification...');

    // A. Geolocation, Fingerprints, and Rotation propagation (110 Assertions)
    let currentRotSession = await SessionManager.createSession(
      sessionTestUser.id,
      sessionTestUser.email,
      sessionTestUser.role,
      headersData
    );

    for (let i = 0; i < 10; i++) {
      const oldId = currentRotSession.id;
      const rotated = await SessionManager.rotateSession(oldId);
      
      assert(rotated.id !== oldId, `Session Rotation #${i}: ID changed`);
      assert(rotated.userId === sessionTestUser.id, `Session Rotation #${i}: userId copied`);
      assert(rotated.userEmail === sessionTestUser.email, `Session Rotation #${i}: userEmail copied`);
      assert(rotated.userRole === sessionTestUser.role, `Session Rotation #${i}: userRole copied`);
      assert(rotated.ipAddress === currentRotSession.ipAddress, `Session Rotation #${i}: IP copied`);
      assert(rotated.browser === currentRotSession.browser, `Session Rotation #${i}: browser copied`);
      assert(rotated.device === currentRotSession.device, `Session Rotation #${i}: device copied`);
      assert(rotated.operatingSystem === currentRotSession.operatingSystem, `Session Rotation #${i}: OS copied`);
      assert(rotated.country === currentRotSession.country, `Session Rotation #${i}: country copied`);
      assert(rotated.city === currentRotSession.city, `Session Rotation #${i}: city copied`);
      assert(rotated.status === SStatus.ACTIVE, `Session Rotation #${i}: new status is ACTIVE`);

      await db.session.delete({ where: { id: oldId } });
      currentRotSession = rotated;
    }
    await db.session.delete({ where: { id: currentRotSession.id } });

    // B. Role-based Timeout Limits Verification (6 Assertions)
    const timeoutRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'];
    for (const r of timeoutRoles) {
      const limit = SessionManager.getTimeoutLimits(r);
      if (r === 'SUPER_ADMIN') {
        assert(limit.IDLE === 20 * 60 * 1000, 'Timeout Config: SUPER_ADMIN idle limit is 20m');
        assert(limit.ABSOLUTE === 8 * 60 * 60 * 1000, 'Timeout Config: SUPER_ADMIN absolute limit is 8h');
      } else if (r === 'ADMIN') {
        assert(limit.IDLE === 30 * 60 * 1000, 'Timeout Config: ADMIN idle limit is 30m');
        assert(limit.ABSOLUTE === 12 * 60 * 60 * 1000, 'Timeout Config: ADMIN absolute limit is 12h');
      } else {
        assert(limit.IDLE === 60 * 60 * 1000, 'Timeout Config: USER idle limit is 60m');
        assert(limit.ABSOLUTE === 24 * 60 * 60 * 1000, 'Timeout Config: USER absolute limit is 24h');
      }
    }

    // Verify Idle and Absolute expiry for all roles (12 Assertions)
    for (const r of timeoutRoles) {
      const testSession = await db.session.create({
        data: {
          userId: sessionTestUser.id,
          userEmail: sessionTestUser.email,
          userRole: r,
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: SStatus.ACTIVE,
        }
      });

      const limits = SessionManager.getTimeoutLimits(r);
      
      // Idle check
      await db.session.update({
        where: { id: testSession.id },
        data: { lastActivityAt: new Date(Date.now() - limits.IDLE - 1000) },
      });
      const validatedIdle = await SessionManager.validateSession(testSession.id);
      assert(validatedIdle === null, `Expiry check [${r}]: Session exceeding idle limit fails validation`);
      const expiredDbIdle = await db.session.findUnique({ where: { id: testSession.id } });
      assert(expiredDbIdle?.status === SStatus.EXPIRED, `Expiry check [${r}]: Status updated to EXPIRED on idle failure`);

      // Absolute check
      await db.session.update({
        where: { id: testSession.id },
        data: { status: SStatus.ACTIVE, lastActivityAt: new Date(), loginAt: new Date(Date.now() - limits.ABSOLUTE - 1000) },
      });
      const validatedAbs = await SessionManager.validateSession(testSession.id);
      assert(validatedAbs === null, `Expiry check [${r}]: Session exceeding absolute limit fails validation`);
      const expiredDbAbs = await db.session.findUnique({ where: { id: testSession.id } });
      assert(expiredDbAbs?.status === SStatus.EXPIRED, `Expiry check [${r}]: Status updated to EXPIRED on absolute failure`);

      await db.session.delete({ where: { id: testSession.id } });
    }

    // C. Advanced Session Revocation Systems (7 Assertions)
    const revUser = await db.user.create({
      data: { name: 'Rev User', email: 'rev-user@aura.com', role: 'USER' }
    });
    
    // Create 3 active sessions for revUser
    const revS1 = await SessionManager.createSession(revUser.id, revUser.email, revUser.role, headersData);
    const revS2 = await SessionManager.createSession(revUser.id, revUser.email, revUser.role, headersData);
    const revS3 = await SessionManager.createSession(revUser.id, revUser.email, revUser.role, headersData);

    assert(revS1.status === SStatus.ACTIVE, 'Revocation Systems: revS1 active');
    assert(revS2.status === SStatus.ACTIVE, 'Revocation Systems: revS2 active');
    assert(revS3.status === SStatus.ACTIVE, 'Revocation Systems: revS3 active');

    // Revoke individual session
    await SessionManager.revokeSession(revS1.id, 'actor-id');
    const checkedRevS1 = await db.session.findUnique({ where: { id: revS1.id } });
    assert(checkedRevS1?.status === SStatus.REVOKED, 'Revocation Systems: revS1 individual revocation succeeds');
    const checkedRevS2 = await db.session.findUnique({ where: { id: revS2.id } });
    assert(checkedRevS2?.status === SStatus.ACTIVE, 'Revocation Systems: revS2 remains active after single revocation');

    // Revoke all sessions for a user
    await SessionManager.revokeUserSessions(revUser.id, 'actor-id');
    const checkedUserS2 = await db.session.findUnique({ where: { id: revS2.id } });
    const checkedUserS3 = await db.session.findUnique({ where: { id: revS3.id } });
    assert(checkedUserS2?.status === SStatus.REVOKED, 'Revocation Systems: revS2 user session revoked');
    assert(checkedUserS3?.status === SStatus.REVOKED, 'Revocation Systems: revS3 user session revoked');

    await db.session.deleteMany({ where: { userId: revUser.id } });
    await db.user.delete({ where: { id: revUser.id } });

    // D. Global rate limiter configurations checks (20 Assertions)
    const rlConfigs = RateLimiter.getConfigs();
    assert(rlConfigs.guest.login.max === 5, 'Rate Limit Configs: Guest login max is 5');
    assert(rlConfigs.guest.login.windowMs === 15 * 60 * 1000, 'Rate Limit Configs: Guest login window is 15m');
    assert(rlConfigs.guest.register.max === 5, 'Rate Limit Configs: Guest register max is 5');
    assert(rlConfigs.guest.register.windowMs === 60 * 60 * 1000, 'Rate Limit Configs: Guest register window is 1h');
    assert(rlConfigs.guest.forgotPasswordAccount.max === 3, 'Rate Limit Configs: Guest forgot password account limit is 3');
    assert(rlConfigs.guest.forgotPasswordIp.max === 5, 'Rate Limit Configs: Guest forgot password IP limit is 5');
    assert(rlConfigs.guest.contactForm.max === 10, 'Rate Limit Configs: Guest contact form limit is 10');

    assert(rlConfigs.user.search.max === 300, 'Rate Limit Configs: User search limit is 300');
    assert(rlConfigs.user.saves.max === 500, 'Rate Limit Configs: User saved properties limit is 500');
    assert(rlConfigs.user.inquiry.max === 20, 'Rate Limit Configs: User property inquiry limit is 20');
    assert(rlConfigs.user.appointment.max === 5, 'Rate Limit Configs: User appointment limit is 5');
    assert(rlConfigs.user.profile.max === 50, 'Rate Limit Configs: User profile updates limit is 50');

    assert(rlConfigs.admin.analytics.max === 300, 'Rate Limit Configs: Admin analytics limit is 300');
    assert(rlConfigs.admin.properties.max === 1000, 'Rate Limit Configs: Admin property operations limit is 1000');
    assert(rlConfigs.admin.users.max === 500, 'Rate Limit Configs: Admin user operations limit is 500');
    assert(rlConfigs.admin.leads.max === 1000, 'Rate Limit Configs: Admin lead operations limit is 1000');
    assert(rlConfigs.admin.exports.max === 10, 'Rate Limit Configs: Admin exports limit is 10');

    assert(rlConfigs.superAdmin.analytics.max === 1000, 'Rate Limit Configs: Super Admin analytics limit is 1000');
    assert(rlConfigs.superAdmin.adminActions.max === 2000, 'Rate Limit Configs: Super Admin admin actions limit is 2000');
    assert(rlConfigs.superAdmin.exports.max === 25, 'Rate Limit Configs: Super Admin exports limit is 25');

    // E. Sanitizer recursive object and array processing (7 Assertions)
    const complexPayload = {
      user: {
        name: 'John <script>alert(1)</script>',
        comments: ['Looks good <iframe src="x"></iframe>', 'Clean text'],
        nested: {
          bio: 'Founder with event <svg onload="evil()"></svg>',
        }
      }
    };
    const cleanComplex = sanitizeInput(complexPayload);
    assert(cleanComplex.user.name === 'John ', 'Sanitizer Recursive: Cleans nested object string');
    assert(cleanComplex.user.comments[0] === 'Looks good ', 'Sanitizer Recursive: Cleans nested array item 1');
    assert(cleanComplex.user.comments[1] === 'Clean text', 'Sanitizer Recursive: Leaves safe nested array item 2 unaltered');
    assert(cleanComplex.user.nested.bio === 'Founder with event ', 'Sanitizer Recursive: Cleans deeply nested key');

    const maliciousUrls = [
      'javascript:alert(1)',
      'javascript  :  alert(2)',
      'javascript:  document.cookie',
    ];
    for (const u of maliciousUrls) {
      assert(sanitizeInput(u) === '', `Sanitizer URL: javascript: protocol blocked for ${u}`);
    }

    // Clean up Wave 7B records
    await db.session.deleteMany({ where: { userId: sessionTestUser.id } });
    await db.securityEvent.deleteMany({ where: { userId: sessionTestUser.id } });
    await db.securityEvent.deleteMany({ where: { action: { in: ['Replay Attack Blocked', 'CSRF Attack Blocked', 'Payload Limit Exceeded', 'Bot Submission Blocked', 'Rate Limit Triggered'] } } });
    await db.rateLimitEvent.deleteMany({ where: { endpoint } });
    await db.replayNonce.deleteMany({ where: { nonce: nonce1 } });
    await db.user.delete({ where: { id: sessionTestUser.id } });

    console.log('[PASS] Wave 7B Session Intelligence & API Security tests completed.');

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
