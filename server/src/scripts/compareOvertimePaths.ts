/**
 * CLI: Vergleicht fünf Berechnungswege für Überstunden je (userId, month) und schlägt bei
 * Abweichung fehl (D3, 09-CONTEXT.md — „Nachweis statt Behauptung").
 *
 * Nutzung:
 *   npm run validate:overtime:paths -- --userId=<n> --month=YYYY-MM [--json=<pfad>]
 *   npm run validate:overtime:paths -- --from=<csv-pfad> [--json=<pfad>]
 *
 * PRODUKTIONSSCHUTZ (D5) — WARUM DER GUARD VOR JEDEM IMPORT STEHEN MUSS:
 * `.claude/CLAUDE.md` → Database Rules verbietet Schreibzugriff auf die Produktionsdatenbank
 * außerhalb des dokumentierten Deploy-Wegs. Dieses Werkzeug ist beim Lesen NICHT
 * nebenwirkungsfrei: sowohl `getUserOvertimeReport()` (reportService.ts:116) als auch
 * `getOvertimeSummary()` (overtimeService.ts:618) rufen `ensureOvertimeBalanceEntries()` auf,
 * das `overtime_balance`-Zeilen anlegt bzw. aktualisiert.
 *
 * Zusätzlich öffnet das Connection-Modul unter server/src/database (Zeile 50:
 * `dbWrapper.instance = initializeConnection();`) die Datenbankdatei bereits beim `import`
 * eines Service-Moduls — nicht erst bei einem Funktionsaufruf. `initializeConnection()`
 * (Zeile 30-47) legt dabei über `initializeDatabase()` fehlende Tabellen an
 * (`CREATE TABLE IF NOT EXISTS`), erzeugt Indizes und setzt WAL-Pragmas; das Verzeichnis wird
 * vorher per `mkdirSync` angelegt (Zeile 13-17). Ein Schutz, der erst NACH einer statischen
 * `import`-Zeile auf `unifiedOvertimeService.js`, `overtimeService.js`, `reportService.js`
 * oder das Connection-Modul liefe, wäre deshalb wirkungslos — die Datei existierte zu diesem
 * Zeitpunkt bereits. Genau dieses Muster (zwei Prozesse mit getrennten Sperrbereichen auf
 * derselben Datei) hat den Vorfall aus `.planning/debug/db-stabilisierung-20260818.md`
 * verursacht.
 *
 * Deshalb, zwingend in dieser Reihenfolge:
 *   1. Am Dateikopf ausschließlich import-sichere Module: Node-Builtins (`fs`, `path`),
 *      `getDatabasePath` (löst nur einen String auf, öffnet keine Datei) und die eigene,
 *      datenbankfreie Vergleichslogik aus `./overtimePathComparison.js`.
 *   2. Direkt danach, als allererste ausgeführte Anweisung: `assertNotProduction()` — eine
 *      SYNCHRONE Funktion auf Modulebene, nicht innerhalb von `main()`.
 *   3. Die drei schreibenden Service-Module (und die Datenbankverbindung selbst) werden erst
 *      danach über dynamisches `await import(...)` innerhalb von `main()` geladen.
 *      `server/package.json` setzt `"type": "module"`, `tsconfig.json` setzt
 *      `"module": "ESNext"`, Start über `tsx` — `await import()` bleibt damit ein echter
 *      dynamischer Import und wird nicht zu `require()` heruntergestuft.
 *
 * Der Exit-Code ist der eigentliche Nachweis aus D3: 0 = alle Wege einig, 1 = mindestens eine
 * Abweichung über TOLERANCE_HOURS, 2 = Schutzabbruch oder Bedienfehler. Er darf nicht durch ein
 * abschließendes `process.exit(0)` oder ein verschlucktes `catch` überschrieben werden.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { getDatabasePath, getProductionDatabasePath } from '../config/database.js';
import {
  comparePaths,
  TOLERANCE_HOURS,
  type PathValue,
  type ComparisonResult,
} from './overtimePathComparison.js';

// ---------------------------------------------------------------------------------------
// Produktionsschutz (D5, WR-06) — muss vor jedem Import eines Service-Moduls laufen, siehe
// Kopf. Kombinierter Vergleich statt reiner Zeichenketten-Heuristik: Pfadgleichheit mit
// getProductionDatabasePath() UND NODE_ENV, Substring-Fallback bleibt zusätzlich erhalten
// (Plan 09-05, Task 3 — gemessen resolviert der reale Produktionspfad
// /home/ubuntu/databases/production.db unter Windows zu
// C:\home\ubuntu\databases\production.db, verschieden von
// path.resolve(getProductionDatabasePath()) = <repo>/server/database.db; ohne den
// Substring-Fallback würde der Kanarientest aus diesem Plan den Guard nicht auslösen).
// ---------------------------------------------------------------------------------------

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
    console.error(
      '  Grund: getUserOvertimeReport() und getOvertimeSummary() schreiben beim Lesen ' +
        '(ensureOvertimeBalanceEntries legt overtime_balance-Zeilen an/aktualisiert sie).'
    );
    console.error(
      '  Setze DATABASE_PATH auf eine lokale Entwicklungskopie, z. B. ./database/development.db'
    );
    process.exit(2);
  }
}

assertNotProduction();

// ---------------------------------------------------------------------------------------
// CLI-Argumente, angelehnt an validateOvertimeDetailed.ts:60-75
// ---------------------------------------------------------------------------------------

interface CliOptions {
  pairs: Array<{ userId: number; month: string }>;
  jsonOutPath?: string;
}

function printUsageAndExit(): never {
  console.error('Nutzung:');
  console.error(
    '  npm run validate:overtime:paths -- --userId=<n> --month=YYYY-MM [--json=<pfad>]'
  );
  console.error('  npm run validate:overtime:paths -- --from=<csv-pfad> [--json=<pfad>]');
  console.error('');
  console.error('  --from erwartet eine CSV-Datei mit Kopfzeile "userId,month" (D4-Prüfnutzer).');
  process.exit(2);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsageAndExit();
  }

  let userIdArg: number | undefined;
  let monthArg: string | undefined;
  let fromPath: string | undefined;
  let jsonOutPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--userId=')) {
      userIdArg = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--userId' && args[i + 1]) {
      userIdArg = parseInt(args[++i], 10);
    } else if (arg.startsWith('--month=')) {
      monthArg = arg.split('=')[1];
    } else if (arg === '--month' && args[i + 1]) {
      monthArg = args[++i];
    } else if (arg.startsWith('--from=')) {
      fromPath = arg.split('=')[1];
    } else if (arg === '--from' && args[i + 1]) {
      fromPath = args[++i];
    } else if (arg.startsWith('--json=')) {
      jsonOutPath = arg.split('=')[1];
    } else if (arg === '--json' && args[i + 1]) {
      jsonOutPath = args[++i];
    }
  }

  const pairs: Array<{ userId: number; month: string }> = [];
  const monthPattern = /^\d{4}-\d{2}$/;

  if (fromPath) {
    let csvContent: string;
    try {
      csvContent = readFileSync(fromPath, 'utf-8');
    } catch (err) {
      console.error(`FEHLER: --from-Datei nicht lesbar: ${fromPath} (${(err as Error).message})`);
      process.exit(2);
    }

    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0 || lines[0].trim() !== 'userId,month') {
      console.error(`FEHLER: ${fromPath} hat nicht die erwartete Kopfzeile "userId,month".`);
      process.exit(2);
    }

    for (const line of lines.slice(1)) {
      const [uidRaw, monthRaw] = line.split(',');
      const uid = parseInt((uidRaw ?? '').trim(), 10);
      const month = (monthRaw ?? '').trim();
      if (Number.isNaN(uid) || !monthPattern.test(month)) {
        console.error(`FEHLER: ungültige Zeile in ${fromPath}: "${line}"`);
        process.exit(2);
      }
      pairs.push({ userId: uid, month });
    }

    if (pairs.length === 0) {
      console.error(`FEHLER: ${fromPath} enthält außer der Kopfzeile keine Datenzeilen.`);
      process.exit(2);
    }
  } else if (userIdArg !== undefined && monthArg !== undefined) {
    if (Number.isNaN(userIdArg) || !monthPattern.test(monthArg)) {
      console.error(
        'FEHLER: --userId muss eine Zahl sein, --month muss dem Format YYYY-MM entsprechen.'
      );
      process.exit(2);
    }
    pairs.push({ userId: userIdArg, month: monthArg });
  } else {
    printUsageAndExit();
  }

  return { pairs, jsonOutPath };
}

// ---------------------------------------------------------------------------------------
// Erhebung der fünf Wege
// ---------------------------------------------------------------------------------------

interface PairResult {
  userId: number;
  month: string;
  values: PathValue[];
  comparison: ComparisonResult;
}

async function main(): Promise<void> {
  const { pairs, jsonOutPath } = parseArgs();

  // Erst JETZT, NACH dem Guard, werden die schreibenden Service-Module dynamisch geladen.
  const { db } = await import('../database/connection.js');
  const { unifiedOvertimeService } = await import('../services/unifiedOvertimeService.js');
  const { getOvertimeSummary } = await import('../services/overtimeService.js');
  const { getUserOvertimeReport } = await import('../services/reportService.js');

  // Startprotokoll gegen den Fehlgriff auf die tote server/database.db
  // (.planning/notes/db-pfad-diskrepanz-20260821.md).
  const absoluteDbPath = path.resolve(getDatabasePath());
  const activeUserCountRow = db
    .prepare('SELECT COUNT(*) as c FROM users WHERE deletedAt IS NULL')
    .get() as { c: number };

  console.log(`Datenbankpfad: ${absoluteDbPath}`);
  console.log(`Aktive Nutzer: ${activeUserCountRow.c}`);

  if (activeUserCountRow.c === 0) {
    console.error(
      'FEHLER: 0 aktive Nutzer in der geöffneten Datenbank — vermutlich falsche oder leere Datei.'
    );
    process.exit(2);
  }
  console.log('');

  let anyDivergent = false;
  const results: PairResult[] = [];

  for (const { userId, month } of pairs) {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNumber = parseInt(monthStr, 10);

    // unified — der kanonische Weg
    let unifiedValue: number | null = null;
    try {
      unifiedValue = unifiedOvertimeService.calculateMonthlyOvertime(userId, month).overtime;
    } catch (err) {
      console.error(
        `WARNUNG: unified-Weg für userId=${userId} month=${month} fehlgeschlagen: ${(err as Error).message}`
      );
    }

    // dashboard — GET /api/overtime/:userId
    let dashboardValue: number | null = null;
    try {
      const summary = await getOvertimeSummary(userId, year);
      const entry = summary.monthly.find(m => m.month === month);
      dashboardValue = entry ? entry.overtime : null;
    } catch (err) {
      console.error(
        `WARNUNG: dashboard-Weg für userId=${userId} month=${month} fehlgeschlagen: ${(err as Error).message}`
      );
    }

    // report_summary + report_daily — GET /api/reports/overtime/user/:userId
    let reportSummaryValue: number | null = null;
    let reportDailyValue: number | null = null;
    try {
      const report = await getUserOvertimeReport(userId, year, monthNumber);
      reportSummaryValue = report.summary.overtime;
      reportDailyValue = report.breakdown.daily
        .filter(d => d.date.startsWith(month))
        .reduce((sum, d) => sum + d.overtime, 0);
    } catch (err) {
      console.error(
        `WARNUNG: report-Weg für userId=${userId} month=${month} fehlgeschlagen: ${(err as Error).message}`
      );
    }

    // balance_row — Spalte overtime aus overtime_balance, oder null ohne Zeile
    const balanceRow = db
      .prepare('SELECT overtime FROM overtime_balance WHERE userId = ? AND month = ?')
      .get(userId, month) as { overtime: number } | undefined;
    const balanceRowValue: number | null = balanceRow ? balanceRow.overtime : null;

    const values: PathValue[] = [
      { name: 'unified', value: unifiedValue },
      { name: 'dashboard', value: dashboardValue },
      { name: 'report_summary', value: reportSummaryValue },
      { name: 'report_daily', value: reportDailyValue },
      { name: 'balance_row', value: balanceRowValue },
    ];

    const comparison = comparePaths(values);
    if (comparison.divergent) {
      anyDivergent = true;
    }

    results.push({ userId, month, values, comparison });

    console.log(`Nutzer ${userId}, Monat ${month}:`);
    for (const v of values) {
      console.log(`  ${v.name.padEnd(15)} ${v.value === null ? 'FEHLT' : v.value.toFixed(2)}`);
    }
    if (comparison.divergent) {
      console.log('  Abweichende Paarungen (> TOLERANCE_HOURS):');
      for (const p of comparison.pairs) {
        if (p.delta > TOLERANCE_HOURS) {
          console.log(`    ${p.a} vs ${p.b}: Delta ${p.delta.toFixed(4)}`);
        }
      }
      if (comparison.missing.length > 0) {
        console.log(`  Fehlende Werte (null): ${comparison.missing.join(', ')}`);
      }
    } else {
      console.log('  Kein Weg weicht ab.');
    }
    console.log('');
  }

  if (jsonOutPath) {
    const jsonDir = path.dirname(jsonOutPath);
    if (jsonDir && !existsSync(jsonDir)) {
      mkdirSync(jsonDir, { recursive: true });
    }
    writeFileSync(
      jsonOutPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          databasePath: absoluteDbPath,
          toleranceHours: TOLERANCE_HOURS,
          results,
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`Grundlinie geschrieben: ${jsonOutPath}`);
  }

  if (anyDivergent) {
    console.log('ERGEBNIS: Mindestens eine Abweichung über der Toleranz gefunden (Exit 1).');
    process.exit(1);
  }

  console.log('ERGEBNIS: Alle Wege stimmen für alle Paare überein (Exit 0).');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
