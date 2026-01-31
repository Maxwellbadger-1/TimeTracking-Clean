import { formatDate } from './src/utils/timezone.js';
import Database from 'better-sqlite3';

const db = new Database('./database/development.db');

// User 155: Test Workflow
// workSchedule: {monday:10, tuesday:8, wednesday:6, thursday:8, friday:6}
// Unpaid leave: 20.-21.01.2026 (Monday + Tuesday)

console.log('=== UNPAID LEAVE CALCULATION TEST ===\n');

// Get user
const user = db.prepare(`SELECT id, firstName, lastName, workSchedule FROM users WHERE id = 155`).get() as any;
if (user.workSchedule) {
  user.workSchedule = JSON.parse(user.workSchedule);
}

console.log('User:', user.firstName, user.lastName);
console.log('workSchedule:', user.workSchedule);
console.log('');

// Get unpaid leave
const unpaidLeave = db.prepare(`
  SELECT id, startDate, endDate, days
  FROM absence_requests
  WHERE userId = 155
    AND type = 'unpaid'
    AND status = 'approved'
`).get() as any;

console.log('Unpaid Leave:', unpaidLeave);
console.log('');

// Manual calculation
const dates = ['2026-01-20', '2026-01-21'];
let expectedHours = 0;

for (const dateStr of dates) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = d.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];

  const hours = user.workSchedule[dayName] || 0;
  expectedHours += hours;

  console.log(`${dateStr} (${dayName}): ${hours}h`);
}

console.log('');
console.log('='.repeat(50));
console.log(`Expected unpaidLeaveReduction: ${expectedHours}h`);
console.log(`Current in DB: 14h (WRONG)`);
console.log(`Match: ${expectedHours === 18 ? '✅ CORRECT' : '❌ WRONG'}`);
console.log('='.repeat(50));

db.close();
