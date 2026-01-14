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
 * - 'earned': Daily overtime from time entries (Soll/Ist difference)
 * - 'compensation': Overtime deduction when taking time off
 * - 'correction': Manual adjustments by admin
 * - 'carryover': Year-end transfer (audit trail only, 0 hours)
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { formatDate } from '../utils/timezone.js';

export interface OvertimeTransaction {
  id: number;
  userId: number;
  date: string;
  type: 'earned' | 'compensation' | 'correction' | 'carryover';
  hours: number;
  description: string | null;
  referenceType: 'time_entry' | 'absence' | 'manual' | 'system' | null;
  referenceId: number | null;
  createdAt: string;
  createdBy: number | null;
}

/**
 * Record earned overtime from daily time tracking
 *
 * AUTOMATIC: Called after time entry CREATE/UPDATE/DELETE
 * Calculates daily overtime as: actualHours - targetHours
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
  if (hours === 0) {
    logger.debug({ userId, date }, 'Skipping transaction: 0 hours');
    return;
  }

  const desc = description || `Differenz Soll/Ist ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType)
    VALUES (?, ?, 'earned', ?, ?, 'time_entry')
  `).run(userId, date, hours, desc);

  logger.debug({
    userId,
    date,
    hours,
    type: 'earned'
  }, `✅ Recorded earned overtime: ${hours > 0 ? '+' : ''}${hours}h`);
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
 */
export function recordOvertimeCorrection(
  userId: number,
  date: string,
  hours: number,
  description: string,
  adminId: number
): void {
  if (!description || description.trim().length === 0) {
    throw new Error('Description is required for manual corrections');
  }

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, createdBy)
    VALUES (?, ?, 'correction', ?, ?, 'manual', ?)
  `).run(userId, date, hours, description, adminId);

  logger.warn({
    userId,
    date,
    hours,
    adminId,
    description,
    type: 'correction'
  }, `⚠️ Manual overtime correction: ${hours > 0 ? '+' : ''}${hours}h`);
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
 * Get current overtime balance for a user
 *
 * @param userId User ID
 * @returns Current balance (sum of all transactions)
 */
export function getOvertimeBalance(userId: number): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as balance
    FROM overtime_transactions
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
 * Only deletes 'earned' transactions to avoid data loss
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
      AND type = 'earned'
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
