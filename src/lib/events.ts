import { EventEmitter } from 'events';
import { db } from './db';
import { ActivityService } from './activity';
import { NotificationService } from './notification';
import { ActivityAction, NotificationType } from '@prisma/client';

export const eventEmitter = new EventEmitter();

// Centralized Event Constants
export const EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  PROPERTY_VIEWED: 'PROPERTY_VIEWED',
  PROPERTY_SAVED: 'PROPERTY_SAVED',
  PROPERTY_UNSAVED: 'PROPERTY_UNSAVED',
  INQUIRY_CREATED: 'INQUIRY_CREATED',
  INQUIRY_UPDATED: 'INQUIRY_UPDATED',
  INQUIRY_DELETED: 'INQUIRY_DELETED',
  APPOINTMENT_CREATED: 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED: 'APPOINTMENT_UPDATED',
  APPOINTMENT_RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  APPOINTMENT_COMPLETED: 'APPOINTMENT_COMPLETED',
  APPOINTMENT_OUTCOME_RECORDED: 'APPOINTMENT_OUTCOME_RECORDED',
  APPOINTMENT_REMINDER_SENT: 'APPOINTMENT_REMINDER_SENT',
  FOLLOW_UP_AUTO_CREATED: 'FOLLOW_UP_AUTO_CREATED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_RESTORED: 'USER_RESTORED',
  ROLE_PROMOTED: 'ROLE_PROMOTED',
  ROLE_REVOKED: 'ROLE_REVOKED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  SYSTEM_EVENT: 'SYSTEM_EVENT',
  PROPERTY_PUBLISHED: 'PROPERTY_PUBLISHED',
  PROPERTY_ARCHIVED: 'PROPERTY_ARCHIVED',
  PROPERTY_RESTORED: 'PROPERTY_RESTORED',
  
  // Lead CRM Events
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_UPDATED: 'LEAD_UPDATED',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_REASSIGNED: 'LEAD_REASSIGNED',
  LEAD_STATUS_CHANGED: 'LEAD_STATUS_CHANGED',
  FOLLOW_UP_CREATED: 'FOLLOW_UP_CREATED',
  FOLLOW_UP_COMPLETED: 'FOLLOW_UP_COMPLETED',
  FOLLOW_UP_OVERDUE: 'FOLLOW_UP_OVERDUE',
  COMMUNICATION_LOGGED: 'COMMUNICATION_LOGGED',

  // Super Admin & Governance Events
  ADMIN_CREATED: 'ADMIN_CREATED',
  ADMIN_PROMOTED: 'ADMIN_PROMOTED',
  ADMIN_REVOKED: 'ADMIN_REVOKED',
  ADMIN_SUSPENDED: 'ADMIN_SUSPENDED',
  ADMIN_RESTORED: 'ADMIN_RESTORED',
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_TERMINATED: 'SESSION_TERMINATED',
  SECURITY_ALERT_CREATED: 'SECURITY_ALERT_CREATED',
  ADMIN_REVIEW_CREATED: 'ADMIN_REVIEW_CREATED',
};

// --- Decoupled Side Effect Event Listeners ---

// Helper to wrap listener execution in try-catch to keep APIs resilient
function safeListener(handler: (...args: any[]) => Promise<any>) {
  return async (...args: any[]) => {
    try {
      await handler(...args);
    } catch (err) {
      console.error('[Event System] Error in listener execution:', err);
    }
  };
}

// 1. Login Success Listener
eventEmitter.on(
  EVENTS.LOGIN_SUCCESS,
  safeListener(async ({ userId, provider }: { userId: string; provider?: string }) => {
    const userExists = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) return;

    await db.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });

    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.LOGIN,
      description: `User logged in successfully via ${provider || 'credentials'}`,
      details: { provider },
    });
  })
);

