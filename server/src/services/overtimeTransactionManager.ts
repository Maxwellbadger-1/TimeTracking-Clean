/**
 * Overtime Transaction Manager
 *
 * CENTRAL SERVICE for all overtime transaction creation
 *
 * PRINCIPLES:
 * - Single Source of Truth for transaction creation
 * - Idempotent operations (safe to call multiple times)
 * - Duplicate prevention through checking before insert
 * - Proper referenceId handling for audit trail
 * - Transaction-based atomicity
 *
 * REPLACES:
 * - Direct INSERT INTO overtime_transactions throughout codebase
 * - Multiple competing transaction creation paths
 * - ensureAbsenceTransactionsForMonth (legacy, duplication-prone)
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Centralized transaction management
 * - Audit trail with proper references
 * - Idempotent operations for reliability
 *
 * Date: 2026-02-07
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

export interface TransactionParams {
  userId: number;
  date: string;
  type: 'earned' | 'compensation' | 'correction' | 'carryover' | 'vacation_credit' | 'sick_credit' | 'overtime_comp_credit' | 'special_credit' | 'unpaid_adjustment';
  hours: number;
  description: string;
  referenceType?: 'time_entry' | 'absence' | 'manual' | 'system' | null;
  referenceId?: number | null;
  createdBy?: number | null;
  balanceBefore?: number;
  balanceAfter?: number;
}

/**
 * Create an overtime transaction with duplicate checking
 *
 * IDEMPOTENT: If a similar transaction already exists, it won't create a duplicate
 * ATOMIC: Uses database transactions for consistency
 *
 * @param params Transaction parameters
 * @returns Transaction ID if created, null if already exists
 */
export function createTransaction(params: TransactionParams): number | null {
  const {
    userId,
    date,
    type,
    hours,
    description,
    referenceType = null,
    referenceId = null,
    createdBy = null,
    balanceBefore,
    balanceAfter
  } = params;

  // Check if this exact transaction already exists
  const existing = db.prepare(`
    SELECT id FROM overtime_transactions
    WHERE userId = ?
      AND date = ?
      AND type = ?
      AND ABS(hours - ?) < 0.01
      AND COALESCE(referenceType, '') = COALESCE(?, '')
      AND COALESCE(referenceId, -1) = COALESCE(?, -1)
  `).get(userId, date, type, hours, referenceType || '', referenceId ?? -1) as { id: number } | undefined;

  if (existing) {
    logger.debug({
      userId,
      date,
      type,
      hours,
      existingId: existing.id
    }, '🔄 Transaction already exists, skipping creation');
    return null;
  }

  // Calculate balance tracking if not provided
  const finalBalanceBefore = balanceBefore ?? getBalanceBeforeDate(userId, date);
  const finalBalanceAfter = balanceAfter ?? (finalBalanceBefore + hours);

  // Insert new transaction
  const result = db.prepare(`
    INSERT INTO overtime_transactions (
      userId, date, type, hours, balanceBefore, balanceAfter,
      description, referenceType, referenceId, createdBy
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    date,
    type,
    hours,
    Math.round(finalBalanceBefore * 100) / 100,
    Math.round(finalBalanceAfter * 100) / 100,
    description,
    referenceType,
    referenceId,
    createdBy
  );

  logger.debug({
    userId,
    date,
    type,
    hours,
    referenceType,
    referenceId,
    id: result.lastInsertRowid,
    balanceBefore: finalBalanceBefore,
    balanceAfter: finalBalanceAfter
  }, `✅ Created transaction: ${type} ${hours > 0 ? '+' : ''}${hours}h`);

  return Number(result.lastInsertRowid);
}

/**
 * Create multiple transactions atomically
 *
 * ALL transactions succeed or ALL fail (atomicity guarantee)
 *
 * @param transactions Array of transaction parameters
 * @returns Array of created transaction IDs
 */
export function createTransactionsBatch(transactions: TransactionParams[]): Array<number | null> {
  const result = db.transaction(() => {
    return transactions.map(tx => createTransaction(tx));
  })();

  return result;
}

/**
 * Delete all transactions for a specific date range and user
 *
 * USED BY: Rebuild services when recalculating monthly overtime
 *
 * @param userId User ID
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param types Optional array of transaction types to delete (default: all)
 */
export function deleteTransactionsInRange(
  userId: number,
  startDate: string,
  endDate: string,
  types?: string[]
): number {
  let query = `
    DELETE FROM overtime_transactions
    WHERE userId = ?
      AND date BETWEEN ? AND ?
  `;

  const params: (number | string)[] = [userId, startDate, endDate];

  if (types && types.length > 0) {
    const placeholders = types.map(() => '?').join(', ');
    query += ` AND type IN (${placeholders})`;
    params.push(...types);
  }

  const result = db.prepare(query).run(...params);

  logger.debug({
    userId,
    startDate,
    endDate,
    types,
    deletedCount: result.changes
  }, '🗑️  Deleted transactions in range');

  return result.changes;
}

/**
 * Check if a transaction with specific criteria exists
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param type Transaction type
 * @param referenceType Optional reference type filter
 * @param referenceId Optional reference ID filter
 * @returns True if transaction exists
 */
export function transactionExists(
  userId: number,
  date: string,
  type: string,
  referenceType?: string | null,
  referenceId?: number | null
): boolean {
  let query = `
    SELECT id FROM overtime_transactions
    WHERE userId = ?
      AND date = ?
      AND type = ?
  `;

  const params: (number | string)[] = [userId, date, type];

  if (referenceType !== undefined) {
    query += ` AND COALESCE(referenceType, '') = COALESCE(?, '')`;
    params.push(referenceType || '');
  }

  if (referenceId !== undefined) {
    query += ` AND COALESCE(referenceId, -1) = COALESCE(?, -1)`;
    params.push(referenceId ?? -1);
  }

  const result = db.prepare(query).get(...params);
  return result !== undefined;
}

/**
 * Get balance before a specific date (for transaction tracking)
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD) - get balance before this date
 * @returns Balance before the given date
 */
function getBalanceBeforeDate(userId: number, date: string): number {
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

  return 0;
}

/**
 * Get all transactions for a user in a date range
 *
 * @param userId User ID
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Array of transactions
 */
export function getTransactionsInRange(
  userId: number,
  startDate: string,
  endDate: string
): Array<{
  id: number;
  date: string;
  type: string;
  hours: number;
  description: string | null;
  referenceType: string | null;
  referenceId: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
}> {
  return db.prepare(`
    SELECT *
    FROM overtime_transactions
    WHERE userId = ?
      AND date BETWEEN ? AND ?
    ORDER BY date ASC, createdAt ASC
  `).all(userId, startDate, endDate) as Array<{
    id: number;
    date: string;
    type: string;
    hours: number;
    description: string | null;
    referenceType: string | null;
    referenceId: number | null;
    balanceBefore: number | null;
    balanceAfter: number | null;
  }>;
}
