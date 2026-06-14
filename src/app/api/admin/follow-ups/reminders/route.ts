import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { NotificationService } from '@/lib/notification';
import { eventEmitter, EVENTS } from '@/lib/events';
import { NotificationType } from '@prisma/client';

export async function POST() {
  try {
    const openFollowUps = await db.followUp.findMany({
      where: { completed: false },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    const now = new Date();
    
    // Start/End of Today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Start/End of Tomorrow
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);

    let todayReminded = 0;
    let tomorrowReminded = 0;
    let overdueReminded = 0;

    for (const task of openFollowUps) {
      if (!task.assignedToId) continue;

      const dueDate = new Date(task.dueDate);
      const isDueToday = dueDate >= todayStart && dueDate <= todayEnd;
      const isDueTomorrow = dueDate >= tomorrowStart && dueDate <= tomorrowEnd;
      const isOverdue = dueDate < todayStart;

      let notificationType: NotificationType | null = null;
      let title = '';
      let message = '';
      let reminderKey = '';

      if (isDueToday) {
        notificationType = NotificationType.FOLLOW_UP_DUE;
        title = 'Task Due Today';
        message = `Task "${task.title}" is due today.`;
        reminderKey = 'today';
      } else if (isDueTomorrow) {
        notificationType = NotificationType.FOLLOW_UP_DUE;
        title = 'Task Due Tomorrow';
        message = `Reminder: Task "${task.title}" is due tomorrow.`;
        reminderKey = 'tomorrow';
      } else if (isOverdue) {
        notificationType = NotificationType.FOLLOW_UP_OVERDUE;
        title = 'Task Overdue';
        message = `CRITICAL: Task "${task.title}" is OVERDUE!`;
        reminderKey = 'overdue';
      }

      if (notificationType && reminderKey) {
        // Enforce idempotency: check if an identical notification was already sent
        const uniqueLink = `/admin/leads/${task.leadId}?task=${task.id}&remind=${reminderKey}`;
        
        const alreadyNotified = await db.notification.findFirst({
          where: {
            userId: task.assignedToId,
            link: uniqueLink,
            type: notificationType,
          },
        });

        if (!alreadyNotified) {
          await NotificationService.create({
            userId: task.assignedToId,
            title,
            message,
            type: notificationType,
            link: uniqueLink,
          });

          if (isDueToday) todayReminded++;
          if (isDueTomorrow) tomorrowReminded++;
          
          if (isOverdue) {
            overdueReminded++;
            // Emit follow up overdue event
            eventEmitter.emit(EVENTS.FOLLOW_UP_OVERDUE, {
              leadId: task.leadId,
              followUpId: task.id,
              title: task.title,
              assignedToId: task.assignedToId,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: openFollowUps.length,
      sent: {
        dueToday: todayReminded,
        dueTomorrow: tomorrowReminded,
        overdue: overdueReminded,
      },
    });
  } catch (error) {
    console.error('Reminder Engine error:', error);
    return NextResponse.json({ error: 'Reminder Engine execution failed' }, { status: 500 });
  }
}
