/**
 * CLI: Unabhängige Tag-für-Tag-Gegenrechnung der Sollstunden (D5, D6, REQ-25,
 * 11-10-PLAN.md, Task 1).
 *
 * WARUM DIESES WERKZEUG EXISTIERT:
 * Der kanonische Überstunden-Lesepfad (`unifiedOvertimeService.getUser()`, intern
 * `WHERE ... AND deletedAt IS NULL`) wirft für soft-gelöschte Nutzer "User <id> not found".
 * Ein Byte-Vergleich zweier `snapshotBalances.ts`-Läufe (10-NULLWIRKUNG-NACHWEIS.md-Muster)
 * vergleicht für diese Nutzer deshalb nur zwei identische Fehlertexte, keine Salden — er
 * belegt für sie nichts über den berechneten Wert. Dieses Werkzeug geht NICHT über
 * `unifiedOvertimeService`, sondern liest `users` ungefiltert direkt (wie
 * `snapshotBalances.ts`s `--all`-Modus) und vergleicht für JEDEN Nutzer, Tag für Tag, zwei
 * unabhängig berechnete Sollstunden-Werte:
 *   NEU: `getDailyTargetHours(user, datum, ctx)` — die periodengetreue Auflösung nach
 *        Plan 11-04, mit einem `createWorkPeriodContext()` je Lauf.
 *   ALT: die Regel vor dem Umbau, unten in diesem Skript ausgeschrieben — eine zweite,
 *        unabhängige Berechnung zum Vergleich, aus demselben Grund, mit dem
 *        `09-INVENTAR-SOLLSTUNDEN.md` die Nachrechnung in `validateOvertimeCalculation.ts`
 *        einordnet. Diese Gegenrechnung liest ausschließlich die heutigen, flachen
 *        `users`-Spalten (`weeklyHours`, `workSchedule`, `hireDate`) — sie kennt keine
 *        Perioden, genau wie der Code vor Plan 11-04.
 *
 * DIE GEGENRECHNUNG DARF DIE DATEI MIT `getDailyTargetHours` NICHT IMPORTIEREN UND DIESE
 * FUNKTION NICHT AUFRUFEN — sonst vergleicht dieses Werkzeug eine Zahl mit sich selbst und
 * die Falsifizierbarkeitsprobe (T-11-39) wäre wertlos. Die Gegenrechnung steht deshalb
 * vollständig ausgeschrieben in `altDailyTargetHours()` unten, ohne einen einzigen Import
 * aus jener Datei.
 *
 * FEIERTAGSABFRAGE: dieselbe Datenquelle und Abfrageform wie die periodengetreue Auflösung
 * (Tabelle `holidays`, `SELECT 1 FROM holidays WHERE date = ?`) — ein anderer
 * Feiertagsbegriff würde flächendeckend Scheinabweichungen erzeugen, die nichts mit einem
 * Modellwechsel zu tun haben.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (zwingend, Muster aus `snapshotBalances.ts`):
 *   1. Ausschließlich importsichere Module am Kopf: `fs`, `crypto`, `path`,
 *      `./productionGuard.js`, `../config/database.js` (löst nur Strings auf, öffnet keine
 *      Datenbank).
 *   2. Argumentauswertung.
 *   3. `assertNotProduction()` — synchron, bevor irgendetwas geöffnet wird.
 *   4. Erst danach `await import(...)` der datenbankziehenden Module innerhalb von `main()`.
 * `server/package.json` setzt `"type": "module"`, `tsconfig.json` `"module": "ESNext"`,
 * Start über `tsx` — `await import()` bleibt damit ein echter dynamischer Import.
 *
 * DATABASE_PATH IST PFLICHT, KEIN STILLER RÜCKFALL — wie in `snapshotBalances.ts` begründet.
 *
 * REIN LESEND: kein INSERT, kein UPDATE, kein DELETE, kein `.run(` in dieser Datei. Der
 * SHA-256-Hash der Datenbankdatei wird vor und nach dem Lauf gebildet und ausgegeben — beide
 * Werte müssen im Aufrufer (11-WIRKUNGSNACHWEIS.md) gleich sein, sonst hat dieses Werkzeug
 * entgegen seinem Zweck geschrieben.
 *
 * ZEITZONENFREIHEIT IST STRUKTURELL: Kein `new Date('YYYY-MM-DD')` für die Tagesschleife
 * (parst als UTC-Mitternacht, hat in Phase 9 systemisch den letzten Kalendertag jedes Monats
 * verschluckt) und keine veraltete ISO-Serialisierung für die Datumsausgabe. Die Tagesschleife
 * baut jedes Datum aus ganzzahligen Jahr/Monat/Tag-Komponenten (kein String-Parsing) und
 * formatiert es über `formatDate(date, 'yyyy-MM-dd')` aus `server/src/utils/timezone.ts` —
 * dasselbe Muster wie `seedModelChangeUser.ts`.
 *
 * FALSIFIZIERBARKEIT (T-11-39): Ein Nachweiswerkzeug, das nicht fehlschlagen kann, ist
 * wertlos. `--erwarte-abweichung=<id,id,...>` benennt die userIds, für die eine Abweichung
 * ERWARTET wird (Exit 0 nur bei exakter Übereinstimmung der Menge). Ohne dieses Argument wird
 * "keine Abweichung bei keinem Nutzer" erwartet.
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';
// Ausschließlich Typ-Importe für Werte, die transitiv die Datenbank öffnen würden — dieselbe
// Begründung wie in `snapshotBalances.ts`: ein Werte-Import liefe über
// '../database/connection.js' und öffnete die Datenbankdatei, bevor die Guards unten
// gelaufen sind. `import type` wird von TypeScript restlos entfernt.
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import type { UserPublic } from '../types/index.js';
import type { WorkPeriodContext } from '../services/workPeriodContext.js';

const TOOL_VERSION = '1.0.0';

// ---------------------------------------------------------------------------------------
// Argumentauswertung
// ---------------------------------------------------------------------------------------

interface CliOptions {
  asOf: string;
  erwarteAbweichung: number[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^\d+$/;

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error(
    '  npm run verify:period-nulleffect -- --asOf=<YYYY-MM-DD> [--erwarte-abweichung=<id,id,...>]'
  );
  console.error('');
  console.error('  --asOf ist Pflicht, kein Rückfall auf das heutige Datum.');
  console.error(
    '  --erwarte-abweichung benennt die userIds, für die eine Abweichung erwartet wird. ' +
      'Ohne dieses Argument wird keine Abweichung bei keinem Nutzer erwartet.'
  );
  console.error(
    '  DATABASE_PATH muss gesetzt sein, kein stiller Rückfall auf database/development.db.'
  );
  process.exit(2);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  let asOf: string | undefined;
  let erwarteAbweichung: number[] = [];

  for (const arg of args) {
    if (arg.startsWith('--asOf=')) {
      asOf = arg.slice('--asOf='.length);
    } else if (arg.startsWith('--erwarte-abweichung=')) {
      const raw = arg.slice('--erwarte-abweichung='.length);
      const ids: number[] = [];
      for (const part of raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)) {
        if (!ID_PATTERN.test(part)) {
          printUsageAndExit(`--erwarte-abweichung enthält keine gültige Ganzzahl: "${part}".`);
        }
        ids.push(parseInt(part, 10));
      }
      erwarteAbweichung = ids;
    }
  }

  if (!asOf) {
    printUsageAndExit('--asOf=<YYYY-MM-DD> fehlt. Kein Rückfall auf das heutige Datum.');
  }
  if (!DATE_PATTERN.test(asOf)) {
    printUsageAndExit(`--asOf muss dem Format YYYY-MM-DD entsprechen, erhalten: "${asOf}".`);
  }

  return { asOf, erwarteAbweichung };
}

// ---------------------------------------------------------------------------------------
// GEGENRECHNUNG — REGEL VOR DEM UMBAU (11-10-PLAN.md <interfaces>, wörtlich aus
// `.claude/CLAUDE.md` und dem Ist-Stand vor Plan 11-04). Liest ausschließlich die heutigen,
// flachen `users`-Spalten — kein Perioden-Bezug, kein Aufruf und kein Import der Datei mit
// der periodengetreuen Auflösung (`getDailyTargetHours`). Reihenfolge:
//   1. Feiertag am Datum                          → 0
//   2. users.workSchedule vorhanden                → Wert des Wochentags aus workSchedule
//   3. users.weeklyHours === 0                     → 0
//   4. Samstag oder Sonntag                        → 0
//   5. sonst                                        → Math.round((weeklyHours/5)*100)/100
//   Datum vor users.hireDate                       → 0
// ---------------------------------------------------------------------------------------

interface RawUserRow {
  id: number;
  hireDate: string | null;
  weeklyHours: number;
  workSchedule: string | null; // JSON-Text, roh aus der Datenbank
}

const DOW_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** Wochentagsname aus einem YYYY-MM-DD-String, ausschließlich über ganzzahlige
 *  Jahr/Monat/Tag-Komponenten (kein String-Parsing eines Datums, dasselbe Muster wie
 *  `seedModelChangeUser.ts`). */
