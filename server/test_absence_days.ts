import { formatDate } from './src/utils/timezone.js';
import { getDailyTargetHours } from './src/utils/workingDays.js';
import Database from 'better-sqlite3';

const db = new Database('./database/development.db');

// Get User 155
const user = db.prepare(`
  SELECT id, firstName, lastName, weeklyHours, workSchedule
  FROM users
  WHERE id = 155
`).get() as any;

if (user.workSchedule) {
  user.workSchedule = JSON.parse(user.workSchedule);
}

console.log('=== TESTING ABSENCE CALCULATION ===\n');
console.log('User:', user.firstName, user.lastName);
console.log('workSchedule:', user.workSchedule);
console.log('');

// Test dates: 2026-01-20 to 2026-01-21
const absenceStart = new Date('2026-01-20');
const absenceEnd = new Date('2026-01-21');

console.log('Absence Period:', formatDate(absenceStart, 'yyyy-MM-dd'), 'to', formatDate(absenceEnd, 'yyyy-MM-dd'));
console.log('');

let totalDays = 0;
let totalHours = 0;

console.log('Day-by-Day:');
for (let d = new Date(absenceStart); d <= absenceEnd; d.setDate(d.getDate() + 1)) {
  const dateStr = formatDate(d, 'yyyy-MM-dd');
  const dayOfWeek = d.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];

  console.log(`  ${dateStr}:`);
  console.log(`    Date object d.getDay(): ${dayOfWeek} (${dayName})`);
  console.log(`    dateStr formatDate: ${dateStr}`);

  // Call getDailyTargetHours with dateStr
  const hours = getDailyTargetHours(user, dateStr);
  console.log(`    getDailyTargetHours(user, '${dateStr}'): ${hours}h`);

  if (hours > 0) {
    totalDays++;
    totalHours += hours;
  }
  console.log('');
}

console.log('='.repeat(50));
console.log(`Total: ${totalHours}h for ${totalDays} workdays`);
console.log(`Expected: 14h for 2 workdays (Di 8h + Mi 6h)`);
console.log(`Match: ${totalHours === 14 ? '✅ CORRECT' : '❌ WRONG'}`);
console.log('='.repeat(50));

db.close();
