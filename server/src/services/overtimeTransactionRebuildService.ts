/**
 * PROFESSIONAL OVERTIME TRANSACTION REBUILD SERVICE
 *
 * ARCHITECTURE DECISION (ADR-2026-001):
 * This service implements the Single Source of Truth pattern for overtime transactions.
 *
 * PRINCIPLES:
 * - IDEMPOTENT: Can be called multiple times, always produces same result
 * - ATOMIC: All changes in ONE database transaction
 * - COMPLETE: Rebuilds ALL transactions for a month from source data
 * - TRACEABLE: Full balance tracking (balanceBefore/balanceAfter)
 *
 * REPLACES:
 * - updateOvertimeTransactionsForDate() (incomplete, buggy)
 * - ensureAbsenceTransactionsForMonth() (duplication-prone)
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Transaction-based tracking with cumulative balance
 * - Transparent audit trail for compliance
 * - Consistency between overtime_transactions and overtime_balance
 */

import { db } from '../database/connection.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { getUserById } from './userService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import logger from '../utils/logger.js';
import * as transactionManager from './overtimeTransactionManager.js';

interface DayCalculation {
  date: string;
  targetHours: number;
  timeEntriesHours: number;
  absence: {
    type: 'vacation' | 'sick' | 'overtime_comp' | 'special' | 'unpaid' | null;
    id: number | null;
  };
  corrections: number;
  isHoliday: boolean;
  isWeekend: boolean;
}

/**
 * Rebuild ALL overtime transactions for a specific month
 *
 * IDEMPOTENT: Deletes existing transactions and rebuilds from scratch
 * ATOMIC: Wrapped in DB transaction for all-or-nothing guarantee
 *
 * @param userId User ID
 * @param month Month in 'YYYY-MM' format
 */
