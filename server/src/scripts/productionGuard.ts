/**
 * Gemeinsamer Produktionsschutz für die Skripte aus Phase 10 (T-10-04, 10-02-PLAN.md),
 * wörtlich übernommen aus der kombinierten Prüflogik in compareOvertimePaths.ts:66-89
 * (Plan 09-05, Task 3).
 *
 * WARUM ALS EIGENES, IMPORTSICHERES MODUL:
 * `server/src/database/connection.ts` öffnet die Datenbankdatei bereits beim `import` eines
 * Service-Moduls (Zeile 50: `dbWrapper.instance = initializeConnection();`), nicht erst bei
 * einem Funktionsaufruf, und legt das Zielverzeichnis vorher per `mkdirSync` an (Zeile
 * 13-17). Ein Schutz, der erst NACH einer statischen `import`-Zeile auf ein schreibendes
 * Service- oder Connection-Modul liefe, wäre wirkungslos — die Datei existierte zu diesem
 * Zeitpunkt bereits. Dieses Modul importiert deshalb ausschließlich `path` und
 * `../config/database.js` (löst nur Strings auf, öffnet keine Datenbank) und muss am Kopf
 * jedes CLI-Skripts SYNCHRON aufgerufen werden, vor jedem `await import()` eines
 * schreibenden Moduls oder vor `new Database(...)`.
 *
 * ABSICHTLICH NICHT ANGEFASST: Die vier bestehenden Werkzeuge aus Phase 9
 * (`compareOvertimePaths.ts`, `validateOvertimeDetailed.ts`, `validateOvertimeCalculation.ts`,
 * `validateAllTestUsers.ts` u. Ä.) behalten weiterhin je eine eigene Kopie dieser Prüfung.
 * Sie auf dieses Modul umzustellen wäre Umbau ohne Auftrag dieses Plans und würde mit der
 * laufenden Verifikation von Phase 9 kollidieren. Die Zusammenführung ist ein Punkt für
 * Phase 9.1 oder Phase 14.
 *
 * Kombinierter Vergleich: Pfadgleichheit mit `getProductionDatabasePath()` UND `NODE_ENV`
 * UND ein Substring-Rückfall. Der Substring-Rückfall bleibt zwingend erhalten — gemessen
 * resolviert der reale Produktionspfad `/home/ubuntu/databases/production.db` unter Windows
 * zu `C:\home\ubuntu\databases\production.db`, verschieden von
 * `path.resolve(getProductionDatabasePath())` = `<repo>/server/database.db`; ohne den
 * Substring-Fallback würde die Kanarienprobe mit dem echten Produktionspfad den Guard nicht
 * auslösen (Plan 09-05, Task 3).
 */

import path from 'path';
import { getDatabasePath, getProductionDatabasePath } from '../config/database.js';

/**
 * Bricht mit Exitcode 2 ab, wenn der aufgelöste Pfad wie die Produktionsdatenbank aussieht.
 *
 * @param explicitPath Optionaler, ausdrücklich zu prüfender Pfad (z. B. aus einem CLI-
 *   Argument wie `--db`). Fehlt er, wird `getDatabasePath()` geprüft.
 */
export function assertNotProduction(explicitPath?: string): void {
  const resolvedPath = path.resolve(explicitPath ?? getDatabasePath());
  const productionPath = path.resolve(getProductionDatabasePath());
  const nodeEnv = process.env.NODE_ENV;

  const looksLikeProduction =
    resolvedPath === productionPath ||
    nodeEnv === 'production' ||
    resolvedPath.toLowerCase().includes('production');

  if (looksLikeProduction) {
    console.error('FEHLER: Produktionsschreibzugriff verweigert (T-10-04, 10-02-PLAN.md; D5, 09-CONTEXT.md).');
    console.error(`  Aufgelöster Datenbankpfad: ${resolvedPath}`);
    console.error(`  NODE_ENV: ${nodeEnv ?? '(nicht gesetzt)'}`);
    console.error(
      '  Phase 10 fasst die Produktionsdatenbank ausdrücklich nicht an — der Produktionslauf ist Phase 14.'
    );
    console.error('  Nutze --db=<pfad> mit einer ausdrücklich benannten, lokalen Kopie.');
    process.exit(2);
  }
}
