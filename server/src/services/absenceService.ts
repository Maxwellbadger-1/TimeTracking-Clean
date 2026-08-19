import { db } from '../database/connection.js';
import type { AbsenceRequest } from '../types/index.js';
import logger from '../utils/logger.js';
import { countWorkingDaysBetween, countWorkingDaysForUser, getDailyTargetHours, getDayName, calculateAbsenceHoursWithWorkSchedule } from '../utils/workingDays.js';
import { validateDateString } from '../utils/validation.js';
import { getUserById } from './userService.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
import { broadcastEvent } from '../websocket/server.js';
import { formatDate } from '../utils/timezone.js';
import { recordVacationTransaction } from './vacationTransactionService.js';

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
  pending: number;
  remaining: number;
}

/**
 * Calculate number of business days between two dates (excluding weekends)
 * DEPRECATED: Use countWorkingDaysBetween() from workingDays.ts instead
 * This function is kept for backwards compatibility but delegates to the canonical implementation
 */
export function calculateBusinessDays(startDate: string, endDate: string): number {
  logger.debug('🔥🔥🔥 CALCULATE BUSINESS DAYS DEBUG 🔥🔥🔥');
  logger.debug({ startDate, endDate }, '📥 Input dates');

  // IMPORTANT: Delegate to countWorkingDaysBetween (SSOT)
  // This ensures consistent holiday exclusion across the entire system
  const count = countWorkingDaysBetween(startDate, endDate);

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
 * DEPRECATED: Use countWorkingDaysBetween() from workingDays.ts instead
 * This function is kept for backwards compatibility but delegates to the canonical implementation
 */
export function calculateVacationDays(startDate: string, endDate: string): number {
  // SECURITY: Validate date strings to prevent SQL injection and data corruption
  validateDateString(startDate, 'startDate');
  validateDateString(endDate, 'endDate');

  logger.debug('🔥🔥🔥 CALCULATE VACATION DAYS DEBUG 🔥🔥🔥');
  logger.debug({ startDate, endDate }, '📥 Input dates');

  // IMPORTANT: Delegate to countWorkingDaysBetween (SSOT)
  // This ensures consistent holiday exclusion across the entire system
  const count = countWorkingDaysBetween(startDate, endDate);

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
  // SIMPLIFIED OVERLAP LOGIC (Standard interval overlap formula)
  // Two intervals [A_start, A_end] and [B_start, B_end] overlap if:
  //   A_start <= B_end AND A_end >= B_start
  // This handles ALL cases: partial overlap, full overlap, and containment
  const query = `
    SELECT *
    FROM absence_requests
    WHERE userId = ?
      AND id != ?
      AND status IN ('approved', 'pending')
      AND date(startDate) <= date(?)
      AND date(endDate) >= date(?)
  `;

  const absence = db.prepare(query).get(
    userId,
    excludeId || 0,
    endDate,      // existing.startDate <= new.endDate
    startDate     // existing.endDate >= new.startDate
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
    WHERE u.deletedAt IS NULL
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
  month?: number;  // Optional: filter by specific month (1-12)
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
    WHERE u.deletedAt IS NULL
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

  // Filter by month (optional drill-down within year)
  if (options.month) {
    const monthKey = `${options.year || new Date().getFullYear()}-${String(options.month).padStart(2, '0')}`;
    query += ' AND (ar.startDate LIKE ? OR ar.endDate LIKE ?)';
    params.push(`${monthKey}%`, `${monthKey}%`);
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

  // ✅ Enrich each absence with calculated hours (Single Source of Truth!)
  const enrichedRows = rows.map(absence => {
    try {
      const user = getUserById(absence.userId);
      if (!user) return absence;

      // Calculate REAL hours based on workSchedule/weeklyHours
      const calculatedHours = calculateAbsenceHoursWithWorkSchedule(
        absence.startDate,
        absence.endDate,
        user.workSchedule,
        user.weeklyHours
      );

      return {
        ...absence,
        calculatedHours,  // ✅ ECHTE Stunden!
      };
    } catch (error) {
      logger.error({ error }, `Failed to calculate hours for absence ${absence.id}:`);
      return absence;  // Return without calculatedHours on error
    }
  });

  return {
    rows: enrichedRows,
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
  try {
    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 1: Function entry with input data
    // ============================================================================
    logger.info('🚀🚀🚀 createAbsenceRequest() CALLED 🚀🚀🚀');
    logger.info({ data }, '📥 Input data');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 2: User lookup
    // ============================================================================
    logger.info({ userId: data.userId }, '🔍 Looking up user in database...');
    const user = db.prepare('SELECT hireDate, weeklyHours, workSchedule FROM users WHERE id = ?').get(data.userId) as
      { hireDate: string; weeklyHours: number; workSchedule: string | null } | undefined;

    if (!user) {
      logger.error({ userId: data.userId }, '❌ User not found in database');
      throw new Error('User not found');
    }
    logger.info({
      userId: data.userId,
      hireDate: user.hireDate,
      weeklyHours: user.weeklyHours,
      workSchedule: user.workSchedule,
    }, '✅ User found');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 3: Hire date validation
    // ============================================================================
    logger.info({
      startDate: data.startDate,
      hireDate: user.hireDate,
      isBeforeHireDate: data.startDate < user.hireDate,
    }, '🔍 Checking hire date constraint...');
    if (data.startDate < user.hireDate) {
      logger.error({ startDate: data.startDate, hireDate: user.hireDate }, '❌ Start date before hire date');
      throw new Error(`Abwesenheit vor Eintrittsdatum (${user.hireDate}) nicht möglich. Keine Einträge vor Beschäftigungsbeginn erlaubt.`);
    }
    logger.info('✅ Hire date constraint passed');

    // Parse workSchedule from JSON
    const workSchedule = user.workSchedule ? JSON.parse(user.workSchedule) : null;
    logger.info({ workSchedule }, '📊 Parsed workSchedule');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 4: Date validation
    // ============================================================================
    logger.info({ startDate: data.startDate, endDate: data.endDate }, '🔍 Validating date format and range...');
    const validation = validateAbsenceDates(data);
    if (!validation.valid) {
      logger.error({ validation }, '❌ Date validation failed');
      throw new Error(validation.error);
    }
    logger.info('✅ Date validation passed');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 5: Day calculation
    // ============================================================================
    let days: number;

    if (data.type === 'vacation' || data.type === 'overtime_comp') {
      logger.info('📊 Calculating VACATION/OVERTIME days (WorkSchedule-aware, excludes 0h days + weekends + holidays)...');
      // Vacation & Overtime: Exclude holidays
      days = countWorkingDaysForUser(data.startDate, data.endDate, workSchedule, user.weeklyHours, db);
      logger.info({ workSchedule, weeklyHours: user.weeklyHours, days, type: data.type }, '📊 WorkSchedule-aware days (with holiday exclusion)');
    } else {
      logger.info('📊 Calculating SICK/UNPAID days (WorkSchedule-aware, excludes 0h days + weekends, INCLUDES holidays)...');
      // Sick & Unpaid: Include holidays (user can be sick/absent on holidays) — holidays are NOT excluded.
      // The 'undefined' db parameter means countWorkingDaysForUser will NOT query the holidays table,
      // so holidays count as working days for sick/unpaid (consistent with HR practice: you can be sick on a holiday).
      // Note: 0h-workSchedule days (e.g. Wed=0h) are still excluded because countWorkingDaysForUser respects workSchedule.
      days = countWorkingDaysForUser(data.startDate, data.endDate, workSchedule, user.weeklyHours, undefined); // undefined = no holiday exclusion
      logger.info({ workSchedule, weeklyHours: user.weeklyHours, days, type: data.type }, '📊 WorkSchedule-aware days (without holiday exclusion)');
    }

    logger.info({ days }, '📊 CALCULATED DAYS');

    if (days <= 0) {
      logger.error({ days, startDate: data.startDate, endDate: data.endDate }, '❌ DAYS <= 0! No business days in period');
      throw new Error('Absence request must span at least one business day');
    }
    logger.info('✅ Day calculation passed (days > 0)');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 6: Overlap check
    // ============================================================================
    logger.info({ userId: data.userId, startDate: data.startDate, endDate: data.endDate }, '🔍 Checking for overlapping absences...');
    const overlappingAbsence = checkOverlappingAbsence(data.userId, data.startDate, data.endDate);
    logger.info({ hasOverlap: !!overlappingAbsence, overlappingAbsence }, '📊 Overlapping absence check result');
    if (overlappingAbsence) {
      const typeLabels: Record<string, string> = {
        vacation: 'Urlaub',
        sick: 'Krankmeldung',
        overtime_comp: 'Überstundenausgleich',
        unpaid: 'Unbezahlter Urlaub'
      };
      const typeLabel = typeLabels[overlappingAbsence.type] || overlappingAbsence.type;
      const statusLabel = overlappingAbsence.status === 'approved' ? 'genehmigter' : 'beantragter';
      const errorMsg = `Überschneidung mit ${statusLabel} ${typeLabel} (${overlappingAbsence.startDate} - ${overlappingAbsence.endDate}). Bitte anderen Zeitraum wählen.`;
      logger.error({ errorMsg, overlappingAbsence }, '❌ Overlap detected');
      throw new Error(errorMsg);
    }
    logger.info('✅ No overlapping absences');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 7: Time entry conflict check
    // ============================================================================
    logger.info({ userId: data.userId, startDate: data.startDate, endDate: data.endDate }, '🔍 Checking for existing time entries in period...');
    const timeEntriesCheck = checkTimeEntriesInPeriod(data.userId, data.startDate, data.endDate);
    logger.info({
      hasEntries: timeEntriesCheck.hasEntries,
      totalHours: timeEntriesCheck.totalHours,
      dates: timeEntriesCheck.dates,
    }, '📊 Time entry check result');

    if (timeEntriesCheck.hasEntries) {
      // Format dates for display
      const formattedDates = timeEntriesCheck.dates
        .map(d => {
          const [year, month, day] = d.split('-');
          return `${day}.${month}.${year}`;
        })
        .join(', ');

      const errorMsg = `In diesem Zeitraum existieren bereits Zeiterfassungen (${timeEntriesCheck.totalHours}h an folgenden Tagen: ${formattedDates}). Bitte zuerst die Zeiterfassungen löschen.`;
      logger.error({ errorMsg, timeEntriesCheck }, '❌ Time entries conflict detected');
      throw new Error(errorMsg);
    }
    logger.info('✅ No time entry conflicts');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 8: Balance validation (vacation)
    // ============================================================================
    if (data.type === 'vacation') {
      const year = parseInt(data.startDate.substring(0, 4));
      logger.info({ userId: data.userId, year, requestedDays: days }, '🔍 Checking vacation balance...');
      const hasEnough = hasEnoughVacationDays(data.userId, year, days);
      logger.info({ hasEnough }, '📊 Vacation balance check result');
      if (!hasEnough) {
        logger.error({ userId: data.userId, year, requestedDays: days }, '❌ Insufficient vacation days');
        throw new Error('Insufficient vacation days remaining');
      }
      logger.info('✅ Sufficient vacation days');
    }

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 9: Balance validation (overtime_comp)
    // ============================================================================
    if (data.type === 'overtime_comp') {
      logger.info('🔥🔥🔥 OVERTIME COMP VALIDATION 🔥🔥🔥');
      logger.info({ userId: data.userId, days, startDate: data.startDate, endDate: data.endDate }, '📌 Parameters');

      // PROFESSIONAL: Use transaction-based balance (like SAP SuccessFactors, Personio, DATEV)
      const overtimeHours = getOvertimeBalance(data.userId);
      logger.info({ overtimeHours }, '📊 overtimeHours from transaction-based system');

      // USE INDIVIDUAL WORK SCHEDULE: Calculate actual hours for this period
      const requiredHours = calculateAbsenceCredits(data.userId, data.startDate, data.endDate);
      logger.info({ overtimeHours, requiredHours, hasEnough: overtimeHours >= requiredHours }, '📊 Comparison (using work schedule)');

      if (overtimeHours < requiredHours) {
        const errorMsg = `Insufficient overtime hours (need ${requiredHours}h, have ${overtimeHours}h)`;
        logger.error({ errorMsg, overtimeHours, requiredHours }, '❌ Insufficient overtime hours');
        throw new Error(errorMsg);
      }
      logger.info('✅ Sufficient overtime hours');
    }

    // Set initial status: sick leave is auto-approved, others are pending
    const status = data.type === 'sick' ? 'approved' : 'pending';
    logger.info({ type: data.type, status }, '📌 Determined initial status');

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 10: Database INSERT
    // ============================================================================
    const query = `
    INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [data.userId, data.type, data.startDate, data.endDate, days, status, data.reason || null];
    logger.info('💾 Executing INSERT query...');
    logger.info({ query, params }, '📝 SQL details');

    const result = db.prepare(query).run(...params);

    logger.info({
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes,
    }, '✅ INSERT successful');

    // If auto-approved (sick), update balances immediately
    if (status === 'approved') {
      logger.info({ requestId: result.lastInsertRowid }, '⚙️ Updating balances after auto-approval (sick leave)...');
      // actorId = null: System-Automatismus (Auto-Genehmigung bei Krankmeldung). Betrifft
      // ohnehin nur type='sick', das Urlaubskonto wird hier nie gebucht (siehe
      // updateBalancesAfterApproval: nur type='vacation' erzeugt eine Journalbuchung).
      updateBalancesAfterApproval(result.lastInsertRowid as number, null);
      logger.info('✅ Balances updated');
    }

    // If pending vacation request, increment pending balance
    if (data.type === 'vacation' && status === 'pending') {
      const year = parseInt(data.startDate.substring(0, 4));
      logger.info({ userId: data.userId, year, days }, '⚙️ Incrementing pending vacation balance...');
      incrementVacationPending(data.userId, year, days);
      logger.info('✅ Pending balance incremented');
    }

    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 11: Fetch created record
    // ============================================================================
    logger.info({ requestId: result.lastInsertRowid }, '🔍 Fetching created absence request from database...');
    const request = getAbsenceRequestById(result.lastInsertRowid as number);
    if (!request) {
      logger.error({ requestId: result.lastInsertRowid }, '❌ Failed to fetch created request from database');
      throw new Error('Failed to create absence request');
    }
    logger.info({
      requestId: request.id,
      userId: request.userId,
      type: request.type,
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
    }, '✅ Created request fetched successfully');

    // Broadcast WebSocket event
    logger.info({ requestId: request.id }, '📡 Broadcasting WebSocket event...');
    broadcastEvent({
      type: 'absence:created',
      userId: data.userId,
      data: request,
      timestamp: new Date().toISOString(),
    });
    logger.info('✅ WebSocket event broadcasted');

    logger.info('🎉 createAbsenceRequest() COMPLETED SUCCESSFULLY 🎉');
    return request;
  } catch (error) {
    // ============================================================================
    // 🔥 SERVICE DEBUG POINT 12: Catch block with full error context
    // ============================================================================
    logger.error('❌❌❌ createAbsenceRequest() ERROR ❌❌❌');
    logger.error({
      err: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      inputData: data,
    }, '❌ Full error context in service layer');
    throw error; // Re-throw to be caught by routes layer
  }
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

    // FIX (Bug #1): Use workSchedule-aware calculation (same as createAbsenceRequest)
    // Load user to get workSchedule for consistent day counting across create/update
    const user = getUserById(existing.userId);
    const workSchedule = user?.workSchedule ?? null;
    const weeklyHours = user?.weeklyHours ?? 40;

    if (existing.type === 'vacation' || existing.type === 'overtime_comp') {
      // Vacation & Overtime: Exclude holidays, respect workSchedule
      days = countWorkingDaysForUser(startDate, endDate, workSchedule, weeklyHours, db);
    } else {
      // Sick & Unpaid: Include holidays, respect workSchedule
      days = countWorkingDaysForUser(startDate, endDate, workSchedule, weeklyHours, undefined);
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
 * AUTOMATICALLY deletes conflicting time entries during the absence period
 */
export async function approveAbsenceRequest(
  id: number,
  approvedBy: number,
  adminNote?: string
): Promise<AbsenceRequest> {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  // PHASE 2 FIX: Allow approving pending OR rejected requests
  // This enables circular workflows: pending → approved → rejected → approved (re-approval)
  if (request.status !== 'pending' && request.status !== 'rejected') {
    throw new Error('Only pending or rejected requests can be approved');
  }

  // VALIDATION: Check overtime balance for overtime_comp
  if (request.type === 'overtime_comp') {
    const {
      hasSufficientOvertimeBalance,
      getOvertimeBalance
    } = await import('./overtimeTransactionService.js');

    const { getWorkTimeAccountWithUser } = await import('./workTimeAccountService.js');

    const account = getWorkTimeAccountWithUser(request.userId);

    // Get user to calculate hours correctly
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.userId) as any;
    if (!user) {
      throw new Error('User not found');
    }

    // Import utility function
    const { calculateAbsenceHoursWithWorkSchedule } = await import('../utils/workingDays.js');
    const actualHoursRequired = calculateAbsenceHoursWithWorkSchedule(
      request.startDate,
      request.endDate,
      user.workSchedule ? JSON.parse(user.workSchedule) : null,
      user.weeklyHours
    );

    const currentBalance = getOvertimeBalance(request.userId);

    if (!hasSufficientOvertimeBalance(request.userId, actualHoursRequired, account?.maxMinusHours || -20)) {
      const balanceAfter = currentBalance - actualHoursRequired;
      throw new Error(
        `Unzureichendes Überstunden-Guthaben. ` +
        `Aktuell: ${currentBalance.toFixed(2)}h, ` +
        `Benötigt: ${actualHoursRequired.toFixed(2)}h, ` +
        `Nach Abbau: ${balanceAfter.toFixed(2)}h, ` +
        `Limit: ${account?.maxMinusHours || -20}h`
      );
    }
  }

  // Update request status
  const query = `
    UPDATE absence_requests
    SET status = 'approved', approvedBy = ?, approvedAt = datetime('now'), adminNote = ?
    WHERE id = ?
  `;

  // ATOMICITY: Statuswechsel und Journalbuchung müssen gemeinsam gelingen oder gemeinsam
  // scheitern — analog zur Klammer in rejectAbsenceRequest() (applyRejection). Ohne diese
  // Klammer könnte der Antrag als genehmigt stehen bleiben, während die Buchung fehlt.
  const applyApproval = db.transaction(() => {
    db.prepare(query).run(approvedBy, adminNote || null, id);

    // Decrement pending balance for vacation requests (before updating taken)
    if (request.type === 'vacation') {
      const year = parseInt(request.startDate.substring(0, 4));
      decrementVacationPending(request.userId, year, request.days);
    }

    // Update balances
    updateBalancesAfterApproval(id, approvedBy);
  });
  applyApproval();

  // CRITICAL: Update overtime calculations for all affected months
  // This creates transactions (vacation_credit, sick_credit, etc.) and updates overtime_balance
  const { updateMonthlyOvertime } = await import('./overtimeService.js');

  // Get all affected months (e.g., "2026-01" if absence spans 12.01-13.01.2026)
  const affectedMonths = new Set<string>();
  for (let d = new Date(request.startDate); d <= new Date(request.endDate); d.setDate(d.getDate() + 1)) {
    const month = formatDate(d, 'yyyy-MM'); // "YYYY-MM"
    affectedMonths.add(month);
  }

  // Update overtime for each affected month
  for (const month of affectedMonths) {
    try {
      updateMonthlyOvertime(request.userId, month);
      logger.info({ userId: request.userId, month, absenceType: request.type }, '✅ Overtime recalculated after absence approval');
    } catch (error) {
      logger.error({ err: error, userId: request.userId, month }, '❌ Failed to recalculate overtime after absence approval');
    }
  }

  // NEW: Record overtime compensation transaction
  if (request.type === 'overtime_comp') {
    const { recordOvertimeCompensation } = await import('./overtimeTransactionService.js');
    const { calculateAbsenceHoursWithWorkSchedule } = await import('../utils/workingDays.js');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.userId) as any;
    const hoursToDeduct = calculateAbsenceHoursWithWorkSchedule(
      request.startDate,
      request.endDate,
      user.workSchedule ? JSON.parse(user.workSchedule) : null,
      user.weeklyHours
    );

    recordOvertimeCompensation(
      request.userId,
      request.startDate,
      hoursToDeduct,
      id,
      `Überstunden-Ausgleich ${request.startDate} - ${request.endDate}`
    );

    // Update work_time_accounts balance
    const { updateWorkTimeAccountBalance } = await import('./workTimeAccountService.js');
    const { getOvertimeBalance } = await import('./overtimeTransactionService.js');
    const newBalance = getOvertimeBalance(request.userId);
    updateWorkTimeAccountBalance(request.userId, newBalance);
  }

  // AUTO-DELETE conflicting time entries (STRICT MODE)
  // Import at runtime to avoid circular dependency
  const { deleteTimeEntriesDuringAbsence } = await import('./timeEntryService.js');
  const deleteResult = deleteTimeEntriesDuringAbsence(
    request.userId,
    request.startDate,
    request.endDate,
    approvedBy
  );

  // Send notification about deleted time entries (if any)
  if (deleteResult.deletedCount > 0) {
    const { notifyTimeEntriesDeletedDueToAbsence } = await import('./notificationService.js');
    notifyTimeEntriesDeletedDueToAbsence(
      request.userId,
      request.type,
      request.startDate,
      request.endDate,
      deleteResult.deletedCount,
      deleteResult.totalHours
    );
  }

  // Return updated request
  const updated = getAbsenceRequestById(id);
  if (!updated) {
    throw new Error('Failed to approve absence request');
  }

  // Broadcast WebSocket event
  broadcastEvent({
    type: 'absence:approved',
    userId: updated.userId,
    data: updated,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

/**
 * Reject absence request
 */
export async function rejectAbsenceRequest(
  id: number,
  approvedBy: number,
  adminNote?: string
): Promise<AbsenceRequest> {
  console.log('\n🔍 ========== DEBUG: rejectAbsenceRequest CALLED ==========');
  console.log('📥 Parameters:', { id, approvedBy, adminNote });

  const request = getAbsenceRequestById(id);
  console.log('📄 Request found:', request ? {
    id: request.id,
    userId: request.userId,
    type: request.type,
    status: request.status,
    startDate: request.startDate,
    endDate: request.endDate,
    days: request.days
  } : 'NULL');

  if (!request) {
    console.log('❌ Request not found - throwing error');
    throw new Error('Absence request not found');
  }

  // PHASE 2 FIX: Allow rejecting from any status (pending, approved, or rejected)
  // This enables circular workflows: pending → approved → rejected → approved (re-approval)
  // Rejecting a rejected absence is a harmless no-op
  if (request.status !== 'pending' && request.status !== 'approved' && request.status !== 'rejected') {
    console.log('❌ Invalid status - throwing error');
    throw new Error('Invalid absence status for rejection');
  }

  // Check if this was an approved absence (cancellation scenario)
  const wasApproved = request.status === 'approved';
  console.log(`✅ Status check: request.status="${request.status}" → wasApproved=${wasApproved}`);

  // Count transactions BEFORE rejection
  const transactionsBefore = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
    WHERE userId = ? AND referenceType = 'absence' AND referenceId = ?
  `).get(request.userId, request.id) as { count: number };
  console.log(`📊 Overtime transactions BEFORE rejection: ${transactionsBefore.count}`);

  // Update request status
  const query = `
    UPDATE absence_requests
    SET status = 'rejected', approvedBy = ?, approvedAt = datetime('now'), adminNote = ?
    WHERE id = ?
  `;

  // ATOMICITY (2026-08-18): The status change and the balance counter-booking must
  // succeed or fail together. Previously the UPDATE was committed on its own, so a
  // failure in the booking left the request rejected while the days stayed deducted —
  // exactly the inconsistency this function is meant to avoid.
  //
  // better-sqlite3 transactions are synchronous, so only synchronous work belongs here.
  // The overtime recalculation below uses `await import()` and stays outside on purpose:
  // it is a derived value that can be safely recomputed, unlike the balance itself.
  console.log('💾 Executing DB UPDATE (transactional)...');
  const applyRejection = db.transaction(() => {
    const updateResult = db.prepare(query).run(approvedBy, adminNote || null, id);
    console.log('✅ DB UPDATE result:', { changes: updateResult.changes });

    // Decrement pending balance for vacation requests
    if (request.type === 'vacation' && !wasApproved) {
      console.log('📉 Decrementing vacation pending balance...');
      const year = parseInt(request.startDate.substring(0, 4));
      decrementVacationPending(request.userId, year, request.days);
    }

    // CRITICAL FIX (2026-08-18): Rejecting an ALREADY APPROVED absence must revert the
    // balance booking that approval made. Without this the vacation days stay deducted
    // forever — there is no later code path that heals it, not even deleting the request.
    //
    // deleteAbsenceRequest() has always done this correctly (see its 'approved' branch);
    // rejection was the one path that booked without a counter-booking.
    //
    // This also fixes double-booking on re-approval: approving a rejected request calls
    // updateBalancesAfterApproval() again, which previously added days a second time
    // because the rejection never gave them back.
    //
    // Root cause analysis: .planning/debug/urlaubstage-bei-ablehnung-verloren.md
    if (wasApproved) {
      console.log('♻️  Reverting balances (was approved → rejected)...');
      revertBalancesAfterDeletion(id, approvedBy, 'rejected');
      logger.info(
        { requestId: id, userId: request.userId, type: request.type, days: request.days },
        '✅ Balances reverted after rejecting a previously approved absence'
      );
    }
  });
  applyRejection();

  // Verify status changed
  const verifyRequest = getAbsenceRequestById(id);
  console.log('🔍 Verify status after update:', verifyRequest?.status);

  // CRITICAL: If rejecting an approved absence (e.g., cancelling vacation),
  // we need to recalculate overtime to remove the credit transactions
  if (wasApproved) {
    console.log('🚀 wasApproved=true → Starting overtime recalculation...');
    try {
      console.log('📦 Importing overtimeService...');
      const { updateMonthlyOvertime } = await import('./overtimeService.js');
      console.log('✅ Import successful!');

      const affectedMonths = new Set<string>();
      for (let d = new Date(request.startDate); d <= new Date(request.endDate); d.setDate(d.getDate() + 1)) {
        affectedMonths.add(formatDate(d, 'yyyy-MM'));
      }
      console.log('📅 Affected months:', Array.from(affectedMonths));

      let recalcCount = 0;
      for (const month of affectedMonths) {
        console.log(`\n  🔄 Recalculating month ${month} (${++recalcCount}/${affectedMonths.size})...`);
        try {
          updateMonthlyOvertime(request.userId, month);
          logger.info({ userId: request.userId, month, absenceType: request.type }, '✅ Overtime recalculated after absence rejection (was approved)');
          console.log(`  ✅ SUCCESS for month ${month}`);
        } catch (error) {
          logger.error({ err: error, userId: request.userId, month }, '❌ Failed to recalculate overtime after absence rejection');
          console.error(`  ❌ ERROR for month ${month}:`, error);
        }
      }

      // Count transactions AFTER recalculation
      const transactionsAfter = db.prepare(`
        SELECT COUNT(*) as count FROM overtime_transactions
        WHERE userId = ? AND referenceType = 'absence' AND referenceId = ?
      `).get(request.userId, request.id) as { count: number };
      console.log(`📊 Overtime transactions AFTER recalculation: ${transactionsAfter.count}`);
      console.log(`📉 Transactions deleted: ${transactionsBefore.count - transactionsAfter.count}`);

    } catch (error) {
      logger.error({ err: error, requestId: id }, '❌ Failed to import overtimeService for recalculation');
      console.error('❌ CRITICAL ERROR during import/recalculation:', error);
    }
  } else {
    console.log('⏭️  wasApproved=false → Skipping overtime recalculation');
  }

  // Return updated request
  const updated = getAbsenceRequestById(id);
  if (!updated) {
    console.log('❌ Failed to get updated request - throwing error');
    throw new Error('Failed to reject absence request');
  }

  console.log('✅ Updated request retrieved:', { id: updated.id, status: updated.status });

  // Broadcast WebSocket event
  console.log('📡 Broadcasting WebSocket event...');
  broadcastEvent({
    type: 'absence:rejected',
    userId: updated.userId,
    data: updated,
    timestamp: new Date().toISOString(),
  });
  console.log('✅ WebSocket event broadcasted');

  console.log('🎉 ========== DEBUG: rejectAbsenceRequest COMPLETED ==========\n');
  return updated;
}

/**
 * Delete absence request
 *
 * `deletedBy` — wer die Löschung ausgelöst hat, landet als `createdBy` in der
 * Gegenbuchung. Ohne diesen Parameter stünde im Kontoauszug bei jeder Löschung
 * „unbekannt" — genau die Lücke, die die Ursachensuche am 18.08. erschwert hat.
 */
export function deleteAbsenceRequest(id: number, deletedBy: number | null): void {
  const request = getAbsenceRequestById(id);
  if (!request) {
    throw new Error('Absence request not found');
  }

  // If pending vacation, decrement pending balance — unabhängig von der Lösch-Transaktion,
  // betrifft nur die Anzeige des noch offenen Antrags.
  if (request.status === 'pending' && request.type === 'vacation') {
    const year = parseInt(request.startDate.substring(0, 4));
    decrementVacationPending(request.userId, year, request.days);
  }

  // ATOMICITY: Gegenbuchung und Löschung des Antrags müssen gemeinsam gelingen oder gemeinsam
  // scheitern — analog zur Klammer in rejectAbsenceRequest() (applyRejection).
  //
  // Die Journalbuchung überlebt das Löschen des Antrags bewusst: referenceId zeigt danach
  // ins Leere, das ist gewollt — der Kontoauszug muss weiterhin erklären, warum sich der
  // Saldo geändert hat (siehe Phase 8 zum Verlinken).
  const applyDeletion = db.transaction(() => {
    if (request.status === 'approved') {
      revertBalancesAfterDeletion(id, deletedBy, 'deleted');
    }
    db.prepare('DELETE FROM absence_requests WHERE id = ?').run(id);
  });
  applyDeletion();

  // CRITICAL: Recalculate overtime after deleting approved absence
  // This removes the transactions and updates overtime_balance.
  // Bleibt außerhalb der Transaktion — abgeleiteter Wert, nutzt require() (CJS-Interop).
  if (request.status === 'approved') {
    try {
      const { updateMonthlyOvertime } = require('./overtimeService.js');

      const affectedMonths = new Set<string>();
      for (let d = new Date(request.startDate); d <= new Date(request.endDate); d.setDate(d.getDate() + 1)) {
        affectedMonths.add(formatDate(d, 'yyyy-MM'));
      }

      for (const month of affectedMonths) {
        try {
          updateMonthlyOvertime(request.userId, month);
          logger.info({ userId: request.userId, month, absenceType: request.type }, '✅ Overtime recalculated after absence deletion');
        } catch (error) {
          logger.error({ err: error, userId: request.userId, month }, '❌ Failed to recalculate overtime after absence deletion');
        }
      }
    } catch (error) {
      logger.error({ err: error, requestId: id }, '❌ Failed to import overtimeService for recalculation');
    }
  }
}

/**
 * Calculate absence credit hours using individual work schedule
 * Iterates through each working day and sums getDailyTargetHours()
 *
 * @param userId - User ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Total credit hours for the absence period
 *
 * @example
 * // Hans: Mo=8h, Fr=2h, Urlaub Fr 07.02.2025
 * calculateAbsenceCredits(hans.id, "2025-02-07", "2025-02-07")
 * // → 2h (not 8h average!)
 */
function calculateAbsenceCredits(userId: number, startDate: string, endDate: string): number {
  logger.debug('🔥🔥🔥 CALCULATE ABSENCE CREDITS 🔥🔥🔥');
  logger.debug({ userId, startDate, endDate }, '📥 Input');

  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let totalHours = 0;

  // Iterate through each day in the period
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Skip weekends
    if (isWeekend) {
      continue;
    }

    // Check if day is a holiday
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
    if (isHoliday) {
      continue;
    }

    // Add daily target hours
    const dailyHours = getDailyTargetHours(user, d);
    logger.debug({ date: dateStr, dayName: getDayName(d), dailyHours }, '📊 Daily hours');
    totalHours += dailyHours;
  }

  logger.debug({ totalHours }, '📊 TOTAL ABSENCE CREDITS');
  logger.debug('🔥🔥🔥 END CALCULATE ABSENCE CREDITS 🔥🔥🔥');

  return Math.round(totalHours * 100) / 100;
}

/**
 * Update balances after approval (vacation balance, overtime, sick leave time entries)
 *
 * `actorId` — wer die Genehmigung ausgelöst hat. Wird bei `type === 'vacation'` in die
 * Journalbuchung geschrieben (`createdBy`). `null` nur bei System-Automatismen (z. B.
 * Auto-Genehmigung von Krankmeldungen), die das Urlaubskonto ohnehin nicht berühren.
 */
function updateBalancesAfterApproval(requestId: number, actorId: number | null): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) {
    throw new Error('Absence request not found');
  }

  const year = parseInt(request.startDate.substring(0, 4));

  if (request.type === 'vacation') {
    // Nur noch buchen — `taken` zieht automatisch nach (Phase 7).
    //
    // Bis Phase 6 stand hier zusätzlich `updateVacationTaken(userId, year, +days)`, das den
    // Zähler inkrementell fortschrieb. Genau diese Fortschreibung war die Fehlerquelle:
    // Fehlt ein einziger Gegenaufruf, driftet der Wert dauerhaft und unbemerkt.
    // `recordVacationTransaction()` synchronisiert `taken` jetzt absolut aus dem Journal.
    ensureVacationBalanceExists(request.userId, year);

    recordVacationTransaction({
      userId: request.userId,
      year,
      date: request.startDate,
      type: 'vacation_taken',
      days: -request.days, // negativ: Verbrauch
      description: `Urlaub ${request.startDate} bis ${request.endDate} genehmigt`,
      referenceType: 'absence',
      referenceId: request.id,
      createdBy: actorId,
    });
  } else if (request.type === 'overtime_comp') {
    // Deduct from overtime balance
    // USE INDIVIDUAL WORK SCHEDULE: Calculate actual hours for this period
    const hoursToDeduct = calculateAbsenceCredits(request.userId, request.startDate, request.endDate);
    logger.info({ userId: request.userId, hoursToDeduct, startDate: request.startDate, endDate: request.endDate }, '✅ Overtime comp: Deducting hours based on work schedule');
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
 * Revert balance changes after deletion (or after rejecting a previously approved request).
 *
 * `actorId` — wer den Storno ausgelöst hat (Ablehnender bzw. Löschender), landet als
 * `createdBy` in der Journalbuchung.
 * `reason` — Anlass des Storno, damit die Beschreibung im Kontoauszug den Vorgang benennt.
 * Diese Funktion wird aus zwei Kontexten aufgerufen: Ablehnung eines genehmigten Antrags
 * (`rejectAbsenceRequest`) und Löschung eines genehmigten Antrags (`deleteAbsenceRequest`).
 */
function revertBalancesAfterDeletion(
  requestId: number,
  actorId: number | null,
  reason: 'rejected' | 'deleted'
): void {
  const request = getAbsenceRequestById(requestId);
  if (!request) return;

  const year = parseInt(request.startDate.substring(0, 4));

  if (request.type === 'vacation') {
    // Nur noch gegenbuchen — `taken` zieht automatisch nach (Phase 7, siehe
    // updateBalancesAfterApproval).
    ensureVacationBalanceExists(request.userId, year);

    const reasonLabel = reason === 'rejected' ? 'Ablehnung' : 'Löschung';
    recordVacationTransaction({
      userId: request.userId,
      year,
      date: request.startDate,
      type: 'vacation_reverted',
      days: request.days, // positiv: Gutschrift
      description: `Urlaub ${request.startDate} bis ${request.endDate} storniert (${reasonLabel})`,
      referenceType: 'absence',
      referenceId: request.id,
      createdBy: actorId,
    });
  } else if (request.type === 'overtime_comp') {
    // Add back to overtime balance
    // USE INDIVIDUAL WORK SCHEDULE: Calculate actual hours for this period
    const hoursToAdd = calculateAbsenceCredits(request.userId, request.startDate, request.endDate);
    logger.info({ userId: request.userId, hoursToAdd, startDate: request.startDate, endDate: request.endDate }, '♻️ Overtime comp reverting: Adding hours back based on work schedule');
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
/**
 * Stellt sicher, dass ein Urlaubskonto für das Nutzerjahr existiert.
 *
 * ERSETZT `updateVacationTaken()` (bis Phase 6). Jene Funktion schrieb `taken`
 * inkrementell fort (`SET taken = taken + ?`) — und genau darin lag die Fehlerklasse,
 * die diesen Milestone ausgelöst hat: Fehlt ein einziger Gegenaufruf, driftet der Wert
 * dauerhaft, ohne dass es irgendwo auffällt. Im Mai 2026 blieb das drei Monate unbemerkt
 * und kostete 16 Urlaubstage.
 *
 * `taken` wird seit Phase 7 von `recordVacationTransaction()` absolut aus dem Journal
 * berechnet. Hier bleibt nur noch, das Konto anzulegen, falls es noch nicht existiert —
 * sonst hätte die Synchronisierung nichts zu aktualisieren.
 */
function ensureVacationBalanceExists(userId: number, year: number): void {
  let balance = getVacationBalance(userId, year);
  if (!balance) {
    balance = initializeVacationBalance(userId, year);
  }

  // Der Anspruch MUSS im Journal stehen, sonst stimmt die abgeleitete Rechnung nicht.
  //
  // `syncTakenFromJournal()` berechnet `taken = entitlement + carryover − Journal-Saldo`.
  // Fehlt die Anspruchsbuchung, fällt der Journal-Saldo um genau diesen Betrag zu niedrig
  // aus und `taken` entsprechend zu hoch — ein Konto mit 30 Tagen Anspruch und 2 Tagen
  // Urlaub käme auf taken = 32 statt 2.
  //
  // Konten entstehen an mehreren Stellen, nicht alle buchen (initializeVacationBalance
  // legt nur die Zeile an). Diese Prüfung trägt fehlende Grundbuchungen nach und macht
  // die Ableitung damit unabhängig davon, auf welchem Weg ein Konto entstanden ist.
  const grundbuchungen = db.prepare(`
    SELECT COUNT(*) AS cnt FROM vacation_transactions
    WHERE userId = ? AND year = ? AND type IN ('entitlement', 'carryover')
  `).get(userId, year) as { cnt: number };

  if (grundbuchungen.cnt === 0) {
    if (balance.entitlement !== 0) {
      recordVacationTransaction({
        userId,
        year,
        date: `${year}-01-01`,
        type: 'entitlement',
        days: balance.entitlement,
        description: `Jahresanspruch ${year}`,
        referenceType: 'system',
        createdBy: null,
      });
    }
    if (balance.carryover !== 0) {
      recordVacationTransaction({
        userId,
        year,
        date: `${year}-01-01`,
        type: 'carryover',
        days: balance.carryover,
        description: `Übertrag aus ${year - 1}`,
        referenceType: 'system',
        createdBy: null,
      });
    }
  }
}

/**
 * FIXED: This function previously tried to update a non-existent 'pending' column.
 *
 * REASON: Pending vacation requests are NOT tracked in vacation_balance.
 * Only APPROVED requests update the 'taken' column (via updateVacationTaken).
 *
 * When a pending request is created, there's NOTHING to update since it hasn't been
 * approved yet. Only after approval does the 'taken' column get updated.
 *
 * Schema: vacation_balance only has: entitlement, carryover, taken, remaining(virtual)
 */
function incrementVacationPending(userId: number, year: number, days: number): void {
  // No-op: Pending requests don't affect vacation_balance table
  // Only approved requests update the 'taken' column
  logger.debug({ userId, year, days }, '✅ Pending vacation request created (no balance update needed)');
}

/**
 * Decrement pending vacation days (when request is approved/rejected/deleted)
 */
/**
 * FIXED: This function previously tried to update a non-existent 'pending' column.
 *
 * REASON: Pending vacation requests are NOT tracked in vacation_balance.
 * Only APPROVED requests update the 'taken' column (via revertVacationBalance).
 *
 * When a pending request is deleted, there's NOTHING to revert since it was never
 * counted in the first place.
 *
 * Schema: vacation_balance only has: entitlement, carryover, taken, remaining(virtual)
 */
function decrementVacationPending(userId: number, year: number, days: number): void {
  // No-op: Pending requests don't affect vacation_balance table
  // Only approved requests update the 'taken' column
  logger.debug({ userId, year, days }, '✅ Pending vacation request deleted (no balance update needed)');
}

// REMOVED: getTotalOvertimeHours() - replaced by overtimeTransactionService.getOvertimeBalance()
// This function used the OLD monthly aggregation system (overtime_balance table).
// All validation now uses the NEW transaction-based system for consistency.

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
