#!/usr/bin/env tsx
/**
 * Migration Script: Fill ALL overtime transactions
 *
 * Ensures COMPLETE transaction history for all users:
 * - 'earned' transactions (ALL days, including minus hours)
 * - Absence credit transactions (vacation, sick, overtime_comp, special)
 * - Correction transactions (if not already created)
 *
 * SAFE: Idempotent (can be run multiple times)
 * FAST: Skips existing transactions
 *
 * Usage:
 *   npm run fill:transactions
 *   OR
 *   tsx src/scripts/fillAllOvertimeTransactions.ts
 */

import { db } from '../database/connection.js';
import { ensureDailyOvertimeTransactions } from '../services/overtimeService.js';
import logger from '../utils/logger.js';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  hireDate: string;
}

async function fillAllOvertimeTransactions() {
  console.log('');
  console.log('================================================================================');
  console.log('🔥 FILLING ALL OVERTIME TRANSACTIONS');
  console.log('================================================================================');
  console.log('');

  // Get all active users
  const users = db.prepare(`
    SELECT id, firstName, lastName, hireDate
    FROM users
    WHERE deletedAt IS NULL
    ORDER BY id ASC
  `).all() as User[];

  console.log(`📊 Found ${users.length} active users\n`);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let totalUsersProcessed = 0;
  let totalErrors = 0;

  for (const user of users) {
    try {
      console.log(`────────────────────────────────────────────────────────────────────────────────`);
      console.log(`👤 User ${user.id}: ${user.firstName} ${user.lastName}`);
      console.log(`   Hire Date: ${user.hireDate}`);

      // Calculate start month (from hire date)
      const hireDate = new Date(user.hireDate);
      const hireYear = hireDate.getFullYear();
      const hireMonth = hireDate.getMonth() + 1;

      const startMonth = `${hireYear}-${String(hireMonth).padStart(2, '0')}`;
      const endMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      console.log(`   Processing: ${startMonth} → ${endMonth}`);

      // Count existing transactions
      const existingCount = (db.prepare(`
        SELECT COUNT(*) as count
        FROM overtime_transactions
        WHERE userId = ?
      `).get(user.id) as { count: number }).count;

      console.log(`   Existing transactions: ${existingCount}`);

      // Fill transactions (idempotent!)
      await ensureDailyOvertimeTransactions(user.id, startMonth, endMonth);

      // Count new total
      const newCount = (db.prepare(`
        SELECT COUNT(*) as count
        FROM overtime_transactions
        WHERE userId = ?
      `).get(user.id) as { count: number }).count;

      const created = newCount - existingCount;
      console.log(`   ✅ Transactions created: ${created} (Total: ${newCount})`);

      // Show breakdown by type
      const breakdown = db.prepare(`
        SELECT type, COUNT(*) as count
        FROM overtime_transactions
        WHERE userId = ?
        GROUP BY type
        ORDER BY type
      `).all(user.id) as Array<{ type: string; count: number }>;

      console.log(`   📊 Breakdown:`);
      breakdown.forEach(({ type, count }) => {
        console.log(`      ${type}: ${count}`);
      });

      totalUsersProcessed++;
    } catch (error) {
      console.error(`   ❌ ERROR for user ${user.id}:`, error);
      totalErrors++;
    }

    console.log('');
  }

  console.log('================================================================================');
  console.log('✅ MIGRATION COMPLETE');
  console.log('================================================================================');
  console.log(`Users processed: ${totalUsersProcessed}/${users.length}`);
  console.log(`Errors: ${totalErrors}`);
  console.log('');

  // Summary statistics
  const totalTransactions = (db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
  `).get() as { count: number }).count;

  const typeBreakdown = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM overtime_transactions
    GROUP BY type
    ORDER BY count DESC
  `).all() as Array<{ type: string; count: number }>;

  console.log('📊 GLOBAL STATISTICS:');
  console.log(`   Total transactions: ${totalTransactions}`);
  console.log('');
  console.log('   By type:');
  typeBreakdown.forEach(({ type, count }) => {
    const percentage = ((count / totalTransactions) * 100).toFixed(1);
    console.log(`      ${type.padEnd(25)}: ${String(count).padStart(6)} (${percentage}%)`);
  });
  console.log('');
}

// Run migration
fillAllOvertimeTransactions()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