function dowNameFor(dateStr: string): (typeof DOW_NAMES)[number] {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DOW_NAMES[new Date(y, m - 1, d).getDay()];
}

function altDailyTargetHours(
  db: BetterSqlite3Database,
  user: RawUserRow,
  dateStr: string
): number {
  // Schritt 1: Feiertag zuerst — dieselbe Tabelle und Abfrageform wie die neue Auflösung.
  const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
  if (holiday) {
    return 0;
  }

  // Ausnahme: Datum vor hireDate → 0 (kein hireDate gesetzt wird vom Aufrufer bereits
  // ausgeschlossen, s. main()).
  if (user.hireDate && dateStr < user.hireDate) {
    return 0;
  }

  // Schritt 2: individueller Wochenplan hat Vorrang vor weeklyHours.
  if (user.workSchedule) {
    const schedule = JSON.parse(user.workSchedule) as Record<string, number>;
    const dow = dowNameFor(dateStr);
    return schedule[dow] || 0;
  }

  // Schritt 3: Aushilfen ohne Wochenstunden.
  if (user.weeklyHours === 0) {
    return 0;
  }

  // Schritt 4: Wochenende ohne individuellen Wochenplan.
  const dow = dowNameFor(dateStr);
  if (dow === 'saturday' || dow === 'sunday') {
    return 0;
  }

  // Schritt 5: Standard-5-Tage-Woche.
  return Math.round((user.weeklyHours / 5) * 100) / 100;
}

