import { db } from '../database/connection.js';

/**
 * Notification Service
 * Create and manage user notifications
 */

interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string | null;
  read: number;
  createdAt: string;
}

/**
 * Create a notification for a user
 */
export function createNotification(
  userId: number,
  type: string,
  title: string,
  message?: string
): Notification {
  const query = `
    INSERT INTO notifications (userId, type, title, message)
    VALUES (?, ?, ?, ?)
  `;

  const result = db
    .prepare(query)
    .run(userId, type, title, message || null);

  const notification = getNotificationById(result.lastInsertRowid as number);
  if (!notification) {
    throw new Error('Failed to create notification');
  }

  return notification;
}

/**
 * Get notification by ID
 */
export function getNotificationById(id: number): Notification | null {
  const query = 'SELECT * FROM notifications WHERE id = ?';
  const notification = db.prepare(query).get(id) as Notification | undefined;
  return notification || null;
}

/**
 * Get all notifications for a user
 */
export function getUserNotifications(
  userId: number,
  unreadOnly = false
): Notification[] {
  let query = 'SELECT * FROM notifications WHERE userId = ?';

  if (unreadOnly) {
    query += ' AND read = 0';
  }

  query += ' ORDER BY createdAt DESC';

  return db.prepare(query).all(userId) as Notification[];
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(id: number): void {
  const query = 'UPDATE notifications SET read = 1 WHERE id = ?';
  db.prepare(query).run(id);
}

/**
 * Mark all notifications as read for a user
 */
export function markAllNotificationsAsRead(userId: number): void {
  const query = 'UPDATE notifications SET read = 1 WHERE userId = ? AND read = 0';
  db.prepare(query).run(userId);
}

/**
 * Delete notification
 */
export function deleteNotification(id: number): void {
  const query = 'DELETE FROM notifications WHERE id = ?';
  db.prepare(query).run(id);
}

/**
 * Get unread notification count for a user
 */
export function getUnreadNotificationCount(userId: number): number {
  const query = `
    SELECT COUNT(*) as count
    FROM notifications
    WHERE userId = ? AND read = 0
  `;

  const result = db.prepare(query).get(userId) as { count: number };
  return result.count;
}

/**
 * Notification helpers for specific events
 */

export function notifyAbsenceApproved(
  userId: number,
  absenceType: string,
  startDate: string,
  endDate: string
): void {
  const typeLabel =
    absenceType === 'vacation'
      ? 'Urlaub'
      : absenceType === 'sick'
      ? 'Krankmeldung'
      : absenceType === 'overtime_comp'
      ? 'Überstundenausgleich'
      : 'Abwesenheit';

  createNotification(
    userId,
    'absence_approved',
    `${typeLabel} genehmigt`,
    `Ihr ${typeLabel} vom ${startDate} bis ${endDate} wurde genehmigt.`
  );
}

export function notifyAbsenceRejected(
  userId: number,
  absenceType: string,
  startDate: string,
  endDate: string,
  reason?: string
): void {
  const typeLabel =
    absenceType === 'vacation'
      ? 'Urlaub'
      : absenceType === 'sick'
      ? 'Krankmeldung'
      : absenceType === 'overtime_comp'
      ? 'Überstundenausgleich'
      : 'Abwesenheit';

  let message = `Ihr ${typeLabel} vom ${startDate} bis ${endDate} wurde abgelehnt.`;
  if (reason) {
    message += ` Grund: ${reason}`;
  }

  createNotification(userId, 'absence_rejected', `${typeLabel} abgelehnt`, message);
}

export function notifyTimeEntryEdited(
  userId: number,
  date: string,
  editedBy: string
): void {
  createNotification(
    userId,
    'time_edited',
    'Zeiterfassung bearbeitet',
    `Ihre Zeiterfassung für ${date} wurde von ${editedBy} bearbeitet.`
  );
}
