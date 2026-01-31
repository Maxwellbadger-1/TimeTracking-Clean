import { db } from './src/database/connection.js';

console.log('🔍 Testing API Endpoint Logic Directly\n');

const userId = 3;
const year = 2026;
const month = '2026-01';

// ============================================
// TEST 1: MONTHLY ENDPOINT LOGIC
// ============================================
console.log('📅 MONTHLY ENDPOINT: /api/overtime/balance/3/2026-01');
console.log('---------------------------------------------------');

const monthlyBalance = db.prepare(`
  SELECT
    userId,
    month,
    targetHours,
    actualHours,
    overtime,
    carryoverFromPreviousYear
  FROM overtime_balance
  WHERE userId = ? AND month = ?
`).get(userId, month) as {
  userId: number;
  month: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
  carryoverFromPreviousYear: number;
} | undefined;

if (monthlyBalance) {
  console.log('✅ Found balance:', monthlyBalance);
  console.log('   Target:', monthlyBalance.targetHours);
  console.log('   Actual:', monthlyBalance.actualHours);
  console.log('   Overtime:', monthlyBalance.overtime);
  console.log('   Carryover:', monthlyBalance.carryoverFromPreviousYear);
} else {
  console.log('❌ No balance found');
}

console.log('\n');

// ============================================
// TEST 2: YEARLY ENDPOINT LOGIC
// ============================================
console.log('📊 YEARLY ENDPOINT: /api/overtime/balance/3/year/2026');
console.log('---------------------------------------------------');

const today = new Date().toISOString().split('T')[0];
const currentMonth = today.substring(0, 7); // "2026-01"

console.log('Current month cutoff:', currentMonth);

const monthlyEntries = db.prepare(`
  SELECT month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = ? AND month LIKE ? AND month <= ?
  ORDER BY month ASC
`).all(userId, `${year}-%`, currentMonth) as Array<{
  month: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
}>;

console.log('\nMonthly entries found:', monthlyEntries.length);
monthlyEntries.forEach(entry => {
  console.log(`  ${entry.month}: Target=${entry.targetHours}, Actual=${entry.actualHours}, Overtime=${entry.overtime}`);
});

const januaryBalance = db.prepare(`
  SELECT carryoverFromPreviousYear
  FROM overtime_balance
  WHERE userId = ? AND month = ?
`).get(userId, `${year}-01`) as { carryoverFromPreviousYear: number } | undefined;

const carryover = januaryBalance?.carryoverFromPreviousYear || 0;

const totalTarget = monthlyEntries.reduce((sum, m) => sum + m.targetHours, 0);
const totalActual = monthlyEntries.reduce((sum, m) => sum + m.actualHours, 0);
const totalOvertime = monthlyEntries.reduce((sum, m) => sum + m.overtime, 0);

console.log('\n📊 YEARLY TOTALS:');
console.log('   Total Target:', totalTarget);
console.log('   Total Actual:', totalActual);
console.log('   Total Overtime (sum):', totalOvertime);
console.log('   Carryover:', carryover);
console.log('   Final Overtime (sum + carryover):', totalOvertime + carryover);

// ============================================
// COMPARISON
// ============================================
console.log('\n🔍 COMPARISON:');
console.log('---------------------------------------------------');
if (monthlyBalance) {
  console.log('MONTHLY endpoint returns:');
  console.log('  overtime:', monthlyBalance.overtime);
  console.log('\nYEARLY endpoint returns:');
  console.log('  overtime:', totalOvertime + carryover);
  console.log('\n🎯 DIFFERENCE:', (totalOvertime + carryover) - monthlyBalance.overtime);

  if (Math.abs((totalOvertime + carryover) - monthlyBalance.overtime) < 0.01) {
    console.log('✅ VALUES MATCH! No issue here.');
  } else {
    console.log('❌ VALUES DIFFER! This is the problem!');
  }
}

process.exit(0);
