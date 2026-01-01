import Database from 'better-sqlite3';

const db = new Database('/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/database/development.db');

console.log('\n🔍 DEEP DIVE: Test Employee (ID 15) Dev DB Analysis\n');
console.log('='.repeat(100));

// Get user info
const user = db.prepare('SELECT * FROM users WHERE id = 15').get();
console.log('\n👤 User Info:');
console.log('   Name:', user.firstName, user.lastName);
console.log('   Hire Date:', user.hireDate);
console.log('   Weekly Hours:', user.weeklyHours);
console.log('   Daily Hours:', user.weeklyHours / 5);

// Get all time entries
const timeEntries = db.prepare('SELECT date, hours FROM time_entries WHERE userId = 15 ORDER BY date').all();
console.log('\n⏰ Time Entries (' + timeEntries.length + ' total):');
const monthlyWorked = {};
timeEntries.forEach(e => {
  const month = e.date.substring(0, 7);
  monthlyWorked[month] = (monthlyWorked[month] || 0) + e.hours;
});
console.log('   Grouped by month:');
for (const [month, hours] of Object.entries(monthlyWorked)) {
  console.log('     ' + month + ':', hours.toFixed(2) + 'h');
}
console.log('   Total Worked:', timeEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(2) + 'h');

// Get all absences
const absences = db.prepare(`
  SELECT type, status, startDate, endDate, days
  FROM absence_requests
  WHERE userId = 15
  ORDER BY startDate
`).all();
console.log('\n🏖️  Absences (' + absences.length + ' total):');
const vacationDays = absences.filter(a => a.status === 'approved' && (a.type === 'vacation' || a.type === 'sick' || a.type === 'overtime_comp')).reduce((sum, a) => sum + a.days, 0);
const unpaidDays = absences.filter(a => a.status === 'approved' && a.type === 'unpaid').reduce((sum, a) => sum + a.days, 0);
absences.forEach(a => {
  console.log(`   ${a.startDate} → ${a.endDate}: ${a.type} (${a.days} days, status: ${a.status})`);
});
console.log('   Credits (vacation/sick/comp):', vacationDays, 'days =', (vacationDays * 8).toFixed(2) + 'h');
console.log('   Unpaid (reduces target):', unpaidDays, 'days =', (unpaidDays * 8).toFixed(2) + 'h');

// Get overtime_balance
const overtime = db.prepare('SELECT * FROM overtime_balance WHERE userId = 15 ORDER BY month').all();
console.log('\n📊 Overtime Balance (DB):');
let totalTarget = 0, totalActual = 0;
overtime.forEach(o => {
  totalTarget += o.targetHours;
  totalActual += o.actualHours;
  const diff = o.actualHours - o.targetHours;
  console.log(`   ${o.month}: Target=${o.targetHours.toFixed(2)}h, Actual=${o.actualHours.toFixed(2)}h, Diff=${diff >= 0 ? '+' : ''}${diff.toFixed(2)}h`);
});
console.log(`   TOTAL: Target=${totalTarget.toFixed(2)}h, Actual=${totalActual.toFixed(2)}h, Overtime=${(totalActual - totalTarget).toFixed(2)}h`);

// Calculate what it SHOULD be
console.log('\n✅ MANUAL CALCULATION:');
const hireDate = new Date('2025-07-01');
const today = new Date('2025-12-15');
const start = new Date(Math.max(hireDate.getTime(), hireDate.getTime()));
const end = new Date(Math.min(today.getTime(), today.getTime()));

// Simple working days count (Mo-Fr, no holidays for simplicity)
let workingDays = 0;
const current = new Date(start);
while (current <= end) {
  const day = current.getDay();
  if (day !== 0 && day !== 6) workingDays++;
  current.setDate(current.getDate() + 1);
}

const dailyHours = 8;
const targetHours = workingDays * dailyHours;
const workedHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
const absenceCredits = vacationDays * dailyHours;
const unpaidReduction = unpaidDays * dailyHours;
const adjustedTarget = targetHours - unpaidReduction;
const actualHours = workedHours + absenceCredits;
const manualOvertime = actualHours - adjustedTarget;

console.log(`   Working Days (${hireDate.toISOString().substring(0, 10)} → ${today.toISOString().substring(0, 10)}): ${workingDays}`);
console.log(`   Base Target: ${workingDays} × ${dailyHours}h = ${targetHours.toFixed(2)}h`);
console.log(`   Unpaid Reduction: -${unpaidReduction.toFixed(2)}h`);
console.log(`   Adjusted Target: ${adjustedTarget.toFixed(2)}h`);
console.log(`   Worked: ${workedHours.toFixed(2)}h`);
console.log(`   Absence Credits: +${absenceCredits.toFixed(2)}h`);
console.log(`   Actual: ${actualHours.toFixed(2)}h`);
console.log(`   OVERTIME: ${manualOvertime >= 0 ? '+' : ''}${manualOvertime.toFixed(2)}h`);

console.log('\n🔍 COMPARISON:');
console.log(`   DB Target: ${totalTarget.toFixed(2)}h`);
console.log(`   Manual Target: ${adjustedTarget.toFixed(2)}h`);
console.log(`   Difference: ${Math.abs(adjustedTarget - totalTarget).toFixed(2)}h ${adjustedTarget === totalTarget ? '✅' : '❌'}`);

console.log('\n' + '='.repeat(100));

db.close();
