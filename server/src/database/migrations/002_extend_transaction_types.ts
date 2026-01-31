/**
 * Migration: Extend overtime_transactions Type CHECK Constraint
 *
 * WHAT: Adds support for credit transaction types (vacation_credit, sick_credit, etc.)
 * WHY: Current schema only allows 4 types, blocking absence credit transactions
 * WHEN: Auto-runs on first server start after update
 *
 * Changes:
 * - OLD: CHECK(type IN ('earned', 'compensation', 'correction', 'carryover'))
 * - NEW: CHECK(type IN ('earned', 'compensation', 'correction', 'carryover',
 *                       'vacation_credit', 'sick_credit', 'overtime_comp_credit',
 *                       'special_credit', 'unpaid_adjustment'))
 *
 * SAFE: Preserves all existing data, idempotent
 * METHOD: SQLite table recreation (standard approach for modifying CHECK constraints)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export default {
  async up(db: Database.Database) {
    logger.info('🚀 Migration 002: Extending overtime_transactions type constraint...');

    // Step 1: Create new table with extended CHECK constraint
    logger.info('📝 Creating new table with extended types...');
    db.prepare(`
      CREATE TABLE overtime_transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN (
          'earned',
          'compensation',
          'correction',
          'carryover',
          'vacation_credit',
          'sick_credit',
          'overtime_comp_credit',
          'special_credit',
          'unpaid_adjustment'
        )),
        hours REAL NOT NULL,
        description TEXT,
        referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system')),
        referenceId INTEGER,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();

    // Step 2: Copy all existing data
    logger.info('📦 Copying existing transactions...');
    const countBefore = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    db.prepare(`
      INSERT INTO overtime_transactions_new
        (id, userId, date, type, hours, description, referenceType, referenceId, createdAt, createdBy)
      SELECT
        id, userId, date, type, hours, description, referenceType, referenceId, createdAt, createdBy
      FROM overtime_transactions
    `).run();

    const countAfter = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions_new
    `).get() as { count: number }).count;

    if (countBefore !== countAfter) {
      throw new Error(`Data copy failed: ${countBefore} rows in source, ${countAfter} rows in target`);
    }

    logger.info(`✅ Copied ${countAfter} transactions successfully`);

    // Step 3: Drop old table
    logger.info('🗑️  Dropping old table...');
    db.prepare(`DROP TABLE overtime_transactions`).run();

    // Step 4: Rename new table
    logger.info('📝 Renaming new table...');
    db.prepare(`ALTER TABLE overtime_transactions_new RENAME TO overtime_transactions`).run();

    // Step 5: Recreate indexes
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

    // Step 6: Verify final state
    const finalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    logger.info('');
    logger.info('================================================================================');
    logger.info('✅ MIGRATION 002 COMPLETED');
    logger.info('================================================================================');
    logger.info(`Total transactions migrated: ${finalCount}`);
    logger.info('');
    logger.info('Allowed transaction types:');
    logger.info('  - earned (daily overtime from time entries)');
    logger.info('  - compensation (overtime taken as time off)');
    logger.info('  - correction (manual adjustments)');
    logger.info('  - carryover (year-end balance transfer)');
    logger.info('  - vacation_credit (vacation day credits)');
    logger.info('  - sick_credit (sick day credits)');
    logger.info('  - overtime_comp_credit (overtime compensation credits)');
    logger.info('  - special_credit (special leave credits)');
    logger.info('  - unpaid_adjustment (unpaid leave adjustments)');
    logger.info('================================================================================');
    logger.info('');
  }
};
