import { formatDate, getCurrentDate } from './src/utils/timezone.js';
import { getDailyTargetHours } from './src/utils/workingDays.js';
import Database from 'better-sqlite3';
import type { UserPublic } from './src/types/index.js';

const db = new Database('./database/development.db');

// Get User 155
const user = db.prepare(`
  SELECT id, firstName, lastName, weeklyHours, workSchedule, hireDate
  FROM users
  WHERE id = 155
`).get() as UserPublic & { workSchedule: string | null };

if (user.workSchedule) {
  user.workSchedule = JSON.parse(user.workSchedule) as any;
}

// Replicate ensureOvertimeBalanceEntries logic for 2026-01
const month = '2026-01';
const [year, monthNum] = month.split('-').map(Number);
const today = getCurrentDate();
const currentMonth = formatDate(today, 'yyyy-MM');

const monthStart = new Date(year, monthNum - 1, 1);
const monthEnd = new Date(year, monthNum, 0);

const endDate = (month === currentMonth) ? today : monthEnd;

const hireDate = new Date(user.hireDate);
let startDate = monthStart;

console.log('=== SETUP ===');
console.log('Month:', month);
console.log('monthStart:', monthStart, '→', formatDate(monthStart, 'yyyy-MM-dd'));
console.log('monthEnd:', monthEnd, '→', formatDate(monthEnd, 'yyyy-MM-dd'));
console.log('today:', today, '→', formatDate(today, 'yyyy-MM-dd'));
console.log('currentMonth:', currentMonth);
console.log('endDate:', endDate, '→', formatDate(endDate, 'yyyy-MM-dd'));
console.log('');

console.log('=== LOOP ===');
let targetHours = 0;
for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dateStr = formatDate(d, 'yyyy-MM-dd');
  const hours = getDailyTargetHours(user, dateStr);
  targetHours += hours;
  console.log(`${dateStr}: ${hours}h (total: ${targetHours}h)`);
}

console.log('');
console.log('=== RESULT ===');
console.log('Total:', targetHours + 'h');
console.log('Expected: 98h (or similar)');
console.log('DB has: 84h');

db.close();
