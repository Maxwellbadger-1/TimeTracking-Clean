/**
 * Test Complete Overtime Flow
 *
 * PURPOSE:
 * - Test that time entry creation triggers correct overtime calculation
 * - Verify transaction-based system updates correctly
 * - Verify Work Time Account syncs correctly
 */

import { db } from '../database/connection.js';
import { updateAllOvertimeLevels } from '../services/overtimeService.js';
import { getOvertimeBalance } from '../services/overtimeTransactionService.js';

const userId = 1;
const date = '2026-01-15';

console.log('🧪 TESTING COMPLETE OVERTIME FLOW');
console.log('='.repeat(80));

// 1. Check balances BEFORE
console.log('\n📊 BEFORE updateAllOvertimeLevels():');
const balanceBefore = getOvertimeBalance(userId);
const worktimeBefore = db.prepare('SELECT currentBalance FROM work_time_accounts WHERE userId = ?').get(userId) as { currentBalance: number };
console.log(`  Transaction Balance: ${balanceBefore >= 0 ? '+' : ''}${balanceBefore}h`);
console.log(`  Work Time Account:   ${worktimeBefore.currentBalance >= 0 ? '+' : ''}${worktimeBefore.currentBalance}h`);

// 2. Get time entries for date
const timeEntries = db.prepare('SELECT * FROM time_entries WHERE userId = ? AND date = ?').all(userId, date);
console.log(`\n📅 Time Entries for ${date}:`);
console.log(`  Found ${timeEntries.length} entries, total: ${timeEntries.reduce((sum: number, e: any) => sum + e.hours, 0)}h`);

// 3. Trigger overtime calculation
console.log('\n⚙️  RUNNING updateAllOvertimeLevels()...');
updateAllOvertimeLevels(userId, date);
console.log('  ✅ Completed');

// 4. Check balances AFTER
console.log('\n📊 AFTER updateAllOvertimeLevels():');
const balanceAfter = getOvertimeBalance(userId);
const worktimeAfter = db.prepare('SELECT currentBalance FROM work_time_accounts WHERE userId = ?').get(userId) as { currentBalance: number };
console.log(`  Transaction Balance: ${balanceAfter >= 0 ? '+' : ''}${balanceAfter}h`);
console.log(`  Work Time Account:   ${worktimeAfter.currentBalance >= 0 ? '+' : ''}${worktimeAfter.currentBalance}h`);

// 5. Check transactions for date
const transactions = db.prepare('SELECT * FROM overtime_transactions WHERE userId = ? AND date = ? ORDER BY createdAt DESC').all(userId, date);
console.log(`\n📝 Transactions for ${date}:`);
transactions.forEach((t: any) => {
  console.log(`  - ${t.type}: ${t.hours >= 0 ? '+' : ''}${t.hours}h (${t.description || 'no description'})`);
});

// 6. Summary
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY:');
console.log(`  Balance Change:        ${balanceBefore}h → ${balanceAfter}h (${balanceAfter - balanceBefore >= 0 ? '+' : ''}${balanceAfter - balanceBefore}h)`);
console.log(`  Work Time Account:     ${worktimeBefore.currentBalance}h → ${worktimeAfter.currentBalance}h (${worktimeAfter.currentBalance - worktimeBefore.currentBalance >= 0 ? '+' : ''}${worktimeAfter.currentBalance - worktimeBefore.currentBalance}h)`);
console.log(`  Balances Match:        ${balanceAfter === worktimeAfter.currentBalance ? '✅ YES' : '❌ NO'}`);

if (balanceAfter === worktimeAfter.currentBalance) {
  console.log('\n✅✅✅ TEST PASSED: System working correctly! ✅✅✅\n');
  process.exit(0);
} else {
  console.log('\n❌❌❌ TEST FAILED: Balances do not match! ❌❌❌\n');
  process.exit(1);
}