// ---------------------------------------------------------------------------------------
// Tagesschleife
// ---------------------------------------------------------------------------------------

/** Erzeugt jedes Datum von `fromStr` bis `toStr` (beide inklusive) als YYYY-MM-DD-String.
 *  Baut jeden Tag aus ganzzahligen Komponenten und schreitet über `setDate()` voran — kein
 *  String-Parsing eines Datums an irgendeiner Stelle dieser Funktion. */
function* dateRange(
  fromStr: string,
  toStr: string,
  formatDate: (date: Date, pattern: string) => string
): Generator<string> {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const cursor = new Date(fy, fm - 1, fd);

  while (true) {
    const dateStr = formatDate(cursor, 'yyyy-MM-dd');
    if (dateStr > toStr) {
      break;
    }
    yield dateStr;
    cursor.setDate(cursor.getDate() + 1);
  }
}

// ---------------------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------------------

interface DeviationEntry {
  date: string;
  alt: number;
  neu: number;
}

interface UserResult {
  userId: number;
  hireDateMissing: boolean;
  daysChecked: number;
  daysDeviating: number;
  firstDeviations: DeviationEntry[];
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

async function main(): Promise<void> {
  const { asOf, erwarteAbweichung } = parseArgs();

  // DATABASE_PATH ist Pflicht — kein Rückfall auf getDatabasePath()s interne Standardwahl.
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error(
      '  Ohne DATABASE_PATH fällt dieses Werkzeug NICHT still auf database/development.db zurück.'
    );
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-datenbank> explizit.');
    process.exit(2);
  }

  // Guard VOR jedem Datenbankzugriff — synchron, bevor irgendein schreibendes Modul geladen
  // wird.
  assertNotProduction();

  const resolvedPath = path.resolve(getDatabasePath());

  if (!existsSync(resolvedPath)) {
    console.error(`FEHLER: Datenbankdatei existiert nicht: ${resolvedPath}`);
    process.exit(2);
  }

  const fileSizeBefore = statSync(resolvedPath).size;
  const shaBefore = sha256File(resolvedPath);

  console.log('=== verifyPeriodNullEffect: Ausgangslage ===');
  console.log(`Aufgelöster Datenbankpfad: ${resolvedPath}`);
  console.log(`Dateigröße (vor Lauf): ${fileSizeBefore} Bytes`);
  console.log(`SHA-256 (vor Lauf): ${shaBefore}`);
  console.log(`asOf: ${asOf}`);
  console.log(
    `Erwartete abweichende userIds: ${erwarteAbweichung.length > 0 ? JSON.stringify(erwarteAbweichung) : '(keine — Nullwirkung erwartet)'}`
  );
  console.log('');

