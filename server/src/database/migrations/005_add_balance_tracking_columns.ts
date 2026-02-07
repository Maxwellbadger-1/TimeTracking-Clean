/**
 * Migration 005: Add Balance Tracking Columns to overtime_transactions
 *
 * ISSUE: Code uses balanceBefore and balanceAfter columns that don't exist in DB
 * SOLUTION: Add these columns for proper balance tracking
 *
 * COLUMNS TO ADD:
 * - balanceBefore: Balance before this transaction
 * - balanceAfter: Balance after this transaction (balanceBefore + hours)
 *
 * BENEFITS:
 * - Proper audit trail with running balance
 * - Faster balance queries (no need to SUM all previous transactions)
 * - Professional standard (SAP, Personio, DATEV)
 *
 * Date: 2026-02-07
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export function up(db: Database.Database): void {
  logger.info('🔄 Migration 005: Adding balance tracking columns to overtime_transactions...');

  try {
    // Add balanceBefore column (nullable initially)
    db.prepare(`
      ALTER TABLE overtime_transactions
      ADD COLUMN balanceBefore REAL
    `).run();
    logger.info('✅ Added balanceBefore column');

    // Add balanceAfter column (nullable initially)
    db.prepare(`
      ALTER TABLE overtime_transactions
      ADD COLUMN balanceAfter REAL
    `).run();
    logger.info('✅ Added balanceAfter column');

    // Migrate existing data: Calculate balance tracking for all existing transactions
    logger.info('🔄 Calculating balance tracking for existing transactions...');

    // Get all users with transactions
    const users = db.prepare(`
      SELECT DISTINCT userId FROM overtime_transactions ORDER BY userId
    `).all() as Array<{ userId: number }>;

    let totalUpdated = 0;

    for (const { userId } of users) {
      // Get all transactions for this user, ordered by date and creation time
      const transactions = db.prepare(`
        SELECT id, hours
        FROM overtime_transactions
        WHERE userId = ?
        ORDER BY date ASC, createdAt ASC
      `).all(userId) as Array<{ id: number; hours: number }>;

      let runningBalance = 0;

      // Update each transaction with calculated balances
      for (const transaction of transactions) {
        const balanceBefore = runningBalance;
        const balanceAfter = runningBalance + transaction.hours;

        db.prepare(`
          UPDATE overtime_transactions
          SET balanceBefore = ?, balanceAfter = ?
          WHERE id = ?
        `).run(
          Math.round(balanceBefore * 100) / 100,
          Math.round(balanceAfter * 100) / 100,
          transaction.id
        );

        runningBalance = balanceAfter;
        totalUpdated++;
      }
    }

    logger.info({ totalUpdated, userCount: users.length }, '✅ Balance tracking calculated for existing transactions');

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to add balance tracking columns');
    throw error;
  }
}

export function down(_db: Database.Database): void {
  logger.info('🔄 Migration 005 DOWN: Removing balance tracking columns...');

  try {
    // SQLite doesn't support DROP COLUMN directly, so we need to:
    // 1. Create new table without these columns
    // 2. Copy data
    // 3. Drop old table
    // 4. Rename new table

    // For simplicity in development, we'll just warn
    logger.warn('⚠️  SQLite does not support DROP COLUMN. Manual intervention required to rollback.');
    logger.warn('⚠️  Columns balanceBefore and balanceAfter will remain in the table.');

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to remove balance tracking columns');
    throw error;
  }
}
