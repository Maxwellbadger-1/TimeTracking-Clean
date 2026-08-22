/**
 * CLI: Legt einen künstlichen Nutzer mit einem echten Modellwechsel mitten im Monat an
 * (D6, 11-CONTEXT.md; 11-09-PLAN.md, Task 3).
 *
 * WARUM DIESES WERKZEUG EXISTIERT:
 * REQ-24 verlangt den Nachweis, dass ein zweifacher Rebuild über einen Zeitraum mit
 * Modellwechsel dieselben Daten liefert. Der bestehende Datenbestand (`11-nullwirkung.db`,
 * 20 Nutzer) hat laut `11-AUSGANGSZUSTAND.md` für KEINEN Nutzer mehr als eine Periode — ein
 * Idempotenznachweis gegen diesen Bestand würde also gar keinen Modellwechsel prüfen.
 * Dieses Skript legt deshalb einen eigenen, künstlichen Nutzer mit einem echten
 * Periodenwechsel mitten im Monat an. Bewusst wiederverwendbar, kein Wegwerfblock: Plan 11-10
 * legt damit denselben Nutzer für den Wirkungsnachweis an (D6), Phase 14 wird ihn erneut
 * brauchen.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (zwingend, Muster aus `snapshotBalances.ts`):
 *   1. Ausschließlich importsichere Module am Kopf: `path`, `./productionGuard.js`,
 *      `../config/database.js` (löst nur Strings auf, öffnet keine Datenbank).
 *   2. Argumentauswertung.
 *   3. Eigene Pfadprüfung gegen `11-nullwirkung.db` — eine eigene Prüfung mit eigener
 *      Fehlermeldung, kein Kommentar. Diese Kopie trägt Snapshot A für Plan 11-10; jeder
 *      Schreibzugriff hier entwertet den Nachweis unwiederbringlich.
 *   4. `assertNotProduction()` — synchron, bevor irgendetwas geöffnet wird.
 *   5. Erst danach `await import(...)` der datenbankziehenden Module innerhalb von `main()`.
 * `server/package.json` setzt `"type": "module"`, `tsconfig.json` `"module": "ESNext"`,
 * Start über `tsx` — `await import()` bleibt damit ein echter dynamischer Import.
 *
 * DATABASE_PATH IST PFLICHT, KEIN STILLER RÜCKFALL — wie in `snapshotBalances.ts` begründet:
 * ein stiller Rückfall auf `database/development.db` widerspräche der Absicht, ausdrücklich
 * gegen eine benannte Arbeitskopie zu schreiben.
 *
 * KEIN ZWEITER SCHREIBWEG FÜR NUTZER/PERIODEN: Ausschließlich `createUser()`
 * (`userService.ts`) legt den Nutzer UND seine Startperiode an (die Funktion tut das bereits
 * intern, in einer Transaktion). Der Modellwechsel selbst entsteht ausschließlich über
 * `closeWorkPeriod()` + `createWorkPeriod()` (`workPeriodService.ts`) — kein direktes,
 * eigenes SQL gegen die Nutzer- oder Perioden-Tabelle in dieser Datei.
 *
 * ZEITZONENFREIHEIT IST STRUKTURELL: Kein `new Date('YYYY-MM-DD')` (parst als UTC-Mitternacht
 * und hat in Phase 9 systemisch den letzten Kalendertag jedes Monats verschluckt). Datumswerte
 * werden ausschließlich als Zeichenketten geführt; wo ein Tageslauf nötig ist,
 * `formatDate(date, 'yyyy-MM-dd')` aus `server/src/utils/timezone.ts`. Die verbotene
 * String-zu-Date-Serialisierung über die veraltete ISO-Methode kommt in dieser Datei nicht
 * vor.
 *
 * IDEMPOTENZ: Ein zweiter Lauf mit denselben Argumenten legt keinen zweiten Nutzer an,
 * sondern erkennt den vorhandenen (deterministischer `username`, kein Zeitstempel-Suffix) und
 * beendet sich mit Exit 0.
 */

