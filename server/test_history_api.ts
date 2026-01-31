/**
 * Test overtime history API for User 47
 */

import { getOvertimeHistory } from './src/services/reportService.js';

const userId = 47;
const months = 12;

console.log('\n=== Testing getOvertimeHistory() ===\n');
console.log(`User ID: ${userId}`);
console.log(`Months: ${months}\n`);

const history = getOvertimeHistory(userId, months);

console.log('Month History:');
console.log('Month    | Earned | Compensation | Carryover | Balance Change | Balance');
console.log('---------|--------|--------------|-----------|----------------|--------');

history.forEach(entry => {
  console.log(
    `${entry.month} | ${entry.earned.toString().padStart(6)} | ${entry.compensation.toString().padStart(12)} | ${entry.carryover.toString().padStart(9)} | ${entry.balanceChange.toString().padStart(14)} | ${entry.balance.toString().padStart(7)}`
  );
});

console.log('\n=== Januar 2026 Details ===');
const jan2026 = history.find(h => h.month === '2026-01');
if (jan2026) {
  console.log(`Earned: ${jan2026.earned}h`);
  console.log(`Carryover: ${jan2026.carryover}h`);
  console.log(`Balance Change: ${jan2026.balanceChange}h`);
  console.log(`Balance: ${jan2026.balance}h`);
} else {
  console.log('Januar 2026 not found!');
}

console.log('\n');
