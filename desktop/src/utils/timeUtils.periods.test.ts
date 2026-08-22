/**
 * Pruefskript fuer die periodengetreuen Funktionen `calculateAbsenceHoursWithWorkSchedule`,
 * `countWorkingDaysForUser` und `resolveWorkTimePeriodIn` (WR-12-Nachzug, Plan 12-08).
 *
 * Der im Projekt konfigurierte Unit-Testlaeufer (vitest, `desktop/package.json` Skript `test`)
 * ist in diesem Environment nicht lauffaehig: `@testing-library/react` (geladen ueber
 * `src/test/setup.ts`) bricht mit "Cannot find module
 * '@babel/runtime/helpers/interopRequireDefault'" ab — geprueft an einem bestehenden,
 * unveraenderten Test (`timeUtils.test.ts`), der mit demselben Fehler scheitert. Das ist ein
 * vorbestehendes, projektweites Problem (siehe `12-02-SUMMARY.md`), nicht durch diesen Plan
 * verursacht. Deshalb greift dieselbe Ausweichroute wie in Plan 12-02: ein `npx tsx`-Pruefskript
 * mit `node:assert`, das denselben Dateinamen traegt.
 *
 * Ausfuehrung: npx tsx src/utils/timeUtils.periods.test.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  calculateAbsenceHoursWithWorkSchedule,
  countWorkingDaysForUser,
  resolveWorkTimePeriodIn,
} from './timeUtils';
import type { WorkTimePeriod, WorkSchedule } from '../types';

function makePeriod(overrides: Partial<WorkTimePeriod> = {}): WorkTimePeriod {
  return {
    id: 1,
    userId: 1,
    validFrom: '2026-01-01',
    validTo: null,
    weeklyHours: 40,
    workSchedule: null,
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: null,
    ...overrides,
  };
}

const NO_HOLIDAYS: ReadonlySet<string> = new Set();

// --- TZ-Teilmodus: nur fuer den in Testfall 9 gestarteten Kindprozess ---
// Muss VOR der Testschleife laufen und den Prozess sofort beenden, sonst wuerde der
// Kindprozess seinerseits versuchen, einen eigenen Kindprozess zu starten (Rekursion).
if (process.env.TIMEUTILS_TZ_CHECK === '1') {
  const periods = [makePeriod({ weeklyHours: 40 })];
  const hours = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  const days = countWorkingDaysForUser('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  process.stdout.write(JSON.stringify({ hours, days }));
  process.exit(0);
}

let testCount = 0;

function test(name: string, fn: () => void): void {
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

// 1. Ein Zeitraum vollstaendig innerhalb einer Periode mit 40 h/Woche und ohne Tagesplan
//    liefert 8 h je Werktag.
test('Zeitraum vollstaendig in einer 40h-Periode ohne Tagesplan liefert 8h je Werktag', () => {
  const periods = [makePeriod({ id: 1, validFrom: '2026-01-01', validTo: null, weeklyHours: 40 })];
  // 2026-01-05 (Mo) bis 2026-01-09 (Fr) — 5 Werktage, keine Feiertage
  const hours = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  const days = countWorkingDaysForUser('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  assert.equal(hours, 40, `Erwartet 40h (5 * 8h), erhalten ${hours}`);
  assert.equal(days, 5, `Erwartet 5 Arbeitstage, erhalten ${days}`);
});

// 2. Ein Zeitraum, der ueber einen Stichtag laeuft (40 h davor, 20 h danach), liefert fuer die
//    Tage vor dem Stichtag 8 h und ab dem Stichtag 4 h — validFrom ist inklusiv.
test('Zeitraum ueber einen Stichtag: 8h vor, 4h ab dem Stichtag (validFrom inklusiv)', () => {
  const periods = [
    makePeriod({ id: 1, validFrom: '2026-01-01', validTo: '2026-01-08', weeklyHours: 40 }),
    makePeriod({ id: 2, validFrom: '2026-01-08', validTo: null, weeklyHours: 20 }),
  ];
  // Mo 2026-01-05 bis Fr 2026-01-09, Stichtag Do 2026-01-08
  const hoursBefore = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-07', periods, NO_HOLIDAYS);
  const hoursFromStichtag = calculateAbsenceHoursWithWorkSchedule('2026-01-08', '2026-01-09', periods, NO_HOLIDAYS);
  const hoursTotal = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  assert.equal(hoursBefore, 24, `Mo-Mi vor dem Stichtag: erwartet 24h (3 * 8h), erhalten ${hoursBefore}`);
  assert.equal(hoursFromStichtag, 8, `Do-Fr ab dem Stichtag: erwartet 8h (2 * 4h), erhalten ${hoursFromStichtag}`);
  assert.equal(hoursTotal, 32, `Gesamtzeitraum: erwartet 32h, erhalten ${hoursTotal}`);
});

// 3. validTo ist exklusiv: der Tag, der gleich validTo ist, gehoert bereits zur Folgeperiode.
test('validTo ist exklusiv: der Stichtag selbst gehoert zur Folgeperiode', () => {
  const alt = makePeriod({ id: 1, validFrom: '2026-01-01', validTo: '2026-01-08', weeklyHours: 40 });
  const neu = makePeriod({ id: 2, validFrom: '2026-01-08', validTo: null, weeklyHours: 20 });
  const periods = [alt, neu];

  const resolved = resolveWorkTimePeriodIn(periods, '2026-01-08');
  assert.ok(resolved !== null, 'Am Stichtag muss eine Periode aufgeloest werden');
  assert.equal(resolved!.id, 2, 'Am Stichtag muss die NEUE Periode gelten, nicht die alte');

  const hoursOnStichtag = calculateAbsenceHoursWithWorkSchedule('2026-01-08', '2026-01-08', periods, NO_HOLIDAYS);
  assert.equal(hoursOnStichtag, 4, `Der Stichtag selbst muss bereits 4h (neue Periode) liefern, erhalten ${hoursOnStichtag}`);

  const dayBefore = resolveWorkTimePeriodIn(periods, '2026-01-07');
  assert.equal(dayBefore!.id, 1, 'Der Tag vor dem Stichtag muss noch die alte Periode liefern');
});

// 4. Samstage und Sonntage liefern 0 h, auch wenn ein Tagesplan dort Stunden vorsieht.
test('Wochenenden liefern 0h, auch wenn der Tagesplan dort Stunden vorsieht', () => {
  const workSchedule: WorkSchedule = {
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 5,
    sunday: 5,
  };
  const periods = [makePeriod({ id: 1, workSchedule })];
  // 2026-01-10 (Sa) bis 2026-01-11 (So)
  const hours = calculateAbsenceHoursWithWorkSchedule('2026-01-10', '2026-01-11', periods, NO_HOLIDAYS);
  const days = countWorkingDaysForUser('2026-01-10', '2026-01-11', periods, NO_HOLIDAYS);
  assert.equal(hours, 0, `Wochenende mit Tagesplan-Stunden muss trotzdem 0h liefern, erhalten ${hours}`);
  assert.equal(days, 0, `Wochenende darf nicht als Arbeitstag zaehlen, erhalten ${days}`);
});

// 5. Ein Datum, das in der Feiertagsliste steht, liefert 0 h, auch wenn es ein Werktag ist.
test('Ein Feiertag liefert 0h, auch wenn es ein Werktag ist', () => {
  const periods = [makePeriod({ id: 1, weeklyHours: 40 })];
  const holidays = new Set(['2026-01-06']); // Di 2026-01-06
  // Mo 2026-01-05 bis Mi 2026-01-07
  const hours = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-07', periods, holidays);
  assert.equal(hours, 16, `Erwartet 16h (8h Mo + 0h Feiertag Di + 8h Mi), erhalten ${hours}`);
});

// 6. Ein Datum ohne passende Periode liefert 0 h und wirft nicht.
test('Ein Datum ohne passende Periode liefert 0h und wirft nicht', () => {
  const periods = [makePeriod({ id: 1, validFrom: '2026-02-01', validTo: null, weeklyHours: 40 })];
  let hours = -1;
  assert.doesNotThrow(() => {
    hours = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-06', periods, NO_HOLIDAYS);
  });
  assert.equal(hours, 0, `Datum vor der ersten Periode muss 0h liefern, erhalten ${hours}`);
});

// 7. Eine leere Periodenliste liefert fuer den gesamten Zeitraum 0 h und wirft nicht.
test('Eine leere Periodenliste liefert 0h fuer den gesamten Zeitraum und wirft nicht', () => {
  let hours = -1;
  assert.doesNotThrow(() => {
    hours = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-09', [], NO_HOLIDAYS);
  });
  assert.equal(hours, 0, `Leere Periodenliste muss 0h liefern, erhalten ${hours}`);
});

// 8. countWorkingDaysForUser zaehlt genau die Tage, die nach denselben Regeln mehr als 0 h
//    liefern.
test('countWorkingDaysForUser zaehlt nur Tage mit mehr als 0h (Personio/DATEV/SAP-Regel)', () => {
  const workSchedule: WorkSchedule = {
    monday: 8,
    tuesday: 0,
    wednesday: 6,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  };
  const periods = [makePeriod({ id: 1, workSchedule })];
  // Mo 2026-01-05 bis Fr 2026-01-09
  const days = countWorkingDaysForUser('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  const hours = calculateAbsenceHoursWithWorkSchedule('2026-01-05', '2026-01-09', periods, NO_HOLIDAYS);
  assert.equal(days, 4, `Dienstag hat 0h und darf nicht zaehlen, erwartet 4 Tage, erhalten ${days}`);
  assert.equal(hours, 30, `Erwartet 30h (8+0+6+8+8), erhalten ${hours}`);
});

// 9. Kein Ergebnis haengt von der Zeitzone des Rechners ab: derselbe Aufruf liefert bei
//    gesetztem TZ=UTC und bei TZ=Europe/Berlin denselben Wert.
test('Zeitzonenunabhaengigkeit: TZ=UTC und TZ=Europe/Berlin liefern denselben Wert', () => {
  const thisFile = fileURLToPath(import.meta.url);
  // node.exe direkt mit dem tsx-CLI-Skript aufrufen statt ueber npx/npx.cmd — vermeidet den
  // Windows-shell:true-Quotingfehler bei Pfaden mit Leerzeichen (dieses Projekt liegt unter
  // "...\Stiftung TimeTracker\...").
  const require = createRequire(import.meta.url);
  const tsxCli = require.resolve('tsx/cli');

  const runWithTz = (tz: string): string => {
    return execFileSync(process.execPath, [tsxCli, thisFile], {
      env: { ...process.env, TZ: tz, TIMEUTILS_TZ_CHECK: '1' },
      encoding: 'utf-8',
    }).trim();
  };

  const resultUtc = runWithTz('UTC');
  const resultBerlin = runWithTz('Europe/Berlin');
  assert.equal(
    resultUtc,
    resultBerlin,
    `TZ=UTC lieferte ${resultUtc}, TZ=Europe/Berlin lieferte ${resultBerlin} — Ergebnis darf nicht von der Rechner-Zeitzone abhaengen`
  );
});

assert.ok(testCount >= 9, `Erwartet mindestens 9 Testfaelle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
