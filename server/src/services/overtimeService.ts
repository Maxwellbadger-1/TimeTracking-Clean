import { db } from '../database/connection.js';
import { startOfWeek, endOfWeek } from 'date-fns';
import { getDailyTargetHours } from '../utils/workingDays.js';
import logger from '../utils/logger.js';
import {
  getCurrentDate,
  getCurrentYear,
  formatDate,
} from '../utils/timezone.js';
import { getTotalCorrectionsForUserInMonth } from './overtimeCorrectionsService.js';
import { getUserById } from './userService.js';
import {
  deleteEarnedTransactionsForDate,
  recordOvertimeEarned,
  getOvertimeBalance
} from './overtimeTransactionService.js';
import { updateWorkTimeAccountBalance } from './workTimeAccountService.js';

/**
 * Professional 3-Level Overtime Service
 * Tracks overtime on DAILY, WEEKLY, and MONTHLY basis
 * Based on German labor law and industry best practices
 */

/**
 * Calculate absence credits for a specific month
 * CRITICAL: Correctly handles absences spanning multiple months!
 * NOW SUPPORTS: Individual work schedules (workSchedule)
 *
 * Example: Vacation from Nov 25 - Dec 5
 * - November: Credits Nov 25-30 (working days only)
 * - December: Credits Dec 1-5 (working days only)
 *
 * @param userId - User ID
 * @param month - Month in 'YYYY-MM' format
 * @param hireDate - User's hire date (ISO string)
 * @param endDate - End date for calculation (Date object, typically today or month end)
 * @returns Total absence credit hours for the month
 */
function calculateAbsenceCreditsForMonth(
  userId: number,
  month: string,
  hireDate: string,
  endDate: Date
): number {
  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  // Effective range: (month start OR hire date) to (month end OR endDate)
  const rangeStart = new Date(Math.max(monthStart.getTime(), new Date(hireDate).getTime()));
  const rangeEnd = new Date(Math.min(monthEnd.getTime(), endDate.getTime()));

  const rangeStartStr = formatDate(rangeStart, 'yyyy-MM-dd');
  const rangeEndStr = formatDate(rangeEnd, 'yyyy-MM-dd');

  // Get all approved absences that overlap with this month's range
  // CRITICAL: Use proper date range query, NOT startDate LIKE 'YYYY-MM%'!
  const absences = db.prepare(`
    SELECT id, type, startDate, endDate, days
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type IN ('sick', 'vacation', 'overtime_comp')
      AND startDate <= ?
      AND endDate >= ?
  `).all(userId, rangeEndStr, rangeStartStr) as Array<{
    id: number;
    type: string;
    startDate: string;
    endDate: string;
    days: number;
  }>;

  if (absences.length === 0) {
    return 0;
  }

  // Get user for workSchedule
  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // For each absence, calculate credit hours using individual work schedule
  let totalCreditHours = 0;

  for (const absence of absences) {
    const absenceStart = new Date(Math.max(new Date(absence.startDate).getTime(), rangeStart.getTime()));
    const absenceEnd = new Date(Math.min(new Date(absence.endDate).getTime(), rangeEnd.getTime()));

    // Iterate through each day and sum getDailyTargetHours()
    let absenceHours = 0;
    for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      // Check if holiday
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue;

      // Add daily target hours (respects workSchedule!)
      absenceHours += getDailyTargetHours(user, d);
    }

    totalCreditHours += absenceHours;

    logger.debug({
      absenceId: absence.id,
      type: absence.type,
      originalRange: `${absence.startDate} - ${absence.endDate}`,
      monthRange: `${rangeStartStr} - ${rangeEndStr}`,
      overlapRange: `${formatDate(absenceStart, 'yyyy-MM-dd')} - ${formatDate(absenceEnd, 'yyyy-MM-dd')}`,
      absenceHours
    }, 'Absence credit calculation (workSchedule-aware)');
  }

  logger.debug({
    month,
    absencesCount: absences.length,
    totalCreditHours
  }, 'Total absence credits for month');

  return totalCreditHours;
}

/**
 * Calculate unpaid leave hours for a specific month
 * Unpaid leave REDUCES target hours (user doesn't need to work those days)
 * NOW SUPPORTS: Individual work schedules (workSchedule)
 *
 * @param userId - User ID
 * @param month - Month in 'YYYY-MM' format
 * @param hireDate - User's hire date
 * @param endDate - End date for calculation
 * @returns Total unpaid leave hours to subtract from target
 */
