import { db } from '../database/connection.js';
import type { TimeEntry } from '../types/index.js';

/**
 * Time Entry Service
 * Business Logic for Time Tracking
 */

interface TimeEntryCreateInput {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  activity?: string;
  project?: string;
  location: 'office' | 'homeoffice' | 'field';
  notes?: string;
}

interface TimeEntryUpdateInput {
  date?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  activity?: string;
  project?: string;
  location?: 'office' | 'homeoffice' | 'field';
  notes?: string;
}

/**
 * Calculate working hours from start/end time and breaks
 */
export function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  // Parse times (format: HH:MM)
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Convert to minutes since midnight
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Calculate gross time in minutes
  let grossMinutes = endMinutes - startMinutes;

  // Handle overnight shifts (e.g., 22:00 to 06:00)
  if (grossMinutes < 0) {
    grossMinutes += 24 * 60;
  }

  // Subtract break
  const netMinutes = grossMinutes - (breakMinutes || 0);

  // Convert to hours (rounded to 2 decimals)
  const hours = Math.round((netMinutes / 60) * 100) / 100;

  return hours;
}

/**
 * Validate time entry data
 */
export function validateTimeEntryData(data: {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}): { valid: boolean; error?: string } {
  // Check date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    return { valid: false, error: 'Invalid date format (use YYYY-MM-DD)' };
  }

  // Check time format (HH:MM)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(data.startTime)) {
    return { valid: false, error: 'Invalid start time format (use HH:MM)' };
  }
  if (!timeRegex.test(data.endTime)) {
    return { valid: false, error: 'Invalid end time format (use HH:MM)' };
  }

  // Check date is not in future
  const entryDate = new Date(data.date);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  if (entryDate > today) {
    return { valid: false, error: 'Cannot create time entries for future dates' };
  }

  // Check break minutes
  const breakMinutes = data.breakMinutes || 0;
  if (breakMinutes < 0) {
    return { valid: false, error: 'Break minutes cannot be negative' };
  }

  // Calculate hours and validate
  const hours = calculateHours(data.startTime, data.endTime, breakMinutes);

  if (hours <= 0) {
    return { valid: false, error: 'End time must be after start time' };
  }

  if (hours > 16) {
    return {
      valid: false,
      error: 'Working time cannot exceed 16 hours per day (including breaks)',
    };
  }

  // Automatic break rule: > 6 hours requires at least 30 min break
  const grossHours = calculateHours(data.startTime, data.endTime, 0);
  if (grossHours > 6 && breakMinutes < 30) {
    return {
      valid: false,
      error: 'Working time over 6 hours requires at least 30 minutes break',
    };
  }

  return { valid: true };
}

/**
 * Check if time entry overlaps with existing entries
 */
export function checkOverlap(
  userId: number,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: number
): boolean {
  const query = `
    SELECT id, startTime, endTime
    FROM time_entries
    WHERE userId = ? AND date = ? AND id != ?
  `;

  const entries = db
    .prepare(query)
    .all(userId, date, excludeId || 0) as Array<{
    id: number;
    startTime: string;
    endTime: string;
  }>;

  for (const entry of entries) {
    // Convert times to minutes for comparison
    const [newStartH, newStartM] = startTime.split(':').map(Number);
    const [newEndH, newEndM] = endTime.split(':').map(Number);
    const [existStartH, existStartM] = entry.startTime.split(':').map(Number);
    const [existEndH, existEndM] = entry.endTime.split(':').map(Number);

    const newStart = newStartH * 60 + newStartM;
    const newEnd = newEndH * 60 + newEndM;
    const existStart = existStartH * 60 + existStartM;
    const existEnd = existEndH * 60 + existEndM;

    // Check for overlap
    // Overlap if: (newStart < existEnd) AND (newEnd > existStart)
    if (newStart < existEnd && newEnd > existStart) {
      return true; // Overlap found
    }
  }

  return false; // No overlap
}

/**
 * Get all time entries (with optional user filter)
 * Includes user information (firstName, lastName, initials) via JOIN
 */
