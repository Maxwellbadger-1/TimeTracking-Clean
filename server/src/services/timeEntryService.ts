import { db } from '../database/connection.js';
import type { TimeEntry, AbsenceRequest } from '../types/index.js';
import { updateAllOvertimeLevels } from './overtimeService.js';
import { validateTimeEntryArbZG } from './arbeitszeitgesetzService.js';
import logger from '../utils/logger.js';

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
export function validateTimeEntryData(
  data: {
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
  },
  options?: {
    allowFutureDates?: boolean;
  }
): { valid: boolean; error?: string } {
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

  // Check date is not in future (unless explicitly allowed for testing/admin)
  // In development mode, always allow future dates for testing
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (!options?.allowFutureDates && !isDevelopment) {
    const entryDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    if (entryDate > today) {
      return { valid: false, error: 'Cannot create time entries for future dates' };
    }
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

    let newStart = newStartH * 60 + newStartM;
    let newEnd = newEndH * 60 + newEndM;
    let existStart = existStartH * 60 + existStartM;
    let existEnd = existEndH * 60 + existEndM;

    // EDGE CASE: Handle overnight shifts (e.g., 22:00-02:00)
    // If end time < start time, it crosses midnight → add 24h (1440 min) to end time
    if (newEnd < newStart) {
      newEnd += 1440; // Overnight shift: 02:00 becomes 1440 + 120 = 1560 min
    }
    if (existEnd < existStart) {
      existEnd += 1440; // Existing overnight shift
    }

    // Check for overlap
    // Overlap if: (newStart < existEnd) AND (newEnd > existStart)
    if (newStart < existEnd && newEnd > existStart) {
      return true; // Overlap found
    }
  }

  return false; // No overlap
}

/**
 * Check if user has an approved absence on this date
 * Returns the absence if found, null otherwise
 */
export function checkAbsenceConflict(
  userId: number,
  date: string
): AbsenceRequest | null {
  const query = `
    SELECT *
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND date(?) BETWEEN date(startDate) AND date(endDate)
  `;

  const absence = db.prepare(query).get(userId, date) as AbsenceRequest | undefined;

  return absence || null;
}

interface PaginatedResult<T> {
  rows: T[];
  total: number;
  cursor: number | null;
  hasMore: boolean;
}

/**
 * Get all time entries (with optional user filter)
 * Includes user information (firstName, lastName, initials) via JOIN
 * @deprecated Use getTimeEntriesPaginated for better performance
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
 * Get paginated time entries with cursor-based pagination
 * Better performance for large datasets
 */