import path from 'path';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';
// Ausschließlich Typ-Importe für Werte, die transitiv die Datenbank öffnen würden — ein
// Werte-Import von 'userService.js'/'workPeriodService.js' liefe über
// '../database/connection.js' und öffnete die Datenbankdatei, bevor die Guards oben gelaufen
// sind (dieselbe Begründung wie in `snapshotBalances.ts`).
import type { UserPublic, UserWorkPeriod } from '../types/index.js';
import type { PeriodChainCheckResult } from '../services/workPeriodService.js';

const TOOL_VERSION = '1.0.0';
const USERNAME_PREFIX = 't1109-modellwechsel-';

// ---------------------------------------------------------------------------------------
// Argumentauswertung
// ---------------------------------------------------------------------------------------

interface CliOptions {
  hireDate: string;
  stichtag: string;
  weeklyHoursBefore: number;
  weeklyHoursAfter: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error(
    '  npm run seed:model-change -- [--hireDate=<YYYY-MM-DD>] [--stichtag=<YYYY-MM-DD>] ' +
      '[--weeklyHoursBefore=<n>] [--weeklyHoursAfter=<n>]'
  );
  console.error('');
  console.error('  Vorgabewerte: hireDate=2025-01-01, stichtag=2026-05-14 (Donnerstag,');
  console.error('  mitten im Monat, D6), weeklyHoursBefore=40, weeklyHoursAfter=20.');
  console.error('  DATABASE_PATH muss gesetzt sein, kein stiller Rückfall auf database/development.db.');
  process.exit(2);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  let hireDate = '2025-01-01';
  let stichtag = '2026-05-14';
  let weeklyHoursBefore = 40;
  let weeklyHoursAfter = 20;

  for (const arg of args) {
    if (arg.startsWith('--hireDate=')) {
      hireDate = arg.slice('--hireDate='.length);
    } else if (arg.startsWith('--stichtag=')) {
      stichtag = arg.slice('--stichtag='.length);
    } else if (arg.startsWith('--weeklyHoursBefore=')) {
      weeklyHoursBefore = Number(arg.slice('--weeklyHoursBefore='.length));
    } else if (arg.startsWith('--weeklyHoursAfter=')) {
      weeklyHoursAfter = Number(arg.slice('--weeklyHoursAfter='.length));
    }
  }

  if (!DATE_PATTERN.test(hireDate)) {
    printUsageAndExit(`--hireDate muss dem Format YYYY-MM-DD entsprechen, erhalten: "${hireDate}".`);
  }
  if (!DATE_PATTERN.test(stichtag)) {
    printUsageAndExit(`--stichtag muss dem Format YYYY-MM-DD entsprechen, erhalten: "${stichtag}".`);
  }
  if (hireDate >= stichtag) {
    printUsageAndExit(
      `--hireDate (${hireDate}) muss deutlich vor --stichtag (${stichtag}) liegen.`
    );
  }
  if (!Number.isFinite(weeklyHoursBefore) || weeklyHoursBefore < 0 || weeklyHoursBefore > 80) {
    printUsageAndExit(`--weeklyHoursBefore muss zwischen 0 und 80 liegen, erhalten: "${weeklyHoursBefore}".`);
  }
  if (!Number.isFinite(weeklyHoursAfter) || weeklyHoursAfter < 0 || weeklyHoursAfter > 80) {
    printUsageAndExit(`--weeklyHoursAfter muss zwischen 0 und 80 liegen, erhalten: "${weeklyHoursAfter}".`);
  }
  if (weeklyHoursBefore === weeklyHoursAfter) {
    printUsageAndExit(
      'weeklyHoursBefore und weeklyHoursAfter dürfen sich nicht gleichen — sonst prüft der ' +
        'Nachweis keinen wirksamen Modellwechsel (T-11-34).'
    );
  }