export function rebuildOvertimeTransactionsForMonth(
  userId: number,
  month: string
): void {
  logger.info({ userId, month }, '🔄 Rebuilding overtime transactions for month');

  // Wrap everything in DB transaction for atomicity
  const transaction = db.transaction(() => {
    // STEP 1: Get user (with workSchedule)
    const user = getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // STEP 2: Determine calculation period
    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const hireDate = new Date(user.hireDate);
    const today = getCurrentDate();

    // Start = later of (month start, hire date)
    const startDate = new Date(Math.max(monthStart.getTime(), hireDate.getTime()));

    // End = earlier of (month end, today) if current month, else month end
    const currentMonth = formatDate(today, 'yyyy-MM');
    const endDate = (month === currentMonth)
      ? new Date(Math.min(monthEnd.getTime(), today.getTime()))
      : monthEnd;

    // Skip if user wasn't hired yet
    if (hireDate > endDate) {
      logger.debug({ month, hireDate, endDate }, 'Skipping month - user not hired yet');
      return;
    }

    logger.debug({
      month,
      startDate: formatDate(startDate, 'yyyy-MM-dd'),
      endDate: formatDate(endDate, 'yyyy-MM-dd')
    }, 'Calculation period determined');

    // STEP 3: Delete the DERIVED transactions for this month, then rebuild them.
    const monthFirstDay = formatDate(monthStart, 'yyyy-MM-dd');
    const monthLastDay = formatDate(monthEnd, 'yyyy-MM-dd');

    // FIX (2026-08-18): This used to delete EVERY transaction in the month with no type
    // filter. Rebuild only regenerates derived rows (time_entry + absence credits), so
    // book-once records were wiped and never came back.
    //
    // Affected types that are written exactly once and cannot be recomputed:
    //   'compensation'     — debit when a time-off-in-lieu day is approved
    //   'correction'       — manual admin adjustment
    //   'carry_over', 'payout', 'initial_balance', 'year_end_balance'
    //
    // Production had 0 'compensation' rows against 3 approved overtime_comp requests —
    // every one of them had been silently deleted by a later rebuild.
    //
    // SCOPE: This restores the audit trail. It does NOT by itself change any balance,
    // because getOvertimeBalance() sums the monthly overtime_balance aggregate rather
    // than these transactions. That the overtime_comp debit never reaches the balance at
    // all is a separate defect in the dual calculation system — tracked, not fixed here.
    // See .planning/debug/urlaubstage-bei-ablehnung-verloren.md (Bug 9/10)
    const REBUILDABLE_TYPES = [
      'worked',
      'time_entry',
      'earned',
      'vacation_credit',
      'sick_credit',
      'overtime_comp_credit',
      'special_credit',
      'unpaid_deduction',
      'unpaid_adjustment',
      'holiday_credit',
      'weekend_credit',
    ];

    const deleteResult = db.prepare(`
      DELETE FROM overtime_transactions
      WHERE userId = ?
        AND date BETWEEN ? AND ?
        AND type IN (${REBUILDABLE_TYPES.map(() => '?').join(', ')})
    `).run(userId, monthFirstDay, monthLastDay, ...REBUILDABLE_TYPES);

    logger.debug({ deletedCount: deleteResult.changes }, '🗑️  Deleted rebuildable transactions (book-once types preserved)');

    // STEP 4: Get previous month balance (for cumulative tracking)
    let runningBalance = getPreviousMonthBalance(userId, month);
    logger.debug({ runningBalance }, '💰 Starting balance from previous month');

    // STEP 5: Collect daily calculations
    const dailyCalculations = collectDailyCalculations(userId, user, startDate, endDate);

    // STEP 6: Insert transactions day-by-day with balance tracking
    let transactionsCreated = 0;

    for (const day of dailyCalculations) {
      const balanceBefore = runningBalance;

      // Handle absences specially (two transactions: earned + credit)
      if (day.absence.type) {
        transactionsCreated += handleAbsenceDay(
          userId,
          day,
          balanceBefore,
          runningBalance
        );

        // Update running balance
        runningBalance = calculateRunningBalanceAfterAbsence(
          runningBalance,
          day.targetHours,
          day.absence.type
        );
      } else {
        // Regular working day: earned = (actual - target + corrections)
        const overtime = day.timeEntriesHours - day.targetHours + day.corrections;

        insertTransactionWithBalance(
          userId,
          day.date,
          'time_entry',
          overtime,
          balanceBefore,
          `Differenz Soll/Ist ${day.date}`,
          null,
          null
        );

        transactionsCreated++;
        runningBalance += overtime;
      }
    }

    logger.info({ userId, month, transactionsCreated, finalBalance: runningBalance },
      '✅ Transactions rebuilt successfully');

    // STEP 7: Update overtime_balance (monthly aggregation)
    updateOvertimeBalanceForMonth(userId, month, dailyCalculations, runningBalance);
  });

  // Execute transaction (atomic!)
  transaction();
}

/**
 * Get balance at the end of previous month
 * Used as starting point for cumulative balance tracking
 *
 * CRITICAL: Must use overtime_transactions (cumulative balance), NOT overtime_balance (monthly differences)!
 */
function getPreviousMonthBalance(userId: number, month: string): number {
  // Get the first day of current month
  const monthStart = `${month}-01`;

  // Get the last transaction balance BEFORE this month starts
  const result = db.prepare(`
    SELECT COALESCE(balanceAfter, 0) as balance
    FROM overtime_transactions
    WHERE userId = ? AND date < ?
    ORDER BY date DESC, id DESC
    LIMIT 1
  `).get(userId, monthStart) as { balance: number | null };

  // If no previous transactions exist, start at 0
  const balance = result?.balance ?? 0;

  logger.debug({
    userId,
    month,
    previousBalance: balance
  }, '💰 Previous month balance from transactions');

  return Math.round(balance * 100) / 100;
}

/**
 * Collect daily calculations for entire month
 * Returns array of DayCalculation objects
 */