// 2. Property Viewed Listener
eventEmitter.on(
  EVENTS.PROPERTY_VIEWED,
  safeListener(async ({ userId, propertyId, propertyName }: { userId?: string | null; propertyId: string; propertyName: string }) => {
    // Write view record to PropertyView table (Analytics)
    await db.propertyView.create({
      data: {
        propertyId,
        userId: userId || null,
      },
    });

    // Write audit log if user is logged in
    if (userId) {
      await ActivityService.log({
        actorId: userId,
        action: ActivityAction.PROPERTY_VIEW,
        description: `Viewed property "${propertyName}"`,
        details: { propertyId, propertyName },
      });
    }
  })
);

// 3. Property Saved Listener
eventEmitter.on(
  EVENTS.PROPERTY_SAVED,
  safeListener(async ({ userId, propertyId, propertyName }: { userId: string; propertyId: string; propertyName: string }) => {
    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.PROPERTY_SAVE,
      description: `Saved property "${propertyName}"`,
      details: { propertyId, propertyName },
    });
  })
);

// 4. Property Unsaved Listener
eventEmitter.on(
  EVENTS.PROPERTY_UNSAVED,
  safeListener(async ({ userId, propertyId, propertyName }: { userId: string; propertyId: string; propertyName: string }) => {
    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.PROPERTY_UNSAVE,
      description: `Unsaved property "${propertyName}"`,
      details: { propertyId, propertyName },
    });
  })
);

// 5. Inquiry Created Listener
eventEmitter.on(
  EVENTS.INQUIRY_CREATED,
  safeListener(async ({ userId, leadId, name, email, message }: { userId?: string | null; leadId: string; name: string; email: string; message: string }) => {
    // Log activity
    await ActivityService.log({
      actorId: userId || null,
      action: ActivityAction.INQUIRY_CREATE,
      description: `Inquiry submitted by ${name} (${email})`,
      details: { leadId, name, email, messageSnippet: message.substring(0, 100) },
    });

    // Notify administrators (bulk optimization used inside notifyAdmins)
    await NotificationService.notifyAdmins({
      title: 'New Concierge Inquiry',
      message: `Inquiry from ${name}: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`,
      type: NotificationType.INQUIRY,
      link: '/admin/inquiries',
    });
  })
);

// 6. Inquiry Updated Listener
eventEmitter.on(
  EVENTS.INQUIRY_UPDATED,
  safeListener(async ({ actorId, leadId, name, email, previousStatus, newStatus }: { actorId: string; leadId: string; name: string; email: string; previousStatus: string; newStatus: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.INQUIRY_UPDATE,
      description: `Inquiry status updated to ${newStatus} for ${name}`,
      details: { leadId, previousStatus, newStatus },
    });

    // Notify user if email is registered
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await NotificationService.create({
        userId: user.id,
        title: 'Inquiry Status Updated',
        message: `Your concierge inquiry status has been updated to "${newStatus}".`,
        type: NotificationType.INQUIRY,
      });
    }
  })
);

// 7. Inquiry Deleted Listener
eventEmitter.on(
  EVENTS.INQUIRY_DELETED,
  safeListener(async ({ actorId, leadId, name, email }: { actorId: string; leadId: string; name: string; email: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.INQUIRY_DELETE,
      description: `Deleted inquiry from ${name} (${email})`,
      details: { leadId, name, email },
    });
  })
);

// 8. Appointment Created Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_CREATED,
  safeListener(async ({ userId, appointmentId, propertyId, propertyName, name, date, time }: { userId: string; appointmentId: string; propertyId: string; propertyName: string; name: string; date: string; time: string }) => {
    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.APPOINTMENT_CREATE,
      description: `Scheduled viewing for property "${propertyName}" on ${date} at ${time}`,
      details: { appointmentId, propertyId, date, time },
    });

    await NotificationService.notifyAdmins({
      title: 'New Property Visit Scheduled',
      message: `${name} scheduled viewing of "${propertyName}" on ${date} at ${time}.`,
      type: NotificationType.APPOINTMENT,
      link: '/admin/appointments',
    });
  })
);

