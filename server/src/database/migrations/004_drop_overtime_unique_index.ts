/**
 * Migration 004: Drop Problematic UNIQUE Index on overtime_transactions
 *
 * ISSUE: idx_overtime_transactions_unique prevented time entry creation
 * CAUSE: Dual system (legacy + modern) creates similar transactions with different referenceIds
 * SOLUTION: Drop the overly restrictive UNIQUE index
 *
 * The index was:
 *   CREATE UNIQUE INDEX idx_overtime_transactions_unique
 *   ON overtime_transactions(userId, date, type, COALESCE(referenceType, ''), COALESCE(referenceId, -1))
 *
 * IMPACT:
 * - Allows both legacy and modern transaction creation to coexist
 * - OvertimeTransactionManager will prevent duplicates programmatically
 * - Maintains performance with existing indexes (userId, date, type)
 *
 * Date: 2026-02-07
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export function up(db: Database.Database): void {
  logger.info('🔄 Migration 004: Dropping idx_overtime_transactions_unique...');

  try {
    // Check if the index exists before trying to drop it
    const indexExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name='idx_overtime_transactions_unique'
    `).get();

    if (indexExists) {
      db.prepare(`DROP INDEX idx_overtime_transactions_unique`).run();
      logger.info('✅ Dropped idx_overtime_transactions_unique');
    } else {
      logger.info('ℹ️  Index idx_overtime_transactions_unique does not exist, skipping');
    }

    // Verify remaining indexes are intact
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='overtime_transactions'
    `).all() as Array<{ name: string }>;

    logger.info({ indexes: indexes.map(i => i.name) }, '📊 Remaining indexes');

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to drop index');
    throw error;
  }
}

export function down(db: Database.Database): void {
  logger.info('🔄 Migration 004 DOWN: Recreating idx_overtime_transactions_unique...');

  try {
    // Recreate the index (for rollback purposes)
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_transactions_unique
      ON overtime_transactions(userId, date, type, COALESCE(referenceType, ''), COALESCE(referenceId, -1))
    `).run();

    logger.info('✅ Recreated idx_overtime_transactions_unique');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to recreate index');
    throw error;
  }
}
