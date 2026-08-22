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
 * REIN LESEND: kein INSERT, kein UPDATE, kein DELETE, kein `.run(` in dieser Datei.
 *
 * UNVERSEHRTHEITSNACHWEIS IN ZWEI PHASEN (WR-07, Code-Review Phase 11, Durchlauf 2):
 * Der Lauf zerfällt in zwei Abschnitte mit unterschiedlichem Schreibrisiko, und es werden
 * DREI Hashes gebildet, nicht zwei:
 *   Phase A — Verbindungsaufbau. `await import('../database/connection.js')` führt
 *     `initializeDatabase()`, `createIndexes()` und `verifyIndexes()` aus — also
 *     `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` und Migrationen. Das ist
 *     der EINZIGE Abschnitt, in dem dieses Werkzeug überhaupt schreiben kann. Gemessen
 *     durch `shaAtStart` (vor dem Import) gegen `shaBefore` (nach Import + Checkpoint).
 *     Nur beurteilbar, wenn beim Start keine gefüllte WAL-Datei vorlag — sonst faltet der
 *     Checkpoint fremden Inhalt ein und die Aussage wäre falsch; das Werkzeug sagt dann
 *     ausdrücklich "nicht beurteilbar" statt "in Ordnung".
 *   Phase B — der eigentliche Messlauf. Gemessen durch `shaBefore` gegen `shaAfter`, beide
 *     nach einem `wal_checkpoint(TRUNCATE)` (WR-13: sonst prüft der Vergleich eine Datei,
 *     in die wegen WAL ohnehin nichts geflossen wäre — er konnte gar nicht fehlschlagen).
 * Beide Phasen werden GETRENNT ausgewiesen. Vor WR-07 deckte der Nachweis genau die
 * riskante Phase A nicht mehr ab.
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
  /** WR-13: Tage, an denen `getDailyTargetHours()` MissingWorkPeriodError geworfen hat.
   *  Eigene Ergebniskategorie statt Abbruch beim ersten betroffenen Nutzer. */
  daysWithoutPeriod: number;
  /** Die ersten betroffenen Datumsangaben, damit der Befund nachvollziehbar ist. */
  firstMissingPeriodDates: string[];
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * WR-13: Größe der WAL-Datei neben der Hauptdatei, oder `null`, wenn keine existiert.
 *
 * Der SHA-256-Vergleich lief bisher ausschließlich über die HAUPTDATEI, und der Hash
 * wurde gebildet, BEVOR die geteilte Verbindung überhaupt geöffnet war. Die Verbindung
 * schaltet `journal_mode = WAL`: Schreibvorgänge landen dann zunächst in `<datei>-wal`,
 * die Hauptdatei bleibt bis zum Checkpoint byteweise identisch. Der Lauf konnte also
 * "Unversehrtheit: ja" melden, obwohl geschrieben wurde — der Nachweis war schwächer, als
 * er behauptete. Die WAL-Größe wird deshalb mitgeführt und mitgemeldet.
 */
