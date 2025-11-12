import { db } from '../database/connection.js';
import type { AbsenceRequest } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Absence Service
 * Business Logic for Absence Management (Vacation, Sick Leave, etc.)
 */

interface AbsenceRequestCreateInput {
  userId: number;
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  startDate: string;
  endDate: string;
  reason?: string;
}

interface AbsenceRequestUpdateInput {
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
}

interface VacationBalance {
  id: number;
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
  taken: number;
  remaining: number;
}

/**
 * Calculate number of business days between two dates (excluding weekends)
 */
export function calculateBusinessDays(startDate: string, endDate: string): number {
  logger.debug('🔥🔥🔥 CALCULATE BUSINESS DAYS DEBUG 🔥🔥🔥');
  logger.debug({ startDate, endDate }, '📥 Input dates');

  // Parse dates in local timezone (YYYY-MM-DD → local Date object)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  logger.debug({ startYear, startMonth, startDay }, '📊 Parsed Start');
  logger.debug({ endYear, endMonth, endDay }, '📊 Parsed End');

  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  logger.debug({ startDate: start.toString() }, '📅 Start Date Object');
  logger.debug({ endDate: end.toString() }, '📅 End Date Object');
  logger.debug('📅 Start Day of Week: ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][start.getDay()]);
  logger.debug('📅 End Day of Week: ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][end.getDay()]);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;
    logger.debug(`  📆 ${current.toISOString().split('T')[0]} = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]} → ${isWeekday ? '✅ COUNT' : '❌ SKIP (weekend)'}`);

    // 0 = Sunday, 6 = Saturday
    if (isWeekday) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  logger.debug({ count }, '📊 TOTAL BUSINESS DAYS');
  logger.debug('🔥🔥🔥 END CALCULATE BUSINESS DAYS 🔥🔥🔥');
  return count;
}

/**
 * Check if date is a holiday
 */
export function isHoliday(date: string): boolean {
  const query = 'SELECT id FROM holidays WHERE date = ?';
  const result = db.prepare(query).get(date);
  return !!result;
}

/**
 * Calculate vacation days (business days - holidays)
 */
export function calculateVacationDays(startDate: string, endDate: string): number {
  logger.debug('🔥🔥🔥 CALCULATE VACATION DAYS DEBUG 🔥🔥🔥');
  logger.debug({ startDate, endDate }, '📥 Input dates');

  // Parse dates in local timezone (YYYY-MM-DD → local Date object)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  logger.debug({ startYear, startMonth, startDay }, '📊 Parsed Start');
  logger.debug({ endYear, endMonth, endDay }, '📊 Parsed End');

  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  logger.debug({ startDate: start.toString() }, '📅 Start Date Object');
  logger.debug({ endDate: end.toString() }, '📅 End Date Object');
  logger.debug('📅 Start Day of Week: ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][start.getDay()]);
  logger.debug('📅 End Day of Week: ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][end.getDay()]);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Format back to YYYY-MM-DD for holiday check
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHol = isHoliday(dateStr);
    const shouldCount = !isWeekend && !isHol;

    logger.debug(`  📆 ${dateStr} = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]} → ${isWeekend ? '❌ SKIP (weekend)' : isHol ? '❌ SKIP (holiday)' : '✅ COUNT'}`);

    // Only count weekdays that are not holidays
    if (shouldCount) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  logger.debug({ count }, '📊 TOTAL VACATION DAYS');
  logger.debug('🔥🔥🔥 END CALCULATE VACATION DAYS 🔥🔥🔥');
  return count;
}

/**
 * Validate absence request dates
 */
export function validateAbsenceDates(data: {
  startDate: string;
  endDate: string;
}): { valid: boolean; error?: string } {
  // Date format validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.startDate)) {
    return { valid: false, error: 'Invalid start date format (use YYYY-MM-DD)' };
  }
  if (!dateRegex.test(data.endDate)) {
    return { valid: false, error: 'Invalid end date format (use YYYY-MM-DD)' };
  }

  // Parse dates
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  // Check start date is not before end date
  if (startDate > endDate) {
    return { valid: false, error: 'End date must be after start date' };
  }

  return { valid: true };
}

/**
 * Check if there are any overlapping absences for this user
 * Returns conflicting absence if found, null otherwise
 */
export function checkOverlappingAbsence(
  userId: number,
  startDate: string,
  endDate: string,
  excludeId?: number
): AbsenceRequest | null {
  const query = `
    SELECT *
    FROM absence_requests
    WHERE userId = ?
      AND id != ?
      AND status IN ('approved', 'pending')
      AND (
        (date(startDate) <= date(?) AND date(endDate) >= date(?))
        OR (date(startDate) <= date(?) AND date(endDate) >= date(?))
        OR (date(startDate) >= date(?) AND date(endDate) <= date(?))
      )
  `;

  const absence = db.prepare(query).get(
    userId,
    excludeId || 0,
    startDate, startDate,
    endDate, endDate,
    startDate, endDate
  ) as AbsenceRequest | undefined;

  return absence || null;
}

/**
 * Check if there are any time entries in the absence period
 * Returns { hasEntries: boolean, totalHours: number, dates: string[] }
 */
export function checkTimeEntriesInPeriod(
  userId: number,
  startDate: string,
  endDate: string
): { hasEntries: boolean; totalHours: number; dates: string[] } {
  const query = `
    SELECT date, SUM(hours) as hours
    FROM time_entries
    WHERE userId = ?
      AND date(date) BETWEEN date(?) AND date(?)
    GROUP BY date
  `;

  const entries = db.prepare(query).all(userId, startDate, endDate) as Array<{
    date: string;
    hours: number;
  }>;

  if (entries.length === 0) {
    return { hasEntries: false, totalHours: 0, dates: [] };
  }

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const dates = entries.map(e => e.date);

  return { hasEntries: true, totalHours, dates };
}

/**
 * Check if user has enough vacation days
 */
export function hasEnoughVacationDays(
  userId: number,
  year: number,
  requestedDays: number
): boolean {
  logger.debug('🔥🔥🔥 hasEnoughVacationDays DEBUG 🔥🔥🔥');
  logger.debug({ userId, year, requestedDays }, '📌 Input parameters');

  let balance = getVacationBalance(userId, year);
  logger.debug({ balance }, '📊 balance from DB');

  // Auto-initialize if not exists
  if (!balance) {
    logger.warn('⚠️ NO VACATION BALANCE FOUND - Auto-initializing...');
    try {
      balance = initializeVacationBalance(userId, year);
      logger.info({ balance }, '✅ Vacation balance initialized');
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to initialize vacation balance');
      return false;
    }
  }

  logger.debug({ remaining: balance.remaining, requestedDays, hasEnough: balance.remaining >= requestedDays }, '📊 Comparison');
  logger.debug('🔥🔥🔥 END hasEnoughVacationDays DEBUG 🔥🔥🔥');

  return balance.remaining >= requestedDays;
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
 * Get all absence requests (with optional filters)
 * Includes user information (firstName, lastName, initials) via JOIN
 * @deprecated Use getAbsenceRequestsPaginated for better performance
 */
export function getAllAbsenceRequests(filters?: {
  userId?: number;
  status?: string;
  type?: string;
}): AbsenceRequest[] {
  let query = `
    SELECT
      ar.*,
      u.firstName,
      u.lastName,
      u.email,
      SUBSTR(u.firstName, 1, 1) || SUBSTR(u.lastName, 1, 1) as userInitials
    FROM absence_requests ar
    LEFT JOIN users u ON ar.userId = u.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.userId) {
    query += ' AND ar.userId = ?';
    params.push(filters.userId);
  }

  if (filters?.status) {
    query += ' AND ar.status = ?';
    params.push(filters.status);
  }

  if (filters?.type) {
    query += ' AND ar.type = ?';
    params.push(filters.type);
  }

  query += ' ORDER BY ar.createdAt DESC';

  return db.prepare(query).all(...params) as AbsenceRequest[];
}

/**
 * Get paginated absence requests with offset-based pagination
 * Better performance for large datasets
 */
export function getAbsenceRequestsPaginated(options: {
  userId?: number;
  status?: string;
  type?: string;
  year?: number;
  page?: number;
  limit?: number;
}): PaginatedResult<AbsenceRequest> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 30, 100); // Max 100 per page
  const offset = (page - 1) * limit;

  // Build query
  let query = `
    SELECT
      ar.*,
      u.firstName,
      u.lastName,
      u.email,
      SUBSTR(u.firstName, 1, 1) || SUBSTR(u.lastName, 1, 1) as userInitials
    FROM absence_requests ar
    LEFT JOIN users u ON ar.userId = u.id
    WHERE 1=1
  `;

  const params: unknown[] = [];

  // Filter by user
  if (options.userId) {
    query += ' AND ar.userId = ?';
    params.push(options.userId);
  }

  // Filter by status
  if (options.status) {
    query += ' AND ar.status = ?';
    params.push(options.status);
  }

  // Filter by type
  if (options.type) {
    query += ' AND ar.type = ?';
    params.push(options.type);
  }

  // Filter by year (default: current year for admin, all for employees)
  if (options.year) {
    query += ' AND (strftime(\'%Y\', ar.startDate) = ? OR strftime(\'%Y\', ar.endDate) = ?)';
    params.push(options.year.toString(), options.year.toString());
  } else if (!options.userId) {
    // Admin view without year: default to current year
    const currentYear = new Date().getFullYear();
    query += ' AND (strftime(\'%Y\', ar.startDate) = ? OR strftime(\'%Y\', ar.endDate) = ?)';
    params.push(currentYear.toString(), currentYear.toString());
  }

  // Get total count (before pagination)
  const countQuery = query.replace(
    /SELECT[\s\S]*?FROM/,
    'SELECT COUNT(*) as count FROM'
  );
  const { count } = db.prepare(countQuery).get(...params) as { count: number };

  // Add pagination
  query += ' ORDER BY ar.createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as AbsenceRequest[];

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
 * Get absence request by ID
 */
export function getAbsenceRequestById(id: number): AbsenceRequest | null {
  const query = 'SELECT * FROM absence_requests WHERE id = ?';
  const request = db.prepare(query).get(id) as AbsenceRequest | undefined;
  return request || null;
}

/**
 * Create new absence request
 */
export function createAbsenceRequest(
  data: AbsenceRequestCreateInput
): AbsenceRequest {
  logger.debug('🚀🚀🚀 CREATE ABSENCE REQUEST DEBUG 🚀🚀🚀');
  logger.debug({ data }, '📥 Input data');

  // Validate dates
  const validation = validateAbsenceDates(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Calculate days
  let days: number;
  if (data.type === 'vacation' || data.type === 'overtime_comp') {
    logger.debug('📊 Calculating VACATION days (excludes weekends + holidays)...');
    // Exclude weekends and holidays
    days = calculateVacationDays(data.startDate, data.endDate);
  } else {
    logger.debug('📊 Calculating BUSINESS days (excludes weekends only)...');
    // Sick leave and unpaid: count business days only (exclude weekends)
    days = calculateBusinessDays(data.startDate, data.endDate);
  }

  logger.debug({ days }, '📊 CALCULATED DAYS');

  if (days <= 0) {
    logger.error('❌ DAYS <= 0! Throwing error...');
    throw new Error('Absence request must span at least one business day');
  }

  // Check for overlapping absences
  logger.debug('🔍 Checking for overlapping absences...');
  const overlappingAbsence = checkOverlappingAbsence(data.userId, data.startDate, data.endDate);
  logger.debug({ hasOverlap: !!overlappingAbsence }, '📊 Overlapping absence check');
  if (overlappingAbsence) {
    const typeLabels: Record<string, string> = {
      vacation: 'Urlaub',
      sick: 'Krankmeldung',
      overtime_comp: 'Überstundenausgleich',
      unpaid: 'Unbezahlter Urlaub'
    };
    const typeLabel = typeLabels[overlappingAbsence.type] || overlappingAbsence.type;
    const statusLabel = overlappingAbsence.status === 'approved' ? 'genehmigter' : 'beantragter';
    throw new Error(
      `Überschneidung mit ${statusLabel} ${typeLabel} (${overlappingAbsence.startDate} - ${overlappingAbsence.endDate}). Bitte anderen Zeitraum wählen.`
    );
  }

  // Check for existing time entries in this period
  const timeEntriesCheck = checkTimeEntriesInPeriod(data.userId, data.startDate, data.endDate);
  if (timeEntriesCheck.hasEntries) {
    logger.error({ totalHours: timeEntriesCheck.totalHours, dates: timeEntriesCheck.dates }, `❌ User has time entries in absence period`);

    // Format dates for display
    const formattedDates = timeEntriesCheck.dates
      .map(d => {
        const [year, month, day] = d.split('-');
        return `${day}.${month}.${year}`;
      })
      .join(', ');

    throw new Error(
      `In diesem Zeitraum existieren bereits Zeiterfassungen (${timeEntriesCheck.totalHours}h an folgenden Tagen: ${formattedDates}). Bitte zuerst die Zeiterfassungen löschen.`
    );
  }

  // For vacation: check if user has enough days
  if (data.type === 'vacation') {
    const year = parseInt(data.startDate.substring(0, 4));
    if (!hasEnoughVacationDays(data.userId, year, days)) {
      throw new Error('Insufficient vacation days remaining');
    }
  }

  // For overtime compensation: check if user has enough overtime
  if (data.type === 'overtime_comp') {
    logger.debug('🔥🔥🔥 OVERTIME COMP VALIDATION DEBUG 🔥🔥🔥');
    logger.debug({ userId: data.userId, days }, '📌 Parameters');

    const overtimeHours = getTotalOvertimeHours(data.userId);
    logger.debug({ overtimeHours }, '📊 overtimeHours from getTotalOvertimeHours()');

    const requiredHours = days * 8; // Assume 8h per day
    logger.debug({ overtimeHours, requiredHours, hasEnough: overtimeHours >= requiredHours }, '📊 Comparison');
    logger.debug('🔥🔥🔥 END OVERTIME COMP VALIDATION 🔥🔥🔥');

    if (overtimeHours < requiredHours) {
      throw new Error(
        `Insufficient overtime hours (need ${requiredHours}h, have ${overtimeHours}h)`
      );
    }
  }

  // Set initial status: sick leave is auto-approved, others are pending
  const status = data.type === 'sick' ? 'approved' : 'pending';

  // Insert request
  const query = `
    INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const result = db
    .prepare(query)
    .run(
      data.userId,
      data.type,
      data.startDate,
      data.endDate,
      days,
      status,
      data.reason || null
    );

  // If auto-approved (sick), update balances immediately
  if (status === 'approved') {
    updateBalancesAfterApproval(result.lastInsertRowid as number);
  }

  // Return created request
  const request = getAbsenceRequestById(result.lastInsertRowid as number);
  if (!request) {
    throw new Error('Failed to create absence request');
  }

  return request;
}

/**
 * Update absence request
 */
export function updateAbsenceRequest(
  id: number,
  data: AbsenceRequestUpdateInput
): AbsenceRequest {
  const existing = getAbsenceRequestById(id);
  if (!existing) {
    throw new Error('Absence request not found');
  }

  // Cannot modify approved/rejected requests (except admin note)
  if (
    existing.status !== 'pending' &&
    (data.startDate || data.endDate || data.reason)
  ) {
    throw new Error('Cannot modify approved or rejected absence request');
  }

  // If dates changed, recalculate days
  let days = existing.days;
  if (data.startDate || data.endDate) {
    const startDate = data.startDate || existing.startDate;
    const endDate = data.endDate || existing.endDate;

    // Validate new dates
    const validation = validateAbsenceDates({ startDate, endDate });
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Recalculate days
    if (existing.type === 'vacation' || existing.type === 'overtime_comp') {
      days = calculateVacationDays(startDate, endDate);
    } else {
      days = calculateBusinessDays(startDate, endDate);
    }
  }

  // Build update query
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.startDate !== undefined) {
    fields.push('startDate = ?');
    values.push(data.startDate);
  }
  if (data.endDate !== undefined) {
    fields.push('endDate = ?');
    values.push(data.endDate);
  }
  if (data.reason !== undefined) {
    fields.push('reason = ?');
    values.push(data.reason || null);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }
  if (data.adminNote !== undefined) {
    fields.push('adminNote = ?');
    values.push(data.adminNote || null);
  }
  if (days !== existing.days) {
    fields.push('days = ?');
    values.push(days);
  }

  values.push(id);

  const query = `
    UPDATE absence_requests
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  db.prepare(query).run(...values);

  // Return updated request
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Failed to update absence request');
  }

  return request;
}

/**
 * Approve absence request
 */
export function approveAbsenceRequest(
  id: number,
  approvedBy: number,
  adminNote?: string
): AbsenceRequest {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be approved');
  }

  // Update request status
  const query = `
    UPDATE absence_requests
    SET status = 'approved', approvedBy = ?, approvedAt = datetime('now'), adminNote = ?
    WHERE id = ?
  `;

  db.prepare(query).run(approvedBy, adminNote || null, id);

  // Update balances
  updateBalancesAfterApproval(id);

  // Return updated request
  const updated = getAbsenceRequestById(id);
  if (!updated) {
    throw new Error('Failed to approve absence request');
  }

  return updated;
}

/**
 * Reject absence request
 */
export function rejectAbsenceRequest(
  id: number,
  approvedBy: number,
  adminNote?: string
): AbsenceRequest {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be rejected');
  }

  // Update request status
  const query = `
    UPDATE absence_requests
    SET status = 'rejected', approvedBy = ?, approvedAt = datetime('now'), adminNote = ?
    WHERE id = ?
  `;

  db.prepare(query).run(approvedBy, adminNote || null, id);

  // Return updated request
  const updated = getAbsenceRequestById(id);
  if (!updated) {
    throw new Error('Failed to reject absence request');
  }

  return updated;
}

/**
 * Delete absence request
 */
export function deleteAbsenceRequest(id: number): void {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  // If approved, need to revert balance changes
  if (request.status === 'approved') {
    revertBalancesAfterDeletion(id);
  }

  const query = 'DELETE FROM absence_requests WHERE id = ?';
  db.prepare(query).run(id);
}

/**
 * Update balances after approval (vacation balance, overtime, sick leave time entries)
 */
function updateBalancesAfterApproval(requestId: number): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) {
    throw new Error('Absence request not found');
  }

  const year = parseInt(request.startDate.substring(0, 4));

  if (request.type === 'vacation') {
    // Deduct from vacation balance
    updateVacationTaken(request.userId, year, request.days);
  } else if (request.type === 'overtime_comp') {
    // Deduct from overtime balance
    const hoursToDeduct = request.days * 8; // 8 hours per day
    deductOvertimeHours(request.userId, hoursToDeduct);
  }
  // Note: Sick days don't need any balance updates here
  // The overtime calculation in ReportsPage.tsx handles absence credits automatically
}

// REMOVED: createSickLeaveTimeEntries function
// Old implementation created automatic time_entries for sick days
// This is WRONG per Best Practice (Personio, DATEV, SAP)
// Sick days should ONLY exist in absence_requests table
// Overtime calculation now handles absence credits directly in ReportsPage.tsx

/**
 * Revert balance changes after deletion
 */
function revertBalancesAfterDeletion(requestId: number): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) return;

  const year = parseInt(request.startDate.substring(0, 4));

  if (request.type === 'vacation') {
    // Add back to vacation balance
    updateVacationTaken(request.userId, year, -request.days);
  } else if (request.type === 'overtime_comp') {
    // Add back to overtime balance
    const hoursToAdd = request.days * 8;
    deductOvertimeHours(request.userId, -hoursToAdd);
  } else if (request.type === 'sick') {
    // Delete automatic time entries for sick days
    deleteSickLeaveTimeEntries(request);
  }
}

/**
 * Delete automatic time entries for sick leave days
 */
function deleteSickLeaveTimeEntries(request: AbsenceRequest): void {
  logger.debug('🗑️ Deleting time entries for sick leave');
  logger.debug({ requestId: request.id, userId: request.userId, startDate: request.startDate, endDate: request.endDate }, 'Sick leave details');

  // Delete all time entries that were auto-created for this sick leave
  const deleteQuery = `
    DELETE FROM time_entries
    WHERE userId = ?
      AND date >= date(?)
      AND date <= date(?)
      AND activity = 'Krankheit'
      AND notes LIKE ?
  `;

  const result = db.prepare(deleteQuery).run(
    request.userId,
    request.startDate,
    request.endDate,
    `%Krankmeldung #${request.id}%`
  );

  logger.info({ deletedEntries: result.changes }, '✅ Sick leave time entries deleted');

  // Update overtime calculations for all affected dates
  const [startYear, startMonth, startDay] = request.startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = request.endDate.split('-').map(Number);

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;

    if (isWeekday) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      try {
        const { updateAllOvertimeLevels } = require('./overtimeService.js');
        updateAllOvertimeLevels(request.userId, dateStr);
      } catch (error) {
        logger.error({ error, date: dateStr }, 'Failed to update overtime after sick leave deletion');
      }
    }

    current.setDate(current.getDate() + 1);
  }
}

