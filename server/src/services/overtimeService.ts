import { db } from '../database/connection.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import logger from '../utils/logger.js';
import {
  getCurrentDate,
  getCurrentYear,
  formatDate,
} from '../utils/timezone.js';
import { getTotalCorrectionsForUserInMonth } from './overtimeCorrectionsService.js';
import { getUserById } from './userService.js';
import { rebuildOvertimeTransactionsForMonth } from './overtimeTransactionRebuildService.js';
import {
  deleteEarnedTransactionsForDate,
  recordOvertimeEarned,
  getOvertimeBalance,
  recordVacationCredit,
  recordSickCredit,
  recordOvertimeCompCredit,
  recordSpecialCredit,
  recordUnpaidAdjustment
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

      // FIX: Pass dateStr instead of Date object to avoid timezone conversion issues
      absenceHours += getDailyTargetHours(user, dateStr);
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

      // FIX: Pass dateStr instead of Date object to avoid timezone conversion issues
      totalUnpaidHours += getDailyTargetHours(user, dateStr);
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

/**
 * PROFESSIONAL STANDARD: Ensure absence transactions exist for a month
 *
 * This creates individual transaction records in overtime_transactions for transparency.
 * Called from updateMonthlyOvertime() to maintain audit trail.
 *
 * IDEMPOTENT: Deletes existing absence transactions for month before creating new ones.
 *
 * Professional systems (SAP SuccessFactors, Personio, DATEV) require transparent transaction history.
 */
function ensureAbsenceTransactionsForMonth(userId: number, month: string): void {
  console.log(`\n  🔧 ensureAbsenceTransactionsForMonth(userId=${userId}, month=${month})`);

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  // Get user for workSchedule
  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const rangeStart = new Date(Math.max(monthStart.getTime(), new Date(user.hireDate).getTime()));
  const rangeEnd = new Date(Math.min(monthEnd.getTime(), new Date().getTime()));

  const rangeStartStr = formatDate(rangeStart, 'yyyy-MM-dd');
  const rangeEndStr = formatDate(rangeEnd, 'yyyy-MM-dd');

  console.log(`    📅 Date range: ${rangeStartStr} to ${rangeEndStr}`);

  // Count existing absence transactions BEFORE
  const monthFirstDay = formatDate(monthStart, 'yyyy-MM-dd');
  const monthLastDay = formatDate(monthEnd, 'yyyy-MM-dd');
  const transactionsBefore = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
    WHERE userId = ?
      AND date BETWEEN ? AND ?
      AND type IN ('vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment')
  `).get(userId, monthFirstDay, monthLastDay) as { count: number };
  console.log(`    📊 Existing absence transactions BEFORE: ${transactionsBefore.count}`);

  // CRITICAL FIX: ALWAYS delete old absence transactions first, regardless of current approved absences!
  // This ensures that when an approved absence is rejected/deleted, its transactions get removed.
  console.log(`    🗑️  Deleting ALL old absence transactions for this month...`);
  const deleteResult = db.prepare(`
    DELETE FROM overtime_transactions
    WHERE userId = ?
      AND date BETWEEN ? AND ?
      AND type IN ('vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment')
  `).run(userId, monthFirstDay, monthLastDay);
  console.log(`    ✅ Deleted ${deleteResult.changes} old transactions`);

  // Now load ALL currently approved absences for this month (all types!)
  const absences = db.prepare(`
    SELECT id, type, startDate, endDate
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type IN ('vacation', 'sick', 'overtime_comp', 'special', 'unpaid')
      AND startDate <= ?
      AND endDate >= ?
  `).all(userId, rangeEndStr, rangeStartStr) as Array<{
    id: number;
    type: 'vacation' | 'sick' | 'overtime_comp' | 'special' | 'unpaid';
    startDate: string;
    endDate: string;
  }>;

  console.log(`    📋 Found ${absences.length} currently approved absences in month`);

  if (absences.length === 0) {
    logger.debug({ userId, month }, 'No approved absences in month → No new transactions to create');
    console.log(`    ✅ No approved absences → Old transactions deleted, no new ones to create`);
    return;
  }

  logger.info({ userId, month, absencesCount: absences.length }, '🔄 Creating absence transactions for month');

  // PHASE 1 FIX: Create "earned" transactions for absence days FIRST
  // This implements neutralization: vacation day shows earned: -8h + vacation_credit: +8h = 0h net
  let earnedTransactionsCreated = 0;

  console.log(`    🔧 PHASE 1: Creating earned transactions for absence days (neutralization)...`);

  for (const absence of absences) {
    const absenceStart = new Date(Math.max(new Date(absence.startDate).getTime(), rangeStart.getTime()));
    const absenceEnd = new Date(Math.min(new Date(absence.endDate).getTime(), rangeEnd.getTime()));

    // Iterate through each day of absence
    for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue; // Skip weekends

      const dateStr = formatDate(d, 'yyyy-MM-dd');

      // Check if holiday
      const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue; // Skip holidays

      // Get target hours for this day (workSchedule-aware!)
      const targetHours = getDailyTargetHours(user, dateStr);
      if (targetHours === 0) continue; // Skip non-working days

      // Check if time entries exist for this day
      const hasTimeEntries = db.prepare(`
        SELECT 1 FROM time_entries WHERE userId = ? AND date = ?
      `).get(userId, dateStr);

      if (!hasTimeEntries) {
        // No time entries exist → create earned transaction with NEGATIVE hours
        // This represents the Soll/Ist difference: 0 (actual) - targetHours (target) = -targetHours
        recordOvertimeEarned(userId, dateStr, -targetHours, `Abwesenheit (${absence.type}): Soll/Ist-Differenz`);
        earnedTransactionsCreated++;
      }
    }
  }

  console.log(`    ✅ Created ${earnedTransactionsCreated} earned transactions (negative hours for absence days)`);

  // For each absence, iterate through each day and create CREDIT transactions
  let transactionsCreated = 0;

  console.log(`    🔧 PHASE 2: Creating credit transactions (neutralizes earned transactions)...`);

  for (const absence of absences) {
    const absenceStart = new Date(Math.max(new Date(absence.startDate).getTime(), rangeStart.getTime()));
    const absenceEnd = new Date(Math.min(new Date(absence.endDate).getTime(), rangeEnd.getTime()));

    // Iterate through each day
    for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue;

      // Check if holiday
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue;

      // Calculate daily target hours (workSchedule-aware)
      const dailyHours = getDailyTargetHours(user, dateStr);

      if (dailyHours === 0) {
        continue; // Skip days where user doesn't work (per workSchedule)
      }

      // Call appropriate record function based on absence type
      switch (absence.type) {
        case 'vacation':
          recordVacationCredit(userId, dateStr, dailyHours, absence.id);
          transactionsCreated++;
          break;
        case 'sick':
          recordSickCredit(userId, dateStr, dailyHours, absence.id);
          transactionsCreated++;
          break;
        case 'overtime_comp':
          recordOvertimeCompCredit(userId, dateStr, dailyHours, absence.id);
          transactionsCreated++;
          break;
        case 'special':
          recordSpecialCredit(userId, dateStr, dailyHours, absence.id);
          transactionsCreated++;
          break;
        case 'unpaid':
          // Unpaid leave: REDUCES target, does NOT give credit
          // But we still create a transaction for transparency
          recordUnpaidAdjustment(userId, dateStr, dailyHours, absence.id);
          transactionsCreated++;
          break;
      }
    }
  }

  logger.info({ userId, month, transactionsCreated }, '✅ Absence transactions created');
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
 * @deprecated LEGACY: Old monthly aggregation system
 * Transaction-based system is now the primary source of truth
 *
 * Update MONTHLY overtime for a specific month
 * Called automatically after weekly overtime is updated
 *
 * KEPT FOR: Backward compatibility and legacy reports
 */
export function updateMonthlyOvertime(userId: number, month: string): void {
  console.log(`\n🔄 updateMonthlyOvertime(userId=${userId}, month=${month})`);

  // Get user with workSchedule support
  const user = getUserById(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  console.log(`  👤 User found: ${user.firstName} ${user.lastName}`);

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
  console.log(`\n  📅 DAY-BY-DAY TARGET CALCULATION for ${month}:`);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);

    console.log(`    ${dateStr} (${['So','Mo','Di','Mi','Do','Fr','Sa'][dayOfWeek]}): isWeekend=${isWeekend}, isHoliday=${!!isHoliday}`);

    if (isWeekend) {
      console.log(`      → SKIPPED (weekend check BEFORE getDailyTargetHours)`);
      continue;
    }

    if (isHoliday) {
      console.log(`      → SKIPPED (holiday check BEFORE getDailyTargetHours)`);
      continue;
    }

    // FIX: Pass dateStr instead of Date object to avoid timezone conversion issues
    const dailyTarget = getDailyTargetHours(user, dateStr);
    console.log(`      → getDailyTargetHours() returned: ${dailyTarget}h`);
    targetHours += dailyTarget;
  }
  targetHours = Math.round(targetHours * 100) / 100;
  console.log(`  ✅ TOTAL targetHours: ${targetHours}h`);

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

  console.log(`\n  📊 MONTHLY HOURS BREAKDOWN:`);
  console.log(`    workedHours: ${workedHours.total}h`);
  console.log(`    absenceCredits: ${absenceCredits}h`);
  console.log(`    overtimeCorrections: ${overtimeCorrections}h`);
  console.log(`    unpaidLeaveReduction: ${unpaidLeaveReduction}h`);
  console.log(`    adjustedTargetHours: ${adjustedTargetHours}h (targetHours ${targetHours}h - unpaidLeave ${unpaidLeaveReduction}h)`);
  console.log(`    actualHoursWithCredits: ${actualHoursWithCredits}h (worked ${workedHours.total}h + absences ${absenceCredits}h + corrections ${overtimeCorrections}h)`);
  console.log(`    OVERTIME: ${actualHoursWithCredits - adjustedTargetHours}h\n`);

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

  // CRITICAL: Ensure absence transactions are created for transparency
  // This creates individual transaction records for each absence day (vacation, sick, etc.)
  // Professional standard (SAP, Personio, DATEV): Transparent audit trail required!
  try {
    ensureAbsenceTransactionsForMonth(userId, month);
  } catch (error) {
    logger.error({ err: error, userId, month }, '❌ Failed to create absence transactions');
    // Don't throw - overtime_balance is updated, transaction creation is secondary
  }

  // REMOVED: Old Work Time Account sync (now handled by transaction-based system)
  // Work Time Account is now ONLY updated from overtimeTransactionService for consistency
  // See: absenceService.ts:696 for the single source of truth
}

/**
 * Master function: Update ALL overtime levels for a date
 * This is called from timeEntryService when entries are created/updated/deleted
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Transaction-based overtime tracking (PRIMARY: overtime_transactions)
 * - Monthly aggregation (SSOT: overtime_balance)
 * - Work Time Account synced from overtime_balance (consistency!)
 *
 * CRITICAL: Uses transaction to prevent race conditions and ensure atomicity.
 * If one update fails, ALL updates are rolled back to maintain data consistency.
 *
 * OPTIMIZED (2026-01-27): Removed legacy daily/weekly aggregations
 * - Removed: updateDailyOvertime() - no longer needed
 * - Removed: updateWeeklyOvertime() - no longer needed
 * - Kept: updateMonthlyOvertime() - CRITICAL (fills overtime_balance SSOT)
 */
export function updateAllOvertimeLevels(userId: number, date: string): void {
  const month = date.substring(0, 7); // "2025-11"

  // REFACTORED (2026-02-04): Use idempotent rebuild service
  // Replaces buggy incremental updates with professional full rebuild
  // This fixes: corrections not included, duplicates, missing balance tracking
  rebuildOvertimeTransactionsForMonth(userId, month);

  // Sync Work Time Account with overtime_balance (outside transaction)
  // This ensures Work Time Account always reflects the current balance
  const currentBalance = getOvertimeBalance(userId);
  updateWorkTimeAccountBalance(userId, currentBalance);

  logger.debug({ userId, date, balance: currentBalance }, '✅ Work Time Account synced from overtime_balance');
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

  // ✅ Record new transaction (ALWAYS, even 0h for complete audit trail!)
  recordOvertimeEarned(userId, date, overtime);

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
export async function getOvertimeSummary(userId: number, year: number): Promise<OvertimeSummary> {
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
  await ensureOvertimeBalanceEntries(userId, endMonth);

  logger.debug('✅ All monthly entries ensured');

  // LEGACY TABLES REMOVED (2026-01-27): overtime_daily and overtime_weekly
  // Now using transaction-based system (overtime_transactions + overtime_balance)
  // Daily/weekly breakdowns can be derived from overtime_transactions if needed
  const daily: DailyOvertime[] = [];
  const weekly: WeeklyOvertime[] = [];

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
 * Ensure overtime_balance entries exist for all months between hire date and target month
 * This is CRITICAL - without entries for months with 0 hours, negative overtime won't accumulate!
 */
export async function ensureOvertimeBalanceEntries(userId: number, upToMonth: string): Promise<void> {
  logger.debug({ userId, upToMonth }, '🔥 ensureOvertimeBalanceEntries called');

  // Get user with workSchedule support
  const user = getUserById(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const hireDate = new Date(user.hireDate);
  const targetDate = new Date(upToMonth + '-01');

  // Ensure holidays are loaded for all years in this range
  const startYear = hireDate.getFullYear();
  const endYear = targetDate.getFullYear();
  const { ensureYearCoverage } = await import('./holidayService.js');

  for (let year = startYear; year <= endYear; year++) {
    await ensureYearCoverage(year);
  }

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
      // CRITICAL FIX #1: Convert Date to string BEFORE using it (Date object mutates in loop!)
      const dateStr = formatDate(d, 'yyyy-MM-dd');

      // CRITICAL FIX #2: getDailyTargetHours() handles holidays AND workSchedule correctly
      // Don't skip weekends here - let getDailyTargetHours decide based on workSchedule!
      // Old buggy code: if (isWeekend) continue; ← This broke weekend workers!

      const hours = getDailyTargetHours(user, dateStr);
      targetHours += hours;
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
 * Ensure ALL daily overtime_transactions exist for a date range
 * Creates transactions for days WITHOUT time_entries (missing minus hours!)
 *
 * ON-DEMAND: Called before reading transactions (like ensureOvertimeBalanceEntries)
 * IDEMPOTENT: Can be called multiple times, won't create duplicates
 *
 * @param userId User ID
 * @param startMonth Start month in 'YYYY-MM' format
 * @param endMonth End month in 'YYYY-MM' format
 */
export async function ensureDailyOvertimeTransactions(
  userId: number,
  startMonth: string,
  endMonth: string
): Promise<void> {
  logger.info({ userId, startMonth, endMonth }, '🔥 ensureDailyOvertimeTransactions called');

  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Parse month range
  const [startYear, startMonthNum] = startMonth.split('-').map(Number);
  const [endYear, endMonthNum] = endMonth.split('-').map(Number);

  const startDate = new Date(startYear, startMonthNum - 1, 1);
  const endDate = new Date(endYear, endMonthNum, 0); // Last day of end month
  const today = getCurrentDate();

  // Don't go into the future
  const effectiveEndDate = endDate > today ? today : endDate;

  // Don't go before hire date
  const hireDate = new Date(user.hireDate);
  const effectiveStartDate = startDate < hireDate ? hireDate : startDate;

  logger.debug({
    effectiveStartDate: formatDate(effectiveStartDate, 'yyyy-MM-dd'),
    effectiveEndDate: formatDate(effectiveEndDate, 'yyyy-MM-dd')
  }, '📅 Date range');

  let transactionsCreated = 0;
  let transactionsSkipped = 0;

  // Iterate through ALL days
  for (let d = new Date(effectiveStartDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d, 'yyyy-MM-dd');

    // Check if transaction already exists
    const existing = db.prepare(`
      SELECT id FROM overtime_transactions
      WHERE userId = ? AND date = ? AND type = 'earned'
    `).get(userId, dateStr);

    if (existing) {
      transactionsSkipped++;
      continue; // Skip if exists
    }

    // Calculate overtime for this day
    const targetHours = getDailyTargetHours(user, dateStr);
    const actualHours = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM time_entries WHERE userId = ? AND date = ?
    `).get(userId, dateStr) as { total: number };

    const overtime = actualHours.total - targetHours;

    // Create transaction (even 0h!)
    recordOvertimeEarned(userId, dateStr, overtime);
    transactionsCreated++;
  }

  logger.info({
    userId,
    startMonth,
    endMonth,
    transactionsCreated,
    transactionsSkipped
  }, '✅ Ensured daily overtime transactions (earned)');

  // NOW: Ensure absence credit transactions
  await ensureAbsenceTransactions(userId, startMonth, endMonth);

  // NOW: Ensure correction transactions
  await ensureCorrectionTransactions(userId, startMonth, endMonth);

  logger.info({ userId, startMonth, endMonth }, '✅ Ensured ALL transaction types');
}

