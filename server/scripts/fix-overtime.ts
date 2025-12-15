/**
 * Fix Overtime Script
 * Recalculates overtime for all users by ensuring all months from hire date to current month exist
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

// Same logic as in overtimeService.ts
function ensureOvertimeBalanceEntries(userId: number, targetMonth: string) {
  const user = db
    .prepare('SELECT hireDate, weeklyHours FROM users WHERE id = ?')
    .get(userId) as { hireDate: string; weeklyHours: number } | undefined;

  if (!user || !user.hireDate) {
    return;
  }

  const hireDate = new Date(user.hireDate);
  const targetDate = new Date(targetMonth + '-01');

  // Generate all months from hire date to target month
  const months: string[] = [];
  const current = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);

  while (current <= targetDate) {
    months.push(current.toISOString().substring(0, 7));
    current.setMonth(current.getMonth() + 1);
  }

  // Ensure entries exist for all months
  for (const month of months) {
    const existing = db
      .prepare('SELECT id FROM overtime_balance WHERE userId = ? AND month = ?')
      .get(userId, month);

    if (!existing) {
      // Create entry with calculated overtime
      const monthStart = new Date(month + '-01');
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      // Calculate working days
      let workingDays = 0;
      for (let d = new Date(Math.max(monthStart.getTime(), hireDate.getTime())); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
        }
      }

      const targetHoursPerDay = user.weeklyHours / 5;
      const targetHours = workingDays * targetHoursPerDay;

      // Get actual hours (worked hours)
      const workedResult = db
        .prepare('SELECT COALESCE(SUM(hours), 0) as total FROM time_entries WHERE userId = ? AND date LIKE ?')
        .get(userId, month + '%') as { total: number };
      const workedHours = workedResult?.total || 0;

      // Get absence credits (approved vacation, sick, overtime_comp)
      const absenceResult = db
        .prepare(`
          SELECT COALESCE(SUM(daysRequired), 0) as total
          FROM absence_requests
          WHERE userId = ?
            AND status = 'approved'
            AND (type = 'vacation' OR type = 'sick' OR type = 'overtime_comp')
            AND (
              (strftime('%Y-%m', startDate) = ? OR strftime('%Y-%m', endDate) = ?)
              OR (startDate < ? || '-01' AND endDate > ? || '-01')
            )
        `)
        .get(userId, month, month, month, month) as { total: number };
      const absenceCredits = (absenceResult?.total || 0) * targetHoursPerDay;

      const actualHours = workedHours + absenceCredits;
      const overtime = actualHours - targetHours;

      db.prepare(`
        INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, month, targetHours, actualHours);

      console.log(`  ✅ Created entry for ${month}: Target=${targetHours.toFixed(2)}h, Actual=${actualHours.toFixed(2)}h, Overtime=${overtime.toFixed(2)}h`);
    }
  }
}

console.log('🔧 Starting overtime recalculation...\n');

const today = new Date();
const currentMonth = today.toISOString().substring(0, 7);

// Get all active users
const users = db
  .prepare('SELECT id, firstName, lastName, hireDate FROM users WHERE deletedAt IS NULL')
  .all() as Array<{ id: number; firstName: string; lastName: string; hireDate: string }>;

console.log(`📊 Found ${users.length} active users\n`);

let totalProcessed = 0;
let totalEntriesCreated = 0;

for (const user of users) {
  console.log(`👤 Processing: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

  const beforeCount = db
    .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
    .get(user.id) as { count: number };

  ensureOvertimeBalanceEntries(user.id, currentMonth);

  const afterCount = db
    .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
    .get(user.id) as { count: number };

  const created = afterCount.count - beforeCount.count;
  totalEntriesCreated += created;
  totalProcessed++;

  if (created > 0) {
    console.log(`  📝 Created ${created} new month entries`);
  }

  // Show current total overtime (actualHours - targetHours)
  const totalResult = db
    .prepare('SELECT COALESCE(SUM(actualHours - targetHours), 0) as total FROM overtime_balance WHERE userId = ?')
    .get(user.id) as { total: number };

  console.log(`  ⏰ Total overtime: ${totalResult.total.toFixed(2)}h\n`);
}

console.log('✅ DONE!');
console.log(`📊 Users processed: ${totalProcessed}`);
console.log(`📝 Entries created: ${totalEntriesCreated}`);

db.close();
