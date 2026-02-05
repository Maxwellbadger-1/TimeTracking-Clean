/**
 * Create NEW EMPLOYEE Test User - Eingestellt 01.01.2026
 *
 * Creates: Lisa Neuling (Hired 01.01.2026)
 *
 * Features:
 * - Hired: 01.01.2026 (Neujahr = Feiertag, erster Arbeitstag = 02.01!)
 * - Individueller Wochenplan: Mo 9h, Di 7h, Mi 8h, Do 9h, Fr 7h = 40h/week
 * - Nur Januar 2026 gearbeitet (bis heute 19.01)
 * - Krankheit: 13.01-14.01 (2 Tage)
 * - Urlaub: 08.01-10.01 (3 Tage, inkl. Wochenende!)
 * - Realistische Zeiteinträge mit Variationen
 * - Locations: office, homeoffice
 * - Break minutes
 *
 * USES TRANSACTION PATTERN!
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import logger from '../utils/logger.js';
import { formatDate } from '../utils/timezone.js';

logger.info('🚀 Creating NEW EMPLOYEE test user - Lisa Neuling (hired 01.01.2026)');

// Helper Functions
const isWorkDay = (date: Date, workSchedule: any): boolean => {
  const dayOfWeek = date.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return (workSchedule[dayNames[dayOfWeek]] || 0) > 0;
};

const getTargetHours = (date: Date, workSchedule: any): number => {
  const dayOfWeek = date.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return workSchedule[dayNames[dayOfWeek]] || 0;
};

const getRandomLocation = (): string => {
  // Neue Mitarbeiterin: mehr im Büro (70%) als im Homeoffice (30%)
  return Math.random() < 0.70 ? 'office' : 'homeoffice';
};

const getBreakMinutes = (hours: number): number => {
  if (hours <= 6) return 0;
  if (hours <= 9) return 30;
  return 60;
};

// INDIVIDUELLER WORK SCHEDULE (40h/week)
const workSchedule = {
  monday: 9,      // Langer Start in die Woche
  tuesday: 7,     // Kurzer Tag
  wednesday: 8,   // Normal
  thursday: 9,    // Langer Tag
  friday: 7,      // Kurzer Freitag
  saturday: 0,
  sunday: 0
};

// ABSENCES im Januar 2026
const absenceDefinitions = [
  { startDate: '2026-01-08', endDate: '2026-01-10', type: 'vacation', reason: 'Kurzurlaub (erste Woche)' },
  { startDate: '2026-01-13', endDate: '2026-01-14', type: 'sick', reason: 'Erkältung' },
] as const;

// ============================================================================
// TRANSACTION
// ============================================================================

const createNewEmployeeTestUser = db.transaction(() => {
  logger.info('🔄 Starting transaction...');

  // 1. Delete existing user if exists
  logger.info('🔍 Checking for existing test user...');
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('test.neuling') as { id: number } | undefined;
  if (existingUser) {
    logger.info({ existingUserId: existingUser.id }, '🗑️  Deleting existing test.neuling user...');
    db.prepare('DELETE FROM users WHERE username = ?').run('test.neuling');
    logger.info('✅ Old user deleted');
  }

  // 2. Create user
  const hashedPassword = bcrypt.hashSync('test123', 10);
  const workScheduleJson = JSON.stringify(workSchedule);

  const result = db.prepare(`
    INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('test.neuling', 'lisa@test.com', hashedPassword, 'Lisa', 'Neuling', 'employee', 40, workScheduleJson, 30, '2026-01-01', 'active');

  const userId = result.lastInsertRowid as number;
  logger.info({ userId, workSchedule }, '✅ User created (Hired 01.01.2026 = Neujahr!)');

  // 3. Add time entries (nur Januar 2026)
  logger.info('📅 Adding time entries (nur Januar 2026)...');
  let totalEntries = 0;

  // Create absence date set
  const absenceDates = new Set<string>();
  absenceDefinitions.forEach(abs => {
    const start = new Date(abs.startDate);
    const end = new Date(abs.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      absenceDates.add(formatDate(d, 'yyyy-MM-dd'));
    }
  });

  // Januar 2026: 01.01 bis heute (19.01)
  const today = new Date();
  const jan2026Days = new Date(2026, 1, 0).getDate();

  for (let day = 1; day <= jan2026Days; day++) {
    const date = new Date(2026, 0, day);
    if (date > today) break; // Nur bis heute

    const dateStr = formatDate(date, 'yyyy-MM-dd');

    // Skip if before hire date (01.01 ist OK, aber Feiertag!)
    if (dateStr < '2026-01-01') continue;

    // Skip if not a work day
    if (!isWorkDay(date, workSchedule)) continue;

    // Skip if user is absent
    if (absenceDates.has(dateStr)) continue;

    // Realistische Muster für neue Mitarbeiterin:
    // - Sehr motiviert, kaum Fehlzeiten
    // - 5% mal etwas früher gehen (-1 bis -2h)
    // - 10% Überstunden (einarbeiten! +1 bis +2h)
    // - 85% exakte Soll-Stunden
    const random = Math.random();

    const targetHours = getTargetHours(date, workSchedule);
    let hours = targetHours;
    let startHour = 8; // Pünktlicher Start

    if (random < 0.05) {
      // Etwas früher gehen (5%)
      hours = Math.max(targetHours - Math.floor(Math.random() * 2) - 1, targetHours - 2);
    } else if (random < 0.15) {
      // Überstunden (10%) - Einarbeitung!
      hours = targetHours + Math.floor(Math.random() * 2) + 1;
    }

    // Start-Zeit etwas variieren (±30min)
    if (Math.random() < 0.3) {
      startHour = Math.random() < 0.5 ? 7.5 : 8.5;
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

  logger.info({ totalEntries }, '✅ Time entries created (nur Januar!)');

  // 4. Add absence requests
  logger.info('🏖️  Adding absence requests...');

  for (const abs of absenceDefinitions) {
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

  return userId;
});

// ============================================================================
// EXECUTE TRANSACTION
// ============================================================================

try {
  const userId = createNewEmployeeTestUser();
  logger.info({ userId }, '💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  // VERIFICATION
  const overtimeData = db.prepare(`
    SELECT month, targetHours, actualHours, overtime
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month DESC
  `).all(userId) as Array<{
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
  }>;

  logger.info('\n📊 Overtime Data:');
  overtimeData.forEach(m => {
    const ot = m.overtime >= 0 ? `+${m.overtime}h` : `${m.overtime}h`;
    logger.info(`  ${m.month}: Target ${m.targetHours}h, Actual ${m.actualHours}h, Overtime ${ot}`);
  });

  // Absence summary
  const absenceSummary = absenceDefinitions.reduce((acc, abs) => {
    acc[abs.type] = (acc[abs.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  logger.info('\n📋 Absence Summary:');
  Object.entries(absenceSummary).forEach(([type, count]) => {
    logger.info(`  ${type}: ${count} periods`);
  });

  // FINAL VERIFICATION
  const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests WHERE userId = ?').get(userId) as { count: number };
  const timeEntryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE userId = ?').get(userId) as { count: number };

  logger.info('\n🔍 FINAL VERIFICATION:');
  logger.info(`  User ID: ${userId}`);
  logger.info(`  Time entries: ${timeEntryCount.count}`);
  logger.info(`  Absences: ${absenceCount.count}`);

  logger.info(`\n✅✅✅ NEW EMPLOYEE TEST USER CREATED! ✅✅✅`);
  logger.info(`\n👤 USER INFO:`);
  logger.info(`   Username: test.neuling`);
  logger.info(`   Password: test123`);
  logger.info(`   Name: Lisa Neuling`);
  logger.info(`   Hire Date: 2026-01-01 (Neujahr = Feiertag, erster Arbeitstag = 02.01!)`);
  logger.info(`\n📅 WORK SCHEDULE (Individuell 40h/week):`);
  logger.info(`   ✅ Montag:     9h`);
  logger.info(`   ✅ Dienstag:   7h`);
  logger.info(`   ✅ Mittwoch:   8h`);
  logger.info(`   ✅ Donnerstag: 9h`);
  logger.info(`   ✅ Freitag:    7h`);
  logger.info(`   ❌ Samstag:    0h`);
  logger.info(`   ❌ Sonntag:    0h`);
  logger.info(`\n🎯 FEATURES:`);
  logger.info(`   ✅ Nur Januar 2026 (hired 01.01.2026)`);
  logger.info(`   ✅ Individueller Wochenplan (9h, 7h, 8h, 9h, 7h)`);
  logger.info(`   ✅ ${timeEntryCount.count} time entries`);
  logger.info(`   ✅ Vacation: ${absenceSummary.vacation || 0} periods`);
  logger.info(`   ✅ Sick: ${absenceSummary.sick || 0} periods`);
  logger.info(`   ✅ Locations: office (70%), homeoffice (30%)`);
  logger.info(`   ✅ Realistische neue Mitarbeiterin (motiviert!)`);
  logger.info(`\n🚀 NEXT STEPS:`);
  logger.info(`   1. npm run validate:overtime:detailed -- --userId=${userId} --month=2026-01`);
  logger.info(`   2. Login: test.neuling / test123`);

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK');
  process.exit(1);
}
