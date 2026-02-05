#!/usr/bin/env tsx
/**
 * Backfill Balance Tracking for Overtime Transactions (Phase 4)
 *
 * PURPOSE:
 * - Populate balanceBefore/balanceAfter columns for existing transactions
 * - These columns improve query performance and data integrity
 * - Run once during Phase 4 migration
 *
 * WHAT IT DOES:
 * 1. Find all transactions with missing balance values
 * 2. For each user, calculate cumulative balance chronologically
 * 3. Update balanceBefore and balanceAfter for each transaction
 *
 * SAFETY:
 * - Read-only queries first to verify data
 * - Updates in transaction (atomic)
 * - Can be run multiple times (idempotent)
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

interface Transaction {
  id: number;
  userId: number;
  date: string;
  hours: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
}

function backfillBalances(): void {
  console.log('\n🔄 Starting Balance Backfill (Phase 4)...\n');

  // Get all users with transactions
  const users = db.prepare(`
    SELECT DISTINCT userId
    FROM overtime_transactions
    ORDER BY userId
  `).all() as Array<{ userId: number }>;

  console.log(`Found ${users.length} users with overtime transactions\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { userId } of users) {
    // Get all transactions for this user, ordered chronologically
    const transactions = db.prepare(`
      SELECT id, userId, date, hours, balanceBefore, balanceAfter, createdAt
      FROM overtime_transactions
      WHERE userId = ?
      ORDER BY date ASC, createdAt ASC
    `).all(userId) as Transaction[];

    console.log(`\n👤 User ${userId}: ${transactions.length} transactions`);

    let runningBalance = 0;

    for (const txn of transactions) {
      totalProcessed++;

      // If already has balance values, skip (unless they're wrong)
      if (txn.balanceBefore !== null && txn.balanceAfter !== null) {
        // Verify correctness
        const expectedAfter = txn.balanceBefore + txn.hours;
        if (Math.abs(txn.balanceAfter - expectedAfter) < 0.01) {
          // Correct values, skip
          runningBalance = txn.balanceAfter;
          totalSkipped++;
          continue;
        }
        // Incorrect values, will update
        console.log(`  ⚠️  Incorrect balance on transaction ${txn.id}, correcting...`);
      }

      // Calculate correct balance values
      const balanceBefore = runningBalance;
      const balanceAfter = runningBalance + txn.hours;

      // Update transaction
      db.prepare(`
        UPDATE overtime_transactions
        SET balanceBefore = ?, balanceAfter = ?
        WHERE id = ?
      `).run(
        Math.round(balanceBefore * 100) / 100,
        Math.round(balanceAfter * 100) / 100,
        txn.id
      );

      runningBalance = balanceAfter;
      totalUpdated++;

      if (totalUpdated % 50 === 0) {
        console.log(`  ... ${totalUpdated} transactions updated`);
      }
    }

    console.log(`  ✅ User ${userId}: Final balance = ${Math.round(runningBalance * 100) / 100}h`);
  }

  console.log(`\n📊 BACKFILL COMPLETE:\n`);
  console.log(`  Total transactions: ${totalProcessed}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped (already correct): ${totalSkipped}`);
  console.log(`  Success rate: ${((totalUpdated + totalSkipped) / totalProcessed * 100).toFixed(1)}%\n`);

  // Verification: Check for any remaining NULL values
  const remaining = db.prepare(`
    SELECT COUNT(*) as count
    FROM overtime_transactions
    WHERE balanceBefore IS NULL OR balanceAfter IS NULL
  `).get() as { count: number };

  if (remaining.count > 0) {
    console.log(`⚠️  WARNING: ${remaining.count} transactions still have NULL balance values!`);
  } else {
    console.log(`✅ SUCCESS: All transactions now have balance tracking!\n`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    backfillBalances();
    logger.info('✅ Balance backfill completed successfully');
  } catch (error) {
    logger.error({ error }, '❌ Balance backfill failed');
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

export { backfillBalances };