/**
 * Get vacation balance for a user and year
 */
export function getVacationBalance(
  userId: number,
  year: number
): VacationBalance | null {
  const query = `
    SELECT * FROM vacation_balance
    WHERE userId = ? AND year = ?
  `;

  const balance = db.prepare(query).get(userId, year) as
    | VacationBalance
    | undefined;

  return balance || null;
}

/**
 * Initialize vacation balance for a user and year
 */
export function initializeVacationBalance(
  userId: number,
  year: number
): VacationBalance {
  // Get user's vacation entitlement
  const user = db
    .prepare('SELECT vacationDaysPerYear FROM users WHERE id = ?')
    .get(userId) as { vacationDaysPerYear: number } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Check if previous year balance exists for carryover
  const previousYear = year - 1;
  const previousBalance = getVacationBalance(userId, previousYear);
  const carryover =
    previousBalance && previousBalance.remaining > 0
      ? Math.min(previousBalance.remaining, 5) // Max 5 days carryover
      : 0;

  // Insert or update balance
  const query = `
    INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(userId, year)
    DO UPDATE SET entitlement = ?, carryover = ?
  `;

  db.prepare(query).run(
    userId,
    year,
    user.vacationDaysPerYear,
    carryover,
    user.vacationDaysPerYear,
    carryover
  );

  const balance = getVacationBalance(userId, year);
  if (!balance) {
    throw new Error('Failed to initialize vacation balance');
  }

  return balance;
}

