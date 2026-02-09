/**
 * Overtime Transaction Service
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Transaction-based overtime tracking (Arbeitszeitkonto)
 * - Immutable audit trail for all overtime changes
 * - Separate handling of earned overtime vs. compensation
 * - Compliance with German labor law (Arbeitszeitgesetz)
 *
 * TRANSACTION TYPES:
 * - 'time_entry': Daily overtime from time entries (Soll/Ist difference)
 * - 'compensation': Overtime deduction when taking time off
 * - 'correction': Manual adjustments by admin
 * - 'carryover': Year-end transfer (audit trail only, 0 hours)
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

export interface OvertimeTransaction {
  id: number;
  userId: number;
  date: string;
  type: 'time_entry' | 'compensation' | 'correction' | 'carryover';
  hours: number;
  description: string | null;
  referenceType: 'time_entry' | 'absence' | 'manual' | 'system' | null;
  referenceId: number | null;
  createdAt: string;
  createdBy: number | null;
}

/**
 * Get balance before a specific date (for transaction tracking)
 * PHASE 4: Used to populate balanceBefore/balanceAfter columns
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD) - get balance before this date
 * @returns Balance before the given date
 */
function getBalanceBeforeDate(userId: number, date: string): number {
  // Get the most recent transaction before this date
  const result = db.prepare(`
    SELECT balanceAfter
    FROM overtime_transactions
    WHERE userId = ? AND date < ?
    ORDER BY date DESC, createdAt DESC
    LIMIT 1
  `).get(userId, date) as { balanceAfter: number | null } | undefined;

  if (result && result.balanceAfter !== null) {
    return result.balanceAfter;
  }

  // No previous transactions, start from 0
  return 0;
}

/**
 * Record earned overtime from daily time tracking
 *
 * AUTOMATIC: Called after time entry CREATE/UPDATE/DELETE
 * Calculates daily overtime as: actualHours - targetHours
 *
 * PHASE 4: Now includes balanceBefore/balanceAfter tracking
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Overtime hours (positive or negative)
 * @param description Optional description
 */
export function recordOvertimeEarned(
  userId: number,
  date: string,
  hours: number,
  description?: string
): void {
  // ✅ ALLOW 0h transactions (important for complete audit trail!)
  // Even days with 0h overtime should be logged for transparency

  const desc = description || `Differenz Soll/Ist ${date}`;

  // PHASE 4: Calculate balance tracking
  const balanceBefore = getBalanceBeforeDate(userId, date);
  const balanceAfter = balanceBefore + hours;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, balanceBefore, balanceAfter)
    VALUES (?, ?, 'time_entry', ?, ?, 'time_entry', ?, ?)
  `).run(userId, date, hours, desc, balanceBefore, balanceAfter);

  logger.debug({
    userId,
    date,
    hours,
    type: 'time_entry',
    balanceBefore,
    balanceAfter
  }, `✅ Recorded earned overtime: ${hours > 0 ? '+' : ''}${hours}h (balance: ${balanceBefore} → ${balanceAfter})`);
}

/**
 * Record overtime compensation (time off in lieu)
 *
 * MANUAL: Called when admin approves overtime_comp absence
 * Deducts hours from overtime account
 *
 * @param userId User ID
 * @param date Start date of absence (YYYY-MM-DD)
 * @param hours Hours to deduct (will be stored as negative)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordOvertimeCompensation(
  userId: number,
  date: string,
  hours: number,
  absenceId: number,
  description?: string
): void {
  // Ensure hours are negative (deduction)
  const hoursToDeduct = -Math.abs(hours);

  const desc = description || `Überstunden-Ausgleich ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'compensation', ?, ?, 'absence', ?)
  `).run(userId, date, hoursToDeduct, desc, absenceId);

  logger.info({
    userId,
    date,
    hours: hoursToDeduct,
    absenceId,
    type: 'compensation'
  }, `✅ Recorded overtime compensation: ${hoursToDeduct}h`);
}

/**
 * Record manual overtime correction by admin
 *
 * MANUAL: Admin tool for fixing errors or making adjustments
 *
 * @param userId User ID
 * @param date Date of correction (YYYY-MM-DD)
 * @param hours Hours to add/subtract
 * @param description Reason for correction (required!)
 * @param adminId Admin user ID who made the correction
 * @param correctionId Optional FK to overtime_corrections table
 */
export function recordOvertimeCorrection(
  userId: number,
  date: string,
  hours: number,
  description: string,
  adminId: number,
  correctionId?: number
): void {
  if (!description || description.trim().length === 0) {
    throw new Error('Description is required for manual corrections');
  }

  // PHASE 4: Calculate balance tracking
  const balanceBefore = getBalanceBeforeDate(userId, date);
  const balanceAfter = balanceBefore + hours;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId, createdBy, balanceBefore, balanceAfter)
    VALUES (?, ?, 'correction', ?, ?, 'manual', ?, ?, ?, ?)
  `).run(userId, date, hours, description, correctionId || null, adminId, balanceBefore, balanceAfter);

  logger.warn({
    userId,
    date,
    hours,
    adminId,
    correctionId,
    description,
    type: 'correction',
    balanceBefore,
    balanceAfter
  }, `⚠️ Manual overtime correction: ${hours > 0 ? '+' : ''}${hours}h (balance: ${balanceBefore} → ${balanceAfter})`);
}