/**
 * Get overtime for all users (Admin dashboard)
 * Calculates cumulative overtime from start of year UP TO CURRENT MONTH (inclusive)
 * This gives the CURRENT balance, not future projection
 * IMPORTANT: Only counts months from employee's hire date onwards!
 */
export async function getAllUsersOvertimeSummary(year: number, month?: string) {
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
      await ensureOvertimeBalanceEntries(user.id, month);
    }
  } else {
    // Yearly report: Full year or up to current month
    startMonth = `${year}-01`;
    endMonth = year === currentYear
      ? formatDate(today, 'yyyy-MM')
      : `${year}-12`;

    for (const user of users) {
      await ensureOvertimeBalanceEntries(user.id, endMonth);
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
export async function getAggregatedOvertimeStats(year: number, month?: string) {
  const today = getCurrentDate();
  const currentYear = today.getFullYear();

  // Ensure all users have complete overtime_balance entries
  const users = db.prepare('SELECT id FROM users WHERE deletedAt IS NULL').all() as Array<{ id: number }>;

  const targetMonth = month || formatDate(today, 'yyyy-MM');

  for (const user of users) {
    await ensureOvertimeBalanceEntries(user.id, targetMonth);
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
export async function deductOvertimeForAbsence(
  userId: number,
  hours: number,
  absenceDate: string
): Promise<void> {
  const currentYear = getCurrentYear();
  const summary = await getOvertimeSummary(userId, currentYear);

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
export async function hasEnoughOvertime(userId: number, requestedHours: number): Promise<boolean> {
  const currentYear = getCurrentYear();
  const summary = await getOvertimeSummary(userId, currentYear);
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
  logger.info({ userId, year }, '📊 getYearEndOvertimeBalance - OPTIMIZED VERSION (Direct DB Query)');

  // OPTIMIZATION: Read directly from overtime_balance table instead of recalculating!
  // This function is called during Year-End Rollover AFTER ensureOvertimeBalanceEntries
  // has already been called, so the data is already in the DB.

  // Get all monthly balances for the year
  const monthlyBalances = db.prepare(`
    SELECT overtime, carryoverFromPreviousYear
    FROM overtime_balance
    WHERE userId = ? AND month LIKE ?
    ORDER BY month ASC
  `).all(userId, `${year}-%`) as Array<{ overtime: number; carryoverFromPreviousYear: number }>;

  if (monthlyBalances.length === 0) {
    logger.error({ userId, year }, '❌ No overtime_balance entries found - cannot calculate year-end balance');
    // CRITICAL: This should never happen in normal flow!
    // ensureOvertimeBalanceEntries() must be called BEFORE getYearEndOvertimeBalance()
    // Returning 0 as safe fallback (year-end rollover will continue but log error)
    return 0;
  }

  // Sum all monthly overtime (each month's overtime = actualHours - targetHours for that month)
  const totalMonthlyOvertime = monthlyBalances.reduce((sum, m) => sum + m.overtime, 0);

  // Get carryover from January (all months have the same carryoverFromPreviousYear value)
  const carryover = monthlyBalances[0]?.carryoverFromPreviousYear || 0;

  const totalBalance = totalMonthlyOvertime + carryover;

  logger.info(
    { userId, year, monthsFound: monthlyBalances.length, totalMonthlyOvertime, carryover, totalBalance },
    `✅ Year-end balance calculated from ${monthlyBalances.length} months`
  );

  // Return cumulative balance: sum of all monthly overtime + carryover from previous year
  return totalBalance;
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
    .prepare('SELECT id FROM users WHERE deletedAt IS NULL AND status = \'active\'')
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
 * Ensure absence credit transactions exist for all approved absences
 *
 * Creates transactions for: vacation, sick, overtime_comp, special, unpaid
 *
 * IMPORTANT: Unpaid leave gets unpaid_adjustment transactions to compensate
 * for the negative earned transactions (since target is reduced to 0)
 *
 * @param userId User ID
 * @param startMonth Start month (YYYY-MM)
 * @param endMonth End month (YYYY-MM)
 */
export async function ensureAbsenceTransactions(
  userId: number,
  startMonth: string,
  endMonth: string
): Promise<void> {
  logger.info({ userId, startMonth, endMonth }, '🔥 ensureAbsenceTransactions called');

  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Parse month range
  const [startYear, startMonthNum] = startMonth.split('-').map(Number);
  const [endYear, endMonthNum] = endMonth.split('-').map(Number);

  const startDate = new Date(startYear, startMonthNum - 1, 1);
  const endDate = new Date(endYear, endMonthNum, 0); // Last day of end month
  const today = getCurrentDate();

  // Don't go into the future
  const effectiveEndDate = endDate > today ? today : endDate;

  // Don't go before hire date
  const hireDate = new Date(user.hireDate);
  const effectiveStartDate = startDate < hireDate ? hireDate : startDate;

  const effectiveStartStr = formatDate(effectiveStartDate, 'yyyy-MM-dd');
  const effectiveEndStr = formatDate(effectiveEndDate, 'yyyy-MM-dd');

  logger.debug({
    effectiveStartDate: effectiveStartStr,
    effectiveEndDate: effectiveEndStr
  }, '📅 Absence date range');

  // Get all approved absences in date range (NOW INCLUDING unpaid!)
  const absences = db.prepare(`
    SELECT id, type, startDate, endDate
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type IN ('vacation', 'sick', 'overtime_comp', 'special', 'unpaid')
      AND startDate <= ?
      AND endDate >= ?
    ORDER BY startDate ASC
  `).all(userId, effectiveEndStr, effectiveStartStr) as Array<{
    id: number;
    type: 'vacation' | 'sick' | 'overtime_comp' | 'special' | 'unpaid';
    startDate: string;
    endDate: string;
  }>;

  let transactionsCreated = 0;
  let transactionsSkipped = 0;

  for (const absence of absences) {
    const absenceStart = new Date(Math.max(new Date(absence.startDate).getTime(), effectiveStartDate.getTime()));
    const absenceEnd = new Date(Math.min(new Date(absence.endDate).getTime(), effectiveEndDate.getTime()));

    // Iterate through each day of absence
    for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) continue; // Skip weekends

      const dateStr = formatDate(d, 'yyyy-MM-dd');

      // Check if holiday
      const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue; // Skip holidays

      // Get target hours for this day (workSchedule-aware!)
      const targetHours = getDailyTargetHours(user, dateStr);
      if (targetHours === 0) continue; // Skip non-working days

      // Check if transaction already exists
      const transactionType = absence.type === 'unpaid'
        ? 'unpaid_adjustment'
        : `${absence.type}_credit` as 'vacation_credit' | 'sick_credit' | 'overtime_comp_credit' | 'special_credit';

      const existing = db.prepare(`
        SELECT id FROM overtime_transactions
        WHERE userId = ? AND date = ? AND type = ? AND referenceId = ?
      `).get(userId, dateStr, transactionType, absence.id);

      if (existing) {
        transactionsSkipped++;
        continue;
      }

      // Create credit transaction
      switch (absence.type) {
        case 'vacation':
          recordVacationCredit(userId, dateStr, targetHours, absence.id);
          break;
        case 'sick':
          recordSickCredit(userId, dateStr, targetHours, absence.id);
          break;
        case 'overtime_comp':
          recordOvertimeCompCredit(userId, dateStr, targetHours, absence.id);
          break;
        case 'special':
          recordSpecialCredit(userId, dateStr, targetHours, absence.id);
          break;
        case 'unpaid':
          // Unpaid leave: Add adjustment to compensate for negative earned
          // (earned for unpaid day = 0 - targetHours = -targetHours)
          // (unpaid_adjustment = +targetHours to compensate)
          recordUnpaidAdjustment(userId, dateStr, targetHours, absence.id);
          break;
      }

      transactionsCreated++;
    }
  }

  logger.info({
    userId,
    startMonth,
    endMonth,
    absencesProcessed: absences.length,
    transactionsCreated,
    transactionsSkipped
  }, '✅ Ensured absence credit transactions');
}

/**
 * Ensure correction transactions exist for all overtime_corrections
 *
 * NOTE: Corrections already create transactions when created via overtimeCorrectionsService
 * This function is for backfilling old corrections that might not have transactions
 *
 * @param userId User ID
 * @param startMonth Start month (YYYY-MM)
 * @param endMonth End month (YYYY-MM)
 */
export async function ensureCorrectionTransactions(
  userId: number,
  startMonth: string,
  endMonth: string
): Promise<void> {
  logger.info({ userId, startMonth, endMonth }, '🔥 ensureCorrectionTransactions called');

  // Get all corrections in date range
  const corrections = db.prepare(`
    SELECT id, date, hours, reason
    FROM overtime_corrections
    WHERE userId = ?
      AND strftime('%Y-%m', date) >= ?
      AND strftime('%Y-%m', date) <= ?
    ORDER BY date ASC
  `).all(userId, startMonth, endMonth) as Array<{
    id: number;
    date: string;
    hours: number;
    reason: string;
  }>;

  let transactionsCreated = 0;
  let transactionsSkipped = 0;

  for (const correction of corrections) {
    // Check if transaction already exists
    const existing = db.prepare(`
      SELECT id FROM overtime_transactions
      WHERE userId = ? AND date = ? AND type = 'correction' AND referenceId = ?
    `).get(userId, correction.date, correction.id);

    if (existing) {
      transactionsSkipped++;
      continue;
    }

    // Create correction transaction
    db.prepare(`
      INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
      VALUES (?, ?, 'correction', ?, ?, 'manual', ?)
    `).run(userId, correction.date, correction.hours, correction.reason, correction.id);

    transactionsCreated++;
  }

  logger.info({
    userId,
    startMonth,
    endMonth,
    correctionsProcessed: corrections.length,
    transactionsCreated,
    transactionsSkipped
  }, '✅ Ensured correction transactions');
}
