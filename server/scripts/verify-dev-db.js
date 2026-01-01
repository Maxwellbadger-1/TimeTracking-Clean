/**
 * COMPLETE DEV DB VERIFICATION
 * Manual calculation vs DB values
 */

import Database from 'better-sqlite3';

const db = new Database('/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database/development.db');

// Get holidays
const holidaysResult = db.prepare('SELECT date FROM holidays WHERE date LIKE ? ORDER BY date').all('2025-%');
const holidays2025 = holidaysResult.map(h => h.date);

console.log('\n📋 DEV DB VERIFICATION - COMPLETE MANUAL CALCULATION');
console.log('='.repeat(100));
console.log(`\n🎄 Loaded ${holidays2025.length} holidays:\n   ${holidays2025.join(', ')}\n`);

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date) {
  const dateStr = formatDate(date);
  return holidays2025.includes(dateStr);
}

function countWorkingDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  const details = [];

  while (current <= endDate) {
    const isWE = isWeekend(current);
    const isH = isHoliday(current);

    if (!isWE && !isH) {
      count++;
      details.push(formatDate(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return { count, details };
}

const today = new Date('2025-12-15');
today.setHours(0, 0, 0, 0);

console.log(`📅 Calculation Date: ${formatDate(today)}\n`);
console.log('='.repeat(100));

// Get all users
const users = db.prepare('SELECT id, firstName, lastName, hireDate, weeklyHours FROM users WHERE deletedAt IS NULL').all();

console.log(`\n👥 Found ${users.length} active users\n`);

for (const user of users) {
  console.log('\n' + '─'.repeat(100));
  console.log(`\n👤 ${user.firstName} ${user.lastName} (ID: ${user.id})`);
  console.log(`   📅 Hire Date: ${user.hireDate}`);
  console.log(`   ⏰ Weekly Hours: ${user.weeklyHours}h → Daily: ${user.weeklyHours / 5}h\n`);

  const hireDate = new Date(user.hireDate);
  hireDate.setHours(0, 0, 0, 0);

  const startDate = new Date(Math.max(hireDate.getTime(), hireDate.getTime()));
  const endDate = new Date(Math.min(today.getTime(), today.getTime()));

  const { count: workingDays } = countWorkingDays(startDate, endDate);
  const dailyHours = user.weeklyHours / 5;
  const targetHours = workingDays * dailyHours;

  console.log(`   📊 MANUAL CALCULATION:`);
  console.log(`      Period: ${formatDate(startDate)} → ${formatDate(endDate)}`);
  console.log(`      Working Days: ${workingDays}`);
  console.log(`      Base Target: ${workingDays} × ${dailyHours}h = ${targetHours.toFixed(2)}h`);

  // Get worked hours
  const workedResult = db.prepare(
    'SELECT COALESCE(SUM(hours), 0) as total FROM time_entries WHERE userId = ?'
  ).get(user.id);
  const workedHours = workedResult.total;

  // Get absence credits (vacation, sick, overtime_comp)
  const absenceResult = db.prepare(`
    SELECT COALESCE(SUM(days), 0) as total
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND (type = 'vacation' OR type = 'sick' OR type = 'overtime_comp')
  `).get(user.id);
  const absenceDays = absenceResult.total || 0;
  const absenceCredits = absenceDays * dailyHours;

  // Get unpaid leave
  const unpaidResult = db.prepare(`
    SELECT COALESCE(SUM(days), 0) as total
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND type = 'unpaid'
  `).get(user.id);
  const unpaidDays = unpaidResult.total || 0;
  const unpaidReduction = unpaidDays * dailyHours;

  const adjustedTargetHours = targetHours - unpaidReduction;
  const actualHours = workedHours + absenceCredits;
  const overtimeManual = actualHours - adjustedTargetHours;

  console.log(`      Worked Hours: ${workedHours.toFixed(2)}h`);
  console.log(`      Absence Credits: ${absenceDays} days × ${dailyHours}h = ${absenceCredits.toFixed(2)}h`);
  console.log(`      Unpaid Leave: ${unpaidDays} days × ${dailyHours}h = -${unpaidReduction.toFixed(2)}h`);
  console.log(`\n   📈 MANUAL RESULT:`);
  console.log(`      Adjusted Target: ${adjustedTargetHours.toFixed(2)}h`);
  console.log(`      Actual Hours: ${actualHours.toFixed(2)}h`);
  console.log(`      OVERTIME: ${overtimeManual >= 0 ? '+' : ''}${overtimeManual.toFixed(2)}h`);

  // Get DB values
  const dbOvertimeResult = db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as total
    FROM overtime_balance
    WHERE userId = ?
  `).get(user.id);
  const dbOvertime = dbOvertimeResult.total;

  const dbTargetResult = db.prepare(`
    SELECT COALESCE(SUM(targetHours), 0) as total
    FROM overtime_balance
    WHERE userId = ?
  `).get(user.id);
  const dbTarget = dbTargetResult.total;

  const dbActualResult = db.prepare(`
    SELECT COALESCE(SUM(actualHours), 0) as total
    FROM overtime_balance
    WHERE userId = ?
  `).get(user.id);
  const dbActual = dbActualResult.total;

  console.log(`\n   💾 DATABASE VALUES:`);
  console.log(`      DB Target: ${dbTarget.toFixed(2)}h`);
  console.log(`      DB Actual: ${dbActual.toFixed(2)}h`);
  console.log(`      DB Overtime: ${dbOvertime >= 0 ? '+' : ''}${dbOvertime.toFixed(2)}h`);

  console.log(`\n   🔍 COMPARISON:`);
  const targetDiff = Math.abs(adjustedTargetHours - dbTarget);
  const actualDiff = Math.abs(actualHours - dbActual);
  const overtimeDiff = Math.abs(overtimeManual - dbOvertime);

  console.log(`      Target: Manual=${adjustedTargetHours.toFixed(2)}h, DB=${dbTarget.toFixed(2)}h, Diff=${targetDiff.toFixed(2)}h ${targetDiff < 0.01 ? '✅' : '❌'}`);
  console.log(`      Actual: Manual=${actualHours.toFixed(2)}h, DB=${dbActual.toFixed(2)}h, Diff=${actualDiff.toFixed(2)}h ${actualDiff < 0.01 ? '✅' : '❌'}`);
  console.log(`      Overtime: Manual=${overtimeManual.toFixed(2)}h, DB=${dbOvertime.toFixed(2)}h, Diff=${overtimeDiff.toFixed(2)}h ${overtimeDiff < 0.01 ? '✅' : '❌'}`);

  // Month-by-month breakdown
  console.log(`\n   📆 MONTH-BY-MONTH BREAKDOWN (DB):`);
  const monthRows = db.prepare(`
    SELECT month, targetHours, actualHours, ROUND(actualHours - targetHours, 2) as overtime
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month
  `).all(user.id);

  for (const row of monthRows) {
    const sign = row.overtime >= 0 ? '+' : '';
    console.log(`      ${row.month}: Target=${row.targetHours.toFixed(2)}h, Actual=${row.actualHours.toFixed(2)}h, Overtime=${sign}${row.overtime.toFixed(2)}h`);
  }
}

console.log('\n' + '='.repeat(100));
console.log('✅ VERIFICATION COMPLETE\n');

db.close();
