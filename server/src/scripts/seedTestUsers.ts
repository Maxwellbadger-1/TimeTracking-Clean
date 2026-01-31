/**
 * Test User Seeding Script
 *
 * Erstellt 10 umfassende Test-User mit realistischen Daten für alle System-Features:
 * - Verschiedene Arbeitszeitmodelle (Vollzeit, Teilzeit, individueller Wochenplan)
 * - Alle Abwesenheitstypen (Urlaub, Krankheit, unbezahlter Urlaub, Überstunden-Ausgleich)
 * - Positive und negative Überstunden
 * - Jahreswechsel-Szenarien (Carryover 2025 → 2026)
 * - Edge Cases (Feiertage, workSchedule-Priorität, Monatsgrenzen)
 *
 * USAGE:
 *   npm run seed:test-users
 *
 * WICHTIG: Script kann mehrfach ausgeführt werden (idempotent)
 *          Bestehende Test-User werden NICHT dupliziert (UPDATE statt INSERT)
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';
import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
import { performYearEndRollover } from '../services/yearEndRolloverService.js';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Create or update a test user
 */
function upsertUser(userData: {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department?: string;
  position?: string;
  weeklyHours: number;
  workSchedule?: Record<string, number> | null;
  vacationDaysPerYear: number;
  hireDate: string;
  endDate?: string | null;
  status: 'active' | 'inactive';
}): number {
  const hashedPassword = bcrypt.hashSync(userData.password, 10);

  // Check if user exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(userData.username) as { id: number } | undefined;

  if (existingUser) {
    // Update existing user
    db.prepare(`
      UPDATE users
      SET email = ?,
          password = ?,
          firstName = ?,
          lastName = ?,
          role = ?,
          department = ?,
          position = ?,
          weeklyHours = ?,
          workSchedule = ?,
          vacationDaysPerYear = ?,
          hireDate = ?,
          endDate = ?,
          status = ?,
          deletedAt = NULL
      WHERE username = ?
    `).run(
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.role,
      userData.department || null,
      userData.position || null,
      userData.weeklyHours,
      userData.workSchedule ? JSON.stringify(userData.workSchedule) : null,
      userData.vacationDaysPerYear,
      userData.hireDate,
      userData.endDate || null,
      userData.status,
      userData.username
    );

    logger.info({ username: userData.username }, '✅ Updated existing test user');
    return existingUser.id;
  } else {
    // Insert new user
    const result = db.prepare(`
      INSERT INTO users (username, email, password, firstName, lastName, role, department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userData.username,
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.role,
      userData.department || null,
      userData.position || null,
      userData.weeklyHours,
      userData.workSchedule ? JSON.stringify(userData.workSchedule) : null,
      userData.vacationDaysPerYear,
      userData.hireDate,
      userData.endDate || null,
      userData.status
    );

    logger.info({ username: userData.username, id: result.lastInsertRowid }, '✅ Created new test user');
    return result.lastInsertRowid as number;
  }
}

/**
 * Delete all time entries for a user (for clean re-seeding)
 */
function clearUserData(userId: number): void {
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_corrections WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM work_time_accounts WHERE userId = ?').run(userId);
  logger.info({ userId }, '🗑️  Cleared existing data for user');
}

/**
 * Add time entry
 */
function addTimeEntry(
  userId: number,
  date: string,
  hours: number,
  location: 'office' | 'homeoffice' | 'field' = 'office',
  activity?: string,
  project?: string,
  notes?: string
): void {
  // Calculate startTime and endTime based on hours
  const startTime = '09:00';
  const startHour = 9;
  const endHour = startHour + Math.floor(hours);
  const endMinutes = Math.round((hours - Math.floor(hours)) * 60);
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

  db.prepare(`
    INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, activity, project, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, date, startTime, endTime, 0, hours, activity || null, project || null, location, notes || null);
}

/**
 * Add absence request (already approved)
 */
function addAbsence(
  userId: number,
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp',
  startDate: string,
  endDate: string,
  days: number,
  reason?: string,
  approvedBy: number = 1 // Default: Admin user
): void {
  db.prepare(`
    INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason, approvedBy, approvedAt)
    VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, datetime('now'))
  `).run(userId, type, startDate, endDate, days, reason || null, approvedBy);
}

/**
 * Add overtime correction
 */
function addOvertimeCorrection(
  userId: number,
  date: string,
  hours: number,
  reason: string,
  correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual' = 'manual',
  createdBy: number = 1 // Default: Admin user
): void {
  db.prepare(`
    INSERT INTO overtime_corrections (userId, hours, date, reason, correctionType, createdBy, approvedBy, approvedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(userId, hours, date, reason, correctionType, createdBy, createdBy);
}

/**
 * Initialize vacation balance for a user
 */
function initVacationBalance(userId: number, year: number, entitlement: number, carryover: number = 0, taken: number = 0): void {
  db.prepare(`
    INSERT OR REPLACE INTO vacation_balance (userId, year, entitlement, carryover, taken)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, year, entitlement, carryover, taken);
}

// ==========================================
// TEST USER PERSONAS
// ==========================================

function seedTestUsers(): void {
  logger.info('🌱 Starting test user seeding...');

  // Ensure admin user exists (for approvals, corrections)
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as { id: number } | undefined;
  if (!adminExists) {
    logger.warn('⚠️  Admin user not found! Creating default admin...');
    upsertUser({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      department: 'Management',
      weeklyHours: 40,
      vacationDaysPerYear: 30,
      hireDate: '2024-01-01',
      status: 'active',
    });
  }

  // ==========================================
  // USER 1: Standard-Vollzeit (Baseline)
  // ==========================================
  logger.info('👤 Creating User 1: Standard-Vollzeit');
  const user1Id = upsertUser({
    username: 'test.vollzeit',
    email: 'vollzeit@test.com',
    password: 'test123',
    firstName: 'Max',
    lastName: 'Vollzeit',
    role: 'employee',
    department: 'IT',
    position: 'Software Developer',
    weeklyHours: 40,
    workSchedule: null, // Uses weeklyHours (40h / 5 = 8h per day)
    vacationDaysPerYear: 30,
    hireDate: '2024-01-01',
    status: 'active',
  });
  clearUserData(user1Id);

  // 2025 Data: Normal work pattern with some absences
  addTimeEntry(user1Id, '2025-07-01', 8, 'office', 'Development', 'Project A');
  addTimeEntry(user1Id, '2025-07-02', 8, 'homeoffice', 'Development', 'Project A');
  addTimeEntry(user1Id, '2025-07-03', 8, 'office', 'Development', 'Project A');
  addTimeEntry(user1Id, '2025-07-04', 8, 'office', 'Development', 'Project A');
  // 2 Tage Urlaub (Mo+Di)
  addAbsence(user1Id, 'vacation', '2025-07-07', '2025-07-08', 2, 'Sommerurlaub');
  addTimeEntry(user1Id, '2025-07-09', 8, 'office', 'Development', 'Project A');
  addTimeEntry(user1Id, '2025-07-10', 8, 'office', 'Development', 'Project A');
  addTimeEntry(user1Id, '2025-07-11', 8, 'office', 'Development', 'Project A');

  // 2025-08: Krankheit + normale Arbeit
  addTimeEntry(user1Id, '2025-08-01', 8, 'office');
  addTimeEntry(user1Id, '2025-08-04', 8, 'office');
  addAbsence(user1Id, 'sick', '2025-08-05', '2025-08-06', 2, 'Grippe');
  addTimeEntry(user1Id, '2025-08-07', 8, 'office');
  addTimeEntry(user1Id, '2025-08-08', 8, 'office');

  // 2025-12: Positive Überstunden (mehr gearbeitet)
  addTimeEntry(user1Id, '2025-12-01', 10, 'office'); // +2h
  addTimeEntry(user1Id, '2025-12-02', 10, 'office'); // +2h
  addTimeEntry(user1Id, '2025-12-03', 9, 'office'); // +1h
  addTimeEntry(user1Id, '2025-12-04', 9, 'office'); // +1h
  addTimeEntry(user1Id, '2025-12-05', 8, 'office');

  // 2026-01: Überstunden-Ausgleich nutzen
  addAbsence(user1Id, 'overtime_comp', '2026-01-02', '2026-01-02', 1, 'Überstunden-Ausgleich');
  addTimeEntry(user1Id, '2026-01-03', 8, 'office');

  // Vacation Balance
  initVacationBalance(user1Id, 2025, 30, 0, 2); // 2 Tage genommen
  initVacationBalance(user1Id, 2026, 30, 28, 0); // Carryover aus 2025

  // ==========================================
  // USER 2: Teilzeit-Christine (Individueller Plan)
  // ==========================================
  logger.info('👤 Creating User 2: Teilzeit-Christine');
  const user2Id = upsertUser({
    username: 'test.christine',
    email: 'christine@test.com',
    password: 'test123',
    firstName: 'Christine',
    lastName: 'Teilzeit',
    role: 'employee',
    department: 'IT',
    position: 'Project Manager',
    weeklyHours: 8, // WIRD IGNORIERT wegen workSchedule!
    workSchedule: { monday: 4, tuesday: 4 }, // Nur Mo+Di Arbeitstage!
    vacationDaysPerYear: 15,
    hireDate: '2025-01-01',
    status: 'active',
  });
  clearUserData(user2Id);

  // 2025-07: Normale Arbeit + Urlaub an Arbeitstag
  addTimeEntry(user2Id, '2025-07-07', 4, 'homeoffice'); // Montag
  addTimeEntry(user2Id, '2025-07-08', 4, 'homeoffice'); // Dienstag
  addTimeEntry(user2Id, '2025-07-14', 4, 'homeoffice'); // Montag
  addAbsence(user2Id, 'vacation', '2025-07-15', '2025-07-15', 1, 'Urlaub'); // Dienstag = 1 Tag
  addTimeEntry(user2Id, '2025-07-21', 4, 'homeoffice'); // Montag
  addTimeEntry(user2Id, '2025-07-22', 4, 'homeoffice'); // Dienstag

  // 2026-01: KRITISCHER TEST - Urlaub über Feiertag (06.01 = Heilige Drei Könige)
  // Urlaub: 01.01 - 25.01 (25 Tage Kalender)
  // ABER: Nur Mo+Di sind Arbeitstage!
  // 06.01.2026 = Dienstag (Feiertag!) → Sollte NICHT als Urlaubstag zählen!
  addAbsence(user2Id, 'vacation', '2026-01-01', '2026-01-25', 6, 'Winterurlaub'); // Nur 6 Arbeitstage (Mo+Di)

  // Vacation Balance
  initVacationBalance(user2Id, 2025, 15, 0, 1); // 1 Tag genommen
  initVacationBalance(user2Id, 2026, 15, 14, 6); // 6 Tage genommen

  // ==========================================
  // USER 3: Positive Überstunden
  // ==========================================
  logger.info('👤 Creating User 3: Positive Überstunden');
  const user3Id = upsertUser({
    username: 'test.overtime-plus',
    email: 'overtime-plus@test.com',
    password: 'test123',
    firstName: 'Peter',
    lastName: 'Fleißig',
    role: 'employee',
    department: 'IT',
    weeklyHours: 40,
    workSchedule: null,
    vacationDaysPerYear: 30,
    hireDate: '2024-01-01',
    status: 'active',
  });
  clearUserData(user3Id);

  // 2025-07 bis 2025-12: Viele Überstunden aufbauen
  // Juli: +20h
  for (let day = 1; day <= 23; day++) {
    const date = new Date(2025, 6, day);
    if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
      addTimeEntry(user3Id, `2025-07-${String(day).padStart(2, '0')}`, 10, 'office'); // 10h statt 8h = +2h/Tag
    }
  }

  // August: +20h
  for (let day = 1; day <= 29; day++) {
    const date = new Date(2025, 7, day);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      addTimeEntry(user3Id, `2025-08-${String(day).padStart(2, '0')}`, 10, 'office');
    }
  }

  // Dezember: +20h
  for (let day = 1; day <= 22; day++) {
    const date = new Date(2025, 11, day);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      addTimeEntry(user3Id, `2025-12-${String(day).padStart(2, '0')}`, 10, 'office');
    }
  }

  // 2026-01: Normale Arbeit
  addTimeEntry(user3Id, '2026-01-02', 8, 'office');
  addTimeEntry(user3Id, '2026-01-03', 8, 'office');

  // Vacation Balance
  initVacationBalance(user3Id, 2025, 30, 0, 0);
  initVacationBalance(user3Id, 2026, 30, 30, 0);

  // ==========================================
  // USER 4: Negative Überstunden
  // ==========================================
  logger.info('👤 Creating User 4: Negative Überstunden');
  const user4Id = upsertUser({
    username: 'test.overtime-minus',
    email: 'overtime-minus@test.com',
    password: 'test123',
    firstName: 'Laura',
    lastName: 'Weniger',
    role: 'employee',
    department: 'HR',
    weeklyHours: 40,
    workSchedule: null,
    vacationDaysPerYear: 30,
    hireDate: '2024-01-01',
    status: 'active',
  });
  clearUserData(user4Id);

  // 2025-07 bis 2025-12: Wenig gearbeitet (negative Überstunden)
  // Juli: Nur 20h gearbeitet (Soll: ~160h)
  addTimeEntry(user4Id, '2025-07-01', 4, 'office');
  addTimeEntry(user4Id, '2025-07-02', 4, 'office');
  addTimeEntry(user4Id, '2025-07-03', 4, 'office');
  addTimeEntry(user4Id, '2025-07-07', 4, 'office');
  addTimeEntry(user4Id, '2025-07-08', 4, 'office');

  // August: Nur 30h gearbeitet
  addTimeEntry(user4Id, '2025-08-01', 6, 'office');
  addTimeEntry(user4Id, '2025-08-04', 6, 'office');
  addTimeEntry(user4Id, '2025-08-05', 6, 'office');
  addTimeEntry(user4Id, '2025-08-06', 6, 'office');
  addTimeEntry(user4Id, '2025-08-07', 6, 'office');

  // Dezember: Nur 40h gearbeitet
  addTimeEntry(user4Id, '2025-12-01', 8, 'office');
  addTimeEntry(user4Id, '2025-12-02', 8, 'office');
  addTimeEntry(user4Id, '2025-12-03', 8, 'office');
  addTimeEntry(user4Id, '2025-12-04', 8, 'office');
  addTimeEntry(user4Id, '2025-12-05', 8, 'office');

  // 2026-01: Normale Arbeit
  addTimeEntry(user4Id, '2026-01-02', 8, 'office');
  addTimeEntry(user4Id, '2026-01-03', 8, 'office');

  // Vacation Balance
  initVacationBalance(user4Id, 2025, 30, 0, 0);
  initVacationBalance(user4Id, 2026, 30, 30, 0);

  // ==========================================
  // USER 5: Unbezahlter Urlaub
  // ==========================================
  logger.info('👤 Creating User 5: Unbezahlter Urlaub');
  const user5Id = upsertUser({
    username: 'test.unpaid',
    email: 'unpaid@test.com',
    password: 'test123',
    firstName: 'Sarah',
    lastName: 'Unbezahlt',
    role: 'employee',
    department: 'Marketing',
    weeklyHours: 40,
    workSchedule: null,
    vacationDaysPerYear: 30,
    hireDate: '2024-01-01',
    status: 'active',
  });
  clearUserData(user5Id);

  // 2025-07: Normale Arbeit
  addTimeEntry(user5Id, '2025-07-01', 8, 'office');
  addTimeEntry(user5Id, '2025-07-02', 8, 'office');
  addTimeEntry(user5Id, '2025-07-03', 8, 'office');
  addTimeEntry(user5Id, '2025-07-04', 8, 'office');

  // 2025-08: UNBEZAHLTER URLAUB (2 Wochen = 10 Arbeitstage)
  // KRITISCH: Reduziert target hours um 80h (10 × 8h)
  // Gibt KEINE Ist-Stunden-Gutschrift!
  addAbsence(user5Id, 'unpaid', '2025-08-11', '2025-08-22', 10, 'Sabbatical');

  // Nach unbezahltem Urlaub: Normale Arbeit
  addTimeEntry(user5Id, '2025-08-25', 8, 'office');
  addTimeEntry(user5Id, '2025-08-26', 8, 'office');
  addTimeEntry(user5Id, '2025-08-27', 8, 'office');
  addTimeEntry(user5Id, '2025-08-28', 8, 'office');
  addTimeEntry(user5Id, '2025-08-29', 8, 'office');

  // Vacation Balance
  initVacationBalance(user5Id, 2025, 30, 0, 0); // Kein Urlaub genommen (nur unpaid)
  initVacationBalance(user5Id, 2026, 30, 30, 0);

  // ==========================================
  // USER 6: 4-Tage-Woche
  // ==========================================
  logger.info('👤 Creating User 6: 4-Tage-Woche');
  const user6Id = upsertUser({
    username: 'test.4day-week',
    email: '4day@test.com',
    password: 'test123',
    firstName: 'Tom',
    lastName: 'Viertage',
    role: 'employee',
    department: 'IT',
    weeklyHours: 40, // WIRD IGNORIERT wegen workSchedule!
    workSchedule: { monday: 10, tuesday: 10, wednesday: 10, thursday: 10 }, // Mo-Do 10h
    vacationDaysPerYear: 30,
    hireDate: '2025-01-01',
    status: 'active',
  });
  clearUserData(user6Id);

  // 2025-07: 4-Tage-Woche Pattern
  addTimeEntry(user6Id, '2025-07-07', 10, 'office'); // Mo
  addTimeEntry(user6Id, '2025-07-08', 10, 'office'); // Di
  addTimeEntry(user6Id, '2025-07-09', 10, 'office'); // Mi
  addTimeEntry(user6Id, '2025-07-10', 10, 'office'); // Do
  // Freitag frei!
  addTimeEntry(user6Id, '2025-07-14', 10, 'office'); // Mo
  addTimeEntry(user6Id, '2025-07-15', 10, 'office'); // Di
  addTimeEntry(user6Id, '2025-07-16', 10, 'office'); // Mi
  addTimeEntry(user6Id, '2025-07-17', 10, 'office'); // Do

  // 2025-12: Urlaub (1 Tag = 10h!)
  addAbsence(user6Id, 'vacation', '2025-12-01', '2025-12-01', 1, 'Urlaub');
  addTimeEntry(user6Id, '2025-12-02', 10, 'office');
  addTimeEntry(user6Id, '2025-12-03', 10, 'office');
  addTimeEntry(user6Id, '2025-12-04', 10, 'office');

  // Vacation Balance
  initVacationBalance(user6Id, 2025, 30, 0, 1);
  initVacationBalance(user6Id, 2026, 30, 29, 0);

  // ==========================================
  // USER 7: Komplexe Historie
  // ==========================================
  logger.info('👤 Creating User 7: Komplexe Historie');
  const user7Id = upsertUser({
    username: 'test.complex',
    email: 'complex@test.com',
    password: 'test123',
    firstName: 'Julia',
    lastName: 'Komplex',
    role: 'employee',
    department: 'Sales',
    weeklyHours: 40,
    workSchedule: null,
    vacationDaysPerYear: 30,
    hireDate: '2024-01-01',
    status: 'active',
  });
  clearUserData(user7Id);

  // 2025-07: Mehrere Abwesenheiten + gearbeitet
  addTimeEntry(user7Id, '2025-07-01', 8, 'office');
  addTimeEntry(user7Id, '2025-07-02', 8, 'office');
  addAbsence(user7Id, 'vacation', '2025-07-03', '2025-07-04', 2, 'Kurzurlaub');
  addTimeEntry(user7Id, '2025-07-07', 8, 'office');
  addAbsence(user7Id, 'sick', '2025-07-08', '2025-07-09', 2, 'Erkältung');
  addTimeEntry(user7Id, '2025-07-10', 8, 'office');
  addTimeEntry(user7Id, '2025-07-11', 8, 'office');

  // 2025-08: Überstunden-Ausgleich + Korrektur
  addAbsence(user7Id, 'overtime_comp', '2025-08-01', '2025-08-01', 1, 'Überstunden abbauen');
  addTimeEntry(user7Id, '2025-08-04', 8, 'office');
  addTimeEntry(user7Id, '2025-08-05', 8, 'office');
  // Admin-Korrektur: +5h für "vergessene Zeiterfassung"
  addOvertimeCorrection(user7Id, '2025-08-06', 5, 'Vergessene Zeiterfassung vom 06.08', 'manual');
  addTimeEntry(user7Id, '2025-08-07', 8, 'office');

  // 2025-12: Urlaub + normale Arbeit
  addAbsence(user7Id, 'vacation', '2025-12-01', '2025-12-01', 1, 'Hochzeit (Sonderurlaub)');
  addTimeEntry(user7Id, '2025-12-02', 8, 'office');
  addTimeEntry(user7Id, '2025-12-03', 8, 'office');

  // Vacation Balance
  initVacationBalance(user7Id, 2025, 30, 0, 2);
  initVacationBalance(user7Id, 2026, 30, 28, 0);

  // ==========================================
  // USER 8: Neu eingestellt 2026
  // ==========================================
  logger.info('👤 Creating User 8: Neu eingestellt 2026');
  const user8Id = upsertUser({
    username: 'test.new2026',
    email: 'new2026@test.com',
    password: 'test123',
    firstName: 'Nina',
    lastName: 'Neuling',
    role: 'employee',
    department: 'IT',
    weeklyHours: 40,
    workSchedule: null,
    vacationDaysPerYear: 30,
    hireDate: '2026-01-15', // WICHTIG: Eingestellt im Januar 2026!
    status: 'active',
  });
  clearUserData(user8Id);

  // Nur 2026 Daten (kein 2025!)
  addTimeEntry(user8Id, '2026-01-15', 8, 'office', 'Onboarding');
  addTimeEntry(user8Id, '2026-01-16', 8, 'office', 'Onboarding');

  // Vacation Balance (prorated für 2026)
  initVacationBalance(user8Id, 2026, 30, 0, 0); // Voller Anspruch

  // ==========================================
  // USER 9: Gekündigter Mitarbeiter
  // ==========================================
  logger.info('👤 Creating User 9: Gekündigter Mitarbeiter');
  const user9Id = upsertUser({
    username: 'test.terminated',
    email: 'terminated@test.com',
    password: 'test123',
    firstName: 'Klaus',
    lastName: 'Ausgeschieden',
    role: 'employee',
    department: 'Sales',
    weeklyHours: 40,
    workSchedule: null,
    vacationDaysPerYear: 30,
    hireDate: '2024-01-01',
    endDate: '2025-12-31', // WICHTIG: Gekündigt Ende 2025!
    status: 'inactive',
  });
  clearUserData(user9Id);

  // 2025-07 bis 2025-12: Normale Arbeit
  addTimeEntry(user9Id, '2025-07-01', 8, 'office');
  addTimeEntry(user9Id, '2025-07-02', 8, 'office');
  addTimeEntry(user9Id, '2025-07-03', 8, 'office');

  addTimeEntry(user9Id, '2025-12-01', 8, 'office');
  addTimeEntry(user9Id, '2025-12-02', 8, 'office');
  // Letzter Arbeitstag: 2025-12-23
  addTimeEntry(user9Id, '2025-12-23', 8, 'office', null, null, 'Letzter Arbeitstag');

  // Vacation Balance
  initVacationBalance(user9Id, 2025, 30, 0, 5);
  // Kein 2026 (nicht mehr aktiv!)

  // ==========================================
  // USER 10: Weekend-Worker
  // ==========================================
  logger.info('👤 Creating User 10: Weekend-Worker');
  const user10Id = upsertUser({
    username: 'test.weekend',
    email: 'weekend@test.com',
    password: 'test123',
    firstName: 'Emma',
    lastName: 'Wochenende',
    role: 'employee',
    department: 'Retail',
    weeklyHours: 16, // WIRD IGNORIERT wegen workSchedule!
    workSchedule: { saturday: 8, sunday: 8 }, // Nur Sa+So Arbeitstage!
    vacationDaysPerYear: 15,
    hireDate: '2025-01-01',
    status: 'active',
  });
  clearUserData(user10Id);

  // 2025-07: Weekend-Pattern
  addTimeEntry(user10Id, '2025-07-05', 8, 'office'); // Samstag
  addTimeEntry(user10Id, '2025-07-06', 8, 'office'); // Sonntag
  addTimeEntry(user10Id, '2025-07-12', 8, 'office'); // Samstag
  addTimeEntry(user10Id, '2025-07-13', 8, 'office'); // Sonntag
  addTimeEntry(user10Id, '2025-07-19', 8, 'office'); // Samstag
  addTimeEntry(user10Id, '2025-07-20', 8, 'office'); // Sonntag

  // 2025-12: Urlaub am Wochenende (1 Tag = Sa oder So)
  addAbsence(user10Id, 'vacation', '2025-12-07', '2025-12-07', 1, 'Urlaub');
  addTimeEntry(user10Id, '2025-12-08', 8, 'office'); // Sonntag
  addTimeEntry(user10Id, '2025-12-14', 8, 'office'); // Samstag
  addTimeEntry(user10Id, '2025-12-15', 8, 'office'); // Sonntag

  // Vacation Balance
  initVacationBalance(user10Id, 2025, 15, 0, 1);
  initVacationBalance(user10Id, 2026, 15, 14, 0);

  logger.info('✅ All test users created/updated successfully!');
}

