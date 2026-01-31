import Database from 'better-sqlite3';
import type { UserPublic, DayName } from './src/types/index.js';

const db = new Database('./database/development.db');

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

  console.log(`  ${dateStr}: Holiday check result:`, holiday);

  if (holiday) {
    console.log(`    → Holiday detected, returning 0h`);
    return 0;
  }

  // If user has individual work schedule, use it
  if (user.workSchedule) {
    const dayName = getDayName(date);
    const hours = user.workSchedule[dayName] || 0;
    console.log(`    → workSchedule[${dayName}] = ${hours}h`);
    return hours;
  }

  // Fallback
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`    → Weekend, returning 0h`);
    return 0;
  }

  const dailyHours = Math.round((user.weeklyHours / 5) * 100) / 100;
  console.log(`    → weeklyHours/5 = ${dailyHours}h`);
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

console.log('USER 155:', user);
console.log('workSchedule:', user.workSchedule);
console.log('');

// Calculate target hours for Jan 1-20, 2026
const startDate = new Date('2026-01-01');
const endDate = new Date('2026-01-20');

let totalTarget = 0;

console.log('CALCULATING TARGET HOURS (2026-01-01 to 2026-01-20):');
console.log('');

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dateStr = d.toISOString().split('T')[0];
  const dayOfWeek = d.getDay();
  const dayName = DAY_NAMES[dayOfWeek];

  console.log(`Date: ${dateStr} (${dayName})`);

  const target = getDailyTargetHours(user, d);
  totalTarget += target;

  console.log(`  Target for this day: ${target}h (Running total: ${totalTarget}h)`);
  console.log('');
}

console.log('═══════════════════════════════════════════════');
console.log(`TOTAL TARGET HOURS: ${totalTarget}h`);
console.log(`DB TARGET HOURS: 84h`);
console.log(`EXPECTED: 92h`);
console.log(`MATCH: ${totalTarget === 92 ? '✅ YES' : '❌ NO'}`);
console.log('═══════════════════════════════════════════════');

db.close();
