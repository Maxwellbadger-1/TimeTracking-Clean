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

import path from 'path';
import type BetterSqlite3 from 'better-sqlite3';
import { formatDate } from '../utils/timezone.js';
import { getDatabasePath, getProductionDatabasePath } from '../config/database.js';
import type { UserPublic, WorkSchedule } from '../types/index.js';
import type { WorkPeriodContext } from '../services/workPeriodContext.js';
import { createTestScenario, getAllScenarioNames } from '../test/generateTestData';

/**
 * PRODUKTIONSSCHUTZ (D5, WR-06, Plan 09-05 Task 3) — MUSS vor jedem Import eines
 * DB-öffnenden Moduls stehen. Begründung und kombinierte Prüfung identisch zu
 * validateOvertimeDetailed.ts und compareOvertimePaths.ts:9-43: '../utils/workingDays'
 * importiert transitiv '../database/connection.js', das beim `import` bereits die
 * Datenbankdatei öffnet. calculateTargetHoursForPeriod/calculateAbsenceHoursWithWorkSchedule
 * werden deshalb unten per `await import(...)` innerhalb von main() geladen, nicht statisch.
 */
function assertNotProduction(): void {
  const resolvedPath = path.resolve(getDatabasePath());
  const productionPath = path.resolve(getProductionDatabasePath());
  const nodeEnv = process.env.NODE_ENV;

  const looksLikeProduction =
    resolvedPath === productionPath ||
    nodeEnv === 'production' ||
    resolvedPath.toLowerCase().includes('production');

  if (looksLikeProduction) {
    console.error('FEHLER: Produktionsschreibzugriff verweigert (D5, 09-CONTEXT.md).');
    console.error(`  Aufgelöster Datenbankpfad: ${resolvedPath}`);
    console.error(`  NODE_ENV: ${nodeEnv ?? '(nicht gesetzt)'}`);
    console.error('  Setze DATABASE_PATH auf eine lokale Entwicklungskopie, z. B. ./database/development.db');
    process.exit(2);
  }
}

assertNotProduction();

// Dynamisch befüllt in main(), erst nach dem Guard oben (siehe Begründung).
let calculateTargetHoursForPeriod: typeof import('../utils/workingDays').calculateTargetHoursForPeriod;
let calculateAbsenceHoursWithWorkSchedule: typeof import('../utils/workingDays').calculateAbsenceHoursWithWorkSchedule;
// REQ-25 (Plan 11-08): DB-Validierungslauf (validateUser) benutzt createWorkPeriodContext()
// (echte Perioden). Das Szenario-Werkzeug (validateScenario) benutzt stubWorkPeriodContext()
// aus test-support/workPeriodFixtures.ts — Szenario-Nutzer sind rein synthetisch (in-memory
// Zähler-IDs aus generateTestData.ts, s. Kommentar in validateScenario) und existieren nicht
// in user_work_periods; createWorkPeriodContext() würde dort MissingWorkPeriodError werfen.
// stubWorkPeriodContext() löst über dieselbe resolveWorkPeriodIn()-Funktion auf wie der
// echte Kontext (keine zweite Auflösungslogik), nur ohne Datenbankzugriff.
let createWorkPeriodContext: typeof import('../services/workPeriodContext.js').createWorkPeriodContext;
let stubWorkPeriodContext: typeof import('../test-support/workPeriodFixtures.js').stubWorkPeriodContext;
// CR-01: Für `instanceof` im `--all`-Lauf. Muss aus demselben dynamischen Import stammen
// wie die Rechenfunktionen — ein statischer `import { MissingWorkPeriodError }` würde
// '../utils/workingDays' vor dem Produktionsschutz oben laden und damit die Datenbank
// öffnen (Begründung am Guard).
let MissingWorkPeriodError: typeof import('../utils/workingDays').MissingWorkPeriodError;

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
//
// Vorher: new Database(path.join(__dirname, '../../database.db')) — eine zweite,
// fest verdrahtete Verbindung auf die tote Legacy-Datei server/database.db, ignorierte
// DATABASE_PATH vollständig. Jetzt: geteilte Verbindung aus database/connection.js,
// dynamisch importiert in main() nach dem Produktionsschutz-Guard oben (Task 3,
// dieselbe Begründung wie in validateOvertimeDetailed.ts: WAL-Vorfall vom 18.08.2026,
// .planning/debug/db-stabilisierung-20260818.md — zwei Verbindungen auf dieselbe Datei
// sind das Risiko, nicht die Lösung).