// ==========================================
// MAIN EXECUTION WITH TRANSACTION PATTERN
// ==========================================

// Wrap ALL database operations in a transaction
const seedTestUsersTransaction = db.transaction(() => {
  logger.info('🔄 Starting transaction for test user seeding...');

  // All the seeding logic runs inside this transaction
  seedTestUsers();

  logger.info('✅ Transaction ready to commit');
});

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Test User Seeding Script...');

    // 1. Seed test users (ATOMIC TRANSACTION)
    seedTestUsersTransaction();
    logger.info('💾 Test users COMMITTED to database!');

    // Force WAL checkpoint
    db.pragma('wal_checkpoint(FULL)');
    logger.info('✅ WAL checkpoint completed');

    // 2. Calculate overtime balances for all users
    logger.info('📊 Calculating overtime balances...');
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Get all active test users
    const testUsers = db.prepare(`
      SELECT id FROM users WHERE username LIKE 'test.%'
    `).all() as Array<{ id: number }>;

    for (const user of testUsers) {
      try {
        ensureOvertimeBalanceEntries(user.id, currentMonth);
        logger.info({ userId: user.id }, '✅ Overtime balance calculated');
      } catch (error) {
        logger.error({ userId: user.id, error }, '❌ Failed to calculate overtime balance');
      }
    }

    // 3. Execute year-end rollover (2025 → 2026)
    logger.info('🎊 Executing year-end rollover (2025 → 2026)...');
    const rolloverResult = performYearEndRollover(2026, 1); // Admin user ID = 1

    if (rolloverResult.success) {
      logger.info(
        {
          vacationUsers: rolloverResult.vacationUsersProcessed,
          overtimeUsers: rolloverResult.overtimeUsersProcessed,
        },
        '✅ Year-end rollover completed successfully!'
      );
    } else {
      logger.error({ errors: rolloverResult.errors }, '❌ Year-end rollover failed!');
    }

    logger.info('🎉 Test user seeding completed successfully!');
    logger.info('💡 You can now validate test users with: npm run validate:overtime:detailed -- --userId=<id>');

    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Test user seeding failed! (ROLLBACK executed)');
    process.exit(1);
  }
}

// Run if called directly
main();