  return { hireDate, stichtag, weeklyHoursBefore, weeklyHoursAfter };
}

function usernameFor(stichtag: string): string {
  return `${USERNAME_PREFIX}${stichtag}`;
}

// ---------------------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs();

  // DATABASE_PATH ist Pflicht — kein Rückfall auf getDatabasePath()s interne Standardwahl.
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error(
      '  Ohne DATABASE_PATH fällt dieses Werkzeug NICHT still auf database/development.db zurück.'
    );
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-datenbank> explizit.');
    process.exit(2);
  }

  const resolvedPath = path.resolve(getDatabasePath());

  // Eigene Prüfung mit eigener Fehlermeldung (T-11-32): 11-nullwirkung.db trägt Snapshot A
  // für Plan 11-10 und darf durch dieses Skript unter keinen Umständen beschrieben werden.
  if (path.basename(resolvedPath) === '11-nullwirkung.db') {
    console.error('FEHLER: Schreibzugriff auf 11-nullwirkung.db verweigert (T-11-32, 11-09-PLAN.md).');
    console.error(`  Aufgelöster Datenbankpfad: ${resolvedPath}`);
    console.error(
      '  Diese Arbeitskopie trägt Snapshot A für den Nullwirkungs-Nachweis in Plan 11-10 — ' +
        'nach dem Umbau existiert der Vor-Umbau-Code nicht mehr, ein Schreibzugriff hier ' +
        'entwertet den Nachweis unwiederbringlich.'
    );
    console.error(
      '  Nutze DATABASE_PATH=./database/11-modellwechsel.db (oder eine andere, ausdrücklich ' +
        'benannte Arbeitskopie).'
    );
    process.exit(2);
  }

  // Guard VOR jedem Datenbankzugriff — synchron, bevor irgendein schreibendes Modul geladen
  // wird.
  assertNotProduction();

  console.log(`=== seedModelChangeUser v${TOOL_VERSION} ===`);
  console.log(`Aufgelöster Datenbankpfad: ${resolvedPath}`);
  console.log(`hireDate: ${options.hireDate}, stichtag: ${options.stichtag}`);
  console.log(`weeklyHoursBefore: ${options.weeklyHoursBefore}, weeklyHoursAfter: ${options.weeklyHoursAfter}`);
  console.log('');

  // Erst JETZT, NACH beiden Guards, werden die datenbankziehenden Module geladen.
  const { db } = await import('../database/connection.js');
  const { createUser, getUserById } = await import('../services/userService.js');
  const { getWorkPeriods, closeWorkPeriod, createWorkPeriod, checkPeriodChain } = await import(
    '../services/workPeriodService.js'
  );
  const { formatDate } = await import('../utils/timezone.js');

  const username = usernameFor(options.stichtag);

  // IDEMPOTENZ: Existiert der Nutzer bereits, wird NICHT erneut angelegt — der vorhandene
  // Zustand wird gemeldet, Exit 0.
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as
    | { id: number }
    | undefined;

  let userId: number;
  let createdNow: boolean;

  if (existing) {
    userId = existing.id;
    createdNow = false;
    console.log(`Nutzer existiert bereits: userId=${userId} (username=${username}). Kein zweiter Lauf nötig.`);
  } else {
    createdNow = true;
    const user: UserPublic = await createUser({
      username,
      email: `${username}@test.local`,
      password: 'ModellwechselTest12345!',
      firstName: 'Modellwechsel',
      lastName: 'Testnutzer',
      role: 'employee',
      weeklyHours: options.weeklyHoursBefore,
      workSchedule: null,
      hireDate: options.hireDate,
      vacationDaysPerYear: 30,
    });
    userId = user.id;
    console.log(`Nutzer angelegt: userId=${userId} (username=${username}).`);

    // Der Zweischritt für den Stichtagswechsel: die von createUser() bereits angelegte
    // Startperiode zum Stichtag schließen, dann die Folgeperiode mit dem neuen Modell
    // anlegen. Kein eigener Schreibweg — ausschließlich closeWorkPeriod()/createWorkPeriod().
    const periodsBeforeChange = getWorkPeriods(userId);
    const openPeriod = periodsBeforeChange.find((p) => p.validTo === null);
    if (!openPeriod) {
      throw new Error(
        `Interner Fehler: Nutzer ${userId} hat nach createUser() keine offene Startperiode.`
      );
    }

    closeWorkPeriod(openPeriod.id, options.stichtag);
    createWorkPeriod({
      userId,
      validFrom: options.stichtag,
      validTo: null,
      weeklyHours: options.weeklyHoursAfter,
      workSchedule: null,
      note: `[SEED-11-09] Modellwechsel zum Stichtag ${options.stichtag} (${options.weeklyHoursBefore}h → ${options.weeklyHoursAfter}h)`,
      createdBy: null,
    });

    // Zeiteinträge: für jeden Werktag (Mo-Fr) im Stichtagsmonat ein Eintrag, damit der
    // Rebuild überhaupt etwas zu rechnen hat. Direktes INSERT (wie in
    // `add2026TimeEntries.ts`) statt `createTimeEntry()`, weil dieses Skript keine
    // Serverlaufzeit (WebSocket-Broadcast, ArbZG-Validierung) voraussetzen soll — reine
    // Fixture-Erzeugung. 8 Stunden je Werktag, 08:00-16:00, kein Zeitzonenanteil (Uhrzeiten
    // als reine Zeichenketten, kein Date-Konstruktor).
    const [year, monthNum] = options.stichtag.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const insertEntry = db.prepare(`
      INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, activity, location, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    let entriesCreated = 0;
    const insertAll = db.transaction(() => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${String(year)}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Wochentag rein aus den Zahlen bestimmen: Date-Konstruktor mit lokalen
        // Ganzzahl-Komponenten (Jahr, Monat-1, Tag) — kein String-Parsing des Datums, keine
        // Serialisierung über die veraltete ISO-Methode.
        const dow = new Date(year, monthNum - 1, day).getDay();
        if (dow === 0 || dow === 6) continue; // Wochenende überspringen
        if (dateStr < options.hireDate) continue; // vor Eintritt (hier irrelevant, Absicherung)
        insertEntry.run(
          userId,
          dateStr,
          `${dateStr}T08:00:00`,
          `${dateStr}T16:00:00`,
          0,
          8,
          'Modellwechsel-Fixture (11-09)',
          'office'
        );
        entriesCreated++;
      }
    });
    insertAll();
    console.log(
      `Zeiteinträge erzeugt: ${entriesCreated} (jeder Werktag im Monat ${String(monthNum).padStart(2, '0')}/${year}, 8h, 08:00-16:00, location=office).`
    );
  }

  // Ausgabe: userId, beide Perioden, checkPeriodChain-Ergebnis.
  const finalPeriods: UserWorkPeriod[] = getWorkPeriods(userId);
  console.log('');
  console.log(`userId: ${userId}`);
  console.log('Perioden:');
  for (const p of finalPeriods) {
    console.log(
      `  id=${p.id} validFrom=${p.validFrom} validTo=${p.validTo ?? 'null (laufend)'} weeklyHours=${p.weeklyHours}`
    );
  }
  const chainResult: PeriodChainCheckResult = checkPeriodChain(userId);
  console.log(`checkPeriodChain(${userId}): ${JSON.stringify(chainResult)}`);

  const user = getUserById(userId);
  console.log(`hireDate: ${user?.hireDate ?? '(unbekannt)'}`);
  console.log(`Erzeugt in diesem Lauf: ${createdNow ? 'ja' : 'nein (bereits vorhanden)'}`);
  console.log(`Referenzdatum dieses Laufs (Europe/Berlin): ${formatDate(new Date(), 'yyyy-MM-dd')}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('FEHLER:', err);
  process.exit(1);
});
