/**
 * Migration Script: Migrate existing overtime data to transaction system
 *
 * PURPOSE:
 * - Migrates historical time entries to overtime_transactions
 * - Recalculates all daily overtime (Soll/Ist differences)
 * - Creates transaction records for all past dates
 * - Handles holidays, work schedules, and hire dates correctly
 *
 * SAFE TO RUN MULTIPLE TIMES:
 * - Deletes existing 'earned' transactions before recreating
 * - Does NOT touch 'compensation', 'correction', or 'carryover' transactions
 *
 * USAGE:
 *   npm run migrate:overtime
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { getUserById } from '../services/userService.js';
import { recordOvertimeEarned, deleteEarnedTransactionsForDate } from '../services/overtimeTransactionService.js';

interface MigrationStats {
  totalUsers: number;
  totalDates: number;
  totalTransactions: number;
  errors: string[];
}

/**
 * Main migration function
 */
export async function migrateOvertimeToTransactions(): Promise<MigrationStats> {
  logger.info('🚀🚀🚀 STARTING OVERTIME MIGRATION 🚀🚀🚀');

  const stats: MigrationStats = {
    totalUsers: 0,
    totalDates: 0,
    totalTransactions: 0,
    errors: [],
  };

  try {
    // Get all active users
    const users = db.prepare(`
      SELECT id, hireDate
      FROM users
      WHERE deletedAt IS NULL
      ORDER BY id
    `).all() as Array<{ id: number; hireDate: string }>;

    logger.info({ count: users.length }, `📋 Found ${users.length} active users`);
    stats.totalUsers = users.length;

    // Process each user
    for (const user of users) {
      try {
        logger.info({ userId: user.id }, `👤 Processing user ${user.id}...`);

        const userStats = await migrateUserOvertimeTransactions(user.id, user.hireDate);

        stats.totalDates += userStats.totalDates;
        stats.totalTransactions += userStats.totalTransactions;

        logger.info(
          {
            userId: user.id,
            dates: userStats.totalDates,
            transactions: userStats.totalTransactions,
          },
          `✅ User ${user.id}: ${userStats.totalTransactions} transactions from ${userStats.totalDates} dates`
        );
      } catch (error) {
        const errorMsg = `User ${user.id}: ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(errorMsg);
        logger.error({ error, userId: user.id }, `❌ Failed to migrate user ${user.id}`);
      }
    }

    logger.info(
      {
        users: stats.totalUsers,
        dates: stats.totalDates,
        transactions: stats.totalTransactions,
        errors: stats.errors.length,
      },
      '🎉🎉🎉 MIGRATION COMPLETED 🎉🎉🎉'
    );
  } catch (error) {
    logger.error({ error }, '❌❌❌ MIGRATION FAILED ❌❌❌');
    throw error;
  }

  return stats;
}

/**
 * Migrate overtime transactions for a single user
 */
async function migrateUserOvertimeTransactions(
  userId: number,
  hireDate: string
): Promise<{ totalDates: number; totalTransactions: number }> {
  // Get full user object with workSchedule
  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Get all unique dates with time entries
  const dates = db.prepare(`
    SELECT DISTINCT date
    FROM time_entries
    WHERE userId = ?
      AND date >= ?
    ORDER BY date ASC
  `).all(userId, hireDate) as Array<{ date: string }>;

  logger.debug({ userId, datesCount: dates.length }, `Found ${dates.length} dates with time entries`);

  let transactionsCreated = 0;

  // Process each date
  for (const { date } of dates) {
    try {
      // Delete existing earned transactions for this date (safe to re-run)
      deleteEarnedTransactionsForDate(userId, date);

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

      // Record transaction (if not 0)
      if (overtime !== 0) {
        recordOvertimeEarned(userId, date, overtime, `Migration: Differenz Soll/Ist ${date}`);
        transactionsCreated++;
      }

      logger.debug({
        userId,
        date,
        targetHours,
        actualHours: actualHours.total,
        overtime,
      }, `Processed date ${date}: ${overtime > 0 ? '+' : ''}${overtime}h`);
    } catch (error) {
      logger.warn({ error, userId, date }, `⚠️ Failed to process date ${date}`);
      // Continue with next date
    }
  }

  return {
    totalDates: dates.length,
    totalTransactions: transactionsCreated,
  };
}

/**
 * Verify migration results
 */
export async function verifyMigration(): Promise<{
  success: boolean;
  issues: string[];
}> {
  logger.info('🔍 VERIFYING MIGRATION...');

  const issues: string[] = [];

  try {
    // Check: All users have transactions
    const usersWithoutTransactions = db.prepare(`
      SELECT u.id, u.firstName, u.lastName
      FROM users u
      WHERE u.deletedAt IS NULL
        AND u.id NOT IN (
          SELECT DISTINCT userId FROM overtime_transactions
        )
        AND EXISTS (
          SELECT 1 FROM time_entries WHERE userId = u.id
        )
    `).all() as Array<{ id: number; firstName: string; lastName: string }>;

    if (usersWithoutTransactions.length > 0) {
      issues.push(
        `${usersWithoutTransactions.length} users with time entries but no transactions: ` +
        usersWithoutTransactions.map(u => `${u.firstName} ${u.lastName} (ID: ${u.id})`).join(', ')
      );
    }

    // Check: Transaction counts match time entry counts
    const mismatchedCounts = db.prepare(`
      SELECT
        u.id,
        u.firstName,
        u.lastName,
        COUNT(DISTINCT te.date) as timeEntryDates,
        COUNT(DISTINCT ot.date) as transactionDates
      FROM users u
      INNER JOIN time_entries te ON u.id = te.userId
      LEFT JOIN overtime_transactions ot ON u.id = ot.userId AND ot.type = 'earned'
      WHERE u.deletedAt IS NULL
      GROUP BY u.id
      HAVING timeEntryDates != transactionDates
    `).all() as Array<{
      id: number;
      firstName: string;
      lastName: string;
      timeEntryDates: number;
      transactionDates: number;
    }>;

    if (mismatchedCounts.length > 0) {
      issues.push(
        `${mismatchedCounts.length} users with mismatched counts: ` +
        mismatchedCounts.map(u =>
          `${u.firstName} ${u.lastName}: ${u.timeEntryDates} time entries vs ${u.transactionDates} transactions`
        ).join(', ')
      );
    }

    if (issues.length === 0) {
      logger.info('✅ Migration verification PASSED');
      return { success: true, issues: [] };
    } else {
      logger.warn({ issues }, '⚠️ Migration verification found issues');
      return { success: false, issues };
    }
  } catch (error) {
    logger.error({ error }, '❌ Migration verification FAILED');
    return {
      success: false,
      issues: [`Verification error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateOvertimeToTransactions()
    .then(async (stats) => {
      console.log('\n📊 MIGRATION STATS:');
      console.log(`  Users: ${stats.totalUsers}`);
      console.log(`  Dates: ${stats.totalDates}`);
      console.log(`  Transactions: ${stats.totalTransactions}`);
      console.log(`  Errors: ${stats.errors.length}`);

      if (stats.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        stats.errors.forEach(err => console.log(`  - ${err}`));
      }

      // Verify
      console.log('\n🔍 Running verification...');
      const verification = await verifyMigration();

      if (verification.success) {
        console.log('\n✅✅✅ MIGRATION SUCCESSFUL ✅✅✅');
        process.exit(0);
      } else {
        console.log('\n⚠️⚠️⚠️ MIGRATION COMPLETED WITH ISSUES ⚠️⚠️⚠️');
        verification.issues.forEach(issue => console.log(`  - ${issue}`));
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌❌❌ MIGRATION FAILED ❌❌❌');
      console.error(error);
      process.exit(1);
    });
}
