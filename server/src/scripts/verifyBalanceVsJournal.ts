/**
 * NACHWEISWERKZEUG BL-01 — Saldo gegen Journalsumme, fuer jeden aktiven Nutzer
 * (Phase 14.1, Plan 14.1-01, D-01; Befund BL-01 aus `14-WEITERE-BEFUNDE.md`).
 *
 *   DATABASE_PATH=<pfad> npx tsx src/scripts/verifyBalanceVsJournal.ts [--month=YYYY-MM]
 *   DATABASE_PATH=<pfad> npm run verify:balance-vs-journal
 *
 * WAS GEMESSEN WIRD: Der Kontoauszug zeigt zwei Zahlen uebereinander — den fetten Saldo
 * (`calculateCurrentOvertimeBalance`) und darunter die Buchungsliste
 * (`calculateLiveOvertimeTransactions`). Die Route reicht beiden Funktionen exakt dieselben
 * `fromDateStr`/`toDateStr` (`routes/overtime.ts:519` und `:527`, Variablen aus `:515-516`).
 * Dieses Werkzeug ruft genau diese beiden Funktionen mit identischen Argumenten auf und
 * vergleicht Saldo gegen Journalsumme je Nutzer. Erwartung nach dem BL-01-Fix: Differenz
 * 0,00 h fuer jeden Nutzer.
 *
 * ZEITRAUM: `von` = erster Tag des Monats, `bis` = LETZTER Tag des Monats — also genau das,
 * was der Desktop schickt (`desktop/src/hooks/useWorkTimeAccounts.ts:296-304`, `:318-319`;
 * der Client deckelt seit WR-10 bewusst nicht mehr selbst). Ohne ein `bis` in der Zukunft
 * waere BL-01 gar nicht messbar. Ohne `--month` gilt der laufende Monat.
 *
 * DIE ROUTE KUERZT, DIESES WERKZEUG NICHT: `routes/overtime.ts:521-523` schneidet die
 * Buchungsliste per `limit` (Vorgabe 50) ab, BEVOR sie den Client erreicht. Eine ueber die
 * Route gemessene Summe waere deshalb eine gekuerzte Summe und als Nachweis wertlos. Dieses
 * Werkzeug ruft die Services direkt auf und summiert die ungekuerzte Liste.
 *
 * ZWEI GETRENNTE KENNZAHLEN JE NUTZER — bewusst nicht in eine zusammengezogen:
 *
 *   `Zukunftsdiff` = Saldo(von … Monatsletzter) minus Saldo(von … heute).
 *      Das ist GENAU die Aussage von D-01/BL-01: Ein `toDate` in der Zukunft darf den Saldo
 *      nicht mehr veraendern. Nach dem Fix ist diese Zahl fuer jeden Nutzer 0,00 h. Sie ist
 *      unabhaengig von jedem anderen Mangel des Rechenwerks messbar und bestimmt deshalb
 *      ALLEIN den Exitcode dieses Werkzeugs.
 *
 *   `JournalDiff` = Journalsumme minus Saldo, beide ueber von … Monatsletzter.
 *      Das ist das erste Erfolgskriterium der Phase („zwei Zahlen auf einem Bildschirm
 *      muessen zusammenpassen"). Diese Zahl ist nach dem BL-01-Fix NICHT fuer jeden Nutzer 0,
 *      und zwar aus einem zweiten, bei der Erhebung der Phase 14 unentdeckt gebliebenen
 *      Grund: Fuer einen Abwesenheitstag erzeugt der Kontoauszug NUR die Gutschriftszeile
 *      (`vacation_credit`/`sick_credit`, + Tagessoll) und ueberspringt die zugehoerige
 *      negative Tageszeile (`overtimeLiveCalculationService.ts`, Schritt 4:
 *      „Skip days with absences"). Der Saldo rechnet den Tag korrekt auf 0 (Soll = Ist =
 *      Gutschrift), die Liste weist ihn als vollen Gewinn aus. Die Restdifferenz ist damit
 *      exakt die Summe der Gutschriften im Zeitraum.
 *      Dieser Befund ist NICHT Gegenstand von Plan 14.1-01 (D-07: ein Commit-Satz je Befund;
 *      D-09: neue Funde werden vermerkt, nicht nebenbei repariert). Er steht in
 *      `.planning/phases/14-absicherung-und-auslieferung/deferred-items.md` und wartet auf
 *      eine Entscheidung des Anwenders. Sobald er geschlossen ist, gehoert `JournalDiff`
 *      ebenfalls in den Exitcode — bis dahin wird er ausgewiesen und gezaehlt, ohne den Lauf
 *      scheitern zu lassen.
 *
 * ES SCHREIBT NICHTS. Alle SQL-Anweisungen dieser Datei sind lesend, die Datenbank wird nur
 * ueber die regulaere Verbindung gelesen, und es gibt bewusst KEINEN `--apply`-Schalter —
 * ein Trockenlauf/Schreiblauf-Paar waere hier sinnlos, weil es keinen Schreiblauf gibt.
 *
 * NUTZER, DIE WERFEN, BRECHEN DEN LAUF NICHT AB: Ein Nutzer ohne Arbeitszeitperiode oder mit
 * unvollstaendigen Stammdaten laesst die Rechenfunktion werfen. Der Fall wird je Nutzer
 * abgefangen und mit seiner Meldung aufgefuehrt (Vorbild: `snapshotBalances.ts`, das
 * denselben Fall fuer soft-geloeschte Nutzer je Nutzer abfaengt), damit ein einzelner
 * Stammdatenmangel nicht den Nachweis fuer alle uebrigen Nutzer verhindert.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (Muster aus `backfillOvertimeJournal.ts`, dort
 * ausfuehrlich begruendet):
 *   1. Am Kopf ausschliesslich importsichere Module: `path`, `url`, `./productionGuard.js`,
 *      `../config/database.js` (loest nur Strings auf, oeffnet keine Datenbank).
 *   2. `DATABASE_PATH`-Pflichtpruefung in `main()`, VOR `parseArgs()` — kein stiller
 *      Rueckfall auf `database/development.db`.
 *   3. Aufgeloester Pfad als allererste Ausgabezeile.
 *   4. `assertNotProduction()` synchron, bevor irgendetwas geoeffnet wird.
 *   5. Erst danach `await import(...)` der DB-beruehrenden Module.
 *
 * EXITCODES: 0 = `Zukunftsdiff` fuer jeden Nutzer 0,00 h und kein Fehlerfall. 1 = mindestens
 * ein Nutzer mit `Zukunftsdiff` ungleich 0,00 h oder mindestens ein Fehlerfall. 2 =
 * Aufruffehler (`DATABASE_PATH` fehlt, unbekanntes Argument, Produktionsschutz).
 */

