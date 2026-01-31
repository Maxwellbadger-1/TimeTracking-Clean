/**
 * Create ONE COMPLETE Test User with ALL Features
 *
 * Creates: Max Mustermann (Teilzeit 30h, hired 2024-01-01)
 * With:
 * - Individual work schedule (Mo 8h, Di 8h, Mi 6h, Do 8h, Fr 0h)
 * - Time entries with gaps and variations (realistic data)
 * - Vacation periods (6 periods über 2024-2025)
 * - Sick leave days (4 periods)
 * - Overtime compensation days (2 periods)
 * - Unpaid leave (1 period)
 * - Feiertage werden berücksichtigt
 *
 * USES TRANSACTION PATTERN for guaranteed COMMIT in WAL mode!
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import logger from '../utils/logger.js';

logger.info('🚀 Creating COMPLETE test user with ALL features using TRANSACTION pattern...');

// Helper: Check if day is work day according to schedule
const isWorkDay = (date: Date, workSchedule: any): boolean => {
  const dayOfWeek = date.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return (workSchedule[dayNames[dayOfWeek]] || 0) > 0;
};

// Helper: Get target hours for a day
const getTargetHours = (date: Date, workSchedule: any): number => {
  const dayOfWeek = date.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return workSchedule[dayNames[dayOfWeek]] || 0;
};

// Define absence periods
const absenceDefinitions = [
  // 2024
  { startDate: '2024-03-25', endDate: '2024-04-05', type: 'vacation', reason: 'Osterurlaub' },
  { startDate: '2024-05-13', endDate: '2024-05-15', type: 'sick', reason: 'Grippe' },
  { startDate: '2024-07-15', endDate: '2024-07-26', type: 'vacation', reason: 'Sommerurlaub' },
  { startDate: '2024-09-09', endDate: '2024-09-10', type: 'overtime_comp', reason: 'Überstundenabbau' },
  { startDate: '2024-11-04', endDate: '2024-11-05', type: 'sick', reason: 'Erkältung' },
  { startDate: '2024-12-02', endDate: '2024-12-03', type: 'unpaid', reason: 'Unbezahlter Urlaub' },

  // 2025
  { startDate: '2025-01-20', endDate: '2025-01-22', type: 'vacation', reason: 'Umzug (als Urlaub)' },
  { startDate: '2025-02-10', endDate: '2025-02-12', type: 'sick', reason: 'Magen-Darm' },
  { startDate: '2025-04-14', endDate: '2025-04-25', type: 'vacation', reason: 'Frühjahrsurlaub' },
  { startDate: '2025-06-16', endDate: '2025-06-18', type: 'overtime_comp', reason: 'Überstundenabbau' },
  { startDate: '2025-08-04', endDate: '2025-08-15', type: 'vacation', reason: 'Sommerurlaub' },
  { startDate: '2025-10-27', endDate: '2025-10-29', type: 'sick', reason: 'Rückenschmerzen' },
  { startDate: '2025-12-22', endDate: '2026-01-03', type: 'vacation', reason: 'Weihnachtsurlaub' },
] as const;

// Work schedule definition
const workSchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 6,
  thursday: 8,
  friday: 0,
  saturday: 0,
  sunday: 0
};

// ============================================================================
// TRANSACTION: All INSERTs in one atomic operation
// ============================================================================

const createCompleteTestUser = db.transaction(() => {
  logger.info('🔄 Starting transaction...');

  // 1. Delete existing test user if exists (CASCADE will delete all related data)
  logger.info('🔍 Checking for existing test user...');
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('test.max') as { id: number } | undefined;
  if (existingUser) {
    logger.info({ existingUserId: existingUser.id }, '🗑️  Deleting existing test.max user...');
    db.prepare('DELETE FROM users WHERE username = ?').run('test.max');
    logger.info('✅ Old user deleted');
  }

  // 2. Create user with individual work schedule
  const hashedPassword = bcrypt.hashSync('test123', 10);
  const workScheduleJson = JSON.stringify(workSchedule);

  const result = db.prepare(`
    INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('test.max', 'max@test.com', hashedPassword, 'Max', 'Mustermann', 'employee', 30, workScheduleJson, 30, '2024-01-01', 'active');

  const userId = result.lastInsertRowid as number;
  logger.info({ userId, workSchedule }, '✅ User created with individual work schedule');

  // 3. Add realistic time entries with gaps and variations
  logger.info('📅 Adding realistic time entries (2024-2026)...');
  let totalEntries = 0;

  // Create absence date set for quick lookup
  const absenceDates = new Set<string>();
  absenceDefinitions.forEach(abs => {
    const start = new Date(abs.startDate);
    const end = new Date(abs.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      absenceDates.add(d.toISOString().split('T')[0]);
    }
  });

  // Add time entries for 2024, 2025
  for (const year of [2024, 2025]) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];

        // Skip if not a work day
        if (!isWorkDay(date, workSchedule)) continue;

        // Skip if user is absent
        if (absenceDates.has(dateStr)) continue;

        // Simulate realistic work patterns:
        // - 10% chance of missing a day
        // - 15% chance of working less hours
        // - 10% chance of working more hours
        const random = Math.random();

        if (random < 0.10) {
          // Skip this day (10% chance)
          continue;
        }

        const targetHours = getTargetHours(date, workSchedule);
        let hours = targetHours;
        let startHour = 8;
        let endHour = startHour + hours;

        if (random < 0.25) {
          // Work less (15% chance)
          hours = Math.max(targetHours - 2, targetHours * 0.5);
          endHour = startHour + hours;
        } else if (random < 0.35) {
          // Work more (10% chance) - Überstunden!
          hours = targetHours + Math.floor(Math.random() * 3) + 1;
          endHour = startHour + hours;
        }

        // Randomize start time a bit (±1 hour)
        if (Math.random() < 0.3) {
          const offset = Math.random() < 0.5 ? -1 : 1;
          startHour += offset;
          endHour += offset;
        }

        const startTime = `${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 === 0.5 ? '30' : '00'}`;
        const endTime = `${String(Math.floor(endHour)).padStart(2, '0')}:${endHour % 1 === 0.5 ? '30' : '00'}`;

        db.prepare(`
          INSERT INTO time_entries (userId, date, startTime, endTime, hours, location, createdAt)
          VALUES (?, ?, ?, ?, ?, 'office', datetime('now'))
        `).run(userId, dateStr, startTime, endTime, hours);

        totalEntries++;
      }
    }
  }

  // 2026: Only January (up to today)
  const jan2026Days = new Date(2026, 1, 0).getDate();
  const today = new Date();
  for (let day = 1; day <= jan2026Days; day++) {
    const date = new Date(2026, 0, day);
    if (date > today) break;

    const dateStr = date.toISOString().split('T')[0];

    // Skip if not a work day
    if (!isWorkDay(date, workSchedule)) continue;

    // Skip if user is absent
    if (absenceDates.has(dateStr)) continue;

    // Similar realistic pattern
    const random = Math.random();
    if (random < 0.10) continue;

    const targetHours = getTargetHours(date, workSchedule);
    let hours = targetHours;
    let startHour = 8;

    if (random < 0.25) {
      hours = Math.max(targetHours - 2, targetHours * 0.5);
    } else if (random < 0.35) {
      hours = targetHours + Math.floor(Math.random() * 3) + 1;
    }

    if (Math.random() < 0.3) {
      const offset = Math.random() < 0.5 ? -1 : 1;
      startHour += offset;
    }

    const endHour = startHour + hours;
    const startTime = `${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 === 0.5 ? '30' : '00'}`;
    const endTime = `${String(Math.floor(endHour)).padStart(2, '0')}:${endHour % 1 === 0.5 ? '30' : '00'}`;

    db.prepare(`
      INSERT INTO time_entries (userId, date, startTime, endTime, hours, location, createdAt)
      VALUES (?, ?, ?, ?, ?, 'office', datetime('now'))
    `).run(userId, dateStr, startTime, endTime, hours);

    totalEntries++;
  }

  logger.info({ totalEntries }, '✅ Time entries created');

  // 4. Add absence requests
  logger.info('🏖️  Adding absence requests...');

  for (const abs of absenceDefinitions) {
    // Calculate work days for this absence
    const start = new Date(abs.startDate);
    const end = new Date(abs.endDate);
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (isWorkDay(d, workSchedule)) {
        days++;
      }
    }

    db.prepare(`
      INSERT INTO absence_requests (userId, type, startDate, endDate, days, reason, status, approvedBy, approvedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', 1, datetime('now'), datetime('now'))
    `).run(userId, abs.type, abs.startDate, abs.endDate, days, abs.reason);
  }

  logger.info({ totalAbsences: absenceDefinitions.length }, '✅ Absence requests created');

  // 5. Calculate overtime balances
  logger.info('⏳ Calculating overtime balances...');
  ensureOvertimeBalanceEntries(userId, '2026-01');
  logger.info('✅ Overtime balances calculated');

  // Return userId for verification
  return userId;
});

// ============================================================================
// EXECUTE TRANSACTION (commits automatically on success!)
// ============================================================================

try {
  const userId = createCompleteTestUser();
  logger.info({ userId }, '💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint to ensure data is written to main DB file
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  // 6. Verify
  const overtimeData = db.prepare(`
    SELECT month, targetHours, actualHours, overtime
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month DESC
    LIMIT 5
  `).all(userId) as Array<{
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
  }>;

  logger.info('\n📊 Last 5 months:');
  overtimeData.forEach(m => {
    const ot = m.overtime >= 0 ? `+${m.overtime}h` : `${m.overtime}h`;
    logger.info(`  ${m.month}: Target ${m.targetHours}h, Actual ${m.actualHours}h, Overtime ${ot}`);
  });

  // Show absence summary
  const absenceSummary = absenceDefinitions.reduce((acc, abs) => {
    acc[abs.type] = (acc[abs.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  logger.info('\n📋 Absence Summary:');
  Object.entries(absenceSummary).forEach(([type, count]) => {
    logger.info(`  ${type}: ${count} periods`);
  });

  // FINAL VERIFICATION: Check if absences are really in DB
  const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests WHERE userId = ?').get(userId) as { count: number };
  logger.info({ userId, absenceCount: absenceCount.count }, '\n🔍 FINAL VERIFICATION: Absences in DB');

  const timeEntryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE userId = ?').get(userId) as { count: number };
  logger.info({ userId, timeEntryCount: timeEntryCount.count }, '🔍 FINAL VERIFICATION: Time entries in DB');

  logger.info(`\n✅✅✅ COMPLETE test user created successfully! ✅✅✅`);
  logger.info(`   User ID: ${userId}`);
  logger.info(`   Username: test.max`);
  logger.info(`   Password: test123`);
  logger.info(`   Work Schedule: Mo-Do (8h, 8h, 6h, 8h) = 30h/week`);
  logger.info(`   Time entries: ${timeEntryCount.count}`);
  logger.info(`   Absences: ${absenceCount.count} periods`);
  logger.info(`\n🎯 Features tested:`);
  logger.info(`   ✅ Individual work schedule (workSchedule)`);
  logger.info(`   ✅ Realistic time entries with gaps`);
  logger.info(`   ✅ Vacation (${absenceSummary.vacation || 0} periods)`);
  logger.info(`   ✅ Sick leave (${absenceSummary.sick || 0} periods)`);
  logger.info(`   ✅ Overtime compensation (${absenceSummary.overtime_comp || 0} periods)`);
  logger.info(`   ✅ Unpaid leave (${absenceSummary.unpaid || 0} periods)`);
  logger.info(`   ✅ Feiertage (automatically considered in overtime calculation)`);

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK executed');
  process.exit(1);
}
