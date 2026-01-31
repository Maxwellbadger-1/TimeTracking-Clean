/**
 * Migration: Backfill All Overtime Transactions
 *
 * WHAT: Creates complete transaction history for all users
 * WHY: Production databases created before transaction system need historical data
 * WHEN: Auto-runs on first server start after update
 *
 * Creates:
 * - 'earned' transactions (daily time entry differences)
 * - Absence credit transactions (vacation, sick, overtime_comp, special)
 * - Unpaid leave adjustments
 * - Correction transactions (manual adjustments)
 *
 * SAFE: Idempotent (skips existing transactions)
 * FAST: Processes all users in parallel where possible
 */

import Database from 'better-sqlite3';
import { ensureDailyOvertimeTransactions } from '../../services/overtimeService.js';
import logger from '../../utils/logger.js';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  hireDate: string;
}

export default {
  async up(db: Database.Database) {
    logger.info('🚀 Migration 001: Backfilling overtime transactions...');

    // Get all active users
    const users = db.prepare(`
      SELECT id, firstName, lastName, hireDate
      FROM users
      WHERE deletedAt IS NULL
      ORDER BY id ASC
    `).all() as User[];

    logger.info(`📊 Found ${users.length} active users to process`);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let totalUsersProcessed = 0;
    let totalErrors = 0;
    let totalTransactionsCreated = 0;

    // Process each user sequentially (to avoid database locking issues)
    for (const user of users) {
      try {
        // Calculate start month (from hire date)
        const hireDate = new Date(user.hireDate);
        const hireYear = hireDate.getFullYear();
        const hireMonth = hireDate.getMonth() + 1;

        const startMonth = `${hireYear}-${String(hireMonth).padStart(2, '0')}`;
        const endMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        logger.debug({
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          startMonth,
          endMonth
        }, '⏳ Processing user');

        // Count before
        const before = (db.prepare(`
          SELECT COUNT(*) as count
          FROM overtime_transactions
          WHERE userId = ?
        `).get(user.id) as { count: number }).count;

        // Ensure ALL transaction types (earned + absences + corrections)
        await ensureDailyOvertimeTransactions(user.id, startMonth, endMonth);

        // Count after
        const after = (db.prepare(`
          SELECT COUNT(*) as count
          FROM overtime_transactions
          WHERE userId = ?
        `).get(user.id) as { count: number }).count;

        const created = after - before;
        totalTransactionsCreated += created;

        logger.debug({
          userId: user.id,
          transactionsCreated: created,
          totalTransactions: after
        }, `✅ User processed`);

        totalUsersProcessed++;
      } catch (error) {
        logger.error({
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          error: error instanceof Error ? error.message : String(error)
        }, '❌ Error processing user');
        totalErrors++;
      }
    }

    // Final summary
    const totalTransactions = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    const typeBreakdown = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM overtime_transactions
      GROUP BY type
      ORDER BY count DESC
    `).all() as Array<{ type: string; count: number }>;

    logger.info('');
    logger.info('================================================================================');
    logger.info('✅ MIGRATION 001 COMPLETED');
    logger.info('================================================================================');
    logger.info(`Users processed: ${totalUsersProcessed}/${users.length}`);
    logger.info(`Errors: ${totalErrors}`);
    logger.info(`Transactions created: ${totalTransactionsCreated}`);
    logger.info(`Total transactions in database: ${totalTransactions}`);
    logger.info('');
    logger.info('Transaction Breakdown:');
    typeBreakdown.forEach(({ type, count }) => {
      const percentage = ((count / totalTransactions) * 100).toFixed(1);
      logger.info(`  ${type.padEnd(25)}: ${String(count).padStart(6)} (${percentage}%)`);
    });
    logger.info('================================================================================');
    logger.info('');
  }
};