export function getTimeEntriesPaginated(options: {
  userId?: number;
  cursor?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): PaginatedResult<TimeEntry> {
  const limit = Math.min(options.limit || 50, 100); // Max 100 per page
  const cursor = options.cursor;

  // Build query
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

  // Filter by user
  if (options.userId) {
    query += ' AND te.userId = ?';
    params.push(options.userId);
  }

  // Filter by date range (default: last 30 days for admin, all for employees)
  if (options.startDate && options.endDate) {
    query += ' AND te.date >= ? AND te.date <= ?';
    params.push(options.startDate, options.endDate);
  } else if (!options.userId) {
    // Admin view without date range: default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];
    query += ' AND te.date >= ?';
    params.push(defaultStartDate);
  }

  // Cursor pagination
  if (cursor) {
    query += ' AND te.id < ?';
    params.push(cursor);
  }

  // Get total count (before pagination)
  const countQuery = query.replace(
    /SELECT[\s\S]*?FROM/,
    'SELECT COUNT(*) as count FROM'
  );
  const { count } = db.prepare(countQuery).get(...params) as { count: number };

  // Add pagination (order by date DESC, then id DESC for consistent ordering)
  query += ' ORDER BY te.date DESC, te.id DESC LIMIT ?';
  params.push(limit + 1); // Fetch one extra to check if there's more

  const rows = db.prepare(query).all(...params) as TimeEntry[];

  // Check if there are more results
  const hasMore = rows.length > limit;
  if (hasMore) {
    rows.pop(); // Remove the extra row
  }

  // Get next cursor (last row's id)
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;

  return {
    rows,
    total: count,
    cursor: hasMore ? nextCursor : null,
    hasMore,
  };
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
  // Get user data (needed for hire date check and admin role check)
  const user = db.prepare('SELECT hireDate, role FROM users WHERE id = ?').get(data.userId) as
    { hireDate: string; role: string } | undefined;
  if (!user) {
    throw new Error('User not found');
  }

  // Admins can create future dates (for testing purposes)
  const isAdmin = user.role === 'admin';

  // PERFORMANCE: Check hire date FIRST (fail fast on cheap validation)
  // Don't waste CPU on expensive validation if entry is before hire date
  if (data.date < user.hireDate) {
    throw new Error(`Zeiterfassung vor Eintrittsdatum (${user.hireDate}) nicht möglich. Keine Einträge vor Beschäftigungsbeginn erlaubt.`);
  }

  // Validate data (expensive validation after cheap checks)
  const validation = validateTimeEntryData(data, { allowFutureDates: isAdmin });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check for approved absence on this date
  const absence = checkAbsenceConflict(data.userId, data.date);
  if (absence) {
    const typeLabels: Record<string, string> = {
      vacation: 'Urlaub',
      sick: 'Krankmeldung',
      overtime_comp: 'Überstundenausgleich',
      unpaid: 'Unbezahlter Urlaub'
    };
    const typeLabel = typeLabels[absence.type] || absence.type;
    throw new Error(`An diesem Tag hast du ${typeLabel} (${absence.startDate} - ${absence.endDate}). Zeiterfassung nicht möglich.`);
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

  // ✅ ArbZG Validation (Arbeitszeitgesetz §3-5)
  logger.debug('🏛️ Running ArbZG validation for new time entry...');
  const arbzgValidation = validateTimeEntryArbZG({
    userId: data.userId,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    hours,
    breakMinutes: data.breakMinutes || 0,
  });

  if (!arbzgValidation.valid) {
    logger.warn({ errors: arbzgValidation.errors }, '❌ ArbZG Validation FAILED');
    // Throw first error (most critical)
    throw new Error(arbzgValidation.errors[0]);
  }

  if (arbzgValidation.warnings.length > 0) {
    logger.warn({ warnings: arbzgValidation.warnings }, '⚠️ ArbZG Warnings');
    // Warnings are logged but don't block creation
    // Frontend can check for warnings in response
  }

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

  // Update all 3 overtime levels (daily, weekly, monthly)
  updateAllOvertimeLevels(data.userId, data.date);

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
  logger.debug('🔥🔥🔥 UPDATE TIME ENTRY SERVICE CALLED 🔥🔥🔥');
  logger.debug({ id, data }, '📍 Update parameters');

  // Get existing entry
  logger.debug({ id }, '🔍 Fetching existing entry');
  const existing = getTimeEntryById(id);

  if (!existing) {
    logger.error({ id }, '❌ ENTRY NOT FOUND');
    throw new Error('Time entry not found');
  }

  logger.debug({ existing }, '✅ Existing entry found');

  // Merge data
  const merged = {
    date: data.date || existing.date,
    startTime: data.startTime || existing.startTime,
    endTime: data.endTime || existing.endTime,
    breakMinutes: data.breakMinutes ?? existing.breakMinutes,
  };

  logger.debug({ merged }, '🔄 Merged data');

  // Get user role (for future dates check)
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(existing.userId) as
    { role: string } | undefined;
  const isAdmin = user?.role === 'admin';

  // Validate merged data
  logger.debug('🔍 Validating merged data...');
  const validation = validateTimeEntryData(merged, { allowFutureDates: isAdmin });

  if (!validation.valid) {
    logger.error({ error: validation.error }, '❌ VALIDATION FAILED');
    throw new Error(validation.error);
  }

  logger.debug('✅ Validation passed');

  // Check for approved absence on this date
  logger.debug('🔍 Checking for absence conflicts...');
  const absence = checkAbsenceConflict(existing.userId, merged.date);
  if (absence) {
    const typeLabels: Record<string, string> = {
      vacation: 'Urlaub',
      sick: 'Krankmeldung',
      overtime_comp: 'Überstundenausgleich',
      unpaid: 'Unbezahlter Urlaub'
    };
    const typeLabel = typeLabels[absence.type] || absence.type;
    logger.error({ absence }, '❌ ABSENCE CONFLICT DETECTED');
    throw new Error(`An diesem Tag hast du ${typeLabel} (${absence.startDate} - ${absence.endDate}). Zeiterfassung nicht möglich.`);
  }

  // Check for overlaps (excluding this entry)
  logger.debug('🔍 Checking for overlaps...');
  const hasOverlap = checkOverlap(
    existing.userId,
    merged.date,
    merged.startTime,
    merged.endTime,
    id
  );

  if (hasOverlap) {
    logger.error('❌ OVERLAP DETECTED');
    throw new Error('Time entry overlaps with existing entry on this date');
  }

  logger.debug('✅ No overlap found');

  // Calculate new hours
  logger.debug('🔢 Calculating hours...');
  const hours = calculateHours(
    merged.startTime,
    merged.endTime,
    merged.breakMinutes
  );
  logger.debug({ hours }, '✅ Hours calculated');

  // ✅ ArbZG Validation (Arbeitszeitgesetz §3-5)
  logger.debug('🏛️ Running ArbZG validation for updated time entry...');
  const arbzgValidation = validateTimeEntryArbZG({
    userId: existing.userId,
    date: merged.date,
    startTime: merged.startTime,
    endTime: merged.endTime,
    hours,
    breakMinutes: merged.breakMinutes,
    excludeEntryId: id, // Exclude this entry from overlap checks
  });

  if (!arbzgValidation.valid) {
    logger.warn({ errors: arbzgValidation.errors }, '❌ ArbZG Validation FAILED');
    throw new Error(arbzgValidation.errors[0]);
  }

  if (arbzgValidation.warnings.length > 0) {
    logger.warn({ warnings: arbzgValidation.warnings }, '⚠️ ArbZG Warnings');
  }

  // Build update query
  logger.debug('🏗️ Building update query...');
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
  fields.push('updatedAt = datetime(\'now\')');

  // Add ID to params
  values.push(id);

  const query = `
    UPDATE time_entries
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  logger.debug({ query, values }, '📝 Final SQL query');

  logger.debug('💾 Executing UPDATE query...');
  const result = db.prepare(query).run(...values);
  logger.debug({ result }, '✅ Query executed');

  // Update all 3 overtime levels for old and new date (if date changed)
  logger.debug('🔄 Updating overtime levels...');

  try {
    updateAllOvertimeLevels(existing.userId, existing.date);
    logger.debug('✅ Old date overtime levels updated');

    if (existing.date !== merged.date) {
      updateAllOvertimeLevels(existing.userId, merged.date);
      logger.debug('✅ New date overtime levels updated');
    }
  } catch (balanceError) {
    logger.warn({ err: balanceError }, '⚠️ Error updating overtime levels (non-critical)');
    // Continue anyway - balance update is not critical
  }

  // Return updated entry
  logger.debug('🔍 Fetching updated entry...');
  const entry = getTimeEntryById(id);

  if (!entry) {
    logger.error('❌ FAILED TO RETRIEVE UPDATED ENTRY');
    throw new Error('Failed to update time entry');
  }

  logger.info({ id, entry }, '✅✅✅ UPDATE SUCCESSFUL');
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

  logger.info({ id, userId: entry.userId, date: entry.date }, '🗑️ Deleting time entry');

  // Delete entry
  const query = 'DELETE FROM time_entries WHERE id = ?';
  db.prepare(query).run(id);

  logger.info('✅ Time entry deleted from database');

  // Update all 3 overtime levels
  try {
    logger.debug({ userId: entry.userId, date: entry.date }, '🔄 Updating overtime levels');
    updateAllOvertimeLevels(entry.userId, entry.date);
    logger.debug('✅ Overtime levels updated successfully');
  } catch (error) {
    logger.error({ err: error }, '❌ Error updating overtime levels');
    // Don't throw - deletion was successful, just log the overtime update error
  }
}

/**
 * Update overtime balance for a user and month
 */
export function updateOvertimeBalance(userId: number, month: string): void {
  try {
    // Get user's weekly hours
    const user = db
      .prepare('SELECT weeklyHours FROM users WHERE id = ?')
      .get(userId) as { weeklyHours: number } | undefined;

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    logger.debug({ weeklyHours: user.weeklyHours }, '👤 User weekly hours');

    // Calculate target hours for the month
    // Method: (weeklyHours / 7) * days in month
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const targetHours = Math.round(((user.weeklyHours / 7) * daysInMonth) * 100) / 100;

    logger.debug({ year, monthNum, daysInMonth, targetHours }, '📊 Target hours calculation');

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

    logger.debug({ actualHours }, '📊 Actual hours');

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

    logger.debug('✅ Overtime balance upserted successfully');
  } catch (error) {
    logger.error({ err: error, userId, month }, '❌ updateOvertimeBalance error');
    throw error;
  }
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
