/**
 * Test year-end rollover preview for User 47
 */

import { previewYearEndRollover } from './src/services/yearEndRolloverService.js';

console.log('\n=== Testing Year-End Rollover Preview (2026 → 2027) ===\n');

const preview = previewYearEndRollover(2027);

console.log(`Year: ${preview.year}`);
console.log(`Previous Year: ${preview.previousYear}\n`);

// Find Test User (ID 47)
const testUser = preview.users.find(u => u.userId === 47);

if (testUser) {
  console.log('Test User (ID 47):');
  console.log(`  Name: ${testUser.firstName} ${testUser.lastName}`);
  console.log(`  Vacation Carryover: ${testUser.vacationCarryover} days`);
  console.log(`  Overtime Carryover: ${testUser.overtimeCarryover}h`);

  if (testUser.warnings.length > 0) {
    console.log(`  Warnings: ${testUser.warnings.join(', ')}`);
  }

  console.log('\n✅ Expected: -163h (2026 overtime: -12h + Jan 2026 carryover: -151h)');
  console.log(`✅ Actual: ${testUser.overtimeCarryover}h\n`);

  if (Math.abs(testUser.overtimeCarryover - (-163)) < 0.01) {
    console.log('🎉 SUCCESS: Overtime carryover is correct!');
  } else {
    console.log('❌ FAIL: Overtime carryover is incorrect!');
    console.log(`   Difference: ${testUser.overtimeCarryover - (-163)}h`);
  }
} else {
  console.log('❌ Test User (ID 47) not found in preview!');
}

console.log('\n');
