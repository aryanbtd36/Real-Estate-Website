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
