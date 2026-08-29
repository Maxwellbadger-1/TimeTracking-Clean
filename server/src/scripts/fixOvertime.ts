/**
 * Überstunden-Neuberechnung — gehärtetes Handbetriebs-Werkzeug (Phase 9.1, Plan 09.1-05,
 * WR-04/WR-05, D-06).
 *
 * ABLÖSUNG VON `server/scripts/fix-overtime.ts`: Jenes Skript importierte statisch aus dem
 * kompilierten Ausgabeverzeichnis (faktisch `any`, WR-04) und öffnete beim bloßen Modulladen
 * bereits eine eigene Datenbankverbindung — ohne Produktionsschutz, ohne `db.close()` im
 * Fehlerpfad. Genau dieser
 * tägliche Cronjob-Lauf war die Ursache der abgehängten WAL
 * (`.planning/debug/wal-abgehaengt-20260827.md`): ein eigener `npx tsx`-Prozess öffnete
 * `production.db`, schloss die Verbindung am Ende selbst, und SQLite räumte dabei WAL und SHM
 * auf, sobald der schließende Prozess kurz die exklusive Sperre bekam — nachts um 03:00, wenn
 * der Server idle war. Der Serverprozess schrieb danach neun Stunden lang in eine aus dem
 * Dateisystem gelöste Datei.
 *
 * SEIT PHASE 9.1 (D-06) HAT DIESES WERKZEUG KEINEN AUTOMATISCHEN AUFRUFER MEHR — weder ein
 * crontab-Eintrag noch ein Deploy-Workflow ruft es auf (siehe Task 2 dieses Plans). Der
 * reguläre, tägliche Weg ist seit Plan 09.1-04 der In-Prozess-Scheduler
 * (`server/src/services/cronService.ts`, `startOvertimeRecalcScheduler()`), der über die
 * geteilte Verbindung des Serverprozesses läuft und niemals eine eigene Verbindung öffnet oder
 * schließt. Dieses Werkzeug bleibt ausschließlich für den Handbetrieb erhalten — einen
 * Bediener, der gezielt einen oder mehrere Nutzer neu berechnen lassen will.
 *
 * REQ-17 / Abweichung A-1 (09-INVENTAR-SOLLSTUNDEN.md, 09-A1-NACHWEIS.md): Das abgelöste
 * Skript ermittelte Sollstunden früher über eine eigene, zweite Kopie der Logik
 * (`targetHoursPerDay = user.weeklyHours / 5`), die kein individuelles `workSchedule` kannte
 * und für Nutzer mit eigenem Wochenplan falsche Werte lieferte. Dieses Werkzeug ruft
 * stattdessen ausschließlich die kanonische Nutzerschleife
 * `runOvertimeRecalcForAllUsers()` aus `server/src/services/overtimeRecalcRunner.ts` (Plan
 * 09.1-04) auf — dieselbe Funktion, die auch der Scheduler und der Anlauf nach jedem
 * Serverstart nutzen. Eine zweite Kopie dieser Schleife hier wäre erneut der Befund A-1 aus
 * Phase 9.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (zwingend, Muster aus `backfillOvertimeJournal.ts:51-65`
 * und dem Kopfkommentar von `productionGuard.ts`):
 *   1. Ausschließlich importsichere Module am Kopf: `path`, `./productionGuard.js`,
 *      `../config/database.js` (löst nur Strings auf, öffnet keine Datenbank).
 *   2. `DATABASE_PATH`-Pflichtprüfung — kein stiller Rückfall auf `database/development.db`.
 *   3. Argumentauswertung (`parseArgs()` — reine Funktion, öffnet nichts).
 *   4. Nur wenn `--allow-production` NICHT gesetzt ist: `assertNotProduction(resolvedPath)`,
 *      synchron, bevor irgendetwas geöffnet wird.
 *   5. Erst danach `await import(...)` der Datenbankverbindung und des Neuberechnungslaufs —
 *      innerhalb von `main()`.
 *
 * `--allow-production` hebt den Schutz ausdrücklich auf. Wer ihn setzt, öffnet die
 * Produktionsdatenbank aus einem eigenen Prozess — mit demselben Risiko wie oben beschrieben.
 * Der reguläre Weg ist der In-Prozess-Scheduler; dieser Schalter ist ein bewusster Notausgang
 * für den Handbetrieb, keine empfohlene Nutzung.
 *
 * Nutzung:
 *   DATABASE_PATH=<pfad> npx tsx src/scripts/fixOvertime.ts [--userId=<id> ...]
 *
 * Vorgeschriebene Aufrufform gegen die Produktionsdatenbank (nur im begründeten Ausnahmefall,
 * s. o.):
 *   DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
 *     npx tsx src/scripts/fixOvertime.ts [--userId=<id> ...] --allow-production
 */

