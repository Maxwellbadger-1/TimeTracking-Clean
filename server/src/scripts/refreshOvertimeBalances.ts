#!/usr/bin/env tsx
/**
 * One-time script to refresh overtime_balance table for affected users
 * This fixes the issue where corrections were not being included
 *
 * Usage: npm run refresh:overtime
 * Or:    tsx src/scripts/refreshOvertimeBalances.ts
 */

import { db } from '../database/connection.js';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import logger from '../utils/logger.js';

async function refreshOvertimeBalances() {
  console.log('\n🔄 OVERTIME BALANCE REFRESH SCRIPT');
  console.log('===================================\n');

  try {
    // Get current month for calculations
    const today = getCurrentDate();
    const currentMonth = formatDate(today, 'yyyy-MM');

    // Find users with corrections or hired in 2026 (most likely affected)
    const affectedUsers = db.prepare(`
      SELECT DISTINCT u.id, u.username, u.firstName, u.lastName, u.hireDate
      FROM users u
      WHERE u.deletedAt IS NULL
      AND (
        -- Users with corrections
        EXISTS (
          SELECT 1 FROM overtime_corrections oc
          WHERE oc.userId = u.id
        )
        -- OR users hired in 2026
        OR u.hireDate >= '2026-01-01'
      )
      ORDER BY u.id
    `).all() as Array<{
      id: number;
      username: string;
      firstName: string;
      lastName: string;
      hireDate: string;
    }>;

    console.log(`Found ${affectedUsers.length} potentially affected users:\n`);

    for (const user of affectedUsers) {
      console.log(`\n📊 Processing User #${user.id}: ${user.firstName} ${user.lastName}`);
      console.log(`   Hire Date: ${user.hireDate}`);

      // Get old values for comparison
      const oldValues = db.prepare(`
        SELECT month, targetHours, actualHours, overtime
        FROM overtime_balance
        WHERE userId = ? AND month >= ?
        ORDER BY month
      `).all(user.id, formatDate(new Date(user.hireDate), 'yyyy-MM')) as Array<{
        month: string;
        targetHours: number;
        actualHours: number;
        overtime: number;
      }>;

      // Refresh overtime balances using UnifiedOvertimeService
      await ensureOvertimeBalanceEntries(user.id, currentMonth);

      // Get new values for comparison
      const newValues = db.prepare(`
        SELECT month, targetHours, actualHours, overtime
        FROM overtime_balance
        WHERE userId = ? AND month >= ?
        ORDER BY month
      `).all(user.id, formatDate(new Date(user.hireDate), 'yyyy-MM')) as Array<{
        month: string;
        targetHours: number;
        actualHours: number;
        overtime: number;
      }>;

      // Compare and show differences
      let hasChanges = false;
      for (let i = 0; i < newValues.length; i++) {
        const newVal = newValues[i];
        const oldVal = oldValues.find(o => o.month === newVal.month);

        if (!oldVal ||
            oldVal.actualHours !== newVal.actualHours ||
            oldVal.overtime !== newVal.overtime) {
          hasChanges = true;

          if (!oldVal) {
            console.log(`   ✅ ${newVal.month}: NEW ENTRY - Overtime: ${newVal.overtime}h`);
          } else if (oldVal.overtime !== newVal.overtime) {
            console.log(`   ✅ ${newVal.month}: UPDATED - Overtime: ${oldVal.overtime}h → ${newVal.overtime}h (Δ${(newVal.overtime - oldVal.overtime).toFixed(1)}h)`);
          }
        }
      }

      if (!hasChanges) {
        console.log('   ⚪ No changes needed');
      }

      // Show yearly total for 2026
      const yearTotal = db.prepare(`
        SELECT
          SUM(targetHours) as totalTarget,
          SUM(actualHours) as totalActual,
          SUM(overtime) as totalOvertime
        FROM overtime_balance
        WHERE userId = ? AND month LIKE '2026-%'
      `).get(user.id) as {
        totalTarget: number;
        totalActual: number;
        totalOvertime: number;
      };

      if (yearTotal && yearTotal.totalOvertime !== null) {
        console.log(`   📈 2026 Total: ${yearTotal.totalOvertime.toFixed(1)}h overtime`);
      }
    }

    console.log('\n✅ REFRESH COMPLETED SUCCESSFULLY!\n');

    // Special check for User 6 & 7
    console.log('🔍 Verification for known issues:');

    const user6 = db.prepare(`
      SELECT SUM(overtime) as total FROM overtime_balance
      WHERE userId = 6 AND month LIKE '2026-%'
    `).get() as { total: number };

    const user7 = db.prepare(`
      SELECT SUM(overtime) as total FROM overtime_balance
      WHERE userId = 7 AND month LIKE '2026-%'
    `).get() as { total: number };

    console.log(`   User 6 (should be 0h): ${user6?.total || 0}h ${user6?.total === 0 ? '✅' : '❌'}`);
    console.log(`   User 7 (should be +4h): ${user7?.total || 0}h ${Math.abs((user7?.total || 0) - 4) < 0.1 ? '✅' : '❌'}`);

  } catch (error) {
    console.error('\n❌ ERROR during refresh:', error);
    process.exit(1);
  }
}

// Run the refresh
refreshOvertimeBalances().catch(error => {
  logger.error({ error }, 'Failed to refresh overtime balances');
  process.exit(1);
});