/**
 * CLI: Hält den Saldenstand eines, mehrerer oder aller Nutzer als stabile JSON-Datei fest
 * (D6, 10-CONTEXT.md; 10-05-PLAN.md, Task 1).
 *
 * WARUM DIESES WERKZEUG EXISTIERT:
 * Phase 10 verspricht, dass die neue Perioden-Tabelle das bestehende Verhalten nicht
 * verändert (REQ-21). Eine Behauptung ist kein Nachweis — dieses Werkzeug erhebt den
 * Saldenstand aller Nutzer vor und nach einem Migrationslauf, damit ein Byte-Vergleich
 * beider Läufe die Nullwirkung tatsächlich belegt. Allgemein gebaut, nicht als
 * Wegwerfskript: Phase 11 (Umbau des Rechenwerks) und Phase 14 (Generalprobe gegen eine
 * Produktionskopie) verlangen denselben Nachweis erneut.
 *
 * `--all` LIEST UNGEFILTERT:
 * `SELECT id FROM users` ohne `WHERE deletedAt IS NULL` — anders als das Muster in
 * compareOvertimePaths.ts. Soft-gelöschte Nutzer bleiben Teil der Population, weil D5
 * verlangt, dass ihre Arbeitszeitperioden auflösbar bleiben. Ein Byte-Vergleich, der sie
 * ausspart, sähe grün aus, ohne die volle Population zu belegen.
 *
 * NUR NEBENWIRKUNGSFREIE BERECHNUNGSWEGE:
 * Manche Lesepfade im Projekt schreiben beim Lesen eigene Ausgleichszeilen, um fehlende
 * Monatssalden nachzutragen — genau das würde die hier gemessene Größe selbst verändern.
 * Dieses Werkzeug ruft ausschließlich den reinen Lesepfad in unifiedOvertimeService.ts auf
 * (kein INSERT, UPDATE oder DELETE in dieser Datei — vor jeder Verwendung per grep erneut
 * bestätigt statt vorausgesetzt).
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (zwingend, wie in compareOvertimePaths.ts und
 * productionGuard.ts begründet):
 *   1. Ausschließlich importsichere Module am Kopf: `fs`, `path`, `./productionGuard.js`,
 *      `../config/database.js` (löst nur Strings auf, öffnet keine Datenbank).
 *   2. Argumentauswertung.
 *   3. `assertNotProduction()` — synchron, bevor irgendetwas geöffnet wird.
 *   4. Erst danach `await import('../database/connection.js')` und
 *      `await import('../services/unifiedOvertimeService.js')` innerhalb von `main()`.
 * `server/package.json` setzt `"type": "module"`, `tsconfig.json` `"module": "ESNext"`,
 * Start über `tsx` — `await import()` bleibt damit ein echter dynamischer Import.
 *
 * DATABASE_PATH IST PFLICHT, KEIN STILLER RÜCKFALL:
 * `getDatabasePath()` würde ohne gesetzte Umgebungsvariable auf die lokale
 * Entwicklungsdatenbank zurückfallen. Für einen Nullwirkungs-Nachweis muss der Aufrufer
 * die Datei ausdrücklich benennen — ein stiller Rückfall widerspräche Punkt 3 der
 * Empfehlung aus `.planning/notes/db-pfad-diskrepanz-20260821.md`. Deshalb wird
 * `process.env.DATABASE_PATH` hier direkt geprüft, nicht nur `getDatabasePath()` aufgerufen.
 */

import { existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';

const TOOL_VERSION = '1.0.0';

// ---------------------------------------------------------------------------------------
// Argumentauswertung
// ---------------------------------------------------------------------------------------

type Selection =
  | { mode: 'all' }
  | { mode: 'ids'; userIds: number[] };

interface CliOptions {
  selection: Selection;
  asOf: string;
  jsonPath: string;
}

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error(
    '  npm run snapshot:balances -- --all --asOf=<YYYY-MM-DD> --json=<pfad>'
  );
  console.error(
    '  npm run snapshot:balances -- --user=<id> --asOf=<YYYY-MM-DD> --json=<pfad>'
  );
  console.error(
    '  npm run snapshot:balances -- --users=<id,id,...> --asOf=<YYYY-MM-DD> --json=<pfad>'
  );
  console.error('');
  console.error('  Genau eines aus --all/--user/--users ist Pflicht.');
  console.error('  --asOf ist Pflicht, kein Rückfall auf das heutige Datum.');
  console.error('  --json ist Pflicht.');
  console.error(
    '  DATABASE_PATH muss gesetzt sein, kein stiller Rückfall auf database/development.db.'
  );
  process.exit(2);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^\d+$/;

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  let allFlag = false;
  let userArg: string | undefined;
  let usersArg: string | undefined;
  let asOf: string | undefined;
  let jsonPath: string | undefined;

  for (const arg of args) {
    if (arg === '--all') {
      allFlag = true;
    } else if (arg.startsWith('--user=')) {
      userArg = arg.slice('--user='.length);
    } else if (arg.startsWith('--users=')) {
      usersArg = arg.slice('--users='.length);
    } else if (arg.startsWith('--asOf=')) {
      asOf = arg.slice('--asOf='.length);
    } else if (arg.startsWith('--json=')) {
      jsonPath = arg.slice('--json='.length);
    }
  }

  const selectionFlagsProvided = [allFlag, userArg !== undefined, usersArg !== undefined].filter(
    Boolean
  ).length;

  if (selectionFlagsProvided !== 1) {
    printUsageAndExit('genau eines aus --all/--user/--users ist Pflicht.');
  }

  let selection: Selection;
  if (allFlag) {
    selection = { mode: 'all' };
  } else if (userArg !== undefined) {
    if (!ID_PATTERN.test(userArg)) {
      printUsageAndExit(`--user muss eine positive Ganzzahl sein, erhalten: "${userArg}".`);
    }
    selection = { mode: 'ids', userIds: [parseInt(userArg, 10)] };
  } else {
    const rawIds = (usersArg as string).split(',').map((s) => s.trim());
    const userIds: number[] = [];
    for (const raw of rawIds) {
      if (!ID_PATTERN.test(raw)) {
        printUsageAndExit(`--users enthält keine gültige Ganzzahl: "${raw}".`);
      }
      userIds.push(parseInt(raw, 10));
    }
    if (userIds.length === 0) {
      printUsageAndExit('--users enthält keine Nutzer-ID.');
    }
    selection = { mode: 'ids', userIds: Array.from(new Set(userIds)) };
  }

  if (!asOf) {
    printUsageAndExit('--asOf=<YYYY-MM-DD> fehlt. Kein Rückfall auf das heutige Datum.');
  }
  if (!DATE_PATTERN.test(asOf)) {
    printUsageAndExit(`--asOf muss dem Format YYYY-MM-DD entsprechen, erhalten: "${asOf}".`);
  }

  if (!jsonPath) {
    printUsageAndExit('--json=<pfad> fehlt.');
  }

  return { selection, asOf, jsonPath };
}

// ---------------------------------------------------------------------------------------
// Ausgabepfad der Vergleichsdatei (nur das users-Array)
// ---------------------------------------------------------------------------------------

function deriveUsersOnlyPath(jsonPath: string): string {
  if (jsonPath.endsWith('.json')) {
    return `${jsonPath.slice(0, -'.json'.length)}.users.json`;
  }
  return `${jsonPath}.users.json`;
}

