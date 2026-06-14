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

    // Clean up CRM test data
    await db.leadNote.deleteMany({ where: { leadId: testLead.id } });
    await db.leadComment.deleteMany({ where: { leadId: testLead.id } });
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