/**
 * Update vacation taken days
 */
function updateVacationTaken(userId: number, year: number, days: number): void {
  // Ensure balance exists
  let balance = getVacationBalance(userId, year);
  if (!balance) {
    balance = initializeVacationBalance(userId, year);
  }

  const query = `
    UPDATE vacation_balance
    SET taken = taken + ?
    WHERE userId = ? AND year = ?
  `;

  db.prepare(query).run(days, userId, year);
}

/**
 * Get total overtime hours for a user (with hireDate filtering)
 */
function getTotalOvertimeHours(userId: number): number {
  logger.debug('🔍 getTotalOvertimeHours - START');
  logger.debug({ userId }, 'userId');

  // Get user's hireDate
  const user = db
    .prepare('SELECT hireDate FROM users WHERE id = ?')
    .get(userId) as { hireDate: string } | undefined;

  const hireDate = user?.hireDate || '1900-01-01';
  logger.debug({ hireDate }, 'hireDate');

  const query = `
    SELECT COALESCE(SUM(overtime), 0) as total
    FROM overtime_balance
    WHERE userId = ? AND month >= strftime('%Y-%m', ?)
  `;

  logger.debug({ query, params: [userId, hireDate] }, 'SQL');

  const result = db.prepare(query).get(userId, hireDate) as { total: number };
  logger.debug({ result }, 'Result');
  logger.debug({ total: result.total }, '🔍 getTotalOvertimeHours - END, returning');

  return result.total;
}

/**
 * Deduct overtime hours
 */
function deductOvertimeHours(userId: number, hours: number): void {
  // Get all overtime balances for user, ordered by month
  const query = `
    SELECT * FROM overtime_balance
    WHERE userId = ? AND overtime > 0
    ORDER BY month ASC
  `;

  const balances = db.prepare(query).all(userId) as Array<{
    id: number;
    month: string;
    overtime: number;
  }>;

  let remainingHours = hours;

  // Deduct from oldest months first (FIFO)
  for (const balance of balances) {
    if (remainingHours <= 0) break;

    const toDeduct = Math.min(remainingHours, balance.overtime);

    // We need to reduce actualHours in the overtime_balance table
    // Since overtime is a VIRTUAL column (actualHours - targetHours),
    // we need to update actualHours
    const updateQuery = `
      UPDATE overtime_balance
      SET actualHours = actualHours - ?
      WHERE id = ?
    `;

    db.prepare(updateQuery).run(toDeduct, balance.id);

    remainingHours -= toDeduct;
  }
}
