/**
 * Overtime Calculation Validation Script
 *
 * On-demand validation for overtime calculations with detailed breakdown.
 *
 * Usage:
 * ```bash
 * npm run validate:overtime -- --userId=5
 * npm run validate:overtime -- --all
 * npm run validate:overtime -- --userId=5 --expected="+37:30"
 * npm run validate:overtime -- --scenario=hans-individual-schedule
 * ```
 *
 * Features:
 * - Validates single user or all users
 * - Shows detailed breakdown (target, actual, overtime)
 * - Compares with expected values
 * - Highlights absences, holidays, unpaid leave
 * - Test scenario validation
 */

import Database from 'better-sqlite3';
import path from 'path';
import { formatDate } from '../utils/timezone.js';
import {
  calculateTargetHoursForPeriod,
  calculateAbsenceHoursWithWorkSchedule,
} from '../utils/workingDays';
import type { UserPublic } from '../types/index.js';
import { createTestScenario, getAllScenarioNames } from '../test/generateTestData';

// ============================================================================
// Types
// ============================================================================

interface ValidationResult {
  userId: number;
  userName: string;
  hireDate: string;
  referenceDate: string;
  weeklyHours: number;
  hasWorkSchedule: boolean;
  targetHours: number;
  workedHours: number;
  absenceCredits: number;
  actualHours: number;
  overtime: number;
  absences: Array<{
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    credit: number;
  }>;
  holidays: Array<{
    date: string;
    name: string;
  }>;
  unpaidDays: number;
  success: boolean;
  errors: string[];
}

// ============================================================================
// Database Connection
// ============================================================================

function getDatabase(): Database.Database {
  const dbPath = path.join(__dirname, '../../database.db');
  return new Database(dbPath);
}

// ============================================================================
// Validation Logic
// ============================================================================