// ---------------------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const { selection, asOf, jsonPath } = parseArgs();

  // DATABASE_PATH ist Pflicht — kein Rückfall auf getDatabasePath()s interne Standardwahl.
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error(
      '  Ohne DATABASE_PATH fällt dieses Werkzeug NICHT still auf database/development.db zurück.'
    );
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-datenbank> explizit.');
    process.exit(2);
  }

  // Guard VOR jedem Datenbankzugriff — synchron, bevor irgendein schreibendes Modul
  // geladen wird.
  assertNotProduction();

  const resolvedPath = path.resolve(getDatabasePath());

  if (!existsSync(resolvedPath)) {
    console.error(`FEHLER: Datenbankdatei existiert nicht: ${resolvedPath}`);
    process.exit(2);
  }

  const fileSizeBytes = statSync(resolvedPath).size;

  // Erst JETZT, NACH dem Guard, wird die Datenbankverbindung geöffnet und der
  // Berechnungsweg geladen.
  const { db } = await import('../database/connection.js');
  const { unifiedOvertimeService } = await import('../services/unifiedOvertimeService.js');

  try {
    const totalUsersRow = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };

    const uwpTableExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_work_periods'`)
      .get();
    const uwpCount = uwpTableExists
      ? (db.prepare('SELECT COUNT(*) as c FROM user_work_periods').get() as { c: number }).c
      : 0;

    console.log('=== snapshotBalances: Ausgangslage ===');
    console.log(`Aufgelöster Datenbankpfad: ${resolvedPath}`);
    console.log(`Dateigröße: ${fileSizeBytes} Bytes`);
    console.log(`Anzahl Zeilen in users (ungefiltert): ${totalUsersRow.c}`);
    console.log(`Anzahl Zeilen in user_work_periods: ${uwpCount}`);
    console.log(`asOf: ${asOf}`);
    console.log('');

    // Nutzerliste bestimmen — im --all-Fall ausdrücklich ungefiltert, sortiert nach
    // userId aufsteigend.
    let userIds: number[];
    if (selection.mode === 'all') {
      const rows = db.prepare('SELECT id FROM users ORDER BY id ASC').all() as Array<{
        id: number;
      }>;
      userIds = rows.map((r) => r.id);
    } else {
      for (const id of selection.userIds) {
        const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(id);
        if (!exists) {
          console.error(`FEHLER: Nutzer ${id} existiert nicht in dieser Datenbank.`);
          process.exit(2);
        }
      }
      userIds = [...selection.userIds].sort((a, b) => a - b);
    }

    const users = userIds.map((userId) => collectUser(db, unifiedOvertimeService, userId, asOf));

    // Abnahmekriterium: im --all-Fall muss die Länge des users-Arrays mit der ungefilterten
    // Zeilenzahl von users übereinstimmen — sonst wäre die Population nicht vollständig.
    if (selection.mode === 'all' && users.length !== totalUsersRow.c) {
      throw new Error(
        `Interner Fehler: ${users.length} Nutzer im Snapshot erhoben, aber ${totalUsersRow.c} ` +
          'Zeilen ungefiltert in users — die Population ist nicht vollständig.'
      );
    }
    console.log(
      `Zeilenzahl users (ungefiltert): ${totalUsersRow.c}; Länge users[] im Snapshot: ${users.length}` +
        (selection.mode === 'all' ? ' — stimmen überein.' : ' (Auswahl, kein --all-Lauf).')
    );

    const output = {
      generatedAt: new Date().toISOString(),
      databasePath: resolvedPath,
      asOf,
      toolVersion: TOOL_VERSION,
      users,
    };

    const jsonDir = path.dirname(jsonPath);
    if (jsonDir && !existsSync(jsonDir)) {
      mkdirSync(jsonDir, { recursive: true });
    }
    writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
    console.log(`Vollständige Datei geschrieben: ${jsonPath}`);

    const usersOnlyPath = deriveUsersOnlyPath(jsonPath);
    writeFileSync(usersOnlyPath, `${JSON.stringify(users, null, 2)}\n`, 'utf-8');
    console.log(`Vergleichsdatei (nur users-Array) geschrieben: ${usersOnlyPath}`);

    console.log('');
    console.log('ERGEBNIS: Snapshot erhoben (Exit 0).');
    process.exit(0);
  } catch (err) {
    console.error('FEHLER während der Erhebung:', err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------
// Erhebung je Nutzer
// ---------------------------------------------------------------------------------------

interface UserSnapshot {
  userId: number;
  masterData: {
    hireDate: string | null;
    endDate: string | null;
    status: string | null;
    deletedAt: string | null;
    weeklyHours: number | null;
    workSchedule: string | null;
  };
  overtimePeriod: {
    startDate: string;
    endDate: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
    breakdown: {
      worked: number;
      absenceCredits: number;
      corrections: number;
      unpaidReduction: number;
    };
  } | null;
  overtimeError: string | null;
  overtimeBalanceRows: Array<{
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
    carryoverFromPreviousYear: number | null;
  }>;
  vacationYears: Array<{
    year: number;
    balance: {
      entitlement: number;
      carryover: number | null;
      taken: number | null;
      remaining: number;
    } | null;
    transactionsSum: number;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectUser(db: any, unifiedOvertimeService: any, userId: number, asOf: string): UserSnapshot {
  // Stammdaten ausdrücklich ungefiltert (kein "WHERE deletedAt IS NULL") — D5 verlangt, dass
  // auch soft-gelöschte Nutzer Teil des Nachweises bleiben. workSchedule bleibt Rohtext.
  const masterRow = db
    .prepare(
      `SELECT hireDate, endDate, status, deletedAt, weeklyHours, workSchedule
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        hireDate: string | null;
        endDate: string | null;
        status: string | null;
        deletedAt: string | null;
        weeklyHours: number | null;
        workSchedule: string | null;
      }
    | undefined;

  if (!masterRow) {
    throw new Error(`Nutzer ${userId} existiert nicht in users — Erhebung abgebrochen.`);
  }

  let overtimePeriod: UserSnapshot['overtimePeriod'] = null;
  let overtimeError: string | null = null;

  if (masterRow.hireDate) {
    try {
      const result = unifiedOvertimeService.calculatePeriodOvertime(
        userId,
        masterRow.hireDate,
        asOf
      );
      overtimePeriod = {
        startDate: result.startDate,
        endDate: result.endDate,
        targetHours: result.targetHours,
        actualHours: result.actualHours,
        overtime: result.overtime,
        breakdown: result.breakdown,
      };
    } catch (err) {
      // Der kanonische Lesepfad löst Nutzer nur unter denselben Bedingungen auf, unter denen
      // auch die aktive Anwendung sie zeigt (kein soft-gelöschter Nutzer) — deshalb wirft er
      // für die beiden Nutzer mit gesetztem deletedAt erwartbar "not found". Das ist kein
      // Fehler dieses Werkzeugs: Die Stammdaten (oben) bleiben für diese Nutzer trotzdem Teil
      // der Population (Abnahmekriterium), nur die Überstundenberechnung bleibt für sie leer,
      // mit der Fehlermeldung wörtlich festgehalten statt verschluckt.
      overtimeError = (err as Error).message;
    }
  } else {
    overtimeError = `Nutzer ${userId} hat kein hireDate — Überstundenberechnung übersprungen.`;
  }

  const overtimeBalanceRows = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime, carryoverFromPreviousYear
       FROM overtime_balance WHERE userId = ? ORDER BY month ASC`
    )
    .all(userId) as UserSnapshot['overtimeBalanceRows'];

  const yearRows = db
    .prepare(
      `SELECT year FROM (
         SELECT year FROM vacation_balance WHERE userId = ?
         UNION
         SELECT year FROM vacation_transactions WHERE userId = ?
       ) ORDER BY year ASC`
    )
    .all(userId, userId) as Array<{ year: number }>;

  const vacationYears = yearRows.map(({ year }) => {
    const balance = db
      .prepare(
        `SELECT entitlement, carryover, taken, remaining
         FROM vacation_balance WHERE userId = ? AND year = ?`
      )
      .get(userId, year) as
      | { entitlement: number; carryover: number | null; taken: number | null; remaining: number }
      | undefined;

    const sumRow = db
      .prepare(
        `SELECT COALESCE(SUM(days), 0) as total FROM vacation_transactions
         WHERE userId = ? AND year = ?`
      )
      .get(userId, year) as { total: number };

    return {
      year,
      balance: balance ?? null,
      transactionsSum: sumRow.total,
    };
  });

  return {
    userId,
    masterData: {
      hireDate: masterRow.hireDate,
      endDate: masterRow.endDate,
      status: masterRow.status,
      deletedAt: masterRow.deletedAt,
      weeklyHours: masterRow.weeklyHours,
      workSchedule: masterRow.workSchedule,
    },
    overtimePeriod,
    overtimeError,
    overtimeBalanceRows,
    vacationYears,
  };
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