function calculateUnpaidLeaveForMonth(
  userId: number,
  month: string,
  hireDate: string,
  endDate: Date
): number {
  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  const rangeStart = new Date(Math.max(monthStart.getTime(), new Date(hireDate).getTime()));
  const rangeEnd = new Date(Math.min(monthEnd.getTime(), endDate.getTime()));

  const rangeStartStr = formatDate(rangeStart, 'yyyy-MM-dd');
  const rangeEndStr = formatDate(rangeEnd, 'yyyy-MM-dd');

  const absences = db.prepare(`
    SELECT id, startDate, endDate
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type = 'unpaid'
      AND startDate <= ?
      AND endDate >= ?
  `).all(userId, rangeEndStr, rangeStartStr) as Array<{
    id: number;
    startDate: string;
    endDate: string;
  }>;

  // Get user for workSchedule
  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let totalUnpaidHours = 0;

  for (const absence of absences) {
    const absenceStart = new Date(Math.max(new Date(absence.startDate).getTime(), rangeStart.getTime()));
    const absenceEnd = new Date(Math.min(new Date(absence.endDate).getTime(), rangeEnd.getTime()));

    // Iterate through each day and sum getDailyTargetHours()
    for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      // Check if holiday
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue;

      // Add daily target hours (respects workSchedule!)
      totalUnpaidHours += getDailyTargetHours(user, d);
    }
  }

  return totalUnpaidHours;
}

interface DailyOvertime {
  date: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
}

interface WeeklyOvertime {
  week: string; // Format: "2025-W45" (ISO week)
  targetHours: number;
  actualHours: number;
  overtime: number;
}

interface MonthlyOvertime {
  month: string; // Format: "2025-11"
  targetHours: number;
  actualHours: number;
  overtime: number;
  carryoverFromPreviousYear?: number; // For January: Carried over from previous year
}

interface OvertimeSummary {
  daily: DailyOvertime[];
  weekly: WeeklyOvertime[];
  monthly: MonthlyOvertime[];
  totalOvertime: number; // Sum of all months in year
}

/**
 * Get ISO week string from date (Berlin timezone)
 * Format: "2025-W45"
 */
function getISOWeek(date: string): string {
  const d = new Date(date);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday
  return formatDate(weekStart, "yyyy-'W'II");
}

/**
 * Get week start and end dates from a date (Berlin timezone)
 */
function getWeekDateRange(date: string): { startDate: string; endDate: string } {
  const d = new Date(date);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(d, { weekStartsOn: 1 }); // Sunday
  return {
    startDate: formatDate(weekStart, 'yyyy-MM-dd'),
    endDate: formatDate(weekEnd, 'yyyy-MM-dd'),
  };
}

/**
 * @deprecated LEGACY: Old daily aggregation system
 * Use overtimeTransactionService.updateOvertimeTransactionsForDate() for transaction-based tracking
 *
 * Update DAILY overtime for a specific date
 * Called automatically when time entries are created/updated/deleted
 *
 * KEPT FOR: Backward compatibility and legacy reports
 */
export function updateDailyOvertime(userId: number, date: string): void {
  // Get full user object with workSchedule for WorkSchedule-aware calculation
  const user = getUserById(userId);

  if (!user) {
    logger.error({ userId }, 'updateDailyOvertime: User not found');
    throw new Error(`User not found: ${userId}`);
  }

  // Check if date is before hire date
  if (date < user.hireDate) {
    // Before hire date: no target, no actual hours
    db.prepare(
      `INSERT INTO overtime_daily (userId, date, targetHours, actualHours)
       VALUES (?, ?, 0, 0)
       ON CONFLICT(userId, date)
       DO UPDATE SET targetHours = 0, actualHours = 0`
    ).run(userId, date);
    logger.debug({ userId, date, hireDate: user.hireDate }, 'Skipped day before hire date');
    return;
  }

  // ✅ FIXED: WorkSchedule-aware daily target calculation (respects individual schedules)
  const dailyTarget = getDailyTargetHours(user, date);

  // Calculate actual hours for the day
  const actualHours = db
    .prepare(
      `SELECT COALESCE(SUM(hours), 0) as total
       FROM time_entries
       WHERE userId = ? AND date = ?`
    )
    .get(userId, date) as { total: number };

  // Upsert daily overtime
  db.prepare(
    `INSERT INTO overtime_daily (userId, date, targetHours, actualHours)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, date)
     DO UPDATE SET targetHours = ?, actualHours = ?`
  ).run(userId, date, dailyTarget, actualHours.total, dailyTarget, actualHours.total);
}

/**
 * @deprecated LEGACY: Old weekly aggregation system
 * Transaction-based system provides better granularity
 *
 * Update WEEKLY overtime for a specific week
 * Called automatically after daily overtime is updated
 *
 * KEPT FOR: Backward compatibility and legacy reports
 */