export function getAllTimeEntries(userId?: number): TimeEntry[] {
  let query = `
    SELECT
      te.*,
      u.firstName,
      u.lastName,
      u.email,
      SUBSTR(u.firstName, 1, 1) || SUBSTR(u.lastName, 1, 1) as userInitials
    FROM time_entries te
    LEFT JOIN users u ON te.userId = u.id
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (userId) {
    query += ' AND te.userId = ?';
    params.push(userId);
  }

  query += ' ORDER BY te.date DESC, te.startTime DESC';

  return db.prepare(query).all(...params) as TimeEntry[];
}

/**
 * Get time entries by date range
 * Includes user information (firstName, lastName, initials) via JOIN
 */
export function getTimeEntriesByDate(
  userId: number,
  startDate: string,
  endDate: string
): TimeEntry[] {
  const query = `
    SELECT
      te.*,
      u.firstName,
      u.lastName,
      u.email,
      SUBSTR(u.firstName, 1, 1) || SUBSTR(u.lastName, 1, 1) as userInitials
    FROM time_entries te
    LEFT JOIN users u ON te.userId = u.id
    WHERE te.userId = ? AND te.date >= ? AND te.date <= ?
    ORDER BY te.date ASC, te.startTime ASC
  `;

  return db.prepare(query).all(userId, startDate, endDate) as TimeEntry[];
}

/**
 * Get single time entry by ID
 */
export function getTimeEntryById(id: number): TimeEntry | null {
  const query = 'SELECT * FROM time_entries WHERE id = ?';
  const entry = db.prepare(query).get(id) as TimeEntry | undefined;
  return entry || null;
}

/**
 * Create new time entry
 */
export function createTimeEntry(data: TimeEntryCreateInput): TimeEntry {
  // Validate data
  const validation = validateTimeEntryData(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check for overlaps
  const hasOverlap = checkOverlap(data.userId, data.date, data.startTime, data.endTime);
  if (hasOverlap) {
    throw new Error('Time entry overlaps with existing entry on this date');
  }

  // Calculate hours
  const hours = calculateHours(
    data.startTime,
    data.endTime,
    data.breakMinutes || 0
  );

  // Insert entry
  const query = `
    INSERT INTO time_entries (
      userId, date, startTime, endTime, breakMinutes, hours,
      activity, project, location, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = db
    .prepare(query)
    .run(
      data.userId,
      data.date,
      data.startTime,
      data.endTime,
      data.breakMinutes || 0,
      hours,
      data.activity || null,
      data.project || null,
      data.location,
      data.notes || null
    );

  // Update overtime balance for this month
  const month = data.date.substring(0, 7); // YYYY-MM
  updateOvertimeBalance(data.userId, month);

  // Return created entry
  const entry = getTimeEntryById(result.lastInsertRowid as number);
  if (!entry) {
    throw new Error('Failed to create time entry');
  }

  return entry;
}

/**
 * Update existing time entry
 */
export function updateTimeEntry(
  id: number,
  data: TimeEntryUpdateInput
): TimeEntry {
  // Get existing entry
  const existing = getTimeEntryById(id);
  if (!existing) {
    throw new Error('Time entry not found');
  }

  // Merge data
  const merged = {
    date: data.date || existing.date,
    startTime: data.startTime || existing.startTime,
    endTime: data.endTime || existing.endTime,
    breakMinutes: data.breakMinutes ?? existing.breakMinutes,
  };

  // Validate merged data
  const validation = validateTimeEntryData(merged);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check for overlaps (excluding this entry)
  const hasOverlap = checkOverlap(
    existing.userId,
    merged.date,
    merged.startTime,
    merged.endTime,
    id
  );
  if (hasOverlap) {
    throw new Error('Time entry overlaps with existing entry on this date');
  }

  // Calculate new hours
  const hours = calculateHours(
    merged.startTime,
    merged.endTime,
    merged.breakMinutes
  );

  // Build update query
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.date !== undefined) {
    fields.push('date = ?');
    values.push(data.date);
  }
  if (data.startTime !== undefined) {
    fields.push('startTime = ?');
    values.push(data.startTime);
  }
  if (data.endTime !== undefined) {
    fields.push('endTime = ?');
    values.push(data.endTime);
  }
  if (data.breakMinutes !== undefined) {
    fields.push('breakMinutes = ?');
    values.push(data.breakMinutes);
  }
  if (data.activity !== undefined) {
    fields.push('activity = ?');
    values.push(data.activity || null);
  }
  if (data.project !== undefined) {
    fields.push('project = ?');
    values.push(data.project || null);
  }
  if (data.location !== undefined) {
    fields.push('location = ?');
    values.push(data.location);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes || null);
  }

  // Always update hours and updatedAt
  fields.push('hours = ?');
  values.push(hours);
  fields.push('updatedAt = datetime("now")');

  // Add ID to params
  values.push(id);

  const query = `
    UPDATE time_entries
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  db.prepare(query).run(...values);

  // Update overtime balance for old and new month (if date changed)
  const oldMonth = existing.date.substring(0, 7);
  const newMonth = merged.date.substring(0, 7);
  updateOvertimeBalance(existing.userId, oldMonth);
  if (oldMonth !== newMonth) {
    updateOvertimeBalance(existing.userId, newMonth);
  }

  // Return updated entry
  const entry = getTimeEntryById(id);
  if (!entry) {
    throw new Error('Failed to update time entry');
  }

  return entry;
}

/**
 * Delete time entry (soft delete)
 */
export function deleteTimeEntry(id: number): void {
  const entry = getTimeEntryById(id);
  if (!entry) {
    throw new Error('Time entry not found');
  }

  // Delete entry
  const query = 'DELETE FROM time_entries WHERE id = ?';
  db.prepare(query).run(id);

  // Update overtime balance for this month
  const month = entry.date.substring(0, 7);
  updateOvertimeBalance(entry.userId, month);
}

/**
 * Update overtime balance for a user and month
 */
export function updateOvertimeBalance(userId: number, month: string): void {
  // Get user's weekly hours
  const user = db
    .prepare('SELECT weeklyHours FROM users WHERE id = ?')
    .get(userId) as { weeklyHours: number } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate target hours for the month
  // Method: (weeklyHours / 7) * days in month
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const targetHours = Math.round(((user.weeklyHours / 7) * daysInMonth) * 100) / 100;

  // Calculate actual hours for the month
  const actualHoursResult = db
    .prepare(
      `
      SELECT COALESCE(SUM(hours), 0) as total
      FROM time_entries
      WHERE userId = ? AND date LIKE ?
    `
    )
    .get(userId, `${month}%`) as { total: number };

  const actualHours = actualHoursResult.total;

  // Upsert overtime_balance
  const upsertQuery = `
    INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, month)
    DO UPDATE SET targetHours = ?, actualHours = ?
  `;

  db.prepare(upsertQuery).run(
    userId,
    month,
    targetHours,
    actualHours,
    targetHours,
    actualHours
  );
}

/**
 * Get overtime balance for a user and month
 */
export function getOvertimeBalance(
  userId: number,
  month: string
): { targetHours: number; actualHours: number; overtime: number } | null {
  const query = `
    SELECT targetHours, actualHours, overtime
    FROM overtime_balance
    WHERE userId = ? AND month = ?
  `;

  const result = db.prepare(query).get(userId, month) as
    | { targetHours: number; actualHours: number; overtime: number }
    | undefined;

  return result || null;
}
