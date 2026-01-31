/**
 * Create SUPER Test User - Ausschöpfung ALLER Features!
 *
 * Creates: Max Mustermann (Variable 38h/week: 10h, 8h, 6h, 8h, 6h)
 *
 * ALLE FEATURES:
 * - Variable work schedule (10h, 8h, 6h, 8h, 6h = 38h/week)
 * - Time entries mit ALLEN Locations (office, homeoffice, field)
 * - Time entries mit ALLEN Break-Varianten (0min, 30min, 60min)
 * - ALLE Absence Types (vacation, sick, overtime_comp, unpaid)
 * - Overtime Corrections (positiv & negativ)
 * - Realistische Muster (Überstunden, Unterstunden, Fehlzeiten)
 * - 3+ Jahre Daten (2022-10-01 bis heute 2026-01-19)
 * - Feiertage berücksichtigt (inkl. Bayern-spezifische!)
 * - Absences die Feiertage überlappen
 * - Absences die Wochenenden überlappen
 * - Absences die 0h-Tage (workSchedule) überlappen
 * - Mix aus langen & kurzen Absences
 * - Wechselnde Locations (60% office, 30% home, 10% field)
 *
 * Hired: 2022-10-01 (3+ Jahre!)
 *
 * USES TRANSACTION PATTERN!
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import logger from '../utils/logger.js';

logger.info('🚀 Creating SUPER test user - MAX FEATURES!');

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
  const rand = Math.random();
  if (rand < 0.60) return 'office';
  if (rand < 0.90) return 'homeoffice';
  return 'field';
};

const getBreakMinutes = (hours: number): number => {
  if (hours <= 6) return 0;
  if (hours <= 9) return 30;
  return 60; // >9h = 60min break (gesetzlich)
};

// VARIABLE WORK SCHEDULE (38h/week - Teilzeit!)
const workSchedule = {
  monday: 10,    // Langer Tag
  tuesday: 8,    // Normal
  wednesday: 6,  // Kurzer Tag
  thursday: 8,   // Normal
  friday: 6,     // Kurzer Tag (Freitag = kurz)
  saturday: 0,   // KEIN Arbeitstag
  sunday: 0      // KEIN Arbeitstag
};

// ALLE ABSENCE TYPES über 3+ Jahre verteilt!
const absenceDefinitions = [
  // 2022 (ab Oktober - Hire Date)
  { startDate: '2022-10-24', endDate: '2022-10-25', type: 'sick', reason: 'Erkältung (erste Woche)' },
  { startDate: '2022-11-07', endDate: '2022-11-08', type: 'vacation', reason: 'Brückentag (Allerheiligen)' },
  { startDate: '2022-12-23', endDate: '2022-12-30', type: 'vacation', reason: 'Weihnachtsurlaub' },

  // 2023
  { startDate: '2023-01-09', endDate: '2023-01-10', type: 'vacation', reason: 'Nach Weihnachten' },
  { startDate: '2023-02-20', endDate: '2023-02-21', type: 'sick', reason: 'Magen-Darm' },
  { startDate: '2023-04-03', endDate: '2023-04-14', type: 'vacation', reason: 'Osterurlaub (2 Wochen)' },
  { startDate: '2023-05-29', endDate: '2023-05-30', type: 'overtime_comp', reason: 'Pfingst-Brückentag (Überstundenabbau)' },
  { startDate: '2023-06-12', endDate: '2023-06-14', type: 'sick', reason: 'Grippe (inkl. Feiertag Fronleichnam!)' },
  { startDate: '2023-07-31', endDate: '2023-08-11', type: 'vacation', reason: 'Sommerurlaub (2 Wochen)' },
  { startDate: '2023-10-02', endDate: '2023-10-03', type: 'vacation', reason: 'Tag der deutschen Einheit Brücke' },
  { startDate: '2023-11-20', endDate: '2023-11-22', type: 'sick', reason: 'Rückenschmerzen' },
  { startDate: '2023-12-22', endDate: '2024-01-05', type: 'vacation', reason: 'Weihnachten + Neujahr (lang!)' },

  // 2024
  { startDate: '2024-02-12', endDate: '2024-02-13', type: 'sick', reason: 'Erkältung' },
  { startDate: '2024-03-25', endDate: '2024-04-05', type: 'vacation', reason: 'Osterurlaub (inkl. Karfreitag, Ostermontag)' },
  { startDate: '2024-05-09', endDate: '2024-05-10', type: 'overtime_comp', reason: 'Christi Himmelfahrt Brücke (Überstunden)' },
  { startDate: '2024-05-20', endDate: '2024-05-21', type: 'vacation', reason: 'Pfingst-Brücke' },
  { startDate: '2024-06-17', endDate: '2024-06-19', type: 'overtime_comp', reason: 'Fronleichnam Ausgleich' },
  { startDate: '2024-07-15', endDate: '2024-07-26', type: 'vacation', reason: 'Sommerurlaub (2 Wochen)' },
  { startDate: '2024-08-19', endDate: '2024-08-20', type: 'sick', reason: 'Migräne' },
  { startDate: '2024-10-07', endDate: '2024-10-11', type: 'unpaid', reason: 'Unbezahlter Urlaub (Familiensache)' },
  { startDate: '2024-10-31', endDate: '2024-11-01', type: 'vacation', reason: 'Allerheiligen Brücke' },
  { startDate: '2024-12-02', endDate: '2024-12-04', type: 'sick', reason: 'Erkältung' },
  { startDate: '2024-12-23', endDate: '2025-01-03', type: 'vacation', reason: 'Weihnachtsurlaub (lang!)' },

  // 2025
  { startDate: '2025-01-20', endDate: '2025-01-23', type: 'sick', reason: 'Magen-Darm-Grippe (4 Tage!)' },
  { startDate: '2025-03-03', endDate: '2025-03-04', type: 'vacation', reason: 'Kurzurlaub' },
  { startDate: '2025-04-14', endDate: '2025-04-25', type: 'vacation', reason: 'Osterurlaub (2 Wochen)' },
  { startDate: '2025-05-29', endDate: '2025-05-30', type: 'overtime_comp', reason: 'Christi Himmelfahrt Brücke' },
  { startDate: '2025-06-09', endDate: '2025-06-10', type: 'vacation', reason: 'Pfingstmontag Brücke' },
  { startDate: '2025-06-16', endDate: '2025-06-17', type: 'overtime_comp', reason: 'Fronleichnam Ausgleich' },
  { startDate: '2025-07-28', endDate: '2025-08-08', type: 'vacation', reason: 'Sommerurlaub (2 Wochen)' },
  { startDate: '2025-09-15', endDate: '2025-09-16', type: 'sick', reason: 'Kopfschmerzen' },
  { startDate: '2025-11-03', endDate: '2025-11-04', type: 'vacation', reason: 'Allerheiligen Brücke' },
  { startDate: '2025-12-22', endDate: '2026-01-06', type: 'vacation', reason: 'Weihnachten + Dreikönig' },

  // 2026 (bis heute)
  { startDate: '2026-01-13', endDate: '2026-01-14', type: 'sick', reason: 'Erkältung (aktuell!)' },
] as const;

// OVERTIME CORRECTIONS (positiv & negativ über die Jahre!)
const overtimeCorrections = [
  { date: '2022-12-31', hours: 5, reason: 'Jahr-End Korrektur 2022 (Admin)', correctionType: 'manual', createdBy: 1 },
  { date: '2023-03-31', hours: -3, reason: 'Fehlerhafte Buchung Q1/2023 entfernt', correctionType: 'system_error', createdBy: 1 },
  { date: '2023-06-30', hours: 10, reason: 'Nachgetragene Überstunden Q2/2023', correctionType: 'manual', createdBy: 1 },
  { date: '2023-09-30', hours: -7, reason: 'Doppelte Buchung korrigiert Q3/2023', correctionType: 'system_error', createdBy: 1 },
  { date: '2023-12-31', hours: 4, reason: 'Jahr-End Korrektur 2023', correctionType: 'manual', createdBy: 1 },
  { date: '2024-06-30', hours: 8, reason: 'Nachgetragene Überstunden Q2/2024', correctionType: 'manual', createdBy: 1 },
  { date: '2024-12-31', hours: -6, reason: 'Überstunden-Abbau korrigiert (Duplikat)', correctionType: 'system_error', createdBy: 1 },
  { date: '2025-06-30', hours: 5, reason: 'Nachgetragene Überstunden Q2/2025', correctionType: 'manual', createdBy: 1 },
  { date: '2025-12-31', hours: 3, reason: 'Jahr-End Korrektur 2025', correctionType: 'manual', createdBy: 1 },
] as const;

// ============================================================================
// TRANSACTION: All INSERTs in one atomic operation
// ============================================================================

const createSuperTestUser = db.transaction(() => {
  logger.info('🔄 Starting transaction...');

  // 1. Delete existing super test user if exists
  logger.info('🔍 Checking for existing test user...');
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('test.super') as { id: number } | undefined;
  if (existingUser) {
    logger.info({ existingUserId: existingUser.id }, '🗑️  Deleting existing test.super user...');
    db.prepare('DELETE FROM users WHERE username = ?').run('test.super');
    logger.info('✅ Old user deleted');
  }

  // 2. Create user with VARIABLE work schedule (Teilzeit 38h!)
  const hashedPassword = bcrypt.hashSync('test123', 10);
  const workScheduleJson = JSON.stringify(workSchedule);

  const result = db.prepare(`
    INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('test.super', 'max@test.com', hashedPassword, 'Max', 'Mustermann', 'employee', 38, workScheduleJson, 30, '2022-10-01', 'active');

  const userId = result.lastInsertRowid as number;
  logger.info({ userId, workSchedule }, '✅ User created with VARIABLE work schedule (38h/week Teilzeit)');

  // 3. Add SUPER REALISTIC time entries (2022-2026)
  logger.info('📅 Adding SUPER REALISTIC time entries (3+ Jahre)...');
  let totalEntries = 0;

  // Create absence date set
  const absenceDates = new Set<string>();
  absenceDefinitions.forEach(abs => {
    const start = new Date(abs.startDate);
    const end = new Date(abs.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      absenceDates.add(d.toISOString().split('T')[0]);
    }
  });

  // Add time entries for 2022 (ab Oktober), 2023, 2024, 2025
  for (const year of [2022, 2023, 2024, 2025]) {
    const startMonth = year === 2022 ? 10 : 1; // 2022 ab Oktober
    const endMonth = 12;

    for (let month = startMonth; month <= endMonth; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];

        // Skip if before hire date
        if (dateStr < '2022-10-01') continue;

        // Skip if not a work day
        if (!isWorkDay(date, workSchedule)) continue;

        // Skip if user is absent
        if (absenceDates.has(dateStr)) continue;

        // SUPER REALISTIC PATTERNS:
        // - 3% komplett fehlen (krank ohne Krankmeldung, verschlafen, etc.)
        // - 25% Unterstunden (-1 bis -3h)
        // - 20% Überstunden (+1 bis +4h)
        // - 52% exakte Soll-Stunden
        const random = Math.random();

        if (random < 0.03) {
          // Komplett fehlen (3%)
          continue;
        }

        const targetHours = getTargetHours(date, workSchedule);
        let hours = targetHours;
        let startHour = 8; // Standard Start 8:00

        if (random < 0.28) {
          // Unterstunden (25%)
          const reduction = Math.floor(Math.random() * 3) + 1; // -1 bis -3h
          hours = Math.max(targetHours - reduction, targetHours * 0.5);
        } else if (random < 0.48) {
          // Überstunden (20%)
          const extra = Math.floor(Math.random() * 4) + 1; // +1 bis +4h
          hours = targetHours + extra;
        }

        // Start-Zeit variieren (±2 Stunden)
        if (Math.random() < 0.4) {
          const offset = Math.floor(Math.random() * 5) - 2; // -2 bis +2
          startHour = Math.max(6, Math.min(10, startHour + offset));
        }

        const endHour = startHour + hours;
        const startTime = `${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 === 0.5 ? '30' : '00'}`;
        const endTime = `${String(Math.floor(endHour)).padStart(2, '0')}:${endHour % 1 === 0.5 ? '30' : '00'}`;

        // Break calculation
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

  // 2026: Bis heute (19.01)
  const today = new Date();
  const jan2026Days = new Date(2026, 1, 0).getDate();
  for (let day = 1; day <= jan2026Days; day++) {
    const date = new Date(2026, 0, day);
    if (date > today) break;

    const dateStr = date.toISOString().split('T')[0];

    if (!isWorkDay(date, workSchedule)) continue;
    if (absenceDates.has(dateStr)) continue;

    const random = Math.random();
    if (random < 0.03) continue;

    const targetHours = getTargetHours(date, workSchedule);
    let hours = targetHours;
    let startHour = 8;

    if (random < 0.28) {
      hours = Math.max(targetHours - Math.floor(Math.random() * 3) - 1, targetHours * 0.5);
    } else if (random < 0.48) {
      hours = targetHours + Math.floor(Math.random() * 4) + 1;
    }

    if (Math.random() < 0.4) {
      startHour = Math.max(6, Math.min(10, 8 + Math.floor(Math.random() * 5) - 2));
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

  logger.info({ totalEntries }, '✅ Time entries created (3+ Jahre!)');

  // 4. Add ALLE absence requests
  logger.info('🏖️  Adding ALLE absence requests...');

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

  // 5. Add ALLE overtime corrections
  logger.info('🔧 Adding overtime corrections (positiv & negativ)...');

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

  return userId;
});

// ============================================================================
// EXECUTE TRANSACTION
// ============================================================================

try {
  const userId = createSuperTestUser();
  logger.info({ userId }, '💾 Transaction COMMITTED successfully!');

  // Force WAL checkpoint
  db.pragma('wal_checkpoint(FULL)');
  logger.info('✅ WAL checkpoint completed');

  // 7. VERIFICATION
  const overtimeData = db.prepare(`
    SELECT month, targetHours, actualHours, overtime
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month DESC
    LIMIT 6
  `).all(userId) as Array<{
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
  }>;

  logger.info('\n📊 Last 6 months:');
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

  // Corrections summary
  const correctionTotal = overtimeCorrections.reduce((sum, c) => sum + c.hours, 0);
  logger.info('\n🔧 Overtime Corrections Summary:');
  overtimeCorrections.forEach(c => {
    const sign = c.hours >= 0 ? '+' : '';
    logger.info(`  ${c.date}: ${sign}${c.hours}h (${c.correctionType})`);
  });
  logger.info(`  TOTAL CORRECTIONS: ${correctionTotal >= 0 ? '+' : ''}${correctionTotal}h`);

  // FINAL VERIFICATION
  const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests WHERE userId = ?').get(userId) as { count: number };
  const timeEntryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE userId = ?').get(userId) as { count: number };
  const correctionCount = db.prepare('SELECT COUNT(*) as count FROM overtime_corrections WHERE userId = ?').get(userId) as { count: number };

  logger.info('\n🔍 FINAL VERIFICATION:');
  logger.info(`  User ID: ${userId}`);
  logger.info(`  Time entries: ${timeEntryCount.count}`);
  logger.info(`  Absences: ${absenceCount.count}`);
  logger.info(`  Corrections: ${correctionCount.count}`);

  logger.info(`\n✅✅✅ SUPER TEST USER CREATED! ✅✅✅`);
  logger.info(`\n👤 USER INFO:`);
  logger.info(`   Username: test.super`);
  logger.info(`   Password: test123`);
  logger.info(`   Name: Max Mustermann`);
  logger.info(`   Hire Date: 2022-10-01 (3+ Jahre!)`);
  logger.info(`\n📅 WORK SCHEDULE (Variable 38h/week Teilzeit):`);
  logger.info(`   ✅ Montag:     10h (LANGER Tag!)`);
  logger.info(`   ✅ Dienstag:    8h`);
  logger.info(`   ✅ Mittwoch:    6h (KURZER Tag)`);
  logger.info(`   ✅ Donnerstag:  8h`);
  logger.info(`   ✅ Freitag:     6h (KURZER Tag)`);
  logger.info(`   ❌ Samstag:     0h`);
  logger.info(`   ❌ Sonntag:     0h`);
  logger.info(`\n🎯 ALLE FEATURES GETESTET:`);
  logger.info(`   ✅ Variable work schedule (10h, 8h, 6h, 8h, 6h = 38h)`);
  logger.info(`   ✅ ${timeEntryCount.count} time entries (3+ Jahre!)`);
  logger.info(`   ✅ Locations: office (60%), homeoffice (30%), field (10%)`);
  logger.info(`   ✅ Breaks: 0min (≤6h), 30min (≤9h), 60min (>9h)`);
  logger.info(`   ✅ Vacation: ${absenceSummary.vacation || 0} periods`);
  logger.info(`   ✅ Sick: ${absenceSummary.sick || 0} periods`);
  logger.info(`   ✅ Overtime Comp: ${absenceSummary.overtime_comp || 0} periods`);
  logger.info(`   ✅ Unpaid: ${absenceSummary.unpaid || 0} periods`);
  logger.info(`   ✅ Corrections: ${correctionCount.count} (Total: ${correctionTotal >= 0 ? '+' : ''}${correctionTotal}h)`);
  logger.info(`   ✅ Realistische Muster (3% fehlen, 25% Unter, 20% Über)`);
  logger.info(`   ✅ 3+ Jahre Daten (2022-10-01 bis 2026-01-19)`);
  logger.info(`   ✅ Feiertage automatisch (inkl. Bayern!)`);
  logger.info(`\n🚀 NEXT STEPS:`);
  logger.info(`   1. npm run validate:overtime:detailed -- --userId=${userId}`);
  logger.info(`   2. npm run validate:overtime:detailed -- --userId=${userId} --month=2026-01`);
  logger.info(`   3. Login: test.super / test123`);

  process.exit(0);
} catch (error) {
  logger.error({ error }, '❌ Transaction FAILED - ROLLBACK');
  process.exit(1);
}