export function updateWeeklyOvertime(userId: number, date: string): void {
  // Get user with workSchedule support
  const user = getUserById(userId);

  if (!user) {
    logger.error({ userId }, 'updateWeeklyOvertime: User not found');
    throw new Error(`User not found: ${userId}`);
  }

  const weekString = getISOWeek(date);

  // Get week start/end dates
  const { startDate, endDate } = getWeekDateRange(date);

  // Check if week is entirely before hire date
  if (endDate < user.hireDate) {
    // Entire week before hire date
    db.prepare(
      `INSERT INTO overtime_weekly (userId, week, targetHours, actualHours)
       VALUES (?, ?, 0, 0)
       ON CONFLICT(userId, week)
       DO UPDATE SET targetHours = 0, actualHours = 0`
    ).run(userId, weekString);
    logger.debug({ userId, week: weekString, hireDate: user.hireDate }, 'Skipped week before hire date');
    return;
  }

  // Adjust start date if hire date is mid-week
  const actualStartDate = startDate < user.hireDate ? user.hireDate : startDate;

  // Calculate target hours using individual work schedule
  // Iterate through each working day and sum getDailyTargetHours()
  let targetHours = 0;
  for (let d = new Date(actualStartDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) continue;

    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
    if (isHoliday) continue;

    targetHours += getDailyTargetHours(user, d);
  }
  targetHours = Math.round(targetHours * 100) / 100;

  // Calculate actual hours for the week
  const actualHours = db
    .prepare(
      `SELECT COALESCE(SUM(hours), 0) as total
       FROM time_entries
       WHERE userId = ? AND date >= ? AND date <= ?`
    )
    .get(userId, startDate, endDate) as { total: number };

  // Upsert weekly overtime
  db.prepare(
    `INSERT INTO overtime_weekly (userId, week, targetHours, actualHours)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, week)
     DO UPDATE SET targetHours = ?, actualHours = ?`
  ).run(userId, weekString, targetHours, actualHours.total, targetHours, actualHours.total);
}

/**
 * @deprecated LEGACY: Old monthly aggregation system
 * Transaction-based system is now the primary source of truth
 *
 * Update MONTHLY overtime for a specific month
 * Called automatically after weekly overtime is updated
 *
 * KEPT FOR: Backward compatibility and legacy reports
 */
export function updateMonthlyOvertime(userId: number, month: string): void {
  // Get user with workSchedule support
  const user = getUserById(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const [year, monthNum] = month.split('-').map(Number);
  const today = getCurrentDate();
  const currentMonth = formatDate(today, 'yyyy-MM');

  // Determine start and end dates for calculation
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0); // Last day of month

  // If this is the current month, only calculate up to today
  const endDate = (month === currentMonth) ? today : monthEnd;

  // Determine actual start date (hire date if in this month, otherwise month start)
  const hireDate = new Date(user.hireDate);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth() + 1;

  let startDate = monthStart;
  if (year === hireYear && monthNum === hireMonth) {
    startDate = hireDate;
  }

  // Skip this month if user wasn't hired yet (hire date is after the month ends)
  if (hireDate > endDate) {
    logger.debug({ month, hireDate, endDate }, 'Skipping month - user not hired yet');
    return;
  }

  // Calculate target hours using individual work schedule
  // Iterate through each working day and sum getDailyTargetHours()
  let targetHours = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) continue;

    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
    if (isHoliday) continue;

    targetHours += getDailyTargetHours(user, d);
  }
  targetHours = Math.round(targetHours * 100) / 100;

  logger.debug({
    month,
    startDate: formatDate(startDate, 'yyyy-MM-dd'),
    endDate: formatDate(endDate, 'yyyy-MM-dd'),
    targetHours
  }, `📅 updateMonthlyOvertime (workSchedule-aware)`);

  // Calculate actual worked hours for the month
  const workedHours = db
    .prepare(
      `SELECT COALESCE(SUM(hours), 0) as total
       FROM time_entries
       WHERE userId = ? AND date LIKE ?`
    )
    .get(userId, `${month}%`) as { total: number };

  // BEST PRACTICE: Calculate absence credits ("Krank/Urlaub = Gearbeitet")
  // Uses centralized function that correctly handles multi-month absences
  // NOW SUPPORTS: Individual work schedules (workSchedule)
  const absenceCredits = calculateAbsenceCreditsForMonth(userId, month, user.hireDate, endDate);

  // Calculate unpaid leave reduction (reduces target hours)
  // Uses centralized function that correctly handles multi-month absences
  // NOW SUPPORTS: Individual work schedules (workSchedule)
  const unpaidLeaveReduction = calculateUnpaidLeaveForMonth(userId, month, user.hireDate, endDate);

  // Adjusted target hours (Soll minus unpaid leave)
  const adjustedTargetHours = targetHours - unpaidLeaveReduction;

  // Get overtime corrections for this month
  const overtimeCorrections = getTotalCorrectionsForUserInMonth(userId, month);

  // Actual hours WITH absence credits AND corrections
  const actualHoursWithCredits = workedHours.total + absenceCredits + overtimeCorrections;

  logger.debug({
    workedHours: workedHours.total,
    absenceCredits,
    overtimeCorrections,
    unpaidLeaveReduction,
    adjustedTargetHours,
    actualHoursWithCredits
  }, `📊 Monthly hours breakdown`);

  // Upsert monthly overtime
  db.prepare(
    `INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, month)
     DO UPDATE SET targetHours = ?, actualHours = ?`
  ).run(userId, month, adjustedTargetHours, actualHoursWithCredits, adjustedTargetHours, actualHoursWithCredits);

  // REMOVED: Old Work Time Account sync (now handled by transaction-based system)
  // Work Time Account is now ONLY updated from overtimeTransactionService for consistency
  // See: absenceService.ts:696 for the single source of truth
}

