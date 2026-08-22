/**
 * CLI: Fährt den bestehenden `migrationRunner` gegen eine ausdrücklich per `--db` benannte
 * Kopie der Datenbank (10-02-PLAN.md, Task 2, Teil B).
 *
 * WARUM DIESES WERKZEUG EXISTIERT:
 * `runMigrations()` aus `server/src/database/migrationRunner.ts` wird ausschließlich beim
 * Serverstart aufgerufen (`server.ts:210`). `npm run migrate` bedient ein zweites,
 * unabhängiges System (SQL-Dateien unter `server/database/migrations` über
 * `scripts/migrate.ts`). Ohne dieses Werkzeug ist die von der ROADMAP verlangte Generalprobe
 * — Migration läuft auf einer Kopie der Produktionsdaten durch, `integrity_check: ok` — nicht
 * durchführbar. Allgemein gebaut, nicht als Wegwerfskript: Phase 11 und Phase 14 brauchen
 * denselben Weg erneut.
 *
 * PFLICHTARGUMENT --db, KEIN RÜCKFALL:
 * `--db=<pfad>` ist Pflicht. Ohne das Argument bricht dieses Werkzeug mit Exit 2 ab und
 * nennt die Nutzung — es fällt NIEMALS auf `getDatabasePath()` zurück. Ein Fehlgriff ohne
 * gesetzten Pfad lief bereits einmal still gegen die falsche Datenbank
 * (`.planning/debug/db-stabilisierung-20260818.md`, 18.08.2026); dieses Werkzeug wiederholt
 * diesen Fehler nicht.
 *
 * REIHENFOLGE (zwingend, wie in compareOvertimePaths.ts und productionGuard.ts begründet):
 *   1. Ausschließlich importsichere Module am Kopf: `fs`, `path`, `better-sqlite3` (das
 *      Öffnen einer Datei passiert erst bei `new Database(...)`, nicht beim Import des
 *      Pakets), `./productionGuard.js` und `../database/migrationRunner.js` (importiert
 *      selbst kein Connection-Modul, siehe migrationRunner.ts:1-8 — keine Datenbank wird
 *      beim Import geöffnet).
 *   2. Argumentauswertung.
 *   3. `assertNotProduction(aufgelösterPfad)` — synchron, bevor irgendetwas geöffnet wird.
 *   4. Erst danach `new Database(pfad)`.
 *
 * `server/package.json` setzt `"type": "module"`, `tsconfig.json` `"module": "ESNext"`,
 * Start über `tsx` — dynamische wie statische Importe bleiben damit echte ESM-Importe.
 */

import { existsSync, statSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { assertNotProduction } from './productionGuard.js';
import { runMigrations } from '../database/migrationRunner.js';

// ---------------------------------------------------------------------------------------
// Argumentauswertung
// ---------------------------------------------------------------------------------------

interface CliOptions {
  dbPath: string;
  expectMigration?: string;
}

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error(
    '  npm run migrate:copy -- --db=<pfad-zu-einer-kopie> [--expect-migration=<name>]'
  );
  console.error('');
  console.error(
    '  --db ist Pflicht und fällt NIEMALS auf die Arbeits- oder Produktionsdatenbank zurück.'
  );
  process.exit(2);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let dbPath: string | undefined;
  let expectMigration: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--db=')) {
      dbPath = arg.slice('--db='.length);
    } else if (arg === '--db' && args[i + 1]) {
      dbPath = args[++i];
    } else if (arg.startsWith('--expect-migration=')) {
      expectMigration = arg.slice('--expect-migration='.length);
    } else if (arg === '--expect-migration' && args[i + 1]) {
      expectMigration = args[++i];
    }
  }

  if (!dbPath) {
    printUsageAndExit('--db=<pfad> fehlt.');
  }

  return { dbPath, expectMigration };
}

// ---------------------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------------------