function collectDailyCalculations(
  userId: number,
  user: any,
  startDate: Date,
  endDate: Date
): DayCalculation[] {
  const calculations: DayCalculation[] = [];

  // Iterate day-by-day
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Check if holiday
    const isHoliday = !!db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);

    // Get target hours (respects holidays, weekends, workSchedule)
    const targetHours = getDailyTargetHours(user, dateStr);

    // Get time entries
    const timeEntries = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM time_entries
      WHERE userId = ? AND date = ?
    `).get(userId, dateStr) as { total: number };

    // Get approved absence (if any)
    const absence = db.prepare(`
      SELECT id, type
      FROM absence_requests
      WHERE userId = ?
        AND status = 'approved'
        AND startDate <= ?
        AND endDate >= ?
      LIMIT 1
    `).get(userId, dateStr, dateStr) as { id: number; type: string } | undefined;

    // Get corrections (from overtime_corrections table)
    const corrections = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM overtime_corrections
      WHERE userId = ? AND date = ?
    `).get(userId, dateStr) as { total: number };

    calculations.push({
      date: dateStr,
      targetHours,
      timeEntriesHours: timeEntries.total,
      absence: absence ? {
        type: absence.type as any,
        id: absence.id
      } : {
        type: null,
        id: null
      },
      corrections: corrections.total,
      isHoliday,
      isWeekend
    });
  }

  return calculations;
}

/**
 * Handle absence day: Creates TWO transactions
 * 1. earned: (0 - targetHours) = negative hours (Soll/Ist difference)
 * 2. credit: +targetHours (absence credit, except unpaid)
 *
 * Result: Net effect = 0 for ALL absence types.
 * Paid (vacation/sick/etc): earned(-targetHours) + credit(+targetHours) = 0
 * Unpaid: earned(-targetHours) + unpaid_deduction(+targetHours) = 0
 *
 * NOTE: The net-0 transaction effect is correct for the running balance.
 * The difference for unpaid vs paid is captured in updateOvertimeBalanceForMonth:
 * unpaid days reduce targetHours in the monthly aggregation (Soll-Stunden Reduktion).
 */
function handleAbsenceDay(
  userId: number,
  day: DayCalculation,
  balanceBefore: number,
  _runningBalance: number
): number {
  let transactionsCreated = 0;
  let currentBalance = balanceBefore;

  // Transaction 1: earned (negative, because actual=0, target>0)
  const earnedHours = day.timeEntriesHours - day.targetHours; // Usually -targetHours

  insertTransactionWithBalance(
    userId,
    day.date,
    'time_entry',
    earnedHours,
    currentBalance,
    `Abwesenheit (${day.absence.type}): Soll/Ist-Differenz`,
    'absence',
    day.absence.id
  );

  transactionsCreated++;
  currentBalance += earnedHours;

  // Transaction 2: credit (positive, neutralizes earned, except for unpaid)
  if (day.absence.type !== 'unpaid') {
    const creditType = getCreditType(day.absence.type!);
    const creditHours = day.targetHours; // Full target hours

    insertTransactionWithBalance(
      userId,
      day.date,
      creditType,
      creditHours,
      currentBalance,
      `${getCreditDescription(day.absence.type!)} ${day.date}`,
      'absence',
      day.absence.id
    );

    transactionsCreated++;
    currentBalance += creditHours;
  } else {
    // Unpaid: Create neutralizing transaction for audit trail transparency.
    // Net effect on running balance = 0 (earned + deduction = 0).
    // The actual overtime impact (Soll-Reduktion) is handled in updateOvertimeBalanceForMonth.
    insertTransactionWithBalance(
      userId,
      day.date,
      'unpaid_deduction',
      day.targetHours,
      currentBalance,
      `Unbezahlter Urlaub Anpassung ${day.date}`,
      'absence',
      day.absence.id
    );

    transactionsCreated++;
    currentBalance += day.targetHours;
  }

  return transactionsCreated;
}

/**
 * Calculate running balance after absence day.
 *
 * Both paid and unpaid absences produce net = 0 change in the running balance.
 * Paid: earned(-targetHours) + credit(+targetHours) = 0
 * Unpaid: earned(-targetHours) + unpaid_deduction(+targetHours) = 0
 *
 * The difference for unpaid is captured in updateOvertimeBalanceForMonth
 * which excludes unpaid days from the targetHours sum (Soll-Reduktion).
 */
