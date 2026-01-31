import Database from 'better-sqlite3';
import type { UserPublic, DayName } from './src/types/index.js';
import { toZonedTime, format as dateFnsFormat } from 'date-fns-tz';

const db = new Database('./database/development.db');
const TIMEZONE = 'Europe/Berlin';

// Replicate formatDate from timezone.ts
function formatDate(date: Date, formatString: string): string {
  const berlinDate = toZonedTime(date, TIMEZONE);
  return dateFnsFormat(berlinDate, formatString);
}

// Day name mapping
const DAY_NAMES: Record<number, DayName> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

function getDayName(date: Date | string): DayName {
  const d = typeof date === 'string' ? new Date(date) : date;
  return DAY_NAMES[d.getDay()];
}

function getDailyTargetHours(user: UserPublic, date: Date | string): number {
  // CRITICAL: Check for holidays FIRST!
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);

  console.log(`      getDailyTargetHours('${dateStr}'): holiday=${!!holiday}`);

  if (holiday) {
    console.log(`        → Returning 0h (holiday)`);
    return 0;
  }

  // If user has individual work schedule, use it
  if (user.workSchedule) {
    const dayName = getDayName(date);
    const hours = user.workSchedule[dayName] || 0;
    console.log(`        → workSchedule[${dayName}] = ${hours}h`);
    return hours;
  }

  // Fallback
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`        → Weekend, returning 0h`);
    return 0;
  }

  const dailyHours = Math.round((user.weeklyHours / 5) * 100) / 100;
  console.log(`        → weeklyHours/5 = ${dailyHours}h`);
  return dailyHours;
}

// Get User 155
const user = db.prepare(`
  SELECT id, firstName, lastName, weeklyHours, workSchedule, hireDate
  FROM users
  WHERE id = 155
`).get() as UserPublic & { workSchedule: string | null };

if (user.workSchedule) {
  user.workSchedule = JSON.parse(user.workSchedule) as any;
}

console.log('USER 155:', user.firstName, user.lastName);
console.log('workSchedule:', user.workSchedule);
console.log('');

// REPLICATE updateMonthlyOvertime() EXACTLY
const month = '2026-01';
const [year, monthNum] = month.split('-').map(Number);
const today = new Date(); // Assume "today" is 2026-01-20

const monthStart = new Date(year, monthNum - 1, 1);
const monthEnd = new Date(year, monthNum, 0);

// Simulate currentMonth check
const currentMonth = '2026-01';
const endDate = (month === currentMonth) ? new Date('2026-01-20') : monthEnd;

const hireDate = new Date(user.hireDate);
const hireYear = hireDate.getFullYear();
const hireMonth = hireDate.getMonth() + 1;

let startDate = monthStart;
if (year === hireYear && monthNum === hireMonth) {
  startDate = hireDate;
}

console.log(`CALCULATION PERIOD: ${formatDate(startDate, 'yyyy-MM-dd')} to ${formatDate(endDate, 'yyyy-MM-dd')}`);
console.log('');

// EXACT CODE FROM updateMonthlyOvertime() lines 422-434
let targetHours = 0;

console.log('ITERATING THROUGH DAYS (updateMonthlyOvertime logic):');
console.log('');

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dayOfWeek = d.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const dateStr = formatDate(d, 'yyyy-MM-dd');
  const dayName = DAY_NAMES[dayOfWeek];

  console.log(`  Date: ${dateStr} (${dayName})`);

  if (isWeekend) {
    console.log(`    → SKIPPED (weekend)`);
    console.log('');
    continue;
  }

  const isHoliday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
  console.log(`    → Holiday check: SELECT id FROM holidays WHERE date = '${dateStr}'`);
  console.log(`    → Result: ${JSON.stringify(isHoliday)}`);

  if (isHoliday) {
    console.log(`    → SKIPPED (holiday)`);
    console.log('');
    continue;
  }

  console.log(`    → Calling getDailyTargetHours(user, d)...`);
  const dailyTarget = getDailyTargetHours(user, d);
  targetHours += dailyTarget;
  console.log(`    → Added ${dailyTarget}h, total now: ${targetHours}h`);
  console.log('');
}

targetHours = Math.round(targetHours * 100) / 100;

console.log('═══════════════════════════════════════════════');
console.log(`FINAL TARGET HOURS: ${targetHours}h`);
console.log(`DB VALUE: 84h`);
console.log(`EXPECTED: 92h`);
console.log(`MATCH: ${targetHours === 84 ? '❌ BUG REPRODUCED!' : (targetHours === 92 ? '✅ CORRECT' : '⚠️ UNEXPECTED')}`);
console.log('═══════════════════════════════════════════════');

db.close();