function getAppliedMigrations(db: Database.Database): string[] {
  const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`)
    .get();
  if (!tableExists) {
    return [];
  }
  const rows = db.prepare('SELECT name FROM migrations ORDER BY id').all() as Array<{
    name: string;
  }>;
  return rows.map((r) => r.name);
}

// ---------------------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dbPath, expectMigration } = parseArgs();
  const resolvedPath = path.resolve(dbPath);

  // Guard VOR jedem Datenbankzugriff — synchron, mit dem ausdrücklich benannten Pfad.
  assertNotProduction(resolvedPath);

  // Zusätzlicher Riegel: ein nicht existierender Pfad ist ein Bedienfehler, keine Einladung,
  // eine leere Datenbank anzulegen (better-sqlite3 würde das sonst klaglos tun).
  if (!existsSync(resolvedPath)) {
    console.error(`FEHLER: Datei existiert nicht: ${resolvedPath}`);
    console.error('  --db muss auf eine bestehende Kopie zeigen, keine neue Datei wird angelegt.');
    process.exit(2);
  }

  const fileSizeBytes = statSync(resolvedPath).size;

  const db = new Database(resolvedPath);

  // Kein journal_mode-Wechsel: die Kopie soll bleiben, wie sie ist. foreign_keys wird
  // gesetzt und zurückgelesen (Empfehlung 3, db-pfad-diskrepanz-20260821.md — ein Fehlgriff
  // soll sofort sichtbar sein statt still zu bleiben).
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true });

  const activeUserCountRow = db.prepare('SELECT COUNT(*) as c FROM users').get() as {
    c: number;
  };
  const migrationsBefore = getAppliedMigrations(db);

  console.log('=== applyMigrationsToCopy: vor dem Lauf ===');
  console.log(`Aufgelöster Pfad: ${resolvedPath}`);
  console.log(`Dateigröße: ${fileSizeBytes} Bytes`);
  console.log(`Nutzerzahl (users): ${activeUserCountRow.c}`);
  console.log(`PRAGMA foreign_keys: ${fkStatus}`);
  console.log(
    `Bereits angewendete Migrationen (${migrationsBefore.length}): ${
      migrationsBefore.length > 0 ? migrationsBefore.join(', ') : '(keine)'
    }`
  );
  console.log('');

  await runMigrations(db);

  const migrationsAfter = getAppliedMigrations(db);
  const newlyApplied = migrationsAfter.filter((name) => !migrationsBefore.includes(name));

  const integrityRows = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
  const integrityResult = integrityRows.map((r) => r.integrity_check).join('; ');
  const integrityOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';

  const foreignKeyIssues = db.pragma('foreign_key_check') as unknown[];

  let userWorkPeriodsRowCount: number | null = null;
  const uwpTableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_work_periods'`)
    .get();
  if (uwpTableExists) {
    userWorkPeriodsRowCount = (
      db.prepare('SELECT COUNT(*) as c FROM user_work_periods').get() as { c: number }
    ).c;
  }

  console.log('=== applyMigrationsToCopy: nach dem Lauf ===');
  console.log(
    `Neu angewendete Migrationen (${newlyApplied.length}): ${
      newlyApplied.length > 0 ? newlyApplied.join(', ') : '(keine)'
    }`
  );
  console.log(`integrity_check: ${integrityResult}`);
  console.log(
    `foreign_key_check: ${
      foreignKeyIssues.length === 0 ? '(leer, keine Verstöße)' : JSON.stringify(foreignKeyIssues)
    }`
  );
  console.log(
    `user_work_periods: ${
      userWorkPeriodsRowCount === null ? 'Tabelle existiert nicht' : `${userWorkPeriodsRowCount} Zeilen`
    }`
  );

  let exitCode = 0;

  if (!integrityOk || foreignKeyIssues.length > 0) {
    console.error('');
    console.error('ERGEBNIS: integrity_check oder foreign_key_check nicht sauber (Exit 1).');
    exitCode = 1;
  }

  if (expectMigration && !migrationsAfter.includes(expectMigration)) {
    console.error('');
    console.error(
      `ERGEBNIS: erwartete Migration "${expectMigration}" steht nach dem Lauf nicht in der ` +
        'migrations-Tabelle (Exit 1).'
    );
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log('');
    console.log('ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).');
  }

  db.close();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