  // Erst JETZT, NACH dem Guard, werden die datenbankziehenden Module geladen.
  const { db } = await import('../database/connection.js');
  const { getDailyTargetHours } = await import('../utils/workingDays.js');
  const { createWorkPeriodContext } = await import('../services/workPeriodContext.js');
  const { formatDate } = await import('../utils/timezone.js');

  const rawUsers = db
    .prepare('SELECT id, hireDate, weeklyHours, workSchedule FROM users ORDER BY id ASC')
    .all() as RawUserRow[];

  // Ein gemeinsamer Perioden-Kontext für den gesamten Lauf (D1/D2): lädt die Perioden je
  // Nutzer beim ersten resolve()-Aufruf genau einmal.
  const periods: WorkPeriodContext = createWorkPeriodContext();

  const results: UserResult[] = [];

  for (const row of rawUsers) {
    if (!row.hireDate) {
      console.log(`userId=${row.id}: kein hireDate — Prüfung übersprungen (0 Tage).`);
      results.push({ userId: row.id, hireDateMissing: true, daysChecked: 0, daysDeviating: 0, firstDeviations: [] });
      continue;
    }

    // Minimal typkonformes UserPublic-Objekt für getDailyTargetHours — die Funktion liest
    // laut ihrer eigenen Dokumentation ausschließlich `id` und `hireDate`; die übrigen
    // Felder sind für den Typ nötig, werden von ihr nicht gelesen.
    const userForNeu: UserPublic = {
      id: row.id,
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'employee',
      department: null,
      position: null,
      weeklyHours: row.weeklyHours,
      workSchedule: row.workSchedule ? JSON.parse(row.workSchedule) : null,
      vacationDaysPerYear: 0,
      hireDate: row.hireDate,
      endDate: null,
      status: 'active',
      privacyConsentAt: null,
      createdAt: '',
    };

    let daysChecked = 0;
    let daysDeviating = 0;
    const firstDeviations: DeviationEntry[] = [];

    for (const dateStr of dateRange(row.hireDate, asOf, formatDate)) {
      const neu = getDailyTargetHours(userForNeu, dateStr, periods);
      const alt = altDailyTargetHours(db, row, dateStr);
      daysChecked++;
      if (neu !== alt) {
        daysDeviating++;
        if (firstDeviations.length < 20) {
          firstDeviations.push({ date: dateStr, alt, neu });
        }
      }
    }

    console.log(`userId=${row.id}: geprüfte Tage=${daysChecked}, abweichende Tage=${daysDeviating}`);
    for (const dev of firstDeviations) {
      console.log(`  Abweichung ${dev.date}: ALT=${dev.alt} NEU=${dev.neu}`);
    }

    results.push({ userId: row.id, hireDateMissing: false, daysChecked, daysDeviating, firstDeviations });
  }

  const deviatingUserIds = results.filter((r) => r.daysDeviating > 0).map((r) => r.userId).sort((a, b) => a - b);
  const expectedSorted = [...erwarteAbweichung].sort((a, b) => a - b);
  const matches =
    deviatingUserIds.length === expectedSorted.length &&
    deviatingUserIds.every((id, i) => id === expectedSorted[i]);

  console.log('');
  console.log('=== Zusammenfassung ===');
  console.log(`Nutzer geprüft (ungefiltert): ${results.length}`);
  console.log(`Nutzer mit Abweichung: ${deviatingUserIds.length} — userIds: ${JSON.stringify(deviatingUserIds)}`);
  console.log(`Erwartete abweichende userIds: ${JSON.stringify(expectedSorted)}`);
  console.log(`Übereinstimmung: ${matches ? 'ja' : 'nein'}`);

  const fileSizeAfter = statSync(resolvedPath).size;
  const shaAfter = sha256File(resolvedPath);
  console.log(`Dateigröße (nach Lauf): ${fileSizeAfter} Bytes`);
  console.log(`SHA-256 (nach Lauf): ${shaAfter}`);
  console.log(`Unversehrtheit (SHA-256 gleich): ${shaBefore === shaAfter ? 'ja' : 'NEIN — Werkzeug hat geschrieben'}`);
  console.log('');

  if (!matches) {
    console.log('ERGEBNIS: Abweichung von der Erwartung (Exit 1).');
    process.exit(1);
  }
  console.log('ERGEBNIS: Erwartung erfüllt (Exit 0).');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
