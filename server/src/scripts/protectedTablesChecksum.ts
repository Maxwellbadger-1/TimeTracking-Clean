/**
 * Kommandozeilenwerkzeug: Zeilenzahl UND SHA-256 der fuenf nach D-01 geschuetzten Tabellen,
 * ohne die geoeffnete Datenbank zu veraendern (Phase 14.2, 14.2-01-PLAN.md, Task 1).
 *
 *   DATABASE_PATH=<pfad> npx tsx src/scripts/protectedTablesChecksum.ts [--markdown] [--label=<text>]
 *
 * D-01 ist ein Abnahmekriterium der ganzen Phase 14.2: keine Zeile in den fuenf Tabellen
 * `time_entries`, `absence_requests`, `overtime_corrections`, `vacation_balance`,
 * `vacation_transactions` wird angefasst — vor und nach jedem Plan mit Zeilenzahl UND
 * SHA-256 zu belegen. Ohne dieses Werkzeug muesste der Nachweis in jedem der zwoelf
 * folgenden Plaene neu geschrieben werden.
 *
 * WARUM DIESES WERKZEUG DAS ZENTRALE DATENBANK-MODUL NICHT LAEDT (CR-02, bestaetigter Befund
 * aus `.planning/phases/14-absicherung-und-auslieferung/deferred-items.md`):
 * Das Modul unter `server/src/database/` (im Kommentar bewusst nicht ausgeschrieben, weil ein
 * Abnahmekriterium den Bezeichner projektweit zaehlt — dasselbe Verfahren wie beim
 * UTC-Bezeichner in `purgeFutureOvertimeRows.ts`) fuehrt beim Modul-Import Schema-DDL auf der
 * geoeffneten Datenbank aus (Migrationen, Trigger-Anlage). Ein Werkzeug, dessen einziger Zweck
 * der Unveraendertheitsnachweis ist, darf die gepruefte Datei nicht per Nebenwirkung eines
 * Imports anfassen. Dieses Werkzeug oeffnet die Datenbank deshalb ausschliesslich direkt
 * ueber `better-sqlite3`, mit `{ readonly: true, fileMustExist: true }`, und setzt
 * unmittelbar danach `PRAGMA query_only = ON` — zwei unabhaengige Schutzmassnahmen
 * (Verteidigung in der Tiefe, wie schon bei `assertNotProduction()`).
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (uebernommen aus `purgeFutureOvertimeRows.ts` /
 * `backfillOvertimeJournal.ts` / `productionGuard.ts`):
 *   1. Ausschliesslich importsichere Module am Kopf: `path`, `url`, `node:crypto`,
 *      `./productionGuard.js`, `./protectedTables.js` (importiert selbst nur `node:crypto`
 *      und einen reinen Typ), `../config/database.js` (loest nur Zeichenketten auf, oeffnet
 *      keine Datenbank). Der `better-sqlite3`-Laufzeitimport ist ein regulaerer,
 *      lesend-oeffnender Import (kein Typ-Import) — er wird bewusst erst in `main()`
 *      geladen, NICHT am Kopf, damit der Produktionsschutz vorher greifen kann.
 *   2. `DATABASE_PATH`-Pflichtpruefung — kein stiller Rueckfall auf
 *      `database/development.db` (laeuft VOR `parseArgs()`).
 *   3. Argumentauswertung (`parseArgs()` — reine Funktion, oeffnet nichts).
 *   4. Nur wenn `--allow-production` NICHT gesetzt ist: `assertNotProduction(resolvedPath)`,
 *      synchron, bevor irgendetwas geoeffnet wird. In Phase 14.2 wird `--allow-production`
 *      NIE benutzt (D-03).
 *   5. Erst danach der `better-sqlite3`-Import und das Oeffnen der Datenbank, readonly.
 */

import path from 'path';
import { createHash } from 'node:crypto';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';
import { measureProtectedTables, printProtectedTables, formatProtectedTablesMarkdown } from './protectedTables.js';

export interface ParsedChecksumArgs {
  markdown: boolean;
  label?: string;
  allowProduction: boolean;
}

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error('  DATABASE_PATH=<pfad> npx tsx src/scripts/protectedTablesChecksum.ts \\');
  console.error('    [--markdown] [--label=<text>] [--allow-production]');
  console.error('');
  console.error('  Die Datenbank wird ausschliesslich readonly geoeffnet (D-01).');
  process.exit(2);
}

export function parseArgs(argv: string[]): ParsedChecksumArgs {
  let markdown = false;
  let label: string | undefined;
  let allowProduction = false;

  for (const arg of argv) {
    if (arg === '--markdown') {
      markdown = true;
    } else if (arg === '--allow-production') {
      allowProduction = true;
    } else if (arg.startsWith('--label=')) {
      label = arg.slice('--label='.length);
    } else if (arg.startsWith('--')) {
      printUsageAndExit(`Unbekanntes oder fehlerhaftes Argument: "${arg}".`);
    }
  }

  return { markdown, label, allowProduction };
}

async function main(): Promise<void> {
  // DATABASE_PATH ist Pflicht — kein stiller Rueckfall auf database/development.db.
  // Laeuft VOR parseArgs().
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error(
      '  Ohne DATABASE_PATH faellt dieses Werkzeug NICHT still auf database/development.db zurueck.'
    );
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-datenbank> explizit.');
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));

  const resolvedPath = path.resolve(getDatabasePath());

  console.log('Aufgeloester Datenbankpfad:', resolvedPath);

  if (args.allowProduction) {
    console.log('### WARNUNG: --allow-production gesetzt — Produktionsschutz UMGANGEN. ###');
    console.log(`  Zieldatenbank: ${resolvedPath}`);
  } else {
    assertNotProduction(resolvedPath);
  }

  // Erst nach dem Produktionsschutz: better-sqlite3 laden und die Datei readonly oeffnen.
  // Kein Import des zentralen Datenbank-Moduls — siehe Kopfkommentar (CR-02).
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');

  const label = args.label ?? resolvedPath;
  const metrics = measureProtectedTables(db);

  if (args.markdown) {
    console.log('');
    console.log(formatProtectedTablesMarkdown(metrics));
  } else {
    console.log('');
    printProtectedTables(label, metrics);
  }

  db.close();

  // SHA-256 der Datenbankdatei selbst — Unveraendertheitsnachweis auch auf Dateiebene.
  const { readFileSync } = await import('node:fs');
  const fileHash = createHash('sha256').update(readFileSync(resolvedPath)).digest('hex');
  console.log('');
  console.log(`Datei-SHA-256 (${resolvedPath}): ${fileHash}`);
}

main().catch((error: unknown) => {
  console.error('FEHLER:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