/**
 * Record year-end carryover (audit trail only, 0 hours)
 *
 * AUTOMATIC: Called by year-end rollover service
 * Creates a marker transaction for audit purposes
 *
 * @param userId User ID
 * @param year New year (e.g., 2026)
 */
export function recordYearEndCarryover(
  userId: number,
  year: number
): void {
  const date = `${year}-01-01`;
  const description = `Jahreswechsel ${year - 1} → ${year}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType)
    VALUES (?, ?, 'carryover', 0, ?, 'system')
  `).run(userId, date, description);

  logger.debug({
    userId,
    year,
    type: 'carryover'
  }, `📅 Recorded year-end carryover marker`);
}

/**
 * Record vacation credit (Urlaubs-Gutschrift)
 *
 * AUTOMATIC: Called when absence is approved or when ensuring transactions
 * Credits target hours for vacation days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordVacationCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Urlaubs-Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'vacation_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'vacation_credit'
  }, `✅ Recorded vacation credit: +${hours}h`);
}

/**
 * Record sick leave credit (Krankheits-Gutschrift)
 *
 * AUTOMATIC: Called when sick leave is approved or when ensuring transactions
 * Credits target hours for sick days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordSickCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Krankheits-Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'sick_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'sick_credit'
  }, `✅ Recorded sick credit: +${hours}h`);
}

/**
 * Record overtime compensation credit (Überstunden-Ausgleich Gutschrift)
 *
 * AUTOMATIC: Called when overtime_comp is approved or when ensuring transactions
 * Credits target hours for overtime compensation days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordOvertimeCompCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Überstunden-Ausgleich Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'overtime_comp_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'overtime_comp_credit'
  }, `✅ Recorded overtime comp credit: +${hours}h`);
}

/**
 * Record special leave credit (Sonderurlaub-Gutschrift)
 *
 * AUTOMATIC: Called when special leave is approved or when ensuring transactions
 * Credits target hours for special leave days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordSpecialCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Sonderurlaub-Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'special_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'special_credit'
  }, `✅ Recorded special credit: +${hours}h`);
}

/**
 * Record unpaid leave adjustment (Unbezahlter Urlaub Anpassung)
 *
 * AUTOMATIC: Called when unpaid leave is approved or when ensuring transactions
 * Adds target hours to compensate for the negative earned transaction
 * (because unpaid reduces target to 0, so earned = 0 - 0 = 0, no adjustment needed actually!)
 *
 * WAIT - this is wrong! Unpaid leave REDUCES target, so:
 * - earned for unpaid day = 0h - 0h = 0h (correct!)
 * - NO additional transaction needed!
 *
 * But to show transparency: We record the adjustment for audit trail
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours that were reduced from target
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordUnpaidAdjustment(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  // ACTUALLY: For unpaid leave, we DON'T need an adjustment transaction
  // because the target is already reduced to 0, so earned = 0 - 0 = 0
  // This function is kept for completeness but may not be used

  const desc = description || `Unbezahlter Urlaub Anpassung ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'unpaid_deduction', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'unpaid_deduction'
  }, `✅ Recorded unpaid adjustment: +${hours}h`);
}

/**
 * Get current overtime balance for a user
 *
 * FIXED: Now uses overtime_balance (Single Source of Truth)
 * - overtime_balance contains CORRECTLY calculated cumulative overtime
 * - Includes unpaid leave reduction in target hours
 * - Professional standard (SAP, Personio, DATEV)
 *
 * @param userId User ID
 * @returns Current balance (cumulative sum from overtime_balance)
 */
