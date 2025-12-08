/**
 * Seed Test Data Script - EDGE CASES (Dezember 2025)
 *
 * WICHTIG: Soll-Stunden werden IMMER bis HEUTE berechnet!
 * Heute ist Mo 08.12.2025
 *
 * Dezember 2025 Wochentage:
 * Mo 01.12, Di 02.12, Mi 03.12, Do 04.12, Fr 05.12, Sa 06.12, So 07.12, Mo 08.12 (HEUTE)
 *
 * Usage:
 *   npm run seed-test-data
 */

import { db } from '../database/connection.js';
import bcrypt from 'bcrypt';

console.log('🌱 Seeding Test Data (EDGE CASES - Dezember 2025)...\n');
console.log('⚠️  WICHTIG: Heute ist Montag 08.12.2025');
console.log('   Soll-Stunden werden bis HEUTE berechnet!\n');

// Helper: Create user
async function createUser(data: {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  weeklyHours: number;
  vacationDaysPerYear: number;
  hireDate: string;
}) {
  const hashedPassword = await bcrypt.hash('test123', 10);

  const result = db.prepare(`
    INSERT INTO users (
      username, password, email, firstName, lastName, role,
      weeklyHours, vacationDaysPerYear, hireDate, privacyConsentAt
    ) VALUES (?, ?, ?, ?, ?, 'employee', ?, ?, ?, datetime('now'))
  `).run(
    data.username,
    hashedPassword,
    data.email,
    data.firstName,
    data.lastName,
    data.weeklyHours,
    data.vacationDaysPerYear,
    data.hireDate
  );

  return result.lastInsertRowid as number;
}

// Helper: Create time entry
function createTimeEntry(userId: number, date: string, startTime: string, endTime: string, breakMinutes: number) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const totalMinutes = endMinutes - startMinutes - breakMinutes;
  const hours = totalMinutes / 60.0;

  db.prepare(`
    INSERT INTO time_entries (
      userId, date, startTime, endTime, breakMinutes, hours, location, activity, project
    ) VALUES (?, ?, ?, ?, ?, ?, 'office', 'Development', 'TimeTracking')
  `).run(userId, date, startTime, endTime, breakMinutes, hours);
}

// Helper: Create absence
function createAbsence(userId: number, type: string, from: string, to: string, days: number) {
  db.prepare(`
    INSERT INTO absence_requests (
      userId, type, startDate, endDate, days, reason, status, approvedAt
    ) VALUES (?, ?, ?, ?, ?, 'Test data', 'approved', datetime('now'))
  `).run(userId, type, from, to, days);
}

// Helper: Initialize vacation balance
function initVacationBalance(userId: number, year: number, entitlement: number) {
  db.prepare(`
    INSERT INTO vacation_balance (userId, year, entitlement, carryover, taken)
    VALUES (?, ?, ?, 0, 0)
    ON CONFLICT(userId, year) DO UPDATE SET
      entitlement = excluded.entitlement
  `).run(userId, year, entitlement);
}

