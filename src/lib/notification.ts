import { db } from './db';
import { NotificationType } from '@prisma/client';

export interface NotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
}

type NotificationListener = (notification: any) => void;
const listeners = new Set<NotificationListener>();

export const NotificationService = {
  /**
   * Subscribes a listener to new notifications (used for future SSE/WebSocket push).
   */
  subscribe(listener: NotificationListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Decoupled Delivery Layer: Dispatches notification to real-time subscribers.
   */
  deliver(notification: any) {
    listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.error('[NotificationService] Error executing listener callback during delivery:', err);
      }
    });
  },

  /**
   * Creates an in-app notification in the database and triggers the delivery layer.
   */
  async create({ userId, title, message, type, link }: NotificationParams) {
    try {
      // 1. Database Creation (source of truth)
      const notification = await db.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          link: link || null,
          read: false,
        },
      });

      // 2. Decoupled Delivery
      this.deliver(notification);

      return notification;
    } catch (error) {
      console.error('[NotificationService.create] Failed to create notification:', error);
      return null;
    }
  },

  /**
   * Bulk Notification Optimization: Broadcasts a notification to all active, non-deleted admins in a single bulk query.
   */
  async notifyAdmins({
    title,
    message,
    type,
    link,
  }: Omit<NotificationParams, 'userId'>) {
    try {
      // Find all active, non-deleted admin IDs
      const admins = await db.user.findMany({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });

      if (admins.length === 0) return [];

      const payload = admins.map((admin) => ({
        userId: admin.id,
        title,
        message,
        type,
        link: link || null,
        read: false,
      }));

      // 1. Bulk DB Insert
      await db.notification.createMany({
        data: payload,
      });

      // 2. Query the inserted records to fetch their actual generated IDs and details for real-time delivery
      const inserted = await db.notification.findMany({
        where: {
          userId: { in: admins.map((a) => a.id) },
          title,
          message,
          type,
          read: false,
        },
        orderBy: { createdAt: 'desc' },
        take: admins.length,
      });

      // 3. Deliver individually to active real-time subscribers
      inserted.forEach((notification) => {
        this.deliver(notification);
      });

      return inserted;
    } catch (error) {
      console.error('[NotificationService.notifyAdmins] Bulk notifications trigger failed:', error);
      return [];
    }
  },

  /**
   * Retrieves the count of unread notifications for a specific user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await db.notification.count({
        where: {
          userId,
          read: false,
        },
      });
    } catch (error) {
      console.error('[NotificationService.getUnreadCount] Failed:', error);
      return 0;
    }
  },

  /**
   * Retrieves notifications for a specific user.
   */
  async getUserNotifications(userId: string, limit = 20, skip = 0) {
    try {
      return await db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      });
    } catch (error) {
      console.error('[NotificationService.getUserNotifications] Failed:', error);
      return [];
    }
  },

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(notificationId: string, userId: string) {
    try {
      return await db.notification.update({
        where: {
          id: notificationId,
          userId, // Ensure the notification belongs to the calling user
        },
        data: { read: true },
      });
    } catch (error) {
      console.error('[NotificationService.markAsRead] Failed:', error);
      return null;
    }
  },

  /**
   * Marks all notifications for a specific user as read.
   */
  async markAllAsRead(userId: string) {
    try {
      return await db.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: { read: true },
      });
    } catch (error) {
      console.error('[NotificationService.markAllAsRead] Failed:', error);
      return null;
    }
  },
};