function walSize(dbPath: string): number | null {
  const walPath = `${dbPath}-wal`;
  return existsSync(walPath) ? statSync(walPath).size : null;
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

  console.log('=== verifyPeriodNullEffect: Ausgangslage ===');
  console.log(`Aufgelöster Datenbankpfad: ${resolvedPath}`);
  console.log(`asOf: ${asOf}`);
  console.log(
    `Erwartete abweichende userIds: ${erwarteAbweichung.length > 0 ? JSON.stringify(erwarteAbweichung) : '(keine — Nullwirkung erwartet)'}`
  );
  console.log('');

  // WR-07 (Code-Review Phase 11, Durchlauf 2): ERSTE Messung — VOR dem dynamischen Import.
  //
  // WARUM: WR-13 hatte den Ausgangs-Hash bewusst HINTER `await import('../database/
  // connection.js')` verschoben, damit er WAL-fest ist. Dieser Import führt aber
  // `initializeDatabase()`, `createIndexes()` und `verifyIndexes()` aus
  // (`database/connection.ts:30-50`) — also `CREATE TABLE IF NOT EXISTS`,
  // `CREATE INDEX IF NOT EXISTS` und in der Folge Migrationen. Genau diese Phase ist der
  // EINZIGE Zeitpunkt, an dem dieses Werkzeug überhaupt schreiben kann; der Rest der Datei
  // enthält nachweislich kein `.run(`. Der Nachweis war nach WR-13 WAL-fest, prüfte aber
  // die Phase nicht mehr, die er prüfen sollte — eine andere Blindstelle, nicht keine.
  //
  // Jetzt werden BEIDE Phasen getrennt ausgewiesen:
  //   Phase A (hier bis nach dem Import) — Schemainitialisierung
  //   Phase B (nach dem Import bis zum Ende) — der eigentliche Messlauf, WAL-fest
  const fileSizeAtStart = statSync(resolvedPath).size;
  const shaAtStart = sha256File(resolvedPath);
  const walAtStart = walSize(resolvedPath);
  console.log(`Dateigröße (vor Verbindungsaufbau): ${fileSizeAtStart} Bytes`);
  console.log(`SHA-256 (vor Verbindungsaufbau): ${shaAtStart}`);
  console.log(
    `WAL-Größe (vor Verbindungsaufbau): ${walAtStart === null ? '(keine WAL-Datei)' : `${walAtStart} Bytes`}`
  );
  console.log('');

  // Erst JETZT, NACH dem Guard, werden die datenbankziehenden Module geladen.
  const { db } = await import('../database/connection.js');
  const { getDailyTargetHours, MissingWorkPeriodError } = await import('../utils/workingDays.js');
  const { createWorkPeriodContext } = await import('../services/workPeriodContext.js');
  const { formatDate } = await import('../utils/timezone.js');

  // WR-13: Der Ausgangs-Hash wird ERST HIER gebildet — nach dem Öffnen der Verbindung
  // (die beim Import `initializeDatabase()`/`createIndexes()` ausführt) und nach einem
  // vollständigen WAL-Checkpoint. Damit steht die gesamte Datenbank zum Messzeitpunkt in
  // der Hauptdatei, und `-wal` ist leer. Derselbe Checkpoint läuft am Ende noch einmal:
  // Hat dieses Werkzeug zwischendurch nichts geschrieben, bewegt der zweite Checkpoint
  // nichts und beide Hashes sind gleich. Vorher verglich der Lauf zwei Hashes einer
  // Datei, in die wegen WAL ohnehin nichts geflossen wäre — der Nachweis konnte gar
  // nicht fehlschlagen.
  db.pragma('wal_checkpoint(TRUNCATE)');
  const fileSizeBefore = statSync(resolvedPath).size;
  const shaBefore = sha256File(resolvedPath);
  const walBefore = walSize(resolvedPath);
  console.log(`Dateigröße (nach Schemainitialisierung, nach WAL-Checkpoint): ${fileSizeBefore} Bytes`);
  console.log(`SHA-256 (nach Schemainitialisierung, nach WAL-Checkpoint): ${shaBefore}`);
  console.log(`WAL-Größe (nach Schemainitialisierung): ${walBefore === null ? '(keine WAL-Datei)' : `${walBefore} Bytes`}`);
  console.log('');

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
      results.push({
        userId: row.id,
        hireDateMissing: true,
        daysChecked: 0,
        daysDeviating: 0,
        firstDeviations: [],
        daysWithoutPeriod: 0,
        firstMissingPeriodDates: [],
      });
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
    let daysWithoutPeriod = 0;
    const firstDeviations: DeviationEntry[] = [];
    const firstMissingPeriodDates: string[] = [];

    for (const dateStr of dateRange(row.hireDate, asOf, formatDate)) {
      // WR-13: `getDailyTargetHours()` kann seit D4 `MissingWorkPeriodError` werfen. Vorher
      // lief der Fehler ungefangen bis in `main().catch()` und beendete den GESAMTEN Lauf
      // mit "FATAL" — für ein Werkzeug, das den Bestand PRÜFEN soll, die falsche Reaktion:
      // Statt einer Liste der betroffenen Nutzer bekam man einen Abbruch beim ersten.
      // Jetzt eigene Ergebniskategorie, der Lauf geht weiter, die Zusammenfassung meldet es.
      let neu: number;
      try {
        neu = getDailyTargetHours(userForNeu, dateStr, periods);
      } catch (err) {
        if (err instanceof MissingWorkPeriodError) {
          // WR-07 (Durchlauf 2): Hier stand zusätzlich `daysChecked++`. An diesem Tag hat
          // aber KEIN Vergleich stattgefunden — `altDailyTargetHours()` wird nicht einmal
          // gerufen. Die Zahl "geprüfte Tage" war dadurch überzeichnet, und die Aussage
          // "0 Abweichungen" galt für eine kleinere Menge als angegeben. Der Tag zählt
          // jetzt ausschließlich in `daysWithoutPeriod`; die Zusammenfassung weist ihn als
          // Abzug aus.
          daysWithoutPeriod++;
          if (firstMissingPeriodDates.length < 20) {
            firstMissingPeriodDates.push(dateStr);
          }
          continue;
        }
        throw err;
      }
      const alt = altDailyTargetHours(db, row, dateStr);
      daysChecked++;
      if (neu !== alt) {
        daysDeviating++;
        if (firstDeviations.length < 20) {
          firstDeviations.push({ date: dateStr, alt, neu });
        }
      }
    }

    console.log(
      `userId=${row.id}: geprüfte Tage=${daysChecked}, abweichende Tage=${daysDeviating}, ` +
      `Tage ohne Periode=${daysWithoutPeriod}`
    );
    for (const dev of firstDeviations) {
      console.log(`  Abweichung ${dev.date}: ALT=${dev.alt} NEU=${dev.neu}`);
    }
    for (const d of firstMissingPeriodDates) {
      console.log(`  Periode fehlt ${d} (Datendefekt, D4)`);
    }

    results.push({
      userId: row.id,
      hireDateMissing: false,
      daysChecked,
      daysDeviating,
      firstDeviations,
      daysWithoutPeriod,
      firstMissingPeriodDates,
    });
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

  // WR-13: eigene Ergebniskategorie statt Abbruch beim ersten Nutzer.
  const usersWithoutPeriod = results.filter((r) => r.daysWithoutPeriod > 0);
  console.log(
    `Nutzer mit fehlender Arbeitszeitperiode (Datendefekt, D4): ${usersWithoutPeriod.length}` +
    (usersWithoutPeriod.length > 0 ? ` — userIds: ${JSON.stringify(usersWithoutPeriod.map((r) => r.userId))}` : '')
  );

  // WR-07: Tagesbilanz — "geprüfte Tage" und "übersprungene Tage" nebeneinander, damit
  // sichtbar bleibt, auf WELCHE Menge sich "0 Abweichungen" bezieht. Tage mit Datendefekt
  // sind aus der Abweichungszählung ausgenommen, weil `altDailyTargetHours()` für sie gar
  // nicht erst gerufen wird.
  const totalDaysChecked = results.reduce((sum, r) => sum + r.daysChecked, 0);
  const totalDaysWithoutPeriod = results.reduce((sum, r) => sum + r.daysWithoutPeriod, 0);
  console.log(
    `Tage verglichen: ${totalDaysChecked} — davon abweichend: ${results.reduce((s, r) => s + r.daysDeviating, 0)}`
  );
  console.log(
    `Tage NICHT verglichen (keine Periode, Abzug): ${totalDaysWithoutPeriod} ` +
    `— Summe betrachteter Tage: ${totalDaysChecked + totalDaysWithoutPeriod}`
  );

  db.pragma('wal_checkpoint(TRUNCATE)');
  const fileSizeAfter = statSync(resolvedPath).size;
  const shaAfter = sha256File(resolvedPath);
  const walAfter = walSize(resolvedPath);
  console.log('');
  console.log('=== Unversehrtheit, zwei getrennte Phasen (WR-07) ===');
  console.log(`Dateigröße (nach Lauf, nach WAL-Checkpoint): ${fileSizeAfter} Bytes`);
  console.log(`SHA-256 (nach Lauf, nach WAL-Checkpoint): ${shaAfter}`);
  console.log(`WAL-Größe (nach Lauf): ${walAfter === null ? '(keine WAL-Datei)' : `${walAfter} Bytes`}`);
  console.log('');
  console.log(
    `Phase B — Messlauf (nach Schemainitialisierung → Ende): ` +
    `${shaBefore === shaAfter ? 'unverändert' : 'VERÄNDERT — Werkzeug hat geschrieben'}`
  );

  // Phase A ist nur dann aussagekräftig, wenn beim Start keine WAL-Datei mit Inhalt
  // vorlag: Der Checkpoint nach dem Import faltet vorhandenen WAL-Inhalt in die Hauptdatei
  // und verändert ihren Hash, ohne dass DIESES Werkzeug etwas geschrieben hätte. Statt eine
  // nicht belegbare Aussage zu treffen, sagt das Werkzeug in diesem Fall ausdrücklich, dass
  // die Phase nicht beurteilt werden kann.
  const phaseAConclusive = walAtStart === null || walAtStart === 0;
  if (!phaseAConclusive) {
    console.log(
      `Phase A — Schemainitialisierung (Verbindungsaufbau): NICHT BEURTEILBAR — beim Start ` +
      `lagen ${walAtStart} Bytes WAL vor, die der Checkpoint in die Hauptdatei gefaltet hat.`
    );
  } else {
    console.log(
      `Phase A — Schemainitialisierung (Verbindungsaufbau): ` +
      `${shaAtStart === shaBefore ? 'unverändert' : 'VERÄNDERT — der Verbindungsaufbau hat geschrieben (CREATE TABLE/INDEX, Migrationen)'}`
    );
  }

  console.log(
    `Gesamturteil (nur bei beurteilbarer Phase A): ` +
    `${phaseAConclusive && shaAtStart === shaBefore && shaBefore === shaAfter ? 'ja — Datei unverändert' : 'siehe Phasen oben'}`
  );
  console.log('');

  if (usersWithoutPeriod.length > 0) {
    console.log('ERGEBNIS: Datendefekt — Nutzer ohne Arbeitszeitperiode gefunden (Exit 1).');
    process.exit(1);
  }

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