function calculateRunningBalanceAfterAbsence(
  currentBalance: number,
  targetHours: number,
  absenceType: string
): number {
  // Both paid and unpaid: net change = 0
  // (earned = -targetHours, credit/deduction = +targetHours)
  const earnedChange = -targetHours;
  const creditChange = targetHours; // Always +targetHours (neutralizes earned for all types)

  void absenceType; // absenceType distinction handled in updateOvertimeBalanceForMonth

  return currentBalance + earnedChange + creditChange;
}

/**
 * Get transaction type for absence credit
 */
function getCreditType(absenceType: string): string {
  const mapping: Record<string, string> = {
    'vacation': 'vacation_credit',
    'sick': 'sick_credit',
    'overtime_comp': 'overtime_comp_credit',
    'special': 'special_credit'
  };

  return mapping[absenceType] || 'time_entry';
}

/**
 * Get description for absence credit
 */
function getCreditDescription(absenceType: string): string {
  const mapping: Record<string, string> = {
    'vacation': 'Urlaubs-Gutschrift',
    'sick': 'Krankheits-Gutschrift',
    'overtime_comp': 'Überstunden-Ausgleich Gutschrift',
    'special': 'Sonderurlaub-Gutschrift'
  };

  return mapping[absenceType] || 'Gutschrift';
}

/**
 * Insert transaction with balance tracking
 * REFACTORED: Now uses OvertimeTransactionManager for centralized transaction creation
 */
function insertTransactionWithBalance(
  userId: number,
  date: string,
  type: string,
  hours: number,
  balanceBefore: number,
  description: string,
  referenceType: string | null,
  referenceId: number | null
): void {
  const balanceAfter = balanceBefore + hours;

  transactionManager.createTransaction({
    userId,
    date,
    type: type as any, // Type assertion needed due to string type from function signature
    hours,
    description,
    referenceType: referenceType as any,
    referenceId,
    balanceBefore,
    balanceAfter
  });
}

/**
 * Update overtime_balance table (monthly aggregation)
 * This is derived from transactions, not source of truth!
 *
 * UNPAID LEAVE RULE (CLAUDE.md): "Reduziert Soll-Stunden, keine Gutschrift"
 * For unpaid days: targetHours contribution = 0 (Soll reduced), actualHours = 0 (no credit)
 * Net overtime impact = 0 - 0 = 0 per unpaid day.
 */
function updateOvertimeBalanceForMonth(
  userId: number,
  month: string,
  dailyCalculations: DayCalculation[],
  _finalBalance: number
): void {
  // Calculate monthly totals
  // FIX (Bug #3): Unpaid days reduce Soll to 0 — exclude their targetHours from the sum.
  const targetHours = dailyCalculations.reduce((sum, day) => {
    // Unpaid leave reduces Soll-Stunden to 0 for those days (CLAUDE.md rule)
    if (day.absence.type === 'unpaid') {
      return sum; // Add 0 for unpaid days
    }
    return sum + day.targetHours;
  }, 0);

  const actualHours = dailyCalculations.reduce((sum, day) => {
    // Actual = time entries + absence credits (all except unpaid)
    let dayActual = day.timeEntriesHours;

    if (day.absence.type && day.absence.type !== 'unpaid') {
      dayActual += day.targetHours; // Absence credit
    }

    // Add corrections
    dayActual += day.corrections;

    return sum + dayActual;
  }, 0);

  // Upsert to overtime_balance
  const result = db.prepare(`
    INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, month)
    DO UPDATE SET targetHours = ?, actualHours = ?
  `).run(
    userId,
    month,
    Math.round(targetHours * 100) / 100,
    Math.round(actualHours * 100) / 100,
    Math.round(targetHours * 100) / 100,
    Math.round(actualHours * 100) / 100
  );

  logger.info({
    userId,
    month,
    targetHours,
    actualHours,
    overtime: actualHours - targetHours,
    dbChanges: result.changes
  }, '📊 Updated overtime_balance');
}

/**
 * Get current overtime balance from overtime_balance table
 * (Maintained by this service, used by work_time_accounts sync)
 */
export function getCurrentOvertimeBalance(userId: number): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
    FROM overtime_balance
    WHERE userId = ?
  `).get(userId) as { balance: number };

  return Math.round(result.balance * 100) / 100;
}