// 9. Appointment Updated Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_UPDATED,
  safeListener(async ({ actorId, targetUserId, appointmentId, propertyName, clientName, status, date, time }: { actorId: string; targetUserId: string; appointmentId: string; propertyName: string; clientName: string; status: string; date: string; time: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId,
      action: ActivityAction.APPOINTMENT_UPDATE,
      description: `Updated appointment status to ${status} for ${clientName} (Property: ${propertyName})`,
      details: { appointmentId, status, date, time },
    });

    // Notify client user
    let notifyMessage = '';
    if (status === 'APPROVED' || status === 'CONFIRMED') {
      notifyMessage = `Your private viewing of "${propertyName}" is confirmed for ${date} at ${time}.`;
    } else if (status === 'REJECTED' || status === 'CANCELLED') {
      notifyMessage = `Your private viewing request for "${propertyName}" has been declined or cancelled.`;
    } else if (status === 'RESCHEDULED') {
      notifyMessage = `Your private viewing of "${propertyName}" has been rescheduled to ${date} at ${time}.`;
    }

    if (notifyMessage) {
      await NotificationService.create({
        userId: targetUserId,
        title: `Property Viewing Update: ${status}`,
        message: notifyMessage,
        type: NotificationType.APPOINTMENT,
        link: '/dashboard',
      });
    }
  })
);

// 10. User Suspended Listener
eventEmitter.on(
  EVENTS.USER_SUSPENDED,
  safeListener(async ({ actorId, targetUserId, targetEmail }: { actorId: string; targetUserId: string; targetEmail: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId,
      action: ActivityAction.USER_SUSPEND,
      description: `Suspended user ${targetEmail}`,
      details: { targetEmail },
    });

    await NotificationService.create({
      userId: targetUserId,
      title: 'Security Alert: Account Suspended',
      message: 'Your AURA client account has been suspended by an administrator. Please contact concierge relations.',
      type: NotificationType.SECURITY,
    });
  })
);

// 11. User Restored Listener
eventEmitter.on(
  EVENTS.USER_RESTORED,
  safeListener(async ({ actorId, targetUserId, targetEmail }: { actorId: string; targetUserId: string; targetEmail: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId,
      action: ActivityAction.USER_RESTORE,
      description: `Restored user ${targetEmail}`,
      details: { targetEmail },
    });

    await NotificationService.create({
      userId: targetUserId,
      title: 'Account Access Restored',
      message: 'Your AURA client account has been successfully restored. You now have full platform privileges.',
      type: NotificationType.SECURITY,
    });
  })
);

// 12. Role Promoted Listener
eventEmitter.on(
  EVENTS.ROLE_PROMOTED,
  safeListener(async ({ actorId, targetUserId, targetEmail, previousRole }: { actorId: string; targetUserId: string; targetEmail: string; previousRole: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId,
      action: ActivityAction.ROLE_PROMOTE,
      description: `Promoted user ${targetEmail} to Admin`,
      details: { previousRole, newRole: 'ADMIN' },
    });

    await NotificationService.create({
      userId: targetUserId,
      title: 'Role Update: Promoted to Admin',
      message: 'You have been promoted to the system Administrator group. Please sign out and sign back in to apply privileges.',
      type: NotificationType.SECURITY,
    });
  })
);

// 13. Role Revoked Listener
eventEmitter.on(
  EVENTS.ROLE_REVOKED,
  safeListener(async ({ actorId, targetUserId, targetEmail, previousRole }: { actorId: string; targetUserId: string; targetEmail: string; previousRole: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId,
      action: ActivityAction.ROLE_REVOKE,
      description: `Revoked Admin role from ${targetEmail}`,
      details: { previousRole, newRole: 'USER' },
    });

    await NotificationService.create({
      userId: targetUserId,
      title: 'Role Update: Privileges Revoked',
      message: 'Your system administrator privileges have been revoked by an administrator.',
      type: NotificationType.SECURITY,
    });
  })
);