import path from 'path';
import { pathToFileURL } from 'url';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';

interface Args {
  /** YYYY-MM oder `null` fuer den laufenden Monat. */
  month: string | null;
}

/** Reine Funktion — wertet nur Strings aus, oeffnet nichts. */
export function parseArgs(argv: string[]): Args {
  let month: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith('--month=')) {
      const value = arg.slice('--month='.length);
      if (!/^\d{4}-\d{2}$/.test(value)) {
        console.error(`FEHLER: --month erwartet das Format YYYY-MM, erhalten: "${value}"`);
        process.exit(2);
      }
      month = value;
      continue;
    }
    console.error(`FEHLER: Unbekanntes Argument "${arg}".`);
    console.error('  Erlaubt ist ausschliesslich --month=YYYY-MM.');
    process.exit(2);
  }

  return { month };
}

/** Erster Tag des Monats `YYYY-MM`. */
function firstOfMonth(month: string): string {
  return `${month}-01`;
}

/**
 * Letzter Tag des Monats `YYYY-MM` — ueber lokale Kalenderfelder (`new Date(y, m, 0)`),
 * nicht ueber `toISOString()` (`.claude/CLAUDE.md`, „Timezone Bugs").
 */
function lastOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 0);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Feste Breite, damit die Ausgabe als Tabelle lesbar bleibt. */
function pad(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

async function main(): Promise<void> {
  // DATABASE_PATH ist Pflicht — kein stiller Rueckfall auf database/development.db.
  // Laeuft VOR parseArgs(), damit ein Aufruf ganz ohne Argumente und ohne DATABASE_PATH
  // exakt diese Meldung zeigt (Muster aus backfillOvertimeJournal.ts).
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

  // Allererste Ausgabezeile: aufgeloester Pfad.
  console.log('Aufgeloester Datenbankpfad:', resolvedPath);

  assertNotProduction(resolvedPath);

  console.log('### NUR LESEND — dieses Werkzeug schreibt nichts ###');

  // Erst JETZT, nach dem Guard, werden DB-beruehrende Module geladen.
  const { db } = await import('../database/connection.js');
  const { getTodayString } = await import('../utils/timezone.js');
  const { calculateLiveOvertimeTransactions, calculateCurrentOvertimeBalance } = await import(
    '../services/overtimeLiveCalculationService.js'
  );

  const today = getTodayString();
  const month = args.month ?? today.slice(0, 7);
  const von = firstOfMonth(month);
  const bis = lastOfMonth(month);

  console.log(`Heute (Berlin):            ${today}`);
  console.log(`Monat:                     ${month}`);
  console.log(`Zeitraum von/bis:          ${von} bis ${bis}`);
  console.log(
    bis > today
      ? `Zukunftsfenster:           ${bis} liegt hinter heute — BL-01 ist in diesem Lauf messbar.`
      : `Zukunftsfenster:           LEER (${bis} liegt nicht hinter heute) — dieser Lauf kann BL-01 NICHT nachweisen.`
  );
  console.log('');

  const userIds = (
    db.prepare('SELECT id FROM users WHERE deletedAt IS NULL ORDER BY id ASC').all() as Array<{
      id: number;
    }>
  ).map((r) => r.id);

  console.log(`Aktive Nutzer (deletedAt IS NULL): ${userIds.length}`);
  console.log('');
  console.log(
    `${pad('userId', 8)} ${pad('SummeJournal', 14)} ${pad('SaldoMonat', 12)} ${pad(
      'SaldoHeute',
      12
    )} ${pad('Zukunftsdiff', 14)} ${pad('JournalDiff', 13)}`
  );
  console.log('-'.repeat(80));

  let futureMismatchCount = 0;
  let journalMismatchCount = 0;
  const errors: Array<{ userId: number; message: string }> = [];

  for (const userId of userIds) {
    try {
      const transactions = calculateLiveOvertimeTransactions(userId, von, bis);
      const journalSum = round2(transactions.reduce((sum, t) => sum + t.hours, 0));
      const balanceMonth = calculateCurrentOvertimeBalance(userId, von, bis);
      const balanceToday = calculateCurrentOvertimeBalance(userId, von, today);

      const futureDiff = round2(balanceMonth - balanceToday);
      const journalDiff = round2(journalSum - balanceMonth);

      if (futureDiff !== 0) futureMismatchCount++;
      if (journalDiff !== 0) journalMismatchCount++;

      const marker =
        futureDiff !== 0
          ? '   <== BL-01 NICHT GESCHLOSSEN'
          : journalDiff !== 0
            ? '   <== Restdifferenz (Gutschriften, siehe deferred-items.md)'
            : '';

      console.log(
        `${pad(String(userId), 8)} ${pad(journalSum.toFixed(2), 14)} ${pad(
          balanceMonth.toFixed(2),
          12
        )} ${pad(balanceToday.toFixed(2), 12)} ${pad(futureDiff.toFixed(2), 14)} ${pad(
          journalDiff.toFixed(2),
          13
        )}${marker}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ userId, message });
      console.log(
        `${pad(String(userId), 8)} ${pad('FEHLER', 14)} ${pad('-', 12)} ${pad('-', 12)} ${pad(
          '-',
          14
        )} ${pad('-', 13)}   ${message}`
      );
    }
  }

  console.log('-'.repeat(80));
  console.log('');
  console.log(`Nutzer mit Zukunftsdiff ungleich 0,00 h (BL-01):        ${futureMismatchCount}`);
  console.log(`Nutzer mit JournalDiff  ungleich 0,00 h (Gutschriften): ${journalMismatchCount}`);
  console.log(`Nutzer mit Fehler beim Berechnen:                       ${errors.length}`);

  if (errors.length > 0) {
    console.log('');
    console.log('Fehlerfaelle im Einzelnen:');
    for (const e of errors) {
      console.log(`  Nutzer ${e.userId}: ${e.message}`);
    }
  }

  if (journalMismatchCount > 0) {
    console.log('');
    console.log(
      `HINWEIS: ${journalMismatchCount} Nutzer tragen eine JournalDiff ungleich 0,00 h. Das ist NICHT BL-01,`
    );
    console.log(
      '  sondern die fehlende Gegenbuchung zu Abwesenheits-Gutschriften im Kontoauszug —'
    );
    console.log(
      '  eigener Befund, vermerkt in .planning/phases/14-absicherung-und-auslieferung/deferred-items.md.'
    );
  }

  if (futureMismatchCount > 0 || errors.length > 0) {
    console.log('');
    console.log(
      'ERGEBNIS: BL-01 NICHT GESCHLOSSEN — ein toDate in der Zukunft veraendert den Saldo weiterhin.'
    );
    process.exit(1);
  }

  console.log('');
  console.log(
    'ERGEBNIS: BL-01 GESCHLOSSEN — fuer jeden aktiven Nutzer ist die Zukunftsdiff 0,00 h.'
  );
}

// Laeuft nur, wenn diese Datei direkt als CLI ausgefuehrt wird — ein `import` (z. B. um
// parseArgs() zu testen) fuehrt main() NICHT aus.
const isMainModule =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
