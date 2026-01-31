import Database from 'better-sqlite3';

const db = new Database('database/development.db');
db.pragma('journal_mode = WAL');

const userId = 47;
const heute = '2026-01-18';

console.log('='
.repeat(80));
console.log('📊 MANUAL OVERTIME CALCULATION FOR USER ID=20');
console.log('='.repeat(80));

// 1. GET USER INFO
const user = db.prepare(`
  SELECT id, firstName, lastName, weeklyHours, workSchedule, hireDate
  FROM users
  WHERE id = ?
`).get(userId) as any;

console.log(`\n👤 USER INFO:`);
console.log(`   Name: ${user.firstName} ${user.lastName}`);
console.log(`   Hire Date: ${user.hireDate}`);
console.log(`   Weekly Hours: ${user.weeklyHours}h`);
console.log(`   Work Schedule: ${user.workSchedule || 'Standard (Mo-Fr)'}`);

const workSchedule = user.workSchedule ? JSON.parse(user.workSchedule) : null;
if (workSchedule) {
  console.log(`\n   📅 Individual Work Schedule:`);
  console.log(`      Monday: ${workSchedule.monday || 0}h`);
  console.log(`      Tuesday: ${workSchedule.tuesday || 0}h`);
  console.log(`      Wednesday: ${workSchedule.wednesday || 0}h`);
  console.log(`      Thursday: ${workSchedule.thursday || 0}h`);
  console.log(`      Friday: ${workSchedule.friday || 0}h`);
  console.log(`      Saturday: ${workSchedule.saturday || 0}h`);
  console.log(`      Sunday: ${workSchedule.sunday || 0}h`);
}

// 2. GET TIME ENTRIES
const timeEntries = db.prepare(`
  SELECT date, hours
  FROM time_entries
  WHERE userId = ?
  ORDER BY date
`).all(userId) as any[];

console.log(`\n📝 TIME ENTRIES (${timeEntries.length}):`);
let totalWorked = 0;
timeEntries.forEach((entry) => {
  console.log(`   ${entry.date}: ${entry.hours}h`);
  totalWorked += entry.hours;
});
console.log(`   TOTAL WORKED: ${totalWorked}h`);

// 3. GET ABSENCES
const absences = db.prepare(`
  SELECT type, startDate, endDate, days
  FROM absence_requests
  WHERE userId = ? AND status = 'approved'
  ORDER BY startDate
`).all(userId) as any[];

console.log(`\n🏖️  ABSENCES (${absences.length}):`);
absences.forEach((abs) => {
  console.log(`   ${abs.type.toUpperCase()}: ${abs.startDate} - ${abs.endDate} (${abs.days} days)`);
});

// 4. CALCULATE ABSENCE CREDITS
console.log(`\n🧮 ABSENCE CREDITS:`);

// Helper: Calculate hours for a date range
function calculateAbsenceHours(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalHours = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (workSchedule && workSchedule[dayName] > 0) {
        totalHours += workSchedule[dayName];
      }
      continue;
    }

    // Get hours for this day from workSchedule
    if (workSchedule) {
      totalHours += workSchedule[dayName] || 0;
    } else {
      // Standard: weeklyHours / 5
      totalHours += user.weeklyHours / 5;
    }
  }

  return totalHours;
}

let sickCredit = 0;
let vacationCredit = 0;
let overtimeCompCredit = 0;
let unpaidReduction = 0;

absences.forEach((abs) => {
  const hours = calculateAbsenceHours(abs.startDate, abs.endDate);

  if (abs.type === 'sick') {
    sickCredit += hours;
    console.log(`   Sick (${abs.startDate} - ${abs.endDate}): +${hours}h`);
  } else if (abs.type === 'vacation') {
    vacationCredit += hours;
    console.log(`   Vacation (${abs.startDate} - ${abs.endDate}): +${hours}h`);
  } else if (abs.type === 'overtime_comp') {
    overtimeCompCredit += hours;
    console.log(`   Overtime Comp (${abs.startDate} - ${abs.endDate}): +${hours}h`);
  } else if (abs.type === 'unpaid') {
    unpaidReduction += hours;
    console.log(`   Unpaid (${abs.startDate} - ${abs.endDate}): -${hours}h (reduces target!)`);
  }
});

const totalAbsenceCredits = sickCredit + vacationCredit + overtimeCompCredit;
console.log(`   TOTAL CREDITS: ${totalAbsenceCredits}h`);

// 5. CALCULATE TARGET HOURS
console.log(`\n🎯 TARGET HOURS CALCULATION:`);
console.log(`   Period: ${user.hireDate} - ${heute}`);

function calculateTargetHours(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  let totalTarget = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    // Weekend?
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (workSchedule && workSchedule[dayName] > 0) {
        totalTarget += workSchedule[dayName];
      }
      continue;
    }

    // Working day
    if (workSchedule) {
      totalTarget += workSchedule[dayName] || 0;
    } else {
      totalTarget += user.weeklyHours / 5;
    }
  }

  return totalTarget;
}

const baseTarget = calculateTargetHours(user.hireDate, heute);
const adjustedTarget = baseTarget - unpaidReduction;

console.log(`   Base Target: ${baseTarget}h`);
console.log(`   Unpaid Reduction: -${unpaidReduction}h`);
console.log(`   ADJUSTED TARGET: ${adjustedTarget}h`);

// 6. CALCULATE OVERTIME
console.log(`\n✅ FINAL CALCULATION:`);
const actualHours = totalWorked + totalAbsenceCredits;
const overtime = actualHours - adjustedTarget;

console.log(`   Worked: ${totalWorked}h`);
console.log(`   + Absence Credits: ${totalAbsenceCredits}h`);
console.log(`   = Actual Hours: ${actualHours}h`);
console.log(`\n   Target Hours: ${adjustedTarget}h`);
console.log(`   Overtime: ${overtime > 0 ? '+' : ''}${overtime}h`);

console.log(`\n${'='.repeat(80)}`);
console.log(`🎯 EXPECTED VALUES FOR FRONTEND:`);
console.log(`${'='.repeat(80)}`);
console.log(`{`);
console.log(`  "userId": ${userId},`);
console.log(`  "period": "${user.hireDate} - ${heute}",`);
console.log(`  "targetHours": ${adjustedTarget},`);
console.log(`  "actualHours": ${actualHours},`);
console.log(`  "overtime": ${overtime},`);
console.log(`  "breakdown": {`);
console.log(`    "workedHours": ${totalWorked},`);
console.log(`    "sickCredit": ${sickCredit},`);
console.log(`    "vacationCredit": ${vacationCredit},`);
console.log(`    "overtimeCompCredit": ${overtimeCompCredit},`);
console.log(`    "unpaidReduction": ${unpaidReduction}`);
console.log(`  }`);
console.log(`}`);
console.log(`${'='.repeat(80)}\n`);

db.close();