// 14. Password Reset Requested Listener
eventEmitter.on(
  EVENTS.PASSWORD_RESET_REQUESTED,
  safeListener(async ({ userId, email }: { userId: string; email: string }) => {
    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.PASSWORD_RESET_REQUEST,
      description: `Requested password reset link for user: ${email}`,
    });
  })
);

// 15. Password Reset Completed Listener
eventEmitter.on(
  EVENTS.PASSWORD_RESET_COMPLETED,
  safeListener(async ({ userId, email }: { userId: string; email: string }) => {
    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.PASSWORD_RESET_COMPLETE,
      description: `Successfully reset password for user: ${email}`,
    });
  })
);

// 16. Email Verified Listener
eventEmitter.on(
  EVENTS.EMAIL_VERIFIED,
  safeListener(async ({ userId, email }: { userId: string; email: string }) => {
    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.EMAIL_VERIFIED,
      description: `Email verified successfully for user: ${email}`,
    });
  })
);

// 17. Property Published Listener
eventEmitter.on(
  EVENTS.PROPERTY_PUBLISHED,
  safeListener(async ({ actorId, propertyId, propertyName }: { actorId: string; propertyId: string; propertyName: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.PROPERTY_PUBLISH,
      description: `Property "${propertyName}" was published successfully`,
      details: { propertyId, propertyName },
    });

    await NotificationService.notifyAdmins({
      title: 'Property Published',
      message: `Property "${propertyName}" has been published and is now live.`,
      type: NotificationType.PROPERTY,
      link: '/admin/properties',
    });
  })
);

// 18. Property Archived Listener
eventEmitter.on(
  EVENTS.PROPERTY_ARCHIVED,
  safeListener(async ({ actorId, propertyId, propertyName }: { actorId: string; propertyId: string; propertyName: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.PROPERTY_ARCHIVE,
      description: `Property "${propertyName}" was archived`,
      details: { propertyId, propertyName },
    });

    await NotificationService.notifyAdmins({
      title: 'Property Archived',
      message: `Property "${propertyName}" was archived by an administrator.`,
      type: NotificationType.PROPERTY,
      link: '/admin/properties',
    });
  })
);

// 19. Property Restored Listener
eventEmitter.on(
  EVENTS.PROPERTY_RESTORED,
  safeListener(async ({ actorId, propertyId, propertyName }: { actorId: string; propertyId: string; propertyName: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.PROPERTY_RESTORE,
      description: `Property "${propertyName}" was restored from archive`,
      details: { propertyId, propertyName },
    });

    await NotificationService.notifyAdmins({
      title: 'Property Restored',
      message: `Property "${propertyName}" was restored from archives to draft.`,
      type: NotificationType.PROPERTY,
      link: '/admin/properties',
    });
  })
);

// 20. Lead Created Listener
eventEmitter.on(
  EVENTS.LEAD_CREATED,
  safeListener(async ({ actorId, leadId, name, email, priority, source }: { actorId?: string | null; leadId: string; name: string; email: string; priority: string; source: string }) => {
    await ActivityService.log({
      actorId: actorId || null,
      action: ActivityAction.LEAD_CREATE,
      description: `New lead created for ${name} (${email})`,
      details: { leadId, priority, source },
    });

    await NotificationService.notifyAdmins({
      title: 'New Lead Registered',
      message: `Lead ${name} (${email}) has been registered via ${source}.`,
      type: NotificationType.INQUIRY,
      link: `/admin/leads/${leadId}`,
    });
  })
);

// 21. Lead Updated Listener
eventEmitter.on(
  EVENTS.LEAD_UPDATED,
  safeListener(async ({ actorId, leadId, name, details }: { actorId: string; leadId: string; name: string; details: any }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_UPDATE,
      description: `Updated lead details for ${name}`,
      details: { leadId, ...details },
    });
  })
);

