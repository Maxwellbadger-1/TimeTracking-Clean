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

// Import working days utility (SSOT - Single Source of Truth)
// This ensures holiday exclusion is consistent across the entire system
import { countWorkingDaysBetween } from '../dist/utils/workingDays.js';

// Import timezone utilities (CRITICAL: Use Europe/Berlin, NOT UTC!)
import { getCurrentDate, getCurrentMonth } from '../dist/utils/timezone.js';

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

  // Get today's date (for calculating target hours only up to today, not until month end!)
  // CRITICAL: Use getCurrentDate() for Europe/Berlin timezone, NOT new Date() (which uses server timezone)!
  const today = getCurrentDate();
  today.setHours(0, 0, 0, 0);

  // Recalculate all months (ALWAYS update, even if entry exists)
  for (const month of months) {
    // Calculate month boundaries
    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    // CRITICAL: Only count working days up to TODAY, not until month end!
    // This is how professional systems (Personio, DATEV) do it:
    // "Overtime = What you SHOULD have worked BY TODAY - What you ACTUALLY worked BY TODAY"
    const effectiveEnd = new Date(Math.min(monthEnd.getTime(), today.getTime()));

    // Calculate working days from (hire date or month start) to (today or month end)
    // IMPORTANT: Use countWorkingDaysBetween() for consistency - it excludes holidays!
    // CRITICAL: Pass our DB instance so it uses the SAME database (not connection.ts!)
    const startDate = new Date(Math.max(monthStart.getTime(), hireDate.getTime()));
    const workingDays = countWorkingDaysBetween(startDate, effectiveEnd, db);

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
        SELECT COALESCE(SUM(days), 0) as total
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

    // Get unpaid leave (REDUCES target hours, does NOT give credits!)
    const unpaidLeaveResult = db
      .prepare(`
        SELECT COALESCE(SUM(days), 0) as total
        FROM absence_requests
        WHERE userId = ?
          AND status = 'approved'
          AND type = 'unpaid'
          AND (
            (strftime('%Y-%m', startDate) = ? OR strftime('%Y-%m', endDate) = ?)
            OR (startDate < ? || '-01' AND endDate > ? || '-01')
          )
      `)
      .get(userId, month, month, month, month) as { total: number };
    const unpaidLeaveReduction = (unpaidLeaveResult?.total || 0) * targetHoursPerDay;

    // IMPORTANT: Unpaid leave reduces target hours (user doesn't need to work those days)
    const adjustedTargetHours = targetHours - unpaidLeaveReduction;
    const actualHours = workedHours + absenceCredits;
    const overtime = actualHours - adjustedTargetHours;

    // UPSERT: Update existing entries or create new ones
    db.prepare(`
      INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId, month)
      DO UPDATE SET targetHours = ?, actualHours = ?
    `).run(userId, month, adjustedTargetHours, actualHours, adjustedTargetHours, actualHours);

    console.log(`  ✅ Updated ${month}: Target=${adjustedTargetHours.toFixed(2)}h, Actual=${actualHours.toFixed(2)}h, Overtime=${overtime.toFixed(2)}h`);
  }
}

console.log('🔧 Starting overtime recalculation...\n');

// CRITICAL: Use Europe/Berlin timezone for correct month calculation
const currentMonth = getCurrentMonth();

// Get all active users
const users = db
  .prepare('SELECT id, firstName, lastName, hireDate FROM users WHERE deletedAt IS NULL')
  .all() as Array<{ id: number; firstName: string; lastName: string; hireDate: string }>;

console.log(`📊 Found ${users.length} active users\n`);

let totalProcessed = 0;
let totalUpdated = 0;

for (const user of users) {
  console.log(`👤 Processing: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

  // Count existing entries before
  const beforeCount = db
    .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
    .get(user.id) as { count: number };

  ensureOvertimeBalanceEntries(user.id, currentMonth);

  // Count entries after
  const afterCount = db
    .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
    .get(user.id) as { count: number };

  const created = afterCount.count - beforeCount.count;
  const updated = afterCount.count; // All entries were processed (created or updated)
  totalUpdated += updated;
  totalProcessed++;

  if (created > 0) {
    console.log(`  📝 Created ${created} new month entries`);
  }
  console.log(`  🔄 Processed ${updated} total month entries`);

  // Show current total overtime (actualHours - targetHours)
  const totalResult = db
    .prepare('SELECT COALESCE(SUM(actualHours - targetHours), 0) as total FROM overtime_balance WHERE userId = ?')
    .get(user.id) as { total: number };

  console.log(`  ⏰ Total overtime: ${totalResult.total.toFixed(2)}h\n`);
}

console.log('✅ DONE!');
console.log(`📊 Users processed: ${totalProcessed}`);
console.log(`🔄 Total entries updated: ${totalUpdated}`);

db.close();