function validateUser(
  db: Database.Database,
  userId: number,
  expectedOvertime?: string
): ValidationResult {
  // Get user
  const user = db
    .prepare(
      `
    SELECT
      id, firstName, lastName, email, weeklyHours, workSchedule, hireDate, role, departmentId
    FROM users
    WHERE id = ? AND deletedAt IS NULL
  `
    )
    .get(userId) as any;

  if (!user) {
    return {
      userId,
      userName: 'Unknown',
      hireDate: '',
      referenceDate: '',
      weeklyHours: 0,
      hasWorkSchedule: false,
      targetHours: 0,
      workedHours: 0,
      absenceCredits: 0,
      actualHours: 0,
      overtime: 0,
      absences: [],
      holidays: [],
      unpaidDays: 0,
      success: false,
      errors: [`User with ID ${userId} not found`],
    };
  }

  // Parse workSchedule
  if (user.workSchedule && typeof user.workSchedule === 'string') {
    try {
      user.workSchedule = JSON.parse(user.workSchedule);
    } catch {
      user.workSchedule = null;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const referenceDate = formatDate(today, 'yyyy-MM-dd');

  const userPublic: UserPublic = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    weeklyHours: user.weeklyHours,
    workSchedule: user.workSchedule,
    hireDate: user.hireDate,
    role: user.role,
    department: user.departmentId,
    position: null,
    vacationDaysPerYear: 30,
    endDate: null,
    status: 'active',
    privacyConsentAt: null,
    createdAt: new Date().toISOString(),
  };

  // Calculate target hours
  const targetHours = calculateTargetHoursForPeriod(
    userPublic,
    user.hireDate,
    referenceDate
  );

  // Get time entries
  const timeEntries = db
    .prepare(
      `
    SELECT date, hours
    FROM time_entries
    WHERE userId = ? AND deletedAt IS NULL
  `
    )
    .all(userId) as Array<{ date: string; hours: number }>;

  const workedHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  // Get absences
  const absences = db
    .prepare(
      `
    SELECT type, startDate, endDate, daysRequired, status
    FROM absence_requests
    WHERE userId = ? AND status = 'approved' AND deletedAt IS NULL
  `
    )
    .all(userId) as Array<{
    type: string;
    startDate: string;
    endDate: string;
    daysRequired: number;
    status: string;
  }>;

  let absenceCredits = 0;
  let unpaidDays = 0;
  const absenceDetails: Array<{
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    credit: number;
  }> = [];

  for (const absence of absences) {
    let credit = 0;

    if (absence.type === 'unpaid') {
      unpaidDays += absence.daysRequired;
      // Unpaid leave: NO credit, already handled in targetHours calculation
    } else if (absence.type === 'vacation' || absence.type === 'sick' || absence.type === 'overtime_comp') {
      // Calculate credit based on workSchedule or weeklyHours
      if (user.workSchedule) {
        credit = calculateAbsenceHoursWithWorkSchedule(
          absence.startDate,
          absence.endDate,
          user.workSchedule,
          user.weeklyHours
        );
      } else {
        // Standard: daysRequired × (weeklyHours / 5)
        credit = absence.daysRequired * (user.weeklyHours / 5);
      }
      absenceCredits += credit;
    }

    absenceDetails.push({
      type: absence.type,
      startDate: absence.startDate,
      endDate: absence.endDate,
      days: absence.daysRequired,
      credit,
    });
  }

  const actualHours = workedHours + absenceCredits;
  const overtime = actualHours - targetHours;

  // Get holidays in period
  const holidays = db
    .prepare(
      `
    SELECT date, name
    FROM holidays
    WHERE date >= ? AND date <= ?
    ORDER BY date
  `
    )
    .all(user.hireDate, referenceDate) as Array<{ date: string; name: string }>;

  // Check expected overtime
  const errors: string[] = [];
  if (expectedOvertime) {
    const expectedHours = parseOvertimeString(expectedOvertime);
    if (Math.abs(overtime - expectedHours) > 0.01) {
      errors.push(
        `Expected overtime: ${expectedOvertime} (${expectedHours}h), but got: ${formatOvertimeHours(overtime)}`
      );
    }
  }

  return {
    userId: user.id,
    userName: `${user.firstName} ${user.lastName}`,
    hireDate: user.hireDate,
    referenceDate,
    weeklyHours: user.weeklyHours,
    hasWorkSchedule: !!user.workSchedule,
    targetHours: Math.round(targetHours * 100) / 100,
    workedHours: Math.round(workedHours * 100) / 100,
    absenceCredits: Math.round(absenceCredits * 100) / 100,
    actualHours: Math.round(actualHours * 100) / 100,
    overtime: Math.round(overtime * 100) / 100,
    absences: absenceDetails,
    holidays,
    unpaidDays,
    success: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Formatting
// ============================================================================

function formatOvertimeHours(hours: number): string {
  const sign = hours >= 0 ? '+' : '';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  return `${sign}${h}:${String(m).padStart(2, '0')}h`;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}h`;
}

function parseOvertimeString(str: string): number {
  const match = str.match(/^([+-])?(\d+):(\d+)h?$/);
  if (!match) throw new Error(`Invalid overtime format: ${str}`);
  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours + minutes / 60);
}

// ============================================================================
// Output
// ============================================================================

function printResult(result: ValidationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log(`ÜBERSTUNDEN-VALIDIERUNG: ${result.userName} (ID: ${result.userId})`);
  console.log('='.repeat(80));

  console.log(`\n📅 Zeitraum: ${result.hireDate} (hireDate) → ${result.referenceDate} (heute)`);
  console.log(`📊 Wochenarbeitsstunden: ${result.weeklyHours}h`);
  console.log(`📊 Individueller Wochenplan: ${result.hasWorkSchedule ? 'JA' : 'NEIN'}`);

  console.log('\n' + '-'.repeat(80));
  console.log('ERGEBNIS:');
  console.log('-'.repeat(80));
  console.log(`📊 SOLL-STUNDEN:  ${formatHours(result.targetHours)}`);
  console.log(`📊 IST-STUNDEN:   ${formatHours(result.actualHours)}`);
  console.log(`📊 ÜBERSTUNDEN:   ${formatOvertimeHours(result.overtime)}`);

  console.log('\n' + '-'.repeat(80));
  console.log('DETAILLIERTE AUFSCHLÜSSELUNG:');
  console.log('-'.repeat(80));

  console.log(`\n📌 Gearbeitete Stunden: ${formatHours(result.workedHours)}`);

  if (result.absences.length > 0) {
    console.log(`\n📌 Abwesenheiten (${result.absences.length}):`);
    for (const absence of result.absences) {
      console.log(`   - ${absence.type}: ${absence.startDate} bis ${absence.endDate}`);
      console.log(`     Tage: ${absence.days}, Gutschrift: ${formatHours(absence.credit)}`);
    }
    console.log(`   SUMME Abwesenheits-Gutschriften: ${formatHours(result.absenceCredits)}`);
  } else {
    console.log(`\n📌 Abwesenheiten: Keine`);
  }

  if (result.unpaidDays > 0) {
    console.log(`\n⚠️  Unbezahlter Urlaub: ${result.unpaidDays} Tage (REDUZIERT Soll-Stunden!)`);
  }

  if (result.holidays.length > 0) {
    console.log(`\n📌 Feiertage im Zeitraum (${result.holidays.length}):`);
    for (const holiday of result.holidays) {
      console.log(`   - ${holiday.date}: ${holiday.name}`);
    }
  } else {
    console.log(`\n📌 Feiertage im Zeitraum: Keine`);
  }

  console.log('\n' + '-'.repeat(80));
  console.log('BERECHNUNG:');
  console.log('-'.repeat(80));
  console.log(`Ist-Stunden  = Gearbeitete Stunden + Abwesenheits-Gutschriften`);
  console.log(`             = ${formatHours(result.workedHours)} + ${formatHours(result.absenceCredits)}`);
  console.log(`             = ${formatHours(result.actualHours)}`);
  console.log();
  console.log(`Überstunden  = Ist-Stunden - Soll-Stunden`);
  console.log(`             = ${formatHours(result.actualHours)} - ${formatHours(result.targetHours)}`);
  console.log(`             = ${formatOvertimeHours(result.overtime)}`);

  if (result.errors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ FEHLER:');
    console.log('='.repeat(80));
    for (const error of result.errors) {
      console.log(`   ${error}`);
    }
  } else {
    console.log('\n✅ Validierung erfolgreich!');
  }

  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// Test Scenario Validation
// ============================================================================

function validateScenario(scenarioName: string): void {
  console.log(`\n🧪 Validiere Test-Szenario: ${scenarioName}`);
  console.log('='.repeat(80));

  const scenario = createTestScenario(scenarioName);

  console.log(`Beschreibung: ${scenario.description}`);
  console.log(`User: ${scenario.user.firstName} ${scenario.user.lastName}`);
  console.log(`Referenzdatum: ${scenario.referenceDate}`);

  // Simulate calculation
  const userPublic: UserPublic = {
    id: scenario.user.id,
    username: scenario.user.email.split('@')[0],
    firstName: scenario.user.firstName,
    lastName: scenario.user.lastName,
    email: scenario.user.email,
    weeklyHours: scenario.user.weeklyHours,
    workSchedule: scenario.user.workSchedule,
    hireDate: scenario.user.hireDate,
    role: scenario.user.role,
    department: null,
    position: null,
    vacationDaysPerYear: 30,
    endDate: null,
    status: 'active',
    privacyConsentAt: null,
    createdAt: new Date().toISOString(),
  };

  const targetHours = calculateTargetHoursForPeriod(
    userPublic,
    scenario.user.hireDate,
    scenario.referenceDate
  );

  const workedHours = scenario.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  let absenceCredits = 0;
  for (const absence of scenario.absences) {
    if (absence.type === 'unpaid') {
      // Unpaid: no credit
      continue;
    }

    if (scenario.user.workSchedule) {
      absenceCredits += calculateAbsenceHoursWithWorkSchedule(
        absence.startDate,
        absence.endDate,
        scenario.user.workSchedule,
        scenario.user.weeklyHours
      );
    } else {
      absenceCredits += absence.daysRequired * (scenario.user.weeklyHours / 5);
    }
  }

  const actualHours = workedHours + absenceCredits;
  const overtime = actualHours - targetHours;

  console.log('\nErwartet:');
  console.log(`  Target: ${formatHours(scenario.expectedTargetHours)}`);
  console.log(`  Actual: ${formatHours(scenario.expectedActualHours)}`);
  console.log(`  Overtime: ${formatOvertimeHours(scenario.expectedOvertime)}`);

  console.log('\nBerechnet:');
  console.log(`  Target: ${formatHours(targetHours)}`);
  console.log(`  Actual: ${formatHours(actualHours)}`);
  console.log(`  Overtime: ${formatOvertimeHours(overtime)}`);

  const targetMatch = Math.abs(targetHours - scenario.expectedTargetHours) < 0.01;
  const actualMatch = Math.abs(actualHours - scenario.expectedActualHours) < 0.01;
  const overtimeMatch = Math.abs(overtime - scenario.expectedOvertime) < 0.01;

  console.log('\nValidierung:');
  console.log(`  Target: ${targetMatch ? '✅' : '❌'}`);
  console.log(`  Actual: ${actualMatch ? '✅' : '❌'}`);
  console.log(`  Overtime: ${overtimeMatch ? '✅' : '❌'}`);

  if (targetMatch && actualMatch && overtimeMatch) {
    console.log('\n✅ Szenario erfolgreich validiert!');
  } else {
    console.log('\n❌ Szenario-Validierung fehlgeschlagen!');
  }

  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let userId: number | null = null;
  let validateAll = false;
  let expectedOvertime: string | undefined;
  let scenarioName: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      userId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all') {
      validateAll = true;
    } else if (arg.startsWith('--expected=')) {
      expectedOvertime = arg.split('=')[1];
    } else if (arg.startsWith('--scenario=')) {
      scenarioName = arg.split('=')[1];
    }
  }

  // Scenario validation
  if (scenarioName) {
    if (scenarioName === 'all') {
      const scenarios = getAllScenarioNames();
      for (const name of scenarios) {
        validateScenario(name);
      }
    } else {
      validateScenario(scenarioName);
    }
    return;
  }

  // Database validation
  const db = getDatabase();

  if (validateAll) {
    console.log('\n🔍 Validiere ALLE Benutzer...\n');

    const users = db
      .prepare('SELECT id FROM users WHERE deletedAt IS NULL')
      .all() as Array<{ id: number }>;

    for (const user of users) {
      const result = validateUser(db, user.id);
      printResult(result);
    }

    console.log(`\n✅ ${users.length} Benutzer validiert.\n`);
  } else if (userId) {
    const result = validateUser(db, userId, expectedOvertime);
    printResult(result);
  } else {
    console.log('Usage:');
    console.log('  npm run validate:overtime -- --userId=5');
    console.log('  npm run validate:overtime -- --all');
    console.log('  npm run validate:overtime -- --userId=5 --expected="+37:30"');
    console.log('  npm run validate:overtime -- --scenario=hans-individual-schedule');
    console.log('  npm run validate:overtime -- --scenario=all');
    console.log('\nAvailable scenarios:');
    getAllScenarioNames().forEach(name => console.log(`  - ${name}`));
    process.exit(1);
  }

  db.close();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
