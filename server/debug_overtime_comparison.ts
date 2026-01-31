/**
 * Debug script to compare overtime calculations
 * Compares getUserOvertimeReport vs overtime_balance table for User 47, Year 2025
 */

import { db } from './src/database/connection.js';
import { getUserById } from './src/services/userService.js';
import { getDailyTargetHours } from './src/utils/workingDays.js';

const userId = 47;
const year = 2025;

console.log('\n========================================');
console.log(`OVERTIME COMPARISON: User ${userId}, Year ${year}`);
console.log('========================================\n');

// Get user
const user = getUserById(userId);
if (!user) {
  console.log('❌ User not found');
  process.exit(1);
}

console.log(`👤 User: ${user.firstName} ${user.lastName}`);
console.log(`📅 Hire Date: ${user.hireDate}`);
console.log(`⏰ Weekly Hours: ${user.weeklyHours}`);
console.log(`📋 Work Schedule:`, user.workSchedule);
console.log('');

// Date range
const today = new Date().toISOString().split('T')[0];
const startDate = `${year}-01-01`;
let endDate = `${year}-12-31`;

// Cap to today
if (endDate > today) {
  endDate = today;
}

// Don't include dates before hire date
const effectiveStartDate = startDate < user.hireDate ? user.hireDate : startDate;

console.log(`📆 Date Range: ${effectiveStartDate} to ${endDate}\n`);

// === PART 1: Daily Breakdown Calculation (same as getUserOvertimeReport) ===

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PART 1: Daily Breakdown (getUserOvertimeReport)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all dates with time entries
const dates = db.prepare(`
  SELECT DISTINCT date
  FROM time_entries
  WHERE userId = ? AND date >= ? AND date <= ?
  ORDER BY date
`).all(userId, effectiveStartDate, endDate) as Array<{ date: string }>;

console.log(`📋 Dates with time entries: ${dates.length}`);

// Also include working days without entries
const allDates = new Set(dates.map(d => d.date));
const start = new Date(effectiveStartDate);
const end = new Date(endDate);

for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const dateStr = d.toISOString().split('T')[0];
  const target = getDailyTargetHours(user, dateStr);

  // Only include if it's a working day OR has time entries
  if (target > 0 || allDates.has(dateStr)) {
    allDates.add(dateStr);
  }
}

console.log(`📅 Total dates (including working days): ${allDates.size}\n`);

let dailyTargetSum = 0;
let dailyActualSum = 0;

console.log('Date         | Target | Worked | Absence | Corrections | Actual | Overtime');
console.log('-------------|--------|--------|---------|-------------|--------|----------');

Array.from(allDates).sort().forEach(date => {
  let target = getDailyTargetHours(user, date);

  // Get worked hours
  const workedResult = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as total
    FROM time_entries
    WHERE userId = ? AND date = ?
  `).get(userId, date) as { total: number };

  // Check for unpaid leave (REDUCES target hours, NO absence credit!)
  const unpaidLeaveResult = db.prepare(`
    SELECT COUNT(*) as hasUnpaidLeave
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type = 'unpaid'
      AND ? >= startDate
      AND ? <= endDate
  `).get(userId, date, date) as { hasUnpaidLeave: number };

  // If unpaid leave on this day, reduce target to 0 (user doesn't need to work)
  if (unpaidLeaveResult.hasUnpaidLeave > 0 && target > 0) {
    target = 0;
  }

  // Get absence credits (EXCLUDING unpaid leave!)
  const absenceResult = db.prepare(`
    SELECT COUNT(*) as hasAbsence
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type IN ('vacation', 'sick', 'overtime_comp', 'special')
      AND ? >= startDate
      AND ? <= endDate
  `).get(userId, date, date) as { hasAbsence: number };

  const absenceCredit = (absenceResult.hasAbsence > 0 && target > 0) ? target : 0;

  // Get manual corrections
  const correctionsResult = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as total
    FROM overtime_corrections
    WHERE userId = ? AND date = ?
  `).get(userId, date) as { total: number };

  const actual = workedResult.total + absenceCredit + correctionsResult.total;
  const overtime = actual - target;

  dailyTargetSum += target;
  dailyActualSum += actual;

  console.log(`${date} | ${target.toString().padStart(6)} | ${workedResult.total.toString().padStart(6)} | ${absenceCredit.toString().padStart(7)} | ${correctionsResult.total.toString().padStart(11)} | ${actual.toString().padStart(6)} | ${overtime.toString().padStart(8)}`);
});

console.log('-------------|--------|--------|---------|-------------|--------|----------');
console.log(`TOTAL        | ${dailyTargetSum.toString().padStart(6)} | ${''.padStart(6)} | ${''.padStart(7)} | ${''.padStart(11)} | ${dailyActualSum.toString().padStart(6)} | ${(dailyActualSum - dailyTargetSum).toString().padStart(8)}`);
console.log('');

// === PART 2: Monthly Overtime Balance (from database) ===

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PART 2: Monthly Overtime Balance (Database)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const monthlyBalances = db.prepare(`
  SELECT month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = ? AND month >= ? AND month <= ?
  ORDER BY month
`).all(userId, `${year}-01`, `${year}-12`) as Array<{
  month: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
}>;

let monthlyTargetSum = 0;
let monthlyActualSum = 0;
let monthlyOvertimeSum = 0;

console.log('Month    | Target | Actual | Overtime');
console.log('---------|--------|--------|----------');

monthlyBalances.forEach(balance => {
  console.log(`${balance.month} | ${balance.targetHours.toString().padStart(6)} | ${balance.actualHours.toString().padStart(6)} | ${balance.overtime.toString().padStart(8)}`);
  monthlyTargetSum += balance.targetHours;
  monthlyActualSum += balance.actualHours;
  monthlyOvertimeSum += balance.overtime;
});

console.log('---------|--------|--------|----------');
console.log(`TOTAL    | ${monthlyTargetSum.toString().padStart(6)} | ${monthlyActualSum.toString().padStart(6)} | ${monthlyOvertimeSum.toString().padStart(8)}`);
console.log('');

// === PART 3: Comparison ===

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PART 3: Comparison');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Metric               | Daily Calc | DB Monthly | Difference');
console.log('---------------------|------------|------------|------------');
console.log(`Target Hours         | ${dailyTargetSum.toString().padStart(10)} | ${monthlyTargetSum.toString().padStart(10)} | ${(dailyTargetSum - monthlyTargetSum).toString().padStart(10)}`);
console.log(`Actual Hours         | ${dailyActualSum.toString().padStart(10)} | ${monthlyActualSum.toString().padStart(10)} | ${(dailyActualSum - monthlyActualSum).toString().padStart(10)}`);
console.log(`Overtime             | ${(dailyActualSum - dailyTargetSum).toString().padStart(10)} | ${monthlyOvertimeSum.toString().padStart(10)} | ${((dailyActualSum - dailyTargetSum) - monthlyOvertimeSum).toString().padStart(10)}`);
console.log('');

if (Math.abs((dailyActualSum - dailyTargetSum) - monthlyOvertimeSum) < 0.01) {
  console.log('✅ MATCH: Daily calculation matches database!');
} else {
  console.log('❌ MISMATCH: Daily calculation differs from database!');
  console.log('');
  console.log('🔍 Analysis:');
  console.log(`   - Daily breakdown processes ${allDates.size} dates`);
  console.log(`   - Database has ${monthlyBalances.length} month entries`);
  console.log(`   - Difference in overtime: ${((dailyActualSum - dailyTargetSum) - monthlyOvertimeSum).toFixed(2)}h`);
}

console.log('\n========================================\n');

db.close();
