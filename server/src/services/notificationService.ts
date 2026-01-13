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

interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
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
 * Get all notifications for a user (non-paginated)
 * @deprecated Use getUserNotificationsPaginated for better performance
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
 * Get paginated notifications for a user
 */
export function getUserNotificationsPaginated(
  userId: number,
  options: { unreadOnly?: boolean; page?: number; limit?: number }
): PaginatedResult<Notification> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100); // Max 100 per page
  const offset = (page - 1) * limit;

  // Build query
  let query = 'SELECT * FROM notifications WHERE userId = ?';
  const params: any[] = [userId];

  if (options.unreadOnly) {
    query += ' AND read = 0';
  }

  // Get total count
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const { count } = db.prepare(countQuery).get(...params) as { count: number };

  // Add pagination
  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as Notification[];

  return {
    rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    hasMore: page * limit < count,
  };
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(id: number): void {
  const query = 'UPDATE notifications SET read = 1 WHERE id = ?';
  db.prepare(query).run(id);
}

/**
 * Mark notification as unread
 */
export function markNotificationAsUnread(id: number): void {
  const query = 'UPDATE notifications SET read = 0 WHERE id = ?';
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

export function notifyAbsenceCancelled(
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

  let message = `Ihr genehmigter ${typeLabel} vom ${startDate} bis ${endDate} wurde vom Administrator storniert.`;
  if (reason) {
    message += ` Grund: ${reason}`;
  }

  createNotification(userId, 'absence_cancelled', `${typeLabel} storniert`, message);
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

export function notifyAbsenceRequested(
  employeeName: string,
  absenceType: string,
  startDate: string,
  endDate: string,
  days: number
): void {
  const typeLabel =
    absenceType === 'vacation'
      ? 'Urlaub'
      : absenceType === 'sick'
      ? 'Krankmeldung'
      : absenceType === 'overtime_comp'
      ? 'Überstundenausgleich'
      : 'Abwesenheit';

  // Get all admin users
  const admins = db
    .prepare('SELECT id FROM users WHERE role = ? AND deletedAt IS NULL')
    .all('admin') as Array<{ id: number }>;

  // Send notification to each admin
  admins.forEach((admin) => {
    createNotification(
      admin.id,
      'absence_requested',
      `Neuer ${typeLabel}-Antrag`,
      `${employeeName} hat einen ${typeLabel} vom ${startDate} bis ${endDate} (${days} Tage) beantragt.`
    );
  });
}

// ==================== HIGH PRIORITY ====================

/**
 * Notify employee when admin edits their time entry
 */
export function notifyTimeEntryEditedByAdmin(
  userId: number,
  date: string,
  adminName: string,
  reason?: string
): void {
  let message = `Ihre Zeiterfassung für ${date} wurde von ${adminName} bearbeitet.`;
  if (reason) {
    message += ` Grund: ${reason}`;
  }
  createNotification(userId, 'time_edited_by_admin', 'Zeiterfassung bearbeitet', message);
}

/**
 * Notify employee when admin deletes their time entry
 */
export function notifyTimeEntryDeleted(
  userId: number,
  date: string,
  adminName: string,
  reason?: string
): void {
  let message = `Ihre Zeiterfassung für ${date} wurde von ${adminName} gelöscht.`;
  if (reason) {
    message += ` Grund: ${reason}`;
  }
  createNotification(userId, 'time_entry_deleted', 'Zeiterfassung gelöscht', message);
}

/**
 * Notify employee when vacation days are manually adjusted
 */
export function notifyVacationDaysAdjusted(
  userId: number,
  oldDays: number,
  newDays: number,
  reason?: string
): void {
  const diff = newDays - oldDays;
  const diffText = diff > 0 ? `+${diff}` : `${diff}`;

  let message = `Ihre Urlaubstage wurden von ${oldDays} auf ${newDays} Tage angepasst (${diffText}).`;
  if (reason) {
    message += ` Grund: ${reason}`;
  }
  createNotification(userId, 'vacation_days_adjusted', 'Urlaubstage angepasst', message);
}

/**
 * Notify employee when their account is deactivated
 */
export function notifyUserDeactivated(userId: number): void {
  createNotification(
    userId,
    'account_deactivated',
    'Account deaktiviert',
    'Ihr Account wurde vom Administrator deaktiviert. Bitte kontaktieren Sie Ihren Vorgesetzten.'
  );
}

// ==================== MEDIUM PRIORITY ====================

/**
 * Notify employee when overtime threshold is reached
 */
export function notifyOvertimeThreshold(
  userId: number,
  currentOvertime: number,
  threshold: number
): void {
  const hours = Math.abs(currentOvertime);
  const type = currentOvertime >= 0 ? 'positive' : 'negative';

  createNotification(
    userId,
    'overtime_threshold',
    'Überstunden-Schwellenwert erreicht',
    `Sie haben aktuell ${hours.toFixed(1)}h ${type} Überstunden (Schwellenwert: ${threshold}h).`
  );
}

/**
 * Notify admin when employee has significant negative overtime
 */
export function notifyNegativeOvertimeAlert(
  employeeName: string,
  currentOvertime: number,
  threshold: number
): void {
  const hours = Math.abs(currentOvertime);

  // Get all admin users
  const admins = db
    .prepare('SELECT id FROM users WHERE role = ? AND deletedAt IS NULL')
    .all('admin') as Array<{ id: number }>;

  admins.forEach((admin) => {
    createNotification(
      admin.id,
      'negative_overtime_alert',
      'Negative Überstunden Warnung',
      `${employeeName} hat aktuell -${hours.toFixed(1)}h Überstunden (Schwellenwert: ${threshold}h).`
    );
  });
}

/**
 * Notify employee when target hours are changed
 */
export function notifyTargetHoursChanged(
  userId: number,
  oldHours: number,
  newHours: number
): void {
  createNotification(
    userId,
    'target_hours_changed',
    'Soll-Stunden geändert',
    `Ihre Soll-Stunden wurden von ${oldHours}h auf ${newHours}h pro Woche angepasst.`
  );
}

/**
 * Notify employee when vacation days are running low
 */
export function notifyVacationDaysLow(
  userId: number,
  remainingDays: number,
  threshold: number = 5
): void {
  if (remainingDays <= threshold && remainingDays > 0) {
    createNotification(
      userId,
      'vacation_days_low',
      'Urlaubstage werden knapp',
      `Sie haben nur noch ${remainingDays} Urlaubstage übrig.`
    );
  }
}

// ==================== LOW PRIORITY ====================

/**
 * Send welcome notification to new user
 */
export function notifyUserCreated(
  userId: number,
  firstName: string
): void {
  createNotification(
    userId,
    'user_created',
    'Willkommen!',
    `Hallo ${firstName}! Ihr Account wurde erfolgreich erstellt. Viel Erfolg mit dem TimeTracking System!`
  );
}

/**
 * Notify about missed clock-in (if user was supposed to work)
 */
export function notifyMissedClockIn(
  userId: number,
  date: string,
  expectedTime: string
): void {
  createNotification(
    userId,
    'missed_clock_in',
    'Einstempeln vergessen?',
    `Sie haben am ${date} um ${expectedTime} nicht eingestempelt. Bitte tragen Sie Ihre Arbeitszeit nach.`
  );
}

/**
 * Notify admin about missed clock-in
 */
export function notifyAdminMissedClockIn(
  employeeName: string,
  date: string
): void {
  const admins = db
    .prepare('SELECT id FROM users WHERE role = ? AND deletedAt IS NULL')
    .all('admin') as Array<{ id: number }>;

  admins.forEach((admin) => {
    createNotification(
      admin.id,
      'employee_missed_clock_in',
      'Mitarbeiter: Einstempeln vergessen',
      `${employeeName} hat am ${date} nicht eingestempelt.`
    );
  });
}

/**
 * Notify about break time violation (German law: 30min after 6h, 45min after 9h)
 */
export function notifyBreakTimeViolation(
  userId: number,
  date: string,
  workedHours: number,
  requiredBreak: number
): void {
  createNotification(
    userId,
    'break_time_violation',
    'Pausenzeit-Verstoß',
    `Am ${date} haben Sie ${workedHours}h ohne ausreichende Pause (${requiredBreak}min erforderlich) gearbeitet.`
  );
}

/**
 * Notify admin about employee weekly overtime limit exceeded
 */
export function notifyWeeklyOvertimeLimitExceeded(
  employeeName: string,
  weeklyHours: number,
  limit: number = 48
): void {
  const admins = db
    .prepare('SELECT id FROM users WHERE role = ? AND deletedAt IS NULL')
    .all('admin') as Array<{ id: number }>;

  admins.forEach((admin) => {
    createNotification(
      admin.id,
      'weekly_overtime_limit_exceeded',
      'Wöchentliche Arbeitszeitgrenze überschritten',
      `${employeeName} hat diese Woche ${weeklyHours}h gearbeitet (Limit: ${limit}h).`
    );
  });
}

/**
 * Notify employee when time entries were automatically deleted due to approved absence
 * AUTO-DELETE NOTIFICATION (STRICT MODE)
 */
export function notifyTimeEntriesDeletedDueToAbsence(
  userId: number,
  absenceType: string,
  startDate: string,
  endDate: string,
  deletedCount: number,
  totalHours: number
): void {
  const typeLabels: Record<string, string> = {
    vacation: 'Urlaub',
    sick: 'Krankmeldung',
    overtime_comp: 'Überstundenausgleich',
    unpaid: 'Unbezahlter Urlaub',
  };
  const typeLabel = typeLabels[absenceType] || absenceType;

  // Format hours (e.g., "8.5h" => "8:30h")
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  const hoursFormatted = `${hours}:${String(minutes).padStart(2, '0')}h`;

  const message =
    `Dein ${typeLabel}-Antrag für ${startDate} bis ${endDate} wurde genehmigt. ` +
    `${deletedCount} Zeiterfassung(en) (${hoursFormatted}) wurden automatisch gelöscht, ` +
    `da Abwesenheiten Vorrang haben. Deine Überstunden wurden entsprechend angepasst.`;

  createNotification(
    userId,
    'time_entries_deleted_due_to_absence',
    'Zeiterfassungen automatisch gelöscht',
    message
  );
}