// 22. Lead Assigned Listener
eventEmitter.on(
  EVENTS.LEAD_ASSIGNED,
  safeListener(async ({ actorId, leadId, name, assignedToId, assignedToName }: { actorId: string; leadId: string; name: string; assignedToId: string; assignedToName: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId: assignedToId,
      action: ActivityAction.LEAD_ASSIGN,
      description: `Assigned lead ${name} to admin ${assignedToName}`,
      details: { leadId },
    });

    await NotificationService.create({
      userId: assignedToId,
      title: 'New Lead Assigned',
      message: `You have been assigned to lead ${name}.`,
      type: NotificationType.USER_ACTION,
      link: `/admin/leads/${leadId}`,
    });
  })
);

// 23. Lead Reassigned Listener
eventEmitter.on(
  EVENTS.LEAD_REASSIGNED,
  safeListener(async ({ actorId, leadId, name, assignedToId, assignedToName, previousAdminName }: { actorId: string; leadId: string; name: string; assignedToId: string; assignedToName: string; previousAdminName?: string }) => {
    await ActivityService.log({
      actorId,
      targetUserId: assignedToId,
      action: ActivityAction.LEAD_REASSIGN,
      description: `Reassigned lead ${name} to admin ${assignedToName} (previously ${previousAdminName || 'unassigned'})`,
      details: { leadId },
    });

    await NotificationService.create({
      userId: assignedToId,
      title: 'Lead Reassigned to You',
      message: `Lead ${name} has been reassigned to you.`,
      type: NotificationType.USER_ACTION,
      link: `/admin/leads/${leadId}`,
    });
  })
);

// 24. Lead Status Changed Listener
eventEmitter.on(
  EVENTS.LEAD_STATUS_CHANGED,
  safeListener(async ({ actorId, leadId, name, email, fromStatus, toStatus }: { actorId: string; leadId: string; name: string; email: string; fromStatus: string; toStatus: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.LEAD_STATUS_CHANGE,
      description: `Status for lead ${name} changed from ${fromStatus} to ${toStatus}`,
      details: { leadId, fromStatus, toStatus },
    });

    // Notify registered client user if any
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await NotificationService.create({
        userId: user.id,
        title: 'Sales Inquiry Status Updated',
        message: `Your concierge relationship status is now: ${toStatus.replace('_', ' ')}.`,
        type: NotificationType.INQUIRY,
      });
    }
  })
);

// 25. Follow-Up Created Listener
eventEmitter.on(
  EVENTS.FOLLOW_UP_CREATED,
  safeListener(async ({ actorId, leadId, followUpId, title, assignedToId }: { actorId: string; leadId: string; followUpId: string; title: string; assignedToId?: string | null }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.FOLLOW_UP_CREATE,
      description: `Scheduled new follow-up task: "${title}"`,
      details: { leadId, followUpId },
    });

    if (assignedToId) {
      await NotificationService.create({
        userId: assignedToId,
        title: 'New Follow-Up Assigned',
        message: `You have been assigned to task "${title}".`,
        type: NotificationType.FOLLOW_UP_DUE,
        link: `/admin/leads/${leadId}`,
      });
    }
  })
);

// 26. Follow-Up Completed Listener
eventEmitter.on(
  EVENTS.FOLLOW_UP_COMPLETED,
  safeListener(async ({ actorId, leadId, followUpId, title, assignedToId }: { actorId: string; leadId: string; followUpId: string; title: string; assignedToId?: string | null }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.FOLLOW_UP_COMPLETE,
      description: `Completed follow-up task: "${title}"`,
      details: { leadId, followUpId },
    });

    if (assignedToId) {
      await NotificationService.create({
        userId: assignedToId,
        title: 'Follow-Up Task Completed',
        message: `Task "${title}" has been marked as completed.`,
        type: NotificationType.FOLLOW_UP_COMPLETED,
        link: `/admin/leads/${leadId}`,
      });
    }
  })
);