import path from 'path';
import { getDatabasePath } from '../config/database.js';
import { assertNotProduction } from './productionGuard.js';

export interface ParsedFixOvertimeArgs {
  allowProduction: boolean;
  userIds: number[];
}

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error('  DATABASE_PATH=<pfad> npx tsx src/scripts/fixOvertime.ts [--userId=<id> ...] [--allow-production]');
  console.error('');
  console.error('  --userId beschränkt den Lauf auf einen oder mehrere Nutzer (mehrfach angebbar), sonst laufen alle.');
  console.error('  --allow-production hebt den Produktionsschutz auf — nur im begründeten Ausnahmefall.');
  process.exit(2);
}

function parsePositiveInteger(raw: string, flagName: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    printUsageAndExit(`--${flagName} muss eine positive Ganzzahl sein, erhalten: "${raw}".`);
  }
  return value;
}

export function parseArgs(argv: string[]): ParsedFixOvertimeArgs {
  let allowProduction = false;
  const userIds: number[] = [];

  for (const arg of argv) {
    if (arg === '--allow-production') {
      allowProduction = true;
    } else if (arg.startsWith('--userId=')) {
      userIds.push(parsePositiveInteger(arg.slice('--userId='.length), 'userId'));
    } else if (arg.startsWith('--')) {
      printUsageAndExit(`Unbekanntes oder fehlerhaftes Argument: "${arg}".`);
    }
  }

  return { allowProduction, userIds };
}

async function main(): Promise<void> {
  // DATABASE_PATH ist Pflicht — kein stiller Rückfall auf database/development.db.
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error(
      '  Ohne DATABASE_PATH fällt dieses Werkzeug NICHT still auf database/development.db zurück.'
    );
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-datenbank> explizit.');
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));

  const resolvedPath = path.resolve(getDatabasePath());

  // Allererste Ausgabezeile: aufgelöster Pfad.
  console.log('Aufgelöster Datenbankpfad:', resolvedPath);

  if (args.allowProduction) {
    console.log('### WARNUNG: --allow-production gesetzt — Produktionsschutz UMGANGEN. ###');
    console.log(`  Zieldatenbank: ${resolvedPath}`);
    console.log(
      '  Ein eigener Prozess auf production.db räumt beim Schließen der Verbindung WAL und'
    );
    console.log(
      '  SHM auf und hängt damit die WAL des laufenden Serverprozesses ab — Vorfälle:'
    );
    console.log('    .planning/debug/db-stabilisierung-20260818.md');
    console.log('    .planning/debug/wal-abgehaengt-20260827.md');
    console.log(
      '  Der reguläre Weg ist der In-Prozess-Scheduler (cronService.ts). Dieser Schalter ist'
    );
    console.log('  ein Notausgang für den Handbetrieb, keine empfohlene Nutzung.');
  } else {
    assertNotProduction(resolvedPath);
  }

  console.log('');

  // Erst JETZT, nach dem Guard, werden DB-berührende Module geladen.
  const { db } = await import('../database/connection.js');
  const { runOvertimeRecalcForAllUsers } = await import('../services/overtimeRecalcRunner.js');

  let exitCode = 0;
  try {
    const bilanz = await runOvertimeRecalcForAllUsers({
      anlass: 'handbetrieb',
      userIds: args.userIds.length > 0 ? args.userIds : undefined,
    });

    console.log(
      `Bilanz: gesamt=${bilanz.gesamt} verarbeitet=${bilanz.verarbeitet} fehlgeschlagen=${bilanz.fehlgeschlagen} dauerMs=${bilanz.dauerMs}`
    );
    for (const eintrag of bilanz.fehler) {
      console.error(`  Fehler bei userId ${eintrag.userId}: ${eintrag.meldung}`);
    }

    exitCode = bilanz.fehlgeschlagen > 0 ? 1 : 0;
  } finally {
    db.close();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('❌ FATAL:', error);
  process.exit(1);
});
