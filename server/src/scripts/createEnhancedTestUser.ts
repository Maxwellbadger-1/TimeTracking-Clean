/**
 * Create ENHANCED Test User with ALL Features
 *
 * Creates: Anna Schmidt (Variable 40h/week: 9h, 8h, 7h, 8h, 8h)
 * With:
 * - VARIABLE work schedule (Mo 9h, Di 8h, Mi 7h, Do 8h, Fr 8h) = 40h/week
 * - Time entries with locations (office, home, client)
 * - Time entries with realistic breaks (breakMinutes)
 * - ALL absence types: vacation, sick, overtime_comp, special, unpaid
 * - Overtime corrections (manual adjustments)
 * - Realistic data from 2023-01-02 to 2026-01-19 (3 years!)
 * - Feiertage berücksichtigt
 *
 * USES TRANSACTION PATTERN for guaranteed COMMIT in WAL mode!
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import logger from '../utils/logger.js';

logger.info('🚀 Creating ENHANCED test user (Anna Schmidt) with ALL features...');

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

// Helper: Random location
const getRandomLocation = (): string => {
  const rand = Math.random();
  if (rand < 0.60) return 'office';
  if (rand < 0.90) return 'homeoffice';
  return 'field';
};

// Helper: Calculate break duration based on work hours
const getBreakMinutes = (hours: number): number => {
  if (hours <= 6) return 0;
  if (hours <= 8) return 30;
  return 60; // >8h requires 1h break
};

// Variable work schedule (40h/week)
const workSchedule = {
  monday: 9,
  tuesday: 8,
  wednesday: 7,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0
};

// Define absence periods (ALL SUPPORTED TYPES!)
// NOTE: 'special' is NOT in DB schema, using existing types only
const absenceDefinitions = [
  // 2023
  { startDate: '2023-01-16', endDate: '2023-01-17', type: 'vacation', reason: 'Umzug (als Urlaub)' },
  { startDate: '2023-04-03', endDate: '2023-04-14', type: 'vacation', reason: 'Osterurlaub' },
  { startDate: '2023-06-12', endDate: '2023-06-14', type: 'sick', reason: 'Grippe' },
  { startDate: '2023-08-07', endDate: '2023-08-18', type: 'vacation', reason: 'Sommerurlaub' },
  { startDate: '2023-12-22', endDate: '2023-12-29', type: 'vacation', reason: 'Weihnachtsurlaub' },

  // 2024
  { startDate: '2024-02-19', endDate: '2024-02-20', type: 'sick', reason: 'Erkältung' },
  { startDate: '2024-04-01', endDate: '2024-04-12', type: 'vacation', reason: 'Frühjahrsurlaub' },
  { startDate: '2024-06-17', endDate: '2024-06-19', type: 'overtime_comp', reason: 'Überstundenabbau' },
  { startDate: '2024-07-15', endDate: '2024-07-17', type: 'vacation', reason: 'Hochzeit (als Urlaub)' },
  { startDate: '2024-08-05', endDate: '2024-08-16', type: 'vacation', reason: 'Sommerurlaub' },
  { startDate: '2024-10-07', endDate: '2024-10-11', type: 'unpaid', reason: 'Unbezahlter Urlaub (Sabbatical)' },
  { startDate: '2024-12-23', endDate: '2024-12-31', type: 'vacation', reason: 'Weihnachtsurlaub' },

  // 2025
  { startDate: '2025-01-20', endDate: '2025-01-23', type: 'sick', reason: 'Magen-Darm-Grippe' },
  { startDate: '2025-04-14', endDate: '2025-04-25', type: 'vacation', reason: 'Osterurlaub' },
  { startDate: '2025-06-16', endDate: '2025-06-17', type: 'overtime_comp', reason: 'Überstundenabbau' },
  { startDate: '2025-08-04', endDate: '2025-08-15', type: 'vacation', reason: 'Sommerurlaub' },
  { startDate: '2025-11-10', endDate: '2025-11-12', type: 'sick', reason: 'Rückenschmerzen' },
  { startDate: '2025-12-22', endDate: '2026-01-03', type: 'vacation', reason: 'Weihnachtsurlaub' },

  // 2026 (bis heute)
  { startDate: '2026-01-06', endDate: '2026-01-10', type: 'vacation', reason: 'Nach Weihnachten' },
] as const;

// Overtime corrections (manual adjustments by admin)
const overtimeCorrections = [
  { date: '2023-06-30', hours: 8, reason: 'Admin-Korrektur Q2/2023 (Nachgetragene Überstunden)', correctionType: 'manual', createdBy: 1 },
  { date: '2024-12-31', hours: -5, reason: 'Überstunden-Abbau korrigiert (Duplikat entfernt)', correctionType: 'system_error', createdBy: 1 },
  { date: '2025-06-30', hours: 3, reason: 'Nachgetragene Überstunden Q2/2025', correctionType: 'manual', createdBy: 1 },
] as const;

// ============================================================================
// TRANSACTION: All INSERTs in one atomic operation
// ============================================================================

const createEnhancedTestUser = db.transaction(() => {
  logger.info('🔄 Starting transaction...');

  // 1. Delete existing test user if exists
  logger.info('🔍 Checking for existing test user...');
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('test.anna') as { id: number } | undefined;
  if (existingUser) {
    logger.info({ existingUserId: existingUser.id }, '🗑️  Deleting existing test.anna user...');
    db.prepare('DELETE FROM users WHERE username = ?').run('test.anna');
    logger.info('✅ Old user deleted');
  }

  // 2. Create user with VARIABLE work schedule
  const hashedPassword = bcrypt.hashSync('test123', 10);
  const workScheduleJson = JSON.stringify(workSchedule);

  const result = db.prepare(`
    INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('test.anna', 'anna@test.com', hashedPassword, 'Anna', 'Schmidt', 'employee', 40, workScheduleJson, 30, '2023-01-02', 'active');

  const userId = result.lastInsertRowid as number;
  logger.info({ userId, workSchedule }, '✅ User created with VARIABLE work schedule');

  // 3. Add realistic time entries (2023-2026)
  logger.info('📅 Adding realistic time entries (2023-2026) with locations & breaks...');
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

  // Add time entries for 2023, 2024, 2025
  for (const year of [2023, 2024, 2025]) {
    for (let month = 1; month <= 12; month++) {
      // Skip months before hire date
      if (year === 2023 && month === 1) {
        // Start from Jan 2 (hire date)
      }

      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];

        // Skip if before hire date
        if (dateStr < '2023-01-02') continue;

        // Skip if not a work day
        if (!isWorkDay(date, workSchedule)) continue;

        // Skip if user is absent
        if (absenceDates.has(dateStr)) continue;

        // Simulate realistic work patterns:
        // - 5% chance of missing a day (krank ohne Krankmeldung, etc.)
        // - 20% chance of working less hours (-1 to -2h)
        // - 15% chance of working more hours (+1 to +3h)
        // - 60% chance of working exact target hours
        const random = Math.random();

        if (random < 0.05) {
          // Skip this day (5% chance)
          continue;
        }

        const targetHours = getTargetHours(date, workSchedule);
        let hours = targetHours;
        let startHour = 8;

        if (random < 0.25) {
          // Work less (20% chance)
          hours = Math.max(targetHours - Math.floor(Math.random() * 2) - 1, targetHours * 0.5);
        } else if (random < 0.40) {
          // Work more (15% chance) - Überstunden!
          hours = targetHours + Math.floor(Math.random() * 3) + 1;
        }

        // Randomize start time a bit (±1 hour)
        if (Math.random() < 0.3) {
          const offset = Math.random() < 0.5 ? -1 : 1;
          startHour += offset;
        }

        const endHour = startHour + hours;
        const startTime = `${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 === 0.5 ? '30' : '00'}`;
        const endTime = `${String(Math.floor(endHour)).padStart(2, '0')}:${endHour % 1 === 0.5 ? '30' : '00'}`;

        // Calculate break
        const breakMinutes = getBreakMinutes(hours);

        // Random location
        const location = getRandomLocation();

        db.prepare(`
          INSERT INTO time_entries (userId, date, startTime, endTime, hours, breakMinutes, location, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(userId, dateStr, startTime, endTime, hours, breakMinutes, location);

        totalEntries++;
      }
    }
  }

  // 2026: Only January (up to today)
  const today = new Date();
  const jan2026Days = new Date(2026, 1, 0).getDate();
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
    if (random < 0.05) continue;

    const targetHours = getTargetHours(date, workSchedule);
    let hours = targetHours;
    let startHour = 8;

    if (random < 0.25) {
      hours = Math.max(targetHours - Math.floor(Math.random() * 2) - 1, targetHours * 0.5);
    } else if (random < 0.40) {
      hours = targetHours + Math.floor(Math.random() * 3) + 1;
    }

    if (Math.random() < 0.3) {
      const offset = Math.random() < 0.5 ? -1 : 1;
      startHour += offset;
    }

    const endHour = startHour + hours;
    const startTime = `${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 === 0.5 ? '30' : '00'}`;
    const endTime = `${String(Math.floor(endHour)).padStart(2, '0')}:${endHour % 1 === 0.5 ? '30' : '00'}`;

    const breakMinutes = getBreakMinutes(hours);
    const location = getRandomLocation();

    db.prepare(`
      INSERT INTO time_entries (userId, date, startTime, endTime, hours, breakMinutes, location, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(userId, dateStr, startTime, endTime, hours, breakMinutes, location);

    totalEntries++;
  }

  logger.info({ totalEntries }, '✅ Time entries created');

  // 4. Add absence requests (ALL TYPES!)
  logger.info('🏖️  Adding absence requests (ALL TYPES)...');

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

  // 5. Add overtime corrections (MANUAL ADJUSTMENTS!)
  logger.info('🔧 Adding overtime corrections...');

  for (const correction of overtimeCorrections) {
    db.prepare(`
      INSERT INTO overtime_corrections (userId, hours, date, reason, correctionType, createdBy, approvedBy, approvedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(userId, correction.hours, correction.date, correction.reason, correction.correctionType, correction.createdBy, correction.createdBy);
  }

  logger.info({ totalCorrections: overtimeCorrections.length }, '✅ Overtime corrections created');

  // 6. Calculate overtime balances
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
  const userId = createEnhancedTestUser();
  logger.info({ userId }, '💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint to ensure data is written to main DB file
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  // 7. Verify
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

  // Show corrections summary
  const correctionTotal = overtimeCorrections.reduce((sum, c) => sum + c.hours, 0);
  logger.info('\n🔧 Overtime Corrections Summary:');
  overtimeCorrections.forEach(c => {
    const sign = c.hours >= 0 ? '+' : '';
    logger.info(`  ${c.date}: ${sign}${c.hours}h (${c.correctionType})`);
  });
  logger.info(`  TOTAL CORRECTIONS: ${correctionTotal >= 0 ? '+' : ''}${correctionTotal}h`);

  // FINAL VERIFICATION: Check if all data is in DB
  const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests WHERE userId = ?').get(userId) as { count: number };
  const timeEntryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE userId = ?').get(userId) as { count: number };
  const correctionCount = db.prepare('SELECT COUNT(*) as count FROM overtime_corrections WHERE userId = ?').get(userId) as { count: number };

  logger.info('\n🔍 FINAL VERIFICATION:');
  logger.info(`  User ID: ${userId}`);
  logger.info(`  Time entries in DB: ${timeEntryCount.count}`);
  logger.info(`  Absences in DB: ${absenceCount.count}`);
  logger.info(`  Corrections in DB: ${correctionCount.count}`);

  logger.info(`\n✅✅✅ ENHANCED test user created successfully! ✅✅✅`);
  logger.info(`\n👤 USER INFO:`);
  logger.info(`   Username: test.anna`);
  logger.info(`   Password: test123`);
  logger.info(`   Name: Anna Schmidt`);
  logger.info(`   Hire Date: 2023-01-02 (3 Jahre!)`);
  logger.info(`\n📅 WORK SCHEDULE (Variable 40h/week):`);
  logger.info(`   ✅ Montag:     9h`);
  logger.info(`   ✅ Dienstag:   8h`);
  logger.info(`   ✅ Mittwoch:   7h`);
  logger.info(`   ✅ Donnerstag: 8h`);
  logger.info(`   ✅ Freitag:    8h`);
  logger.info(`   ❌ Samstag:    0h (KEIN Arbeitstag!)`);
  logger.info(`   ❌ Sonntag:    0h (KEIN Arbeitstag!)`);
  logger.info(`\n🎯 FEATURES TESTED:`);
  logger.info(`   ✅ Variable work schedule (Mo 9h, Di 8h, Mi 7h, Do 8h, Fr 8h)`);
  logger.info(`   ✅ Realistic time entries with gaps & variations`);
  logger.info(`   ✅ Locations: office (60%), homeoffice (30%), field (10%)`);
  logger.info(`   ✅ Break minutes: 0min (≤6h), 30min (≤8h), 60min (>8h)`);
  logger.info(`   ✅ Vacation (${absenceSummary.vacation || 0} periods)`);
  logger.info(`   ✅ Sick leave (${absenceSummary.sick || 0} periods)`);
  logger.info(`   ✅ Overtime compensation (${absenceSummary.overtime_comp || 0} periods)`);
  logger.info(`   ✅ Unpaid leave (${absenceSummary.unpaid || 0} periods)`);
  logger.info(`   ✅ Overtime corrections (${correctionCount.count} manual adjustments) - NEU!`);
  logger.info(`   ✅ 3 Jahre Daten (2023-2026)`);
  logger.info(`   ✅ Feiertage automatisch berücksichtigt`);
  logger.info(`\n📊 DATA VOLUME:`);
  logger.info(`   Time Entries: ${timeEntryCount.count}`);
  logger.info(`   Absences: ${absenceCount.count} (${absenceSummary.vacation || 0}V + ${absenceSummary.sick || 0}S + ${absenceSummary.overtime_comp || 0}O + ${absenceSummary.unpaid || 0}U)`);
  logger.info(`   Corrections: ${correctionCount.count} (Total: ${correctionTotal >= 0 ? '+' : ''}${correctionTotal}h)`);
  logger.info(`\n🚀 NEXT STEPS:`);
  logger.info(`   1. Run validation: npm run validate:overtime:detailed -- --userId=${userId}`);
  logger.info(`   2. Check current month: npm run validate:overtime:detailed -- --userId=${userId} --month=2026-01`);
  logger.info(`   3. Login in app: test.anna / test123`);

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK executed');
  process.exit(1);
}