/**
 * Master function: Update ALL overtime levels for a date
 * This is called from timeEntryService when entries are created/updated/deleted
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Transaction-based overtime tracking as primary system
 * - Old aggregation tables (daily, weekly, monthly) maintained for legacy reports
 * - Work Time Account synced from transaction-based balance (single source of truth)
 *
 * CRITICAL: Uses transaction to prevent race conditions and ensure atomicity.
 * If one update fails, ALL updates are rolled back to maintain data consistency.
 */
export function updateAllOvertimeLevels(userId: number, date: string): void {
  const month = date.substring(0, 7); // "2025-11"

  // Wrap in transaction for atomicity (CRITICAL for data consistency!)
  const transaction = db.transaction(() => {
    // NEW SYSTEM: Transaction-based tracking (PRIMARY)
    updateOvertimeTransactionsForDate(userId, date);

    // OLD SYSTEM: Legacy aggregation tables (for backward compatibility)
    updateDailyOvertime(userId, date);
    updateWeeklyOvertime(userId, date);
    updateMonthlyOvertime(userId, month);
  });

  // Execute transaction (all-or-nothing)
  transaction();

  // Sync Work Time Account with transaction-based balance (outside transaction)
  // This ensures Work Time Account always reflects the current transaction-based balance
  const currentBalance = getOvertimeBalance(userId);
  updateWorkTimeAccountBalance(userId, currentBalance);

  logger.debug({ userId, date, balance: currentBalance }, '✅ Work Time Account synced from transactions');
}

/**
 * Update overtime_transactions for a specific date
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio):
 * - Recalculates daily overtime (Soll/Ist difference)
 * - Creates/updates transaction record
 * - Handles holidays (0h Soll) and no time entries (-Xh Minusstunden)
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 */
function updateOvertimeTransactionsForDate(userId: number, date: string): void {
  // Get user for workSchedule-aware calculation
  const user = getUserById(userId);
  if (!user) {
    logger.error({ userId }, 'updateOvertimeTransactionsForDate: User not found');
    throw new Error(`User not found: ${userId}`);
  }

  // Check if date is before hire date
  if (date < user.hireDate) {
    logger.debug({ userId, date, hireDate: user.hireDate }, 'Skipped: Date before hire date');
    return;
  }

  // Calculate target hours (respects holidays and workSchedule!)
  const targetHours = getDailyTargetHours(user, date);

  // Calculate actual hours
  const actualHours = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as total
    FROM time_entries
    WHERE userId = ? AND date = ?
  `).get(userId, date) as { total: number };

  // Calculate overtime
  const overtime = actualHours.total - targetHours;

  // Delete existing earned transactions for this date
  deleteEarnedTransactionsForDate(userId, date);

  // Record new transaction (if not 0)
  if (overtime !== 0) {
    recordOvertimeEarned(userId, date, overtime);
  }

  logger.debug({
    userId,
    date,
    targetHours,
    actualHours: actualHours.total,
    overtime
  }, 'Updated overtime transaction');
}

/**
 * Get complete overtime summary for a user and year
 * Returns daily, weekly, monthly breakdowns + total
 */
export function getOvertimeSummary(userId: number, year: number): OvertimeSummary {
  logger.debug('🔥🔥🔥 getOvertimeSummary CALLED 🔥🔥🔥');
  logger.debug({ userId, year }, '📌 Parameters');

  // Get user's hireDate to filter overtime calculations
  const user = db
    .prepare('SELECT hireDate FROM users WHERE id = ?')
    .get(userId) as { hireDate: string } | undefined;

  const hireDate = user?.hireDate || '1900-01-01'; // Default to very old date if not set

  logger.debug({ hireDate }, '📅 User hireDate');

  // Determine the end month (current month if current year, December if past year)
  const today = getCurrentDate();
  const currentYear = today.getFullYear();
  const endMonth = year === currentYear
    ? formatDate(today, 'yyyy-MM')
    : `${year}-12`;

  logger.debug({ endMonth }, '📅 Ensuring overtime entries up to');

  // Ensure all monthly overtime_balance entries exist
  ensureOvertimeBalanceEntries(userId, endMonth);

  logger.debug('✅ All monthly entries ensured');

  // Get daily overtime (only from hireDate onwards)
  const daily = db
    .prepare(
      `SELECT date, targetHours, actualHours, overtime
       FROM overtime_daily
       WHERE userId = ? AND date LIKE ? AND date >= ?
       ORDER BY date DESC`
    )
    .all(userId, `${year}-%`, hireDate) as DailyOvertime[];

  // Get weekly overtime (only from hireDate onwards)
  const weekly = db
    .prepare(
      `SELECT week, targetHours, actualHours, overtime
       FROM overtime_weekly
       WHERE userId = ? AND week LIKE ?
         AND week >= strftime('%Y-W%W', ?)
       ORDER BY week DESC`
    )
    .all(userId, `${year}-%`, hireDate) as WeeklyOvertime[];

  // Get monthly overtime (only from hireDate onwards)
  const monthlyRaw = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month LIKE ? AND month >= strftime('%Y-%m', ?)
       ORDER BY month DESC`
    )
    .all(userId, `${year}-%`, hireDate) as MonthlyOvertime[];

  // Ensure all numbers are properly typed (SQLite sometimes returns strings)
  const monthly = monthlyRaw.map(m => ({
    month: m.month,
    targetHours: Number(m.targetHours) || 0,
    actualHours: Number(m.actualHours) || 0,
    overtime: Number(m.overtime) || 0,
  }));

  logger.debug({ monthlyCount: monthly.length }, '📊 Monthly data');

  // Calculate total overtime for year
  const totalOvertime = monthly.reduce((sum, m) => sum + m.overtime, 0);

  logger.debug({ totalOvertime }, '📊 Total overtime');
  logger.debug('🔥🔥🔥 END getOvertimeSummary 🔥🔥🔥');

  return {
    daily,
    weekly,
    monthly,
    totalOvertime: Math.round(totalOvertime * 100) / 100,
  };
}