// 27. Follow-Up Overdue Listener
eventEmitter.on(
  EVENTS.FOLLOW_UP_OVERDUE,
  safeListener(async ({ leadId, followUpId, title, assignedToId }: { leadId: string; followUpId: string; title: string; assignedToId: string }) => {
    await ActivityService.log({
      actorId: null,
      targetUserId: assignedToId,
      action: ActivityAction.FOLLOW_UP_OVERDUE,
      description: `Follow-up task overdue: "${title}"`,
      details: { leadId, followUpId },
    });

    await NotificationService.create({
      userId: assignedToId,
      title: 'CRITICAL: Follow-Up Task Overdue',
      message: `The task "${title}" is past its due date.`,
      type: NotificationType.FOLLOW_UP_OVERDUE,
      link: `/admin/leads/${leadId}`,
    });
  })
);

// 28. Communication Logged Listener
eventEmitter.on(
  EVENTS.COMMUNICATION_LOGGED,
  safeListener(async ({ actorId, leadId, type, contentSummary }: { actorId: string; leadId: string; type: string; contentSummary: string }) => {
    await ActivityService.log({
      actorId,
      action: ActivityAction.COMMUNICATION_LOG,
      description: `Logged communication (${type}): ${contentSummary}`,
      details: { leadId, type },
    });
  })
);

// 29. Appointment Rescheduled Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_RESCHEDULED,
  safeListener(async ({ actorId, targetUserId, appointmentId, propertyName, clientName, status, date, time, reason }: { actorId: string; targetUserId: string; appointmentId: string; propertyName: string; clientName: string; status: string; date: string; time: string; reason: string }) => {
    if (targetUserId) {
      await NotificationService.create({
        userId: targetUserId,
        title: 'Property Viewing Rescheduled',
        message: `Your private viewing of "${propertyName}" has been rescheduled to ${date} at ${time}. Reason: ${reason}`,
        type: NotificationType.APPOINTMENT,
        link: '/dashboard',
      });
    }
  })
);

// 30. Appointment Cancelled Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_CANCELLED,
  safeListener(async ({ actorId, targetUserId, appointmentId, propertyName, clientName, status, reason }: { actorId: string; targetUserId: string; appointmentId: string; propertyName: string; clientName: string; status: string; reason: string }) => {
    if (targetUserId) {
      await NotificationService.create({
        userId: targetUserId,
        title: 'Property Viewing Cancelled',
        message: `Your private viewing request for "${propertyName}" has been cancelled. Reason: ${reason}`,
        type: NotificationType.APPOINTMENT,
        link: '/dashboard',
      });
    }
  })
);

// 31. Appointment Completed Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_COMPLETED,
  safeListener(async ({ actorId, targetUserId, appointmentId, propertyName, clientName, outcome }: { actorId: string; targetUserId: string; appointmentId: string; propertyName: string; clientName: string; outcome: string }) => {
    if (targetUserId) {
      await NotificationService.create({
        userId: targetUserId,
        title: 'Property Viewing Completed',
        message: `Thank you for attending the showing of "${propertyName}". Outcome: ${outcome.replace('_', ' ')}.`,
        type: NotificationType.APPOINTMENT,
        link: '/dashboard',
      });
    }
  })
);

// 32. Appointment Outcome Recorded Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_OUTCOME_RECORDED,
  safeListener(async ({ actorId, targetUserId, appointmentId, outcome, notes }: { actorId: string; targetUserId: string; appointmentId: string; outcome: string; notes?: string }) => {
    // Audit outcomes internally or notify admins if critical status was reached
  })
);

