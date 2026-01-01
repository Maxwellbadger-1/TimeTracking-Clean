import Database from 'better-sqlite3';

const db = new Database('/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database/development.db');

console.log('\n🔍 DEBUG: December 2025 Working Days Calculation\n');
console.log('='.repeat(100));

// Get holidays for 2025
const holidays = db.prepare('SELECT date FROM holidays WHERE date LIKE ? ORDER BY date')
  .all('2025-%')
  .map(h => h.date);

console.log('\n📅 Holidays in 2025:', holidays.length);
holidays.forEach(h => console.log('   -', h));

// Simulate the exact calculation from fix-overtime.ts
const today = new Date('2025-12-15'); // Simulate when DB was last updated
today.setHours(0, 0, 0, 0);

const month = '2025-12';
const monthStart = new Date(month + '-01');

// CRITICAL: This is how fix-overtime.ts calculates monthEnd
const year = monthStart.getFullYear();
const monthIndex = monthStart.getMonth();
const lastDay = new Date(year, monthIndex + 1, 0).getDate();
const monthEnd = new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);

console.log('\n📊 Date Boundaries:');
console.log('   monthStart:', monthStart.toISOString().substring(0, 10));
console.log('   monthEnd:', monthEnd.toISOString().substring(0, 10));
console.log('   today:', today.toISOString().substring(0, 10));

const effectiveEnd = new Date(Math.min(monthEnd.getTime(), today.getTime()));
console.log('   effectiveEnd:', effectiveEnd.toISOString().substring(0, 10));

// User 15 hire date
const hireDate = new Date('2025-07-01');
const startDate = new Date(Math.max(monthStart.getTime(), hireDate.getTime()));
console.log('   startDate:', startDate.toISOString().substring(0, 10));

console.log('\n🔢 MANUAL DAY-BY-DAY COUNT (Dec 1-15):');

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let manualCount = 0;
const current = new Date(startDate);

while (current <= effectiveEnd) {
  const dateStr = current.toISOString().substring(0, 10);
  const dayOfWeek = current.getDay();
  const dayName = daysOfWeek[dayOfWeek];
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(dateStr);
  const isWorking = !isWeekend && !isHoliday;

  if (isWorking) {
    manualCount++;
    console.log(`   ${dateStr} (${dayName}) - WORKING DAY #${manualCount}`);
  } else {
    console.log(`   ${dateStr} (${dayName}) - ${isWeekend ? 'WEEKEND' : 'HOLIDAY'}`);
  }

  current.setDate(current.getDate() + 1);
}

console.log('\n   TOTAL MANUAL COUNT:', manualCount, 'days');
console.log('   Expected Target:', manualCount * 8, 'hours');

console.log('\n🔧 UTC-BASED CALCULATION (used in production):');

const startUTC = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
const endUTC = Date.UTC(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let utcCount = 0;
const utcDays = [];

for (let time = startUTC; time <= endUTC; time += MS_PER_DAY) {
  const date = new Date(time);
  const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const dayOfWeek = date.getUTCDay();
  const dayName = daysOfWeek[dayOfWeek];
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(dateStr);
  const isWorking = !isWeekend && !isHoliday;

  utcDays.push({ dateStr, dayName, isWorking });

  if (isWorking) {
    utcCount++;
    console.log(`   ${dateStr} (${dayName}) - WORKING DAY #${utcCount}`);
  } else {
    console.log(`   ${dateStr} (${dayName}) - ${isWeekend ? 'WEEKEND' : 'HOLIDAY'}`);
  }
}

console.log('\n   TOTAL UTC COUNT:', utcCount, 'days');
console.log('   Expected Target:', utcCount * 8, 'hours');

// Check what's in the DB
const dbResult = db.prepare('SELECT targetHours, actualHours FROM overtime_balance WHERE userId = 15 AND month = ?')
  .get('2025-12');

console.log('\n📊 DATABASE VALUE:');
console.log('   Target Hours:', dbResult?.targetHours || 'N/A');
console.log('   Working Days:', dbResult?.targetHours ? Math.round(dbResult.targetHours / 8) : 'N/A');

console.log('\n🔍 COMPARISON:');
console.log('   Manual Count:', manualCount, 'days =', manualCount * 8, 'hours');
console.log('   UTC Count:', utcCount, 'days =', utcCount * 8, 'hours');
console.log('   DB Shows:', dbResult?.targetHours ? Math.round(dbResult.targetHours / 8) : 'N/A', 'days =', dbResult?.targetHours || 'N/A', 'hours');

if (manualCount !== utcCount) {
  console.log('\n⚠️  DISCREPANCY FOUND: Manual and UTC counts differ!');
} else if (dbResult && Math.round(dbResult.targetHours / 8) !== utcCount) {
  console.log('\n⚠️  DISCREPANCY FOUND: DB value differs from calculation!');
  console.log('   Difference:', Math.round(dbResult.targetHours / 8) - utcCount, 'days');
} else {
  console.log('\n✅ All counts match!');
}

console.log('\n' + '='.repeat(100));

db.close();
