/**
 * Sync Work Time Accounts with Transaction-Based Balances
 *
 * PURPOSE:
 * - After migration to transaction-based system, ensure work_time_accounts
 *   reflects the correct balance from overtime_transactions
 * - Single source of truth: overtime_transactions
 *
 * SAFE TO RUN MULTIPLE TIMES:
 * - Simply recalculates and updates current balances
 *
 * USAGE:
 *   tsx src/scripts/syncWorkTimeAccounts.ts
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { getOvertimeBalance } from '../services/overtimeTransactionService.js';

interface SyncResult {
  userId: number;
  name: string;
  oldBalance: number;
  newBalance: number;
  difference: number;
}

/**
 * Sync all work time accounts
 */
export async function syncWorkTimeAccounts(): Promise<SyncResult[]> {
  logger.info('🔄 SYNCING WORK TIME ACCOUNTS WITH TRANSACTION BALANCES');

  const results: SyncResult[] = [];

  try {
    // Get all active users with work time accounts
    const users = db.prepare(`
      SELECT u.id, u.firstName, u.lastName, wta.currentBalance as oldBalance
      FROM users u
      INNER JOIN work_time_accounts wta ON u.id = wta.userId
      WHERE u.deletedAt IS NULL
      ORDER BY u.id
    `).all() as Array<{
      id: number;
      firstName: string;
      lastName: string;
      oldBalance: number;
    }>;

    logger.info({ count: users.length }, `📋 Found ${users.length} users with work time accounts`);

    for (const user of users) {
      // Calculate correct balance from transactions
      const newBalance = getOvertimeBalance(user.id);
      const difference = newBalance - user.oldBalance;

      // Update work time account
      db.prepare(`
        UPDATE work_time_accounts
        SET currentBalance = ?,
            lastUpdated = datetime('now')
        WHERE userId = ?
      `).run(newBalance, user.id);

      const result: SyncResult = {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        oldBalance: user.oldBalance,
        newBalance,
        difference,
      };

      results.push(result);

      logger.info(
        {
          userId: user.id,
          name: result.name,
          oldBalance: user.oldBalance,
          newBalance,
          difference,
        },
        `✅ ${result.name}: ${user.oldBalance}h → ${newBalance}h (${difference >= 0 ? '+' : ''}${difference}h)`
      );
    }

    logger.info('🎉 SYNC COMPLETED SUCCESSFULLY');
  } catch (error) {
    logger.error({ error }, '❌ SYNC FAILED');
    throw error;
  }

  return results;
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  syncWorkTimeAccounts()
    .then((results) => {
      console.log('\n📊 SYNC RESULTS:');
      console.log('='.repeat(80));
      console.log(`${'User'.padEnd(30)} ${'Old Balance'.padStart(15)} ${'New Balance'.padStart(15)} ${'Diff'.padStart(10)}`);
      console.log('='.repeat(80));

      results.forEach(r => {
        const oldBalanceStr = `${r.oldBalance >= 0 ? '+' : ''}${r.oldBalance.toFixed(1)}h`;
        const newBalanceStr = `${r.newBalance >= 0 ? '+' : ''}${r.newBalance.toFixed(1)}h`;
        const diffStr = `${r.difference >= 0 ? '+' : ''}${r.difference.toFixed(1)}h`;

        console.log(
          `${r.name.padEnd(30)} ${oldBalanceStr.padStart(15)} ${newBalanceStr.padStart(15)} ${diffStr.padStart(10)}`
        );
      });

      console.log('='.repeat(80));
      console.log(`\n✅✅✅ SUCCESSFULLY SYNCED ${results.length} WORK TIME ACCOUNTS ✅✅✅\n`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌❌❌ SYNC FAILED ❌❌❌');
      console.error(error);
      process.exit(1);
    });
}
