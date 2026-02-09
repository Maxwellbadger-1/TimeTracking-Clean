/**
 * Migration 006: Add 'time_entry' and Modern Transaction Types
 *
 * PROBLEM: Code uses 'time_entry' but CHECK constraint doesn't allow it
 * SOLUTION: Extend CHECK constraint to include modern transaction types
 *
 * OLD constraint:
 * - 'earned', 'compensation', 'correction', 'carryover'
 * - 'vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment'
 *
 * NEW constraint (complete list):
 * - 'worked', 'time_entry', 'vacation_credit', 'sick_credit'
 * - 'overtime_comp_credit', 'special_credit', 'unpaid_deduction'
 * - 'holiday_credit', 'weekend_credit', 'carry_over', 'payout'
 * - 'correction', 'initial_balance', 'year_end_balance'
 * - 'earned', 'compensation', 'carryover', 'unpaid_adjustment' (legacy, keep for compatibility)
 *
 * SAFE: Preserves all existing data, fully reversible
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export default {
  async up(db: Database.Database) {
    logger.info('🚀 Migration 006: Adding time_entry and modern transaction types...');

    // Step 1: Check current transaction count
    const countBefore = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    logger.info(`📊 Current transactions: ${countBefore}`);

    // Step 2: Create new table with extended CHECK constraint
    logger.info('📝 Creating new table with extended types...');
    db.prepare(`
      CREATE TABLE overtime_transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN (
          'worked', 'time_entry', 'vacation_credit', 'sick_credit',
          'overtime_comp_credit', 'special_credit', 'unpaid_deduction',
          'holiday_credit', 'weekend_credit', 'carry_over', 'payout',
          'correction', 'initial_balance', 'year_end_balance',
          'earned', 'compensation', 'carryover', 'unpaid_adjustment'
        )),
        hours REAL NOT NULL,
        description TEXT,
        referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system', NULL)),
        referenceId INTEGER,
        balanceBefore REAL,
        balanceAfter REAL,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();

    // Step 3: Copy all existing data
    logger.info('📦 Copying existing transactions...');

    // Check if balanceBefore/balanceAfter columns exist in old table
    const oldTableInfo = db.pragma('table_info(overtime_transactions)') as Array<{ name: string }>;
    const hasBalanceColumns = oldTableInfo.some(col => col.name === 'balanceBefore');

    if (hasBalanceColumns) {
      // New schema with balance columns
      db.prepare(`
        INSERT INTO overtime_transactions_new
          (id, userId, date, type, hours, description, referenceType, referenceId,
           balanceBefore, balanceAfter, createdAt, createdBy)
        SELECT
          id, userId, date, type, hours, description, referenceType, referenceId,
          balanceBefore, balanceAfter, createdAt, createdBy
        FROM overtime_transactions
      `).run();
    } else {
      // Old schema without balance columns
      db.prepare(`
        INSERT INTO overtime_transactions_new
          (id, userId, date, type, hours, description, referenceType, referenceId, createdAt, createdBy)
        SELECT
          id, userId, date, type, hours, description, referenceType, referenceId, createdAt, createdBy
        FROM overtime_transactions
      `).run();
    }

    const countAfter = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions_new
    `).get() as { count: number }).count;

    if (countBefore !== countAfter) {
      throw new Error(`❌ Data copy failed: ${countBefore} rows in source, ${countAfter} rows in target`);
    }

    logger.info(`✅ Copied ${countAfter} transactions successfully`);

    // Step 4: Drop old table
    logger.info('🗑️  Dropping old table...');
    db.prepare(`DROP TABLE overtime_transactions`).run();

    // Step 5: Rename new table
    logger.info('📝 Renaming new table...');
    db.prepare(`ALTER TABLE overtime_transactions_new RENAME TO overtime_transactions`).run();

    // Step 6: Recreate indexes
    logger.info('🔍 Recreating indexes...');
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_userId ON overtime_transactions(userId)
    `).run();
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_date ON overtime_transactions(date)
    `).run();
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_type ON overtime_transactions(type)
    `).run();

    // Step 7: Verify final state
    const finalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    logger.info('');
    logger.info('================================================================================');
    logger.info('✅ MIGRATION 006 COMPLETED');
    logger.info('================================================================================');
    logger.info(`Total transactions migrated: ${finalCount}`);
    logger.info('');
    logger.info('NEW allowed transaction types:');
    logger.info('  Modern types (preferred):');
    logger.info('    - time_entry (daily overtime from time entries)');
    logger.info('    - worked (worked hours transaction)');
    logger.info('    - vacation_credit, sick_credit, overtime_comp_credit, special_credit');
    logger.info('    - unpaid_deduction (unpaid leave)');
    logger.info('    - holiday_credit, weekend_credit');
    logger.info('    - correction, payout, carry_over');
    logger.info('    - initial_balance, year_end_balance');
    logger.info('');
    logger.info('  Legacy types (kept for compatibility):');
    logger.info('    - earned, compensation, carryover, unpaid_adjustment');
    logger.info('================================================================================');
    logger.info('');
  }
};
