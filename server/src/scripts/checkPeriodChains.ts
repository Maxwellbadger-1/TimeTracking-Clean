/**
 * Bestands-Check der Arbeitszeitperioden (WR-02, Code-Review Phase 11, Durchlauf 2)
 *
 * WOZU DIESES SKRIPT EXISTIERT
 * ============================
 * `checkAllPeriodChains()` (workPeriodService.ts) wurde in Durchlauf 1 als Gegenmaßnahme
 * zur WR-03-Vereinzelung gebaut: Wenn ein Nutzer ohne Arbeitszeitperiode den Report, die
 * Statistik und den Export nicht mehr zum Absturz bringt, muss der Defekt auf einem anderen
 * Weg auffallen. Die Funktion war jedoch außerhalb von `workPeriodService.test.ts` NIRGENDS
 * aufgerufen — kein CLI, kein npm-Script, keine Route, kein Startlauf. Die Vereinzelung
 * hatte damit den Alarm abgeschaltet, ohne den Ersatzmelder anzuschließen.
 *
 * Dieses Skript ist einer von zwei Aufrufern, die WR-02 nachgezogen hat:
 *   1. HIER: `npm run check:period-chains` — Exitcode 1 bei Befunden, damit ein Cron-Lauf
 *      oder eine Pipeline den Defekt meldet, ohne dass jemand die Ausgabe liest.
 *   2. `GET /api/admin/period-chains` (routes/users.ts) — derselbe Check zur Laufzeit gegen
 *      die Datenbank, die der Server tatsächlich benutzt; der einzige Weg, der auch die
 *      Produktion abdeckt (siehe PRODUKTIONSSCHUTZ unten).
 *
 * BEWUSST NICHT UMGESETZT: der dritte vom Befund genannte Weg, ein Aufruf beim Serverstart.
 * Begründung: Der Check läuft über alle Nutzer und lädt je Nutzer die Periodenliste; das
 * verzögert jeden PM2-Neustart um eine mit dem Bestand wachsende Zeitspanne, und ein
 * `logger.error` beim Start ist genau die Meldung, die in einem Neustart-Log untergeht. Die
 * Admin-Route liefert dieselbe Aussage auf Abruf, ohne den Start zu belasten. Diese
 * Entscheidung ist hier festgehalten, damit sie nicht als Vergessen gelesen wird.
 *
 * PRODUKTIONSSCHUTZ ZUERST, DANN DYNAMISCHER IMPORT
 * =================================================
 * Muster wie in `validateAllTestUsers.ts` und `verifyPeriodNullEffect.ts`:
 * `database/connection.ts` öffnet die Datenbankdatei bereits beim `import` und führt dabei
 * `initializeDatabase()`/`createIndexes()` aus — also `CREATE TABLE IF NOT EXISTS` und
 * `CREATE INDEX IF NOT EXISTS`. Das ist ein SCHREIBVORGANG. Ein reiner Lese-Check ist dieses
 * Werkzeug deshalb nicht, und der Guard gilt auch hier. Für die Produktion ist die
 * Admin-Route der vorgesehene Weg — dort läuft der Check im ohnehin laufenden Serverprozess,
 * ohne eine zweite Verbindung zu öffnen.
 *
 * Am Kopf stehen deshalb nur importsichere Module.
 *
 * Aufruf:
 * ```bash
 * DATABASE_PATH=./database/development.db npm run check:period-chains
 * ```
 *
 * Exitcodes:
 *   0 — Bestand in Ordnung, keine Befunde
 *   1 — mindestens ein Nutzer mit defekter Periodenkette
 *   2 — Produktionsschutz hat ausgelöst
 */

import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';

assertNotProduction();

const { checkAllPeriodChains } = await import('../services/workPeriodService.js');

function main(): void {
  console.log('');
  console.log('='.repeat(78));
  console.log('BESTANDS-CHECK ARBEITSZEITPERIODEN (checkAllPeriodChains)');
  console.log('='.repeat(78));
  console.log(`Datenbank: ${getDatabasePath()}`);
  console.log('');

  const issues = checkAllPeriodChains();

  if (issues.length === 0) {
    console.log('✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose');
    console.log('   Periodenkette ab seinem Eintrittsdatum.');
    console.log('');
    process.exit(0);
  }

  const findingCount = issues.reduce((sum, issue) => sum + issue.findings.length, 0);

  console.log(
    `❌ ${issues.length} Nutzer mit insgesamt ${findingCount} Befund(en):`
  );
  console.log('');

  for (const issue of issues) {
    console.log(`  Nutzer ${issue.userId}:`);
    for (const finding of issue.findings) {
      console.log(`    - ${finding}`);
    }
    console.log('');
  }

  console.log('-'.repeat(78));
  console.log('Wirkung dieser Defekte (D4, Phase 11):');
  console.log('  - Jede Sollstunden-Berechnung für diese Nutzer wirft MissingWorkPeriodError.');
  console.log('  - Sammelauswertungen überspringen sie und melden dadurch zu kleine Summen.');
  console.log('  - Der DATEV-Export bricht ab, statt eine unvollständige Datei auszuliefern.');
  console.log('');
  console.log(`Nutzer-IDs zum Weiterverarbeiten: ${issues.map(i => i.userId).join(', ')}`);
  console.log('='.repeat(78));
  console.log('');

  process.exit(1);
}

main();
