/**
 * Desktop Notifications Hook
 * Monitors database notifications and triggers native desktop notifications
 */

import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types';

export function useDesktopNotifications(userId: number | undefined) {
  const { data: notifications } = useNotifications(userId!);
  const previousNotifications = useRef<Notification[]>([]);

  useEffect(() => {
    if (!userId || !notifications) {
      return;
    }

    // Get IDs of previous notifications
    const previousIds = new Set(previousNotifications.current.map((n) => n.id));

    // Find NEW notifications (not in previous set)
    const newNotifications = notifications.filter((n) => !previousIds.has(n.id) && !n.isRead);

    // Send desktop notification for each new notification
    newNotifications.forEach((notification) => {
      sendDesktopNotification(notification);
    });

    // Update ref for next comparison
    previousNotifications.current = notifications;
  }, [notifications, userId]);
}

/**
 * Send desktop notification based on notification type
 */
function sendDesktopNotification(notification: Notification): void {
  const { type, title, message } = notification;

  // Map database notification types to notification service types
  switch (type) {
    case 'absence_approved':
      notificationService.send({
        title: '✅ ' + title,
        body: message || '',
      });
      break;

    case 'absence_rejected':
      notificationService.send({
        title: '❌ ' + title,
        body: message || '',
      });
      break;

    case 'absence_cancelled':
      notificationService.send({
        title: '⚠️ ' + title,
        body: message || '',
      });
      break;

    case 'overtime_warning':
      notificationService.send({
        title: '⚠️ ' + title,
        body: message || '',
      });
      break;

    default:
      // Generic notification
      notificationService.send({
        title: title,
        body: message || '',
      });
      break;
  }
}