/**
 * Get daily overtime for a specific date
 */
export function getDailyOvertime(userId: number, date: string): DailyOvertime | null {
  const result = db
    .prepare(
      `SELECT date, targetHours, actualHours, overtime
       FROM overtime_daily
       WHERE userId = ? AND date = ?`
    )
    .get(userId, date) as DailyOvertime | undefined;

  return result || null;
}

/**
 * Get weekly overtime for a specific week
 */
export function getWeeklyOvertime(userId: number, week: string): WeeklyOvertime | null {
  const result = db
    .prepare(
      `SELECT week, targetHours, actualHours, overtime
       FROM overtime_weekly
       WHERE userId = ? AND week = ?`
    )
    .get(userId, week) as WeeklyOvertime | undefined;

  return result || null;
}

/**
 * Get monthly overtime for a specific month
 */
export function getMonthlyOvertime(userId: number, month: string): MonthlyOvertime | null {
  const result = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month = ?`
    )
    .get(userId, month) as MonthlyOvertime | undefined;

  return result || null;
}

/**
 * Get current overtime stats (for dashboard)
 * Returns: today, this week, this month, total year
 */
export function getCurrentOvertimeStats(userId: number) {
  const today = formatDate(getCurrentDate(), 'yyyy-MM-dd');
  const currentWeek = getISOWeek(today);
  const currentMonth = formatDate(getCurrentDate(), 'yyyy-MM');
  const currentYear = getCurrentYear();

  logger.debug('🔥🔥🔥 getCurrentOvertimeStats CALLED 🔥🔥🔥');
  logger.debug({ userId, today, currentWeek, currentMonth, currentYear }, '📌 Parameters');

  const dailyData = getDailyOvertime(userId, today);
  logger.debug({ dailyData }, '📊 dailyData');

  const weeklyData = getWeeklyOvertime(userId, currentWeek);
  logger.debug({ weeklyData }, '📊 weeklyData');

  const monthlyData = getMonthlyOvertime(userId, currentMonth);
  logger.debug({ monthlyData }, '📊 monthlyData');

  const yearData = getOvertimeSummary(userId, currentYear);
  logger.debug({ yearDataTotal: yearData.totalOvertime }, '📊 yearData');

  const result = {
    today: dailyData?.overtime || 0,
    thisWeek: weeklyData?.overtime || 0,
    thisMonth: monthlyData?.overtime || 0,
    totalYear: yearData.totalOvertime,
  };

  logger.info({ result }, '✅ RETURNING RESULT');
  logger.debug('🔥🔥🔥 END getCurrentOvertimeStats 🔥🔥🔥');

  return result;
}

/**
 * Ensure overtime_balance entries exist for all months between hire date and target month
 * This is CRITICAL - without entries for months with 0 hours, negative overtime won't accumulate!
 */
export function ensureOvertimeBalanceEntries(userId: number, upToMonth: string): void {
  logger.debug({ userId, upToMonth }, '🔥 ensureOvertimeBalanceEntries called');

  // Get user with workSchedule support
  const user = getUserById(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const hireDate = new Date(user.hireDate);
  const targetDate = new Date(upToMonth + '-01');

  logger.debug({ hireDate: user.hireDate, targetMonth: upToMonth }, '📅 Date range');

  // Generate all months from hire date to target month
  const months: string[] = [];
  const current = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);

  while (current <= targetDate) {
    months.push(formatDate(current, 'yyyy-MM'));
    current.setMonth(current.getMonth() + 1);
  }

  logger.debug({ monthsCount: months.length }, '📅 Months to ensure');

  // For each month, ensure an overtime_balance entry exists
  for (const month of months) {
    const [year, monthNum] = month.split('-').map(Number);
    const today = getCurrentDate();
    const currentMonth = formatDate(today, 'yyyy-MM');

    // Determine start and end dates for this month
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0); // Last day of month

    // If this is the current month, only calculate up to today
    const endDate = (month === currentMonth) ? today : monthEnd;

    // Determine actual start date (hire date if in this month, otherwise month start)
    const hireYear = hireDate.getFullYear();
    const hireMonth = hireDate.getMonth() + 1;

    let startDate = monthStart;
    if (year === hireYear && monthNum === hireMonth) {
      startDate = hireDate;
    }

    // Calculate target hours using individual work schedule
    // Iterate through each working day and sum getDailyTargetHours()
    let targetHours = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue;

      targetHours += getDailyTargetHours(user, d);
    }
    targetHours = Math.round(targetHours * 100) / 100;

    logger.debug({ month, targetHours }, `📅 Month calculation (workSchedule-aware)`);

    // CRITICAL: ALWAYS recalculate, even if entry exists!
    // OLD BUG: if (!existing) only created new entries, never updated existing ones
    // NEW: UPSERT pattern (INSERT or UPDATE) ensures values are always current

    // Calculate actual worked hours for this month
    const workedHours = db
      .prepare(
        `SELECT COALESCE(SUM(hours), 0) as total
         FROM time_entries
         WHERE userId = ? AND date LIKE ?`
      )
      .get(userId, `${month}%`) as { total: number };

    // BEST PRACTICE: Calculate absence credits ("Krank/Urlaub = Gearbeitet")
    // Uses centralized function that correctly handles multi-month absences
    // NOW SUPPORTS: Individual work schedules (workSchedule)
    const absenceCredits = calculateAbsenceCreditsForMonth(userId, month, user.hireDate, endDate);

    // Calculate unpaid leave reduction
    // Uses centralized function that correctly handles multi-month absences
    // NOW SUPPORTS: Individual work schedules (workSchedule)
    const unpaidLeaveReduction = calculateUnpaidLeaveForMonth(userId, month, user.hireDate, endDate);

    const adjustedTargetHours = targetHours - unpaidLeaveReduction;
    const actualHoursWithCredits = workedHours.total + absenceCredits;

    // UPSERT: Insert new entry or update existing one
    db.prepare(
      `INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(userId, month)
       DO UPDATE SET targetHours = ?, actualHours = ?`
    ).run(userId, month, adjustedTargetHours, actualHoursWithCredits, adjustedTargetHours, actualHoursWithCredits);

    logger.debug({
      workedHours: workedHours.total,
      absenceCredits,
      unpaidLeaveReduction,
      adjustedTargetHours,
      actualHoursWithCredits,
      overtime: actualHoursWithCredits - adjustedTargetHours
    }, `✅ Upserted entry for ${month}`);
  }
}

/**
 * Get overtime for all users (Admin dashboard)
 * Calculates cumulative overtime from start of year UP TO CURRENT MONTH (inclusive)
 * This gives the CURRENT balance, not future projection
 * IMPORTANT: Only counts months from employee's hire date onwards!
 */
export function getAllUsersOvertimeSummary(year: number, month?: string) {
  const today = getCurrentDate();
  const currentYear = today.getFullYear();

  // First, ensure all users have complete overtime_balance entries
  const users = db.prepare('SELECT id FROM users WHERE deletedAt IS NULL').all() as Array<{ id: number }>;

  // Determine date range based on parameters (monthly or yearly)
  let startMonth: string;
  let endMonth: string;

  if (month) {
    // Monthly report: Use specified month only
    startMonth = month;
    endMonth = month;

    // Ensure overtime_balance exists for this month
    for (const user of users) {
      ensureOvertimeBalanceEntries(user.id, month);
    }
  } else {
    // Yearly report: Full year or up to current month
    startMonth = `${year}-01`;
    endMonth = year === currentYear
      ? formatDate(today, 'yyyy-MM')
      : `${year}-12`;

    for (const user of users) {
      ensureOvertimeBalanceEntries(user.id, endMonth);
    }
  }

  const query = `
    SELECT
      u.id as userId,
      u.firstName,
      u.lastName,
      u.email,
      COALESCE(SUM(ob.targetHours), 0) as targetHours,
      COALESCE(SUM(ob.actualHours), 0) as actualHours,
      COALESCE(SUM(ob.overtime), 0) as totalOvertime
    FROM users u
    LEFT JOIN overtime_balance ob ON u.id = ob.userId
      AND ob.month >= ?
      AND ob.month <= ?
      AND ob.month >= strftime('%Y-%m', u.hireDate)
    WHERE u.deletedAt IS NULL
    GROUP BY u.id
    ORDER BY totalOvertime DESC
  `;

  return db.prepare(query).all(startMonth, endMonth) as Array<{
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    targetHours: number;
    actualHours: number;
    totalOvertime: number;
  }>;
}

/**
 * Get aggregated overtime statistics for all users (Admin dashboard)
 * Returns total sums for Soll, Ist, and Überstunden
 * Best Practice: Used for "Alle Mitarbeiter" view in reports
 */
export function getAggregatedOvertimeStats(year: number, month?: string) {
  const today = getCurrentDate();
  const currentYear = today.getFullYear();

  // Ensure all users have complete overtime_balance entries
  const users = db.prepare('SELECT id FROM users WHERE deletedAt IS NULL').all() as Array<{ id: number }>;

  const targetMonth = month || formatDate(today, 'yyyy-MM');

  for (const user of users) {
    ensureOvertimeBalanceEntries(user.id, targetMonth);
  }

  // Query for monthly aggregation
  if (month) {
    const query = `
      SELECT
        SUM(ob.targetHours) as totalTargetHours,
        SUM(ob.actualHours) as totalActualHours,
        SUM(ob.overtime) as totalOvertime,
        COUNT(DISTINCT ob.userId) as userCount
      FROM overtime_balance ob
      JOIN users u ON ob.userId = u.id
      WHERE u.deletedAt IS NULL
        AND ob.month = ?
    `;

    const baseStats = db.prepare(query).get(month) as {
      totalTargetHours: number;
      totalActualHours: number;
      totalOvertime: number;
      userCount: number;
    };

    // IMPORTANT: overtime_balance.actualHours ALREADY includes corrections!
    // DON'T add them again (would be double-counting)
    return {
      totalTargetHours: baseStats.totalTargetHours || 0,
      totalActualHours: baseStats.totalActualHours || 0,
      totalOvertime: baseStats.totalOvertime || 0,
      userCount: baseStats.userCount || 0,
    };
  }

  // Query for yearly aggregation
  const startMonth = `${year}-01`;
  const endMonth = year === currentYear
    ? formatDate(today, 'yyyy-MM')
    : `${year}-12`;

  const query = `
    SELECT
      SUM(ob.targetHours) as totalTargetHours,
      SUM(ob.actualHours) as totalActualHours,
      SUM(ob.overtime) as totalOvertime,
      COUNT(DISTINCT ob.userId) as userCount
    FROM overtime_balance ob
    JOIN users u ON ob.userId = u.id
    WHERE u.deletedAt IS NULL
      AND ob.month >= ?
      AND ob.month <= ?
      AND ob.month >= strftime('%Y-%m', u.hireDate)
  `;

  const baseStats = db.prepare(query).all(startMonth, endMonth)[0] as {
    totalTargetHours: number;
    totalActualHours: number;
    totalOvertime: number;
    userCount: number;
  };

  // IMPORTANT: overtime_balance.actualHours ALREADY includes corrections!
  // DON'T add them again (would be double-counting)
  return {
    totalTargetHours: baseStats.totalTargetHours || 0,
    totalActualHours: baseStats.totalActualHours || 0, // ✅ NO double-counting
    totalOvertime: baseStats.totalOvertime || 0, // ✅ NO double-counting
    userCount: baseStats.userCount || 0,
  };
}

/**
 * Deduct overtime when overtime compensation absence is approved
 */
export function deductOvertimeForAbsence(
  userId: number,
  hours: number,
  absenceDate: string
): void {
  const currentYear = getCurrentYear();
  const summary = getOvertimeSummary(userId, currentYear);

  if (summary.totalOvertime < hours) {
    throw new Error(
      `Insufficient overtime hours (need ${hours}h, have ${summary.totalOvertime}h)`
    );
  }

  // Deduct from the month where absence is taken
  const absenceMonth = absenceDate.substring(0, 7);
  const monthData = getMonthlyOvertime(userId, absenceMonth);

  if (monthData) {
    const newActualHours = monthData.actualHours - hours;
    db.prepare(
      'UPDATE overtime_balance SET actualHours = ? WHERE userId = ? AND month = ?'
    ).run(newActualHours, userId, absenceMonth);
  }
}

/**
 * Check if user has enough overtime for compensation request
 */
export function hasEnoughOvertime(userId: number, requestedHours: number): boolean {
  const currentYear = getCurrentYear();
  const summary = getOvertimeSummary(userId, currentYear);
  return summary.totalOvertime >= requestedHours;
}

/**
 * YEAR-END ROLLOVER FUNCTIONS
 * Used for automatic year-end transfer of overtime hours
 */

/**
 * Get total overtime balance at year-end (December 31st)
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Calculate sum of ALL monthly overtime in the year
 * - This is the balance that will be carried over to next year
 *
 * @param userId User ID
 * @param year Year to calculate (e.g., 2025)
 * @returns Total overtime hours at year-end
 */
export function getYearEndOvertimeBalance(userId: number, year: number): number {
  const summary = getOvertimeSummary(userId, year);
  return summary.totalOvertime;
}

/**
 * Initialize overtime balance for January of new year with carryover
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Create January entry with carryover from previous year
 * - Target hours = 0 (no work expected yet)
 * - Actual hours = carryover (starting balance)
 * - This ensures January shows correct starting balance
 *
 * CRITICAL: This function is called AUTOMATICALLY by yearEndRolloverService
 *
 * @param userId User ID
 * @param year New year (e.g., 2026)
 * @param carryoverHours Overtime hours from previous year (can be negative!)
 */
export function initializeOvertimeBalanceForNewYear(
  userId: number,
  year: number,
  carryoverHours: number
): void {
  const januaryMonth = `${year}-01`;

  logger.info({ userId, year, carryoverHours }, '🎊 Initializing overtime balance for new year');

  // Check if January entry already exists
  const existing = db
    .prepare('SELECT id FROM overtime_balance WHERE userId = ? AND month = ?')
    .get(userId, januaryMonth) as { id: number } | undefined;

  if (existing) {
    // Update existing entry with carryover
    db.prepare(`
      UPDATE overtime_balance
      SET carryoverFromPreviousYear = ?
      WHERE userId = ? AND month = ?
    `).run(carryoverHours, userId, januaryMonth);

    logger.info({ userId, januaryMonth }, '✅ Updated existing January entry with carryover');
  } else {
    // Create new January entry
    // Target hours = 0, Actual hours = 0, Carryover = balance from previous year
    db.prepare(`
      INSERT INTO overtime_balance (userId, month, targetHours, actualHours, carryoverFromPreviousYear)
      VALUES (?, ?, 0, 0, ?)
    `).run(userId, januaryMonth, carryoverHours);

    logger.info({ userId, januaryMonth }, '✅ Created January entry with carryover');
  }
}

/**
 * Bulk initialize overtime balances for ALL active users for new year
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Called automatically by cron job at midnight on January 1st
 * - Processes ALL active employees
 * - Transfers overtime balance from previous year
 * - Creates audit log entries for compliance
 *
 * CRITICAL: This function uses SQLite transactions!
 * If one user fails, ALL updates are rolled back (data integrity!)
 *
 * @param year New year (e.g., 2026)
 * @returns Number of users processed
 */
export function bulkInitializeOvertimeBalancesForNewYear(year: number): number {
  const previousYear = year - 1;

  logger.info({ year, previousYear }, '🎊🎊🎊 BULK YEAR-END OVERTIME ROLLOVER STARTED 🎊🎊🎊');

  // Get all active users
  const users = db
    .prepare('SELECT id FROM users WHERE deletedAt IS NULL AND status = "active"')
    .all() as Array<{ id: number }>;

  logger.info({ count: users.length }, `📋 Found ${users.length} active users`);

  let processedCount = 0;

  // Process each user in a transaction (all-or-nothing!)
  const transaction = db.transaction(() => {
    for (const user of users) {
      try {
        // Get year-end balance from previous year
        const carryoverHours = getYearEndOvertimeBalance(user.id, previousYear);

        logger.info(
          { userId: user.id, carryoverHours, previousYear },
          `💼 User ${user.id}: ${carryoverHours > 0 ? '+' : ''}${carryoverHours.toFixed(2)}h carryover`
        );

        // Initialize new year with carryover
        initializeOvertimeBalanceForNewYear(user.id, year, carryoverHours);

        processedCount++;
      } catch (error: unknown) {
        logger.error(
          { userId: user.id, error: error instanceof Error ? error.message : String(error) },
          `❌ Failed to rollover overtime for user ${user.id}`
        );
        throw error; // Rollback transaction
      }
    }
  });

  // Execute transaction
  transaction();

  logger.info({ processedCount, year }, `✅✅✅ BULK ROLLOVER COMPLETED: ${processedCount} users processed`);

  return processedCount;
}

/**
 * LEGACY COMPATIBILITY FUNCTIONS
 * These are kept for backwards compatibility with old API endpoints
 *
 * @deprecated Use overtimeTransactionService.getOvertimeBalance() for NEW transaction-based system
 */

/**
 * @deprecated LEGACY: Uses old overtime_balance table. Use overtimeTransactionService.getOvertimeBalance() instead.
 */
export function getOvertimeBalanceLEGACY(userId: number, year: number) {
  return getOvertimeSummary(userId, year);
}

/**
 * @deprecated LEGACY: Uses old monthly system. Use transaction-based system instead.
 */
export function getOvertimeByMonth(userId: number, month: string) {
  const monthlyData = getMonthlyOvertime(userId, month);
  if (!monthlyData) {
    return { targetHours: 0, actualHours: 0, overtime: 0 };
  }
  return monthlyData;
}

/**
 * @deprecated LEGACY: Uses old monthly system. Use transaction-based system instead.
 */
export function getOvertimeStats(userId: number) {
  return getCurrentOvertimeStats(userId);
}