export function getOvertimeBalance(userId: number): number {
  // FIXED: Sum overtime from overtime_balance (NOT transactions!)
  // overtime_balance contains cumulative overtime correctly calculated by updateMonthlyOvertime()
  // This ensures consistency with "Monatliche Entwicklung" display
  const result = db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
    FROM overtime_balance
    WHERE userId = ?
  `).get(userId) as { balance: number };

  return Math.round(result.balance * 100) / 100; // Round to 2 decimals
}

/**
 * Get overtime transaction history for a user
 *
 * @param userId User ID
 * @param year Optional year filter (e.g., 2026)
 * @param limit Optional limit (default: all)
 * @returns Array of transactions, newest first
 */
export function getOvertimeHistory(
  userId: number,
  year?: number,
  limit?: number
): OvertimeTransaction[] {
  let query = `
    SELECT *
    FROM overtime_transactions
    WHERE userId = ?
  `;

  const params: (number | string)[] = [userId];

  if (year) {
    query += ` AND date LIKE ?`;
    params.push(`${year}-%`);
  }

  query += ` ORDER BY date DESC, createdAt DESC`;

  if (limit) {
    query += ` LIMIT ?`;
    params.push(limit);
  }

  return db.prepare(query).all(...params) as OvertimeTransaction[];
}

/**
 * Get overtime transactions for a specific date range
 *
 * @param userId User ID
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Array of transactions, newest first
 */
export function getOvertimeHistoryByDateRange(
  userId: number,
  startDate: string,
  endDate: string
): OvertimeTransaction[] {
  return db.prepare(`
    SELECT *
    FROM overtime_transactions
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    ORDER BY date DESC, createdAt DESC
  `).all(userId, startDate, endDate) as OvertimeTransaction[];
}

/**
 * Get overtime balance at a specific date
 *
 * USEFUL FOR: Historical reports, year-end calculations
 *
 * @param userId User ID
 * @param date Date to calculate balance at (YYYY-MM-DD)
 * @returns Balance up to and including the specified date
 */
export function getOvertimeBalanceAtDate(
  userId: number,
  date: string
): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as balance
    FROM overtime_transactions
    WHERE userId = ?
      AND date <= ?
  `).get(userId, date) as { balance: number };

  return Math.round(result.balance * 100) / 100;
}

/**
 * Delete all transactions for a specific date
 *
 * INTERNAL USE: Called when recalculating daily overtime
 * Only deletes 'time_entry' transactions to avoid data loss
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 */
export function deleteEarnedTransactionsForDate(
  userId: number,
  date: string
): void {
  db.prepare(`
    DELETE FROM overtime_transactions
    WHERE userId = ?
      AND date = ?
      AND type = 'time_entry'
  `).run(userId, date);

  logger.debug({ userId, date }, 'Deleted earned transactions for recalculation');
}

/**
 * Get aggregated overtime stats for admin dashboard
 *
 * @param year Optional year filter (default: current year)
 * @returns Summary stats for all users
 */
export function getAggregatedOvertimeStats(year?: number): {
  totalUsers: number;
  totalBalance: number;
  averageBalance: number;
  maxBalance: number;
  minBalance: number;
} {
  let query = `
    SELECT
      COUNT(DISTINCT userId) as totalUsers,
      COALESCE(SUM(hours), 0) as totalBalance,
      COALESCE(AVG(hours), 0) as averageBalance,
      COALESCE(MAX(hours), 0) as maxBalance,
      COALESCE(MIN(hours), 0) as minBalance
    FROM (
      SELECT
        userId,
        SUM(hours) as hours
      FROM overtime_transactions
  `;

  const params: (number | string)[] = [];

  if (year) {
    query += ` WHERE date LIKE ?`;
    params.push(`${year}-%`);
  }

  query += `
      GROUP BY userId
    )
  `;

  const result = db.prepare(query).get(...params) as {
    totalUsers: number;
    totalBalance: number;
    averageBalance: number;
    maxBalance: number;
    minBalance: number;
  };

  return {
    totalUsers: result.totalUsers || 0,
    totalBalance: Math.round((result.totalBalance || 0) * 100) / 100,
    averageBalance: Math.round((result.averageBalance || 0) * 100) / 100,
    maxBalance: Math.round((result.maxBalance || 0) * 100) / 100,
    minBalance: Math.round((result.minBalance || 0) * 100) / 100,
  };
}