// ============================================================================
// Validation Logic
// ============================================================================

/**
 * WR-09: Zeilenform der `users`-Abfrage in `validateUser()`. Vorher stand dort `as any`.
 *
 * Zwei Dinge sind dadurch sichtbar geworden und mitkorrigiert:
 * 1. `username` wurde weiter unten in `userPublic` gelesen, war in der SELECT-Liste aber
 *    gar nicht enthalten — mit `as any` blieb das unbemerkt und lieferte `undefined`.
 *    Die Spalte steht jetzt in der Abfrage.
 * 2. `workSchedule` kommt roh als JSON-Zeichenkette und wird direkt nach dem Lesen
 *    IN-PLACE geparst — der Typ bildet beide Zustände ab, statt einen davon zu leugnen.
 */
interface ValidationUserRow {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  weeklyHours: number;
  workSchedule: string | WorkSchedule | null;
  hireDate: string;
  role: 'admin' | 'employee';
  department: string | null;
}

function validateUser(
  db: BetterSqlite3.Database,
  userId: number,
  expectedOvertime?: string
): ValidationResult {
  // Get user
  // RULE 3 (blocking bug, Plan 09-05 Task 3): 'departmentId' ist keine Spalte von `users`
  // (schema.ts:42, `department TEXT`) — jeder Aufruf mit --userId= warf zuvor
  // "SqliteError: no such column: departmentId" und machte diesen Modus des Werkzeugs
  // vollständig unbenutzbar, unabhängig von REQ-19. Gemessen bei der Ausführung dieses Plans.
  const user = db
    .prepare(
      `
    SELECT
      id, username, firstName, lastName, email, weeklyHours, workSchedule, hireDate, role, department
    FROM users
    WHERE id = ? AND deletedAt IS NULL
  `
    )
    // WR-09: `as any` ersetzt. Genau die oben selektierten Spalten, `workSchedule` als
    // rohe JSON-Zeichenkette aus SQLite.
    .get(userId) as ValidationUserRow | undefined;

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
    // Nach dem In-place-Parsen oben ist das entweder ein WorkSchedule oder null; die
    // Zeichenketten-Variante ist an dieser Stelle bereits ausgeschlossen.
    workSchedule: typeof user.workSchedule === 'string' ? null : user.workSchedule,
    hireDate: user.hireDate,
    role: user.role,
    department: user.department,
    position: null,
    vacationDaysPerYear: 30,
    endDate: null,
    status: 'active',
    privacyConsentAt: null,
    createdAt: new Date().toISOString(),
  };

  // REQ-25 (Plan 11-08): EIN Kontext für diesen Validierungslauf — alle Vergleichswege
  // unten (Zielstunden, Abwesenheitsgutschriften) benutzen denselben Kontext.
  const periods = createWorkPeriodContext();

  // Calculate target hours
  const targetHours = calculateTargetHoursForPeriod(
    userPublic,
    user.hireDate,
    referenceDate,
    periods
  );

  // Get time entries
  //
  // CR-01 (Code-Review Phase 11, Durchlauf 2): Hier stand `AND deletedAt IS NULL`.
  // `time_entries` hat diese Spalte NICHT — weder in `schema.ts` (Tabellendefinition
  // Zeile 164-181: id, userId, date, startTime, endTime, breakMinutes, hours, activity,
  // project, location, notes, createdAt, updatedAt) noch über eine Migration
  // (`ALTER TABLE time_entries` kommt im gesamten Repository nicht vor; per
  // `PRAGMA table_info(time_entries)` gegen `database/development.db` nachgemessen).
  // Jeder Aufruf mit `--userId=` oder `--all` endete deshalb mit
  // `SqliteError: no such column: deletedAt` — genau der Befehl, den `.claude/CLAUDE.md`
  // unter "Validation Tools" und "Overtime Bug Fix (Special Case)" vorschreibt.
  //
  // Warum die Bedingung ersatzlos entfällt statt auf eine andere Spalte umgeschrieben zu
  // werden: Zeiteinträge werden in diesem System HART gelöscht. Beide Löschwege gehen über
  // `DELETE FROM time_entries WHERE id = ?` (`timeEntryService.ts:756` in
  // `deleteTimeEntry()` und `:911` in der Abwesenheits-Bereinigung). Es gibt keine
  // Markierung, die zurückbliebe — eine gelöschte Zeile ist physisch weg und kann von
  // dieser Abfrage nicht mitgezählt werden. Alle übrigen Leser der Tabelle
  // (`overtimeService.ts:474`, `unifiedOvertimeService.ts:357`,
  // `overtimeTransactionRebuildService.ts:299`, `timeEntryService.ts:160`) filtern aus
  // demselben Grund ebenfalls nicht.
  //
  // OFFEN, hier NICHT behoben: `.claude/CLAUDE.md` verbietet unter "Database & Date
  // Handling" den Hard Delete. `time_entries` verletzt diese Regel — und der Kopfkommentar
  // von `deleteTimeEntry()` behauptet fälschlich "soft delete". Das ist eine
  // Schemaänderung samt Anpassung aller Leser und gehört nicht in eine Review-Korrektur
  // an einem Validierungswerkzeug.
  const timeEntries = db
    .prepare(
      `
    SELECT date, hours
    FROM time_entries
    WHERE userId = ?
  `
    )
    .all(userId) as Array<{ date: string; hours: number }>;

  const workedHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  // Get absences
  //
  // CR-01 (Fortsetzung): Dieselbe Abfrage hatte ZWEI falsche Spaltennamen, die der Befund
  // nicht nennt — sie wären erst nach der Korrektur oben sichtbar geworden, weil SQLite
  // beim `prepare()` der Zeiteintragsabfrage bereits abbrach:
  //   1. `daysRequired` existiert in `absence_requests` nicht; die Spalte heißt `days`
  //      (`schema.ts:187`, per PRAGMA bestätigt). Der Alias `days AS daysRequired` behält
  //      den in `ValidationResult`/`generateTestData.ts` benutzten Namen bei — dasselbe
  //      Vorgehen wie in `reproduceOvertimeCompDefect.ts:226`.
  //   2. `deletedAt` existiert in `absence_requests` ebenfalls nicht. Abwesenheiten werden
  //      nicht gelöscht, sondern über `status` geführt ('pending'/'approved'/'rejected',
  //      CHECK in `schema.ts:189`); der Filter `status = 'approved'` unten leistet bereits,
  //      was die gedachte Bedingung leisten sollte.
  const absences = db
    .prepare(
      `
    SELECT type, startDate, endDate, days AS daysRequired, status
    FROM absence_requests
    WHERE userId = ? AND status = 'approved'
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
    } else if (absence.type === 'vacation' || absence.type === 'sick' || absence.type === 'special') {
      // REQ-19, 09-INVENTAR-KREDITIERUNG.md #10: 'overtime_comp' entfernt (wird AUS dem
      // Überstundenkonto selbst bezahlt, keine Gutschrift — unifiedOvertimeService.ts:336-357).
      // 'special' ergänzt: fehlte hier zuvor komplett, eine von REQ-19 unabhängige, eigene
      // Abweichung vom kanonischen Kredit-Filter (Plan 09-05, Task 3; in
      // 09-INVENTAR-KREDITIERUNG.md vermerkt statt stillschweigend übernommen).
      // CR-04 (Phase 11): KEINE Verzweigung über `user.workSchedule` mehr.
      // Die alte Abfrage fragte den HEUTIGEN Stammdatensatz und erzeugte damit zwei Fehler:
      // (1) Ein Nutzer, der heute keinen Wochenplan hat, im Abwesenheitszeitraum aber einen
      //     hatte (oder umgekehrt), landete im else-Zweig — der Perioden-Kontext `periods`
      //     wurde für ihn nie benutzt.
      // (2) Der else-Zweig multiplizierte mit `user.weeklyHours` von HEUTE — genau dem
      //     Maßstab, den REQ-23 abgelöst hat. Bei einem Modellwechsel (40h → 20h) bewertete
      //     das Werkzeug eine Abwesenheit aus der 40h-Zeit mit 20h und meldete eine
      //     Abweichung gegen den Service, obwohl der Service richtig rechnete.
      // `calculateAbsenceHoursWithWorkSchedule()` behandelt beide Fälle bereits über die
      // Periode (workingDays.ts: `period.workSchedule` sonst `period.weeklyHours / 5`) und
      // kennt zusätzlich Feiertage und Wochenenden — anders als `daysRequired`.
      credit = calculateAbsenceHoursWithWorkSchedule(
        userPublic,
        absence.startDate,
        absence.endDate,
        periods
      );
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
  // RULE 1 (bug fix, Plan 09-05 Task 3): 'sign' war für negative Stunden eine leere
  // Zeichenkette statt '-' — jeder negative Saldo (z. B. das Ergebnis eines
  // overtime_comp-Tages nach REQ-19) erschien in der Konsolenausgabe ohne Minuszeichen,
  // ununterscheidbar von einem positiven Saldo gleicher Größe. Gemessen bei der
  // Ausführung dieses Plans anhand des neu korrigierten overtime-compensation-Szenarios
  // (expectedOvertime: -24 zeigte zuvor "24:00h" statt "-24:00h").
  const sign = hours >= 0 ? '+' : '-';
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

  // REQ-25 (Plan 11-08): Szenario-Nutzer sind synthetisch (in-memory Zähler-ID aus
  // generateTestData.ts) und existieren nicht in user_work_periods — stubWorkPeriodContext()
  // statt createWorkPeriodContext() (s. Kommentar bei den Modul-Haltern oben). Eine Periode,
  // gültig ab hireDate, mit dem Wochenplan/den Wochenstunden des Szenarios.
  const periods = stubWorkPeriodContext([
    {
      userId: userPublic.id,
      validFrom: scenario.user.hireDate,
      validTo: null,
      weeklyHours: scenario.user.weeklyHours,
      workSchedule: scenario.user.workSchedule,
    },
  ]);

  const targetHours = calculateTargetHoursForPeriod(
    userPublic,
    scenario.user.hireDate,
    scenario.referenceDate,
    periods
  );

  const workedHours = scenario.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  let absenceCredits = 0;
  for (const absence of scenario.absences) {
    // Allowlist statt Blockliste (REQ-19, unifiedOvertimeService.ts:336-357,
    // getAbsenceCredit()): nur vacation/sick erhalten hier eine Gutschrift (TestAbsence in
    // generateTestData.ts kennt nur 'vacation' | 'sick' | 'unpaid' | den Ausgleichstyp —
    // 'special' kommt in Testdaten nicht vor). Unpaid (reduziert Soll stattdessen) und der
    // aus dem Überstundenkonto selbst bezahlte Ausgleichstag bleiben ohne Gutschrift. Vorher
    // fiel der Ausgleichstag durch die alte Blockliste (nur 'unpaid' ausgeschlossen) und
    // wurde im else-Zweig unten wie vacation/sick kreditiert (Plan 09-05, Task 3; Testdaten
    // in generateTestData.ts:createOvertimeCompensationScenario() entsprechend korrigiert).
    if (absence.type !== 'vacation' && absence.type !== 'sick') {
      continue;
    }

    // CR-04: dieselbe Regel an genau einer Stelle — hier war die Verzweigung wegen des
    // selbstgebauten `stubWorkPeriodContext` zwar in sich stimmig, aber sie war die zweite
    // Kopie derselben Entscheidung. `calculateAbsenceHoursWithWorkSchedule()` deckt den
    // Fall ohne Wochenplan über `period.weeklyHours / 5` ab.
    absenceCredits += calculateAbsenceHoursWithWorkSchedule(
      userPublic,
      absence.startDate,
      absence.endDate,
      periods
    );
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
  // Dynamische Imports NACH dem Produktionsschutz oben (siehe Begründung am Guard):
  // '../utils/workingDays', '../services/workPeriodContext.js' und
  // '../test-support/workPeriodFixtures.js' ziehen transitiv die geteilte DB-Verbindung
  // (workPeriodFixtures.js importiert workPeriodService.js für createWorkPeriod/
  // resolveWorkPeriodIn).
  const [workingDays, workPeriodContextModule, workPeriodFixtures] = await Promise.all([
    import('../utils/workingDays.js'),
    import('../services/workPeriodContext.js'),
    import('../test-support/workPeriodFixtures.js'),
  ]);
  calculateTargetHoursForPeriod = workingDays.calculateTargetHoursForPeriod;
  calculateAbsenceHoursWithWorkSchedule = workingDays.calculateAbsenceHoursWithWorkSchedule;
  MissingWorkPeriodError = workingDays.MissingWorkPeriodError;
  createWorkPeriodContext = workPeriodContextModule.createWorkPeriodContext;
  stubWorkPeriodContext = workPeriodFixtures.stubWorkPeriodContext;

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

  // Database validation — geteilte Verbindung (siehe Kommentar bei "Database Connection" oben)
  const { db } = await import('../database/connection.js');

  if (validateAll) {
    console.log('\n🔍 Validiere ALLE Benutzer...\n');

    const users = db
      .prepare('SELECT id FROM users WHERE deletedAt IS NULL')
      .all() as Array<{ id: number }>;

    // CR-01: Ein Nutzer mit Datendefekt (keine Arbeitszeitperiode, D4) beendete den
    // GESAMTEN `--all`-Lauf beim ersten Vorkommen — gemessen an `development.db`: 18 von
    // 19 Nutzern ausgegeben, dann Abbruch bei Nutzer 12877. Für ein Werkzeug, das den
    // Bestand PRÜFEN soll, ist das die falsche Reaktion; dieselbe Begründung und dieselbe
    // Behandlung wie in `verifyPeriodNullEffect.ts:399-413` (WR-13). Der Defekt wird
    // eigene Ergebniskategorie, der Lauf geht weiter, die Zusammenfassung meldet ihn, und
    // der Exitcode wird 1 — damit ein unvollständiger Lauf in einer Pipeline nicht als
    // Erfolg durchgeht. Jeder ANDERE Fehler fliegt unverändert weiter.
    const usersWithoutPeriod: Array<{ userId: number; reason: string }> = [];
    let validatedCount = 0;

    for (const user of users) {
      try {
        const result = validateUser(db, user.id);
        printResult(result);
        validatedCount++;
      } catch (error) {
        if (error instanceof MissingWorkPeriodError) {
          usersWithoutPeriod.push({ userId: user.id, reason: error.message });
          console.log(
            `\n⚠️  Nutzer ${user.id} übersprungen — Datendefekt (D4): ${error.message}\n`
          );
          continue;
        }
        throw error;
      }
    }

    console.log(`\n✅ ${validatedCount} von ${users.length} Benutzern validiert.`);
    if (usersWithoutPeriod.length > 0) {
      console.log(
        `\n❌ ${usersWithoutPeriod.length} Nutzer ohne lückenlose Arbeitszeitperiode ` +
          `(Datendefekt, D4): ${usersWithoutPeriod.map(u => u.userId).join(', ')}`
      );
      console.log(
        '   Diese Nutzer sind NICHT geprüft. Behebung: `npm run check:period-chains` ' +
          'zeigt die betroffenen Ketten im Detail.\n'
      );
      process.exitCode = 1;
    } else {
      console.log('');
    }
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