// 33. Appointment Reminder Sent Listener
eventEmitter.on(
  EVENTS.APPOINTMENT_REMINDER_SENT,
  safeListener(async ({ targetUserId, appointmentId, propertyName, clientName, date, time }: { targetUserId: string; appointmentId: string; propertyName: string; clientName: string; date: string; time: string }) => {
    await ActivityService.log({
      actorId: null,
      targetUserId,
      action: ActivityAction.APPOINTMENT_REMINDER,
      description: `Sent showing reminder to client ${clientName} for property "${propertyName}"`,
      details: { appointmentId, date, time },
    });

    await NotificationService.create({
      userId: targetUserId,
      title: 'Upcoming Property Viewing Reminder',
      message: `Friendly reminder: Your private viewing of "${propertyName}" is scheduled on ${date} at ${time}.`,
      type: NotificationType.APPOINTMENT,
      link: '/dashboard',
    });
  })
);

// 34. Follow-Up Auto Created Listener
eventEmitter.on(
  EVENTS.FOLLOW_UP_AUTO_CREATED,
  safeListener(async ({ leadId, followUpId, title, assignedToId }: { leadId: string; followUpId: string; title: string; assignedToId: string }) => {
    // Side effect for auto created follow-ups if any
  })
);

// 35. Admin Created/Promoted/Revoked/Suspended/Restored Listeners
eventEmitter.on(
  EVENTS.ADMIN_CREATED,
  safeListener(async ({ actorId, targetUserId, targetEmail }: any) => {
    // Already handled in routes, but can hook additional logging here
  })
);

// 36. Permission Granted / Revoked Listeners
eventEmitter.on(
  EVENTS.PERMISSION_GRANTED,
  safeListener(async ({ actorId, targetUserId, permissions }: any) => {
    // Hook additional notifications if desired
  })
);

// 37. Session Created Listener
eventEmitter.on(
  EVENTS.SESSION_CREATED,
  safeListener(async ({ userId, ipAddress, browser, device, operatingSystem, country, city }: any) => {
    await db.adminSession.create({
      data: {
        userId,
        ipAddress: ipAddress || '127.0.0.1',
        browser: browser || 'Chrome',
        device: device || 'Desktop',
        operatingSystem: operatingSystem || 'Windows',
        country: country || 'India',
        city: city || 'Lucknow',
        isActive: true,
      },
    });

    await ActivityService.log({
      actorId: userId,
      action: ActivityAction.SESSION_CREATED,
      description: `New administrator session created from IP ${ipAddress || '127.0.0.1'} (${city || 'Lucknow'})`,
      details: { ipAddress, browser, device, operatingSystem },
    });
  })
);

// 38. Session Terminated Listener
eventEmitter.on(
  EVENTS.SESSION_TERMINATED,
  safeListener(async ({ sessionId, actorId }: any) => {
    const session = await db.adminSession.findUnique({ where: { id: sessionId } });
    if (!session || !session.isActive) return;

    await db.$transaction(async (tx) => {
      await tx.adminSession.update({
        where: { id: sessionId },
        data: { isActive: false, logoutAt: new Date() },
      });

      await tx.activityLog.create({
        data: {
          actorId: actorId || session.userId,
          targetUserId: session.userId,
          action: 'SESSION_TERMINATED',
          description: `Administrator session ${sessionId} was force-terminated`,
          details: { sessionId },
        },
      });
    }, { maxWait: 10000, timeout: 30000 });
  })
);

// 39. Security Alert Created Listener
eventEmitter.on(
  EVENTS.SECURITY_ALERT_CREATED,
  safeListener(async ({ alertId, adminId, severity, description }: any) => {
    // Automatically log this as a critical system event
    await ActivityService.log({
      actorId: adminId || null,
      action: 'SECURITY_ALERT',
      description: `SECURITY ALERT [${severity}]: ${description}`,
      details: { alertId, severity },
    });
  })
);

// 40. Admin Review Created Listener
eventEmitter.on(
  EVENTS.ADMIN_REVIEW_CREATED,
  safeListener(async ({ actorId, targetUserId, rating }: any) => {
    // Log review activity
  })
);