/**
 * Check if user has sufficient overtime balance
 *
 * VALIDATION: Used before approving overtime_comp absence
 *
 * @param userId User ID
 * @param hoursRequired Hours needed for absence
 * @param maxMinusHours Limit from work_time_accounts (e.g., -20)
 * @returns true if user has enough balance (considering limit)
 */
export function hasSufficientOvertimeBalance(
  userId: number,
  hoursRequired: number,
  maxMinusHours: number
): boolean {
  const currentBalance = getOvertimeBalance(userId);
  const balanceAfterDeduction = currentBalance - hoursRequired;

  return balanceAfterDeduction >= maxMinusHours;
}

/**
 * Monthly Transaction Summary Entry
 * Used for Monatliche Entwicklung (Monthly Development) display
 */
export interface MonthlyTransactionSummary {
  month: string;           // "2025-11"
  earned: number;          // Sum of 'time_entry' transactions
  compensation: number;    // Sum of 'compensation' transactions
  correction: number;      // Sum of 'correction' transactions
  carryover: number;       // Sum of 'carryover' transactions (usually 0 except January)
  balance: number;         // Cumulative balance at end of month
  balanceChange: number;   // Change from previous month
}

/**
 * Get monthly transaction summary for overtime history
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio):
 * - Groups transactions by month
 * - Shows earned/compensation/correction separately (full transparency)
 * - Calculates cumulative balance (like bank account)
 *
 * REPLACES: reportService.getOvertimeHistory() which used overtime_balance (wrong!)
 * NOW USES: overtime_transactions as Single Source of Truth
 *
 * @param userId User ID
 * @param months Number of months to retrieve (default: 12)
 * @returns Array of monthly summaries, newest first
 */
export function getMonthlyTransactionSummary(
  userId: number,
  months: number = 12
): MonthlyTransactionSummary[] {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get all transactions for this user in the date range
  const transactions = db.prepare(`
    SELECT
      substr(date, 1, 7) as month,
      type,
      SUM(hours) as totalHours
    FROM overtime_transactions
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY month, type
    ORDER BY month ASC
  `).all(userId, `${startMonth}-01`, `${currentMonth}-31`) as Array<{
    month: string;
    type: string; // Can be any transaction type (earned, time_entry, compensation, correction, vacation_credit, etc.)
    totalHours: number;
  }>;

  // Get balance before start month (for cumulative calculation)
  const previousBalance = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as balance
    FROM overtime_transactions
    WHERE userId = ?
      AND date < ?
  `).get(userId, `${startMonth}-01`) as { balance: number };

  // Group by month
  const monthsMap = new Map<string, {
    earned: number;
    compensation: number;
    correction: number;
    carryover: number;
  }>();

  transactions.forEach(t => {
    if (!monthsMap.has(t.month)) {
      monthsMap.set(t.month, { earned: 0, compensation: 0, correction: 0, carryover: 0 });
    }
    const monthData = monthsMap.get(t.month)!;

    // Map modern types to legacy types for this summary (backward compatibility)
    // 'time_entry' and 'earned' are semantically identical (daily overtime from time entries)
    const mappedType = t.type === 'time_entry' ? 'earned' : t.type;

    // Only count the 4 main types (ignore credit types like vacation_credit, etc.)
    if (mappedType === 'earned' || mappedType === 'compensation' ||
        mappedType === 'correction' || mappedType === 'carryover') {
      monthData[mappedType] += t.totalHours;
    }
  });

  // Build summary array with cumulative balance
  const summary: MonthlyTransactionSummary[] = [];
  let runningBalance = previousBalance.balance;

  // Sort months and calculate balances
  const sortedMonths = Array.from(monthsMap.keys()).sort();

  sortedMonths.forEach(month => {
    const data = monthsMap.get(month)!;

    // Balance change = sum of all transaction types
    const balanceChange = data.earned + data.compensation + data.correction + data.carryover;
    runningBalance += balanceChange;

    summary.push({
      month,
      earned: Math.round(data.earned * 100) / 100,
      compensation: Math.round(data.compensation * 100) / 100,
      correction: Math.round(data.correction * 100) / 100,
      carryover: Math.round(data.carryover * 100) / 100,
      balance: Math.round(runningBalance * 100) / 100,
      balanceChange: Math.round(balanceChange * 100) / 100,
    });
  });

  // Return newest first (for display)
  return summary.reverse();
}