// Main seed function
async function seed() {
  // Clean existing test users
  console.log('🗑️  Cleaning existing test data...');
  db.prepare("DELETE FROM users WHERE username LIKE '%_test'").run();

  // =================================================================
  // EDGE CASE 1: David Late - START AM 03. DEZEMBER (Mittwoch)
  // =================================================================
  console.log('\n👤 EDGE CASE 1: David Late (Mid-Week Hire)');
  console.log('   Eingestellt: 03.12.2025 (Mittwoch)');

  const davidId = await createUser({
    username: 'david_test',
    email: 'david.test@company.com',
    firstName: 'David',
    lastName: 'Late',
    weeklyHours: 40,
    vacationDaysPerYear: 30,
    hireDate: '2025-12-03', // ⚠️ Start am Mittwoch!
  });

  initVacationBalance(davidId, 2025, 30);

  // David arbeitet vom 03.12 bis 08.12 (ALLE Tage inkl. heute)
  const davidWorkDays = [
    '2025-12-03', // Mi
    '2025-12-04', // Do
    '2025-12-05', // Fr
    '2025-12-08', // Mo (HEUTE)
  ];

  davidWorkDays.forEach(date => {
    createTimeEntry(davidId, date, '09:00', '17:30', 30); // 8h
  });

  console.log('   ✅ David: 4 Arbeitstage (Mi, Do, Fr, Mo)');
  console.log('   📊 ERWARTETE WERTE IM FRONTEND:');
  console.log('      Soll: 32.0h (4 Arbeitstage bis heute × 8h)');
  console.log('      Ist: 32.0h (4 Tage gearbeitet)');
  console.log('      Überstunden: 0.0h');
  console.log('      Urlaub: 30 Tage');

  // =================================================================
  // EDGE CASE 2: Emma Unpaid - UNBEZAHLTER URLAUB
  // =================================================================
  console.log('\n👤 EDGE CASE 2: Emma Unpaid (Unpaid Leave)');
  console.log('   Unbezahlter Urlaub: 1 Tag (Fr 05.12)');

  const emmaId = await createUser({
    username: 'emma_test',
    email: 'emma.test@company.com',
    firstName: 'Emma',
    lastName: 'Unpaid',
    weeklyHours: 40,
    vacationDaysPerYear: 30,
    hireDate: '2025-12-01', // Montag, 01.12
  });

  initVacationBalance(emmaId, 2025, 30);

  // Emma arbeitet Mo, Di, Mi, Do, Mo (5 Tage)
  const emmaWorkDays = [
    '2025-12-01', // Mo
    '2025-12-02', // Di
    '2025-12-03', // Mi
    '2025-12-04', // Do
    '2025-12-08', // Mo (HEUTE)
  ];

  emmaWorkDays.forEach(date => {
    createTimeEntry(emmaId, date, '09:00', '17:30', 30); // 8h
  });

  // Emma: 1 Tag unbezahlter Urlaub (Fr 05.12)
  // ⚠️ Unbezahlter Urlaub reduziert das Soll UND gibt KEINE Gutschrift!
  createAbsence(emmaId, 'unpaid', '2025-12-05', '2025-12-05', 1);

  console.log('   ✅ Emma: 5 Arbeitstage + 1 Tag unbezahlter Urlaub (Fr)');
  console.log('   📊 ERWARTETE WERTE IM FRONTEND:');
  console.log('      Soll: 40.0h (6 Tage - 1 unbezahlt = 5 Tage × 8h)');
  console.log('      Ist: 40.0h (5 Tage gearbeitet, KEINE Gutschrift!)');
  console.log('      Überstunden: 0.0h');
  console.log('      Urlaub: 30 Tage (unbezahlt zählt NICHT als Urlaub)');

  // =================================================================
  // EDGE CASE 3: Frank Overtime - ÜBERSTUNDEN + ÜBERSTUNDEN-ABBAU
  // =================================================================
  console.log('\n👤 EDGE CASE 3: Frank Overtime (Overtime Compensation)');
  console.log('   Überstunden Mo-Mi, Überstunden-Ausgleich Do-Fr, heute gearbeitet');

  const frankId = await createUser({
    username: 'frank_test',
    email: 'frank.test@company.com',
    firstName: 'Frank',
    lastName: 'Overtime',
    weeklyHours: 40,
    vacationDaysPerYear: 30,
    hireDate: '2025-12-01', // Montag, 01.12
  });

  initVacationBalance(frankId, 2025, 30);

  // Frank arbeitet Mo-Mi mit Überstunden (3×10h = 30h)
  const frankOvertimeDays = [
    '2025-12-01', // Mo: 10h
    '2025-12-02', // Di: 10h
    '2025-12-03', // Mi: 10h
  ];
  frankOvertimeDays.forEach(date => {
    createTimeEntry(frankId, date, '08:00', '18:30', 30); // 10h
  });

  // Frank arbeitet heute normal (Mo 08.12: 8h)
  createTimeEntry(frankId, '2025-12-08', '09:00', '17:30', 30); // 8h

  // Frank nimmt Überstunden-Ausgleich Do-Fr (2 Tage)
  // ⚠️ Überstunden-Ausgleich = Volle Gutschrift (wie Urlaub/Krank)
  createAbsence(frankId, 'overtime_comp', '2025-12-04', '2025-12-05', 2);

  console.log('   ✅ Frank: 3×10h (Mo-Mi) + 2 Tage Überstunden-Ausgleich (Do-Fr) + 1×8h (heute)');
  console.log('   📊 ERWARTETE WERTE IM FRONTEND:');
  console.log('      Soll: 48.0h (6 Arbeitstage × 8h)');
  console.log('      Ist: 54.0h (30h + 16h Gutschrift + 8h heute)');
  console.log('      Überstunden: +6.0h');
  console.log('      Urlaub: 30 Tage (Überstunden-Ausgleich zählt NICHT als Urlaub)');

  console.log('\n✅ Test Data seeded successfully!');
  console.log('\n📅 Zeitraum: Mo 01.12 - Mo 08.12.2025 (heute)');
  console.log('⚠️  KRITISCH: Soll-Stunden werden bis HEUTE (08.12) berechnet!');
  console.log('   Alle Test-User haben HEUTE (Mo 08.12) bereits Einträge.');
  console.log('🔍 Verifikation: npm run verify-test-data');
}

// Run seed
seed()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error seeding test data:', error);
    process.exit(1);
  });
