/**
 * PRODUCTION OVERTIME VERIFICATION
 *
 * Reads directly from production database and calculates overtime
 * using the EXACT same logic as fix-overtime.ts
 */

import Database from 'better-sqlite3';

// Production DB path (via SSH mount or direct access)
const db = new Database('/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database.db');

// German holidays 2025 (from DB)
const holidaysResult = db.prepare('SELECT date FROM holidays WHERE date LIKE ? ORDER BY date').all('2025-%');
const holidays2025 = holidaysResult.map(h => h.date);

console.log('📋 PRODUCTION OVERTIME VERIFICATION');
console.log('='.repeat(100));
console.log(`\n🎄 Loaded ${holidays2025.length} holidays from production DB:\n   ${holidays2025.join(', ')}\n`);

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function isHoliday(date) {
  const dateStr = formatDate(date);
  return holidays2025.includes(dateStr);
}

/**
 * Count working days - EXACT same logic as workingDays.ts
 */
function countWorkingDays(startDate, endDate, debugMonth = null) {
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

    if (debugMonth && current.getMonth() + 1 === debugMonth) {
      const status = !isWE && !isH ? '✅' : '❌';
      const reason = isWE ? 'Weekend' : isH ? 'Holiday' : 'Working';
      console.log(`    ${status} ${formatDate(current)} - ${reason}`);
    }

    current.setDate(current.getDate() + 1);
  }

  return { count, details };
}

// Get today (Europe/Berlin timezone)
const today = new Date('2025-12-15'); // Fixed to match production test
today.setHours(0, 0, 0, 0);

console.log(`📅 Calculation Date: ${formatDate(today)}\n`);
console.log('='.repeat(100));

// Get all active users
const users = db.prepare('SELECT id, firstName, lastName, hireDate, weeklyHours FROM users WHERE deletedAt IS NULL').all();

console.log(`\n👥 Found ${users.length} active users\n`);

for (const user of users) {
  console.log('\n' + '─'.repeat(100));
  console.log(`\n👤 ${user.firstName} ${user.lastName} (ID: ${user.id})`);
  console.log(`   📅 Hire Date: ${user.hireDate}`);
  console.log(`   ⏰ Weekly Hours: ${user.weeklyHours}h → Daily: ${user.weeklyHours / 5}h\n`);

  const hireDate = new Date(user.hireDate);
  hireDate.setHours(0, 0, 0, 0);

  // Calculate working days from hire date to today
  const startDate = new Date(Math.max(hireDate.getTime(), hireDate.getTime()));
  const endDate = new Date(Math.min(today.getTime(), today.getTime()));

  // Debug Oktober for Test Test (ID: 15)
  const debugOktober = user.id === 15;

  if (debugOktober) {
    console.log('   🔍 DETAILED OKTOBER 2025 CALCULATION:');
    const oktoberStart = new Date('2025-10-01');
    const oktoberEnd = new Date('2025-10-31');
    const oktoberResult = countWorkingDays(oktoberStart, oktoberEnd, 10);
    console.log(`\n   📊 Oktober 2025: ${oktoberResult.count} working days\n`);
  }

  const { count: workingDays, details } = countWorkingDays(startDate, endDate);

  const dailyHours = user.weeklyHours / 5;
  const targetHours = workingDays * dailyHours;

  console.log(`   📊 CALCULATION:`);
  console.log(`      Working Days: ${workingDays} (from ${formatDate(startDate)} to ${formatDate(endDate)})`);
  console.log(`      Target Hours: ${workingDays} × ${dailyHours}h = ${targetHours.toFixed(2)}h`);

  // Get worked hours from DB
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

  // Get unpaid leave (REDUCES target!)
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
  const overtime = actualHours - adjustedTargetHours;

  console.log(`      Worked Hours: ${workedHours.toFixed(2)}h`);
  console.log(`      Absence Credits: ${absenceDays} days × ${dailyHours}h = ${absenceCredits.toFixed(2)}h`);
  console.log(`      Unpaid Leave: ${unpaidDays} days × ${dailyHours}h = -${unpaidReduction.toFixed(2)}h`);
  console.log(`\n   📈 RESULT:`);
  console.log(`      Adjusted Target: ${adjustedTargetHours.toFixed(2)}h`);
  console.log(`      Actual Hours: ${actualHours.toFixed(2)}h`);
  console.log(`      OVERTIME: ${overtime >= 0 ? '+' : ''}${overtime.toFixed(2)}h`);

  // Compare with production DB value
  const dbOvertimeResult = db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as total
    FROM overtime_balance
    WHERE userId = ?
  `).get(user.id);
  const dbOvertime = dbOvertimeResult.total;

  console.log(`\n   🔍 VERIFICATION:`);
  console.log(`      Production DB: ${dbOvertime >= 0 ? '+' : ''}${dbOvertime.toFixed(2)}h`);
  console.log(`      Manual Calc:   ${overtime >= 0 ? '+' : ''}${overtime.toFixed(2)}h`);

  const diff = Math.abs(overtime - dbOvertime);
  if (diff < 0.01) {
    console.log(`      ✅ MATCH! (Difference: ${diff.toFixed(2)}h)`);
  } else {
    console.log(`      ❌ MISMATCH! (Difference: ${diff.toFixed(2)}h)`);
  }
}

console.log('\n' + '='.repeat(100));
console.log('✅ VERIFICATION COMPLETE\n');

db.close();
