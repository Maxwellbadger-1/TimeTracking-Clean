/**
 * NACHWEISWERKZEUG F-5 — Zukunftsdifferenz in `overtime_balance`, fuer jeden aktiven Nutzer
 * (Phase 14.2, Plan 14.2-05, D-07; Befund F-5 aus `14-ABNAHME-SICHT.md` § 5, dazu B-4 aus
 * `14-ABNAHME-SERVER.md`).
 *
 *   DATABASE_PATH=<pfad> npx tsx src/scripts/verifyFutureOvertimeBalance.ts [--rebuild]
 *   DATABASE_PATH=<pfad> npm run verify:future-overtime
 *   DATABASE_PATH=<pfad> npm run verify:future-overtime -- --rebuild
 *
 * WAS GEMESSEN WIRD: `overtime_balance` traegt je Nutzer und Monat ein Soll und ein Ist. Fuer
 * einen Monat, der noch gar nicht begonnen hat, muessen beide 0 sein — es gibt dort weder
 * geleistete noch geschuldete Stunden. Vor dem F-5-Fix schrieb
 * `rebuildOvertimeTransactionsForMonth()` fuer jeden Zukunftsmonat das volle Monatssoll ohne
 * Ist, weil seine Deckelung des Berechnungsendes an den laufenden Monat gekoppelt war. Das
 * Werkzeug zaehlt, wie viele der aktiven Nutzer eine solche Zukunftsdifferenz tragen.
 *
 * ZWEI KENNZAHLEN, BEWUSST GETRENNT:
 *
 *   `Zukunftsdifferenz` = `actualHours - targetHours` einer `overtime_balance`-Zeile, deren
 *      Monat NACH dem laufenden Monat liegt. Nach dem Fix ist sie fuer jeden aktiven Nutzer
 *      0,00 h. Sie allein bestimmt den Exitcode.
 *
 *   `Journalzeilen mit Zukunftsdatum` = Zeilen in `overtime_transactions` mit
 *      `date > heute`. Hier wird zwischen den WIEDERAUFBAUBAREN Zeilen (Tages- und
 *      Gutschriftszeilen; sie duerfen kein Zukunftsdatum tragen) und den BOOK-ONCE-Zeilen
 *      unterschieden. Letztere — allen voran `model_change` — DUERFEN in der Zukunft liegen
 *      (WR-10: die Journalzeile eines Stundenwechsels traegt das kuenftige `validFrom`), und
 *      der `REBUILDABLE_TYPES`-Filter des DELETE im Rebuild schuetzt sie ausdruecklich. Sie
 *      werden deshalb ausgewiesen, zaehlen aber nicht als Mangel.
 *
 * WARUM DIE TYPLISTE HIER STEHT UND NICHT IMPORTIERT WIRD: `REBUILDABLE_TYPES` ist in
 * `overtimeTransactionRebuildService.ts` eine lokale Konstante im Funktionsrumpf und nicht
 * exportierbar. Ein Export waere eine zweite Aenderung an genau der Datei, die den F-5-Fix
 * traegt — der Fix soll aber ein einzeln ruecknehmbarer Commit bleiben (D-02). Die Liste
 * unten fuehrt deshalb die BOOK-ONCE-Typen auf (die kuerzere, stabilere Seite derselben
 * Unterscheidung); alles andere gilt als wiederaufbaubar.
 *
 * `--rebuild` SCHREIBT: Fuer jeden betroffenen Nutzer und Monat wird
 * `overtimeService.updateMonthlyOvertime(userId, month)` gerufen — also genau der Weg, den
 * auch die Anzeige nimmt, nicht `rebuildOvertimeTransactionsForMonth()` direkt. Beruehrt
 * werden dabei ausschliesslich `overtime_balance` und `overtime_transactions`; beide stehen
 * ausdruecklich NICHT unter dem Schutz von D-01. Danach wird erneut gemessen und die
 * Gegenueberstellung vorher/nachher gedruckt.
 *
 * OHNE `--rebuild` SCHREIBT DIESES WERKZEUG NICHTS — alle SQL-Anweisungen des Messteils sind
 * lesend.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (Muster aus `backfillOvertimeJournal.ts` und
 * `verifyBalanceVsJournal.ts`, dort ausfuehrlich begruendet):
 *   1. Am Kopf ausschliesslich importsichere Module: `path`, `url`, `./productionGuard.js`,
 *      `../config/database.js` (loest nur Zeichenketten auf, oeffnet keine Datenbank).
 *   2. `DATABASE_PATH`-Pflichtpruefung in `main()`, VOR `parseArgs()` — kein stiller
 *      Rueckfall auf `database/development.db`.
 *   3. Aufgeloester Pfad als allererste Ausgabezeile.
 *   4. `assertNotProduction()` synchron, bevor irgendetwas geoeffnet wird. In Phase 14.2 wird
 *      `--allow-production` NIE benutzt (D-03).
 *   5. Erst danach `await import(...)` der DB-beruehrenden Module.
 *
 * EXITCODES: 0 = kein aktiver Nutzer traegt eine Zukunftsdifferenz. 1 = mindestens einer
 * traegt eine, oder ein Nutzer hat beim Neuberechnen geworfen. 2 = Aufruffehler
 * (`DATABASE_PATH` fehlt, unbekanntes Argument, Produktionsschutz).
 */

import path from 'path';
import { pathToFileURL } from 'url';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';

/**
 * Journaltypen, die genau einmal gebucht und nie neu berechnet werden. Sie duerfen ein
 * Datum in der Zukunft tragen und werden vom DELETE des Rebuilds nicht angefasst.
 * Gegenstueck zu `REBUILDABLE_TYPES` in `overtimeTransactionRebuildService.ts` — siehe
 * Kopfkommentar, warum die Liste hier steht statt importiert zu werden.
 */
const BOOK_ONCE_TYPES: readonly string[] = [
  'model_change',
  'compensation',
  'correction',
  'carry_over',
  'carryover',
  'payout',
  'initial_balance',
  'year_end_balance',
];

export interface ParsedVerifyArgs {
  rebuild: boolean;
  allowProduction: boolean;
}

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error('  DATABASE_PATH=<pfad> npx tsx src/scripts/verifyFutureOvertimeBalance.ts \\');
  console.error('    [--rebuild] [--allow-production]');
  console.error('');
  console.error('  Ohne --rebuild ist der Lauf rein lesend.');
  console.error('  Mit --rebuild wird ueber overtimeService.updateMonthlyOvertime() neu');
  console.error('  gerechnet; geschrieben wird ausschliesslich in overtime_balance und');
  console.error('  overtime_transactions (beide nicht unter dem Schutz von D-01).');
  process.exit(2);
}

/** Reine Funktion — wertet nur Zeichenketten aus, oeffnet nichts. */
export function parseArgs(argv: string[]): ParsedVerifyArgs {
  let rebuild = false;
  let allowProduction = false;

  for (const arg of argv) {
    if (arg === '--rebuild') {
      rebuild = true;
    } else if (arg === '--allow-production') {
      allowProduction = true;
    } else {
      printUsageAndExit(`Unbekanntes oder fehlerhaftes Argument: "${arg}".`);
    }
  }

  return { rebuild, allowProduction };
}

interface ActiveUser {
  id: number;
  username: string;
}

interface FutureBalanceRow {
  userId: number;
  username: string;
  month: string;
  targetHours: number;
  actualHours: number;
  differenz: number;
}

interface FutureJournalRow {
  userId: number;
  username: string;
  rebuildable: number;
  bookOnce: number;
}

interface Measurement {
  users: ActiveUser[];
  balanceRows: FutureBalanceRow[];
  affectedUserIds: Set<number>;
  journalRows: FutureJournalRow[];
  rebuildableFutureTotal: number;
  bookOnceFutureTotal: number;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Feste Breite, damit die Ausgabe als Tabelle lesbar bleibt. */
function padLeft(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/** Typwache statt `as` — eine Zeile aus `users`. */
function toActiveUser(row: unknown): ActiveUser {
  if (typeof row !== 'object' || row === null) {
    throw new Error('users-Zeile ist kein Objekt');
  }
  const r = row as Record<string, unknown>;
  if (!isNumber(r.id) || !isString(r.username)) {
    throw new Error('users-Zeile traegt kein id/username-Paar');
  }
  return { id: r.id, username: r.username };
}

interface RawBalanceRow {
  userId: number;
  username: string;
  month: string;
  targetHours: number;
  actualHours: number;
}

function toBalanceRow(row: unknown): RawBalanceRow {
  if (typeof row !== 'object' || row === null) {
    throw new Error('overtime_balance-Zeile ist kein Objekt');
  }
  const r = row as Record<string, unknown>;
  if (
    !isNumber(r.userId) ||
    !isString(r.username) ||
    !isString(r.month) ||
    !isNumber(r.targetHours) ||
    !isNumber(r.actualHours)
  ) {
    throw new Error('overtime_balance-Zeile hat unerwartete Spaltentypen');
  }
  return {
    userId: r.userId,
    username: r.username,
    month: r.month,
    targetHours: r.targetHours,
    actualHours: r.actualHours,
  };
}

interface DatabaseLike {
  prepare(sql: string): {
    all(...params: Array<string | number>): unknown[];
  };
}

/**
 * Der Messteil. Rein lesend. `currentMonth` ist der laufende Monat in Berliner Zeit;
 * „Zukunft" heisst hier: der Monat liegt NACH dem laufenden Monat, ein Tagesdatum liegt
 * NACH heute.
 */
function measure(
  database: DatabaseLike,
  currentMonth: string,
  today: string
): Measurement {
  const users = database
    .prepare(
      `SELECT id, username FROM users
       WHERE status = 'active' AND deletedAt IS NULL
       ORDER BY id ASC`
    )
    .all()
    .map(toActiveUser);

  const activeIds = new Set(users.map((u) => u.id));

  const balanceRows: FutureBalanceRow[] = database
    .prepare(
      `SELECT ob.userId AS userId, u.username AS username, ob.month AS month,
              ob.targetHours AS targetHours, ob.actualHours AS actualHours
       FROM overtime_balance ob
       JOIN users u ON u.id = ob.userId
       WHERE u.status = 'active' AND u.deletedAt IS NULL
         AND ob.month > ?
       ORDER BY ob.userId ASC, ob.month ASC`
    )
    .all(currentMonth)
    .map(toBalanceRow)
    .map((r) => ({ ...r, differenz: round2(r.actualHours - r.targetHours) }))
    .filter((r) => r.differenz !== 0);

  const affectedUserIds = new Set(balanceRows.map((r) => r.userId));

  const bookOncePlaceholders = BOOK_ONCE_TYPES.map(() => '?').join(', ');
  const journalRows: FutureJournalRow[] = database
    .prepare(
      `SELECT ot.userId AS userId, u.username AS username,
              SUM(CASE WHEN ot.type IN (${bookOncePlaceholders}) THEN 0 ELSE 1 END) AS rebuildable,
              SUM(CASE WHEN ot.type IN (${bookOncePlaceholders}) THEN 1 ELSE 0 END) AS bookOnce
       FROM overtime_transactions ot
       JOIN users u ON u.id = ot.userId
       WHERE u.status = 'active' AND u.deletedAt IS NULL
         AND ot.date > ?
       GROUP BY ot.userId, u.username
       ORDER BY ot.userId ASC`
    )
    .all(...BOOK_ONCE_TYPES, ...BOOK_ONCE_TYPES, today)
    .map((row) => {
      if (typeof row !== 'object' || row === null) {
        throw new Error('overtime_transactions-Zeile ist kein Objekt');
      }
      const r = row as Record<string, unknown>;
      if (!isNumber(r.userId) || !isString(r.username) || !isNumber(r.rebuildable) || !isNumber(r.bookOnce)) {
        throw new Error('overtime_transactions-Aggregat hat unerwartete Spaltentypen');
      }
      return { userId: r.userId, username: r.username, rebuildable: r.rebuildable, bookOnce: r.bookOnce };
    })
    .filter((r) => activeIds.has(r.userId));

  return {
    users,
    balanceRows,
    affectedUserIds,
    journalRows,
    rebuildableFutureTotal: journalRows.reduce((sum, r) => sum + r.rebuildable, 0),
    bookOnceFutureTotal: journalRows.reduce((sum, r) => sum + r.bookOnce, 0),
  };
}

function printMeasurement(label: string, m: Measurement): void {
  console.log(`=== ${label} ===`);
  if (m.balanceRows.length === 0) {
    console.log('  Keine overtime_balance-Zeile eines aktiven Nutzers traegt eine Zukunftsdifferenz.');
  } else {
    console.log(
      `  ${padLeft('userId', 8)} ${padRight('username', 34)} ${padRight('month', 8)} ${padLeft(
        'target',
        9
      )} ${padLeft('actual', 9)} ${padLeft('differenz', 10)}`
    );
    console.log('  ' + '-'.repeat(82));
    for (const r of m.balanceRows) {
      console.log(
        `  ${padLeft(String(r.userId), 8)} ${padRight(r.username, 34)} ${padRight(r.month, 8)} ${padLeft(
          r.targetHours.toFixed(2),
          9
        )} ${padLeft(r.actualHours.toFixed(2), 9)} ${padLeft(r.differenz.toFixed(2), 10)}`
      );
    }
  }
  console.log('');
  console.log(`  Nutzer mit Zukunftsdifferenz: ${m.affectedUserIds.size} von ${m.users.length} aktiven`);
  console.log(`  Betroffene overtime_balance-Zeilen: ${m.balanceRows.length}`);
  console.log(
    `  overtime_transactions mit Zukunftsdatum: ${m.rebuildableFutureTotal} wiederaufbaubar, ` +
      `${m.bookOnceFutureTotal} book-once (duerfen in der Zukunft liegen, WR-10)`
  );
  if (m.journalRows.length > 0) {
    console.log('  Journalzeilen mit Zukunftsdatum je Nutzer:');
    for (const r of m.journalRows) {
      console.log(
        `    ${padLeft(String(r.userId), 8)} ${padRight(r.username, 34)} wiederaufbaubar=${padLeft(
          String(r.rebuildable),
          5
        )} book-once=${padLeft(String(r.bookOnce), 4)}`
      );
    }
  }
  console.log('');
}

async function main(): Promise<void> {
  // DATABASE_PATH ist Pflicht — kein stiller Rueckfall auf database/development.db.
  // Laeuft VOR parseArgs(), damit ein Aufruf ganz ohne Argumente und ohne DATABASE_PATH
  // exakt diese Meldung zeigt.
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

  if (args.allowProduction) {
    console.log('### WARNUNG: --allow-production gesetzt — Produktionsschutz UMGANGEN. ###');
    console.log(`  Zieldatenbank: ${resolvedPath}`);
  } else {
    assertNotProduction(resolvedPath);
  }

  console.log(
    args.rebuild
      ? '### SCHREIBLAUF (--rebuild): overtime_balance und overtime_transactions werden neu berechnet. ###'
      : '### NUR LESEND — ohne --rebuild schreibt dieses Werkzeug nichts. ###'
  );

  // Erst JETZT, nach dem Guard, werden DB-beruehrende Module geladen.
  const { db } = await import('../database/connection.js');
  const { getTodayString } = await import('../utils/timezone.js');

  const today = getTodayString();
  const currentMonth = today.slice(0, 7);

  console.log(`Heute (Berlin):            ${today}`);
  console.log(`Laufender Monat:           ${currentMonth}`);
  console.log('');

  const database = db as unknown as DatabaseLike;
  const before = measure(database, currentMonth, today);
  printMeasurement(args.rebuild ? 'VORHER' : 'MESSUNG', before);

  if (!args.rebuild) {
    if (before.affectedUserIds.size > 0) {
      console.log(
        'ERGEBNIS: F-5 NICHT GESCHLOSSEN — mindestens ein aktiver Nutzer traegt eine Zukunftsdifferenz.'
      );
      process.exit(1);
    }
    console.log('ERGEBNIS: F-5 GESCHLOSSEN — kein aktiver Nutzer traegt eine Zukunftsdifferenz.');
    return;
  }

  // --rebuild: ueber den echten Anzeigeweg neu rechnen.
  const { updateMonthlyOvertime } = await import('../services/overtimeService.js');

  // Zu rechnende Monate: alle Zukunftsmonate mit Differenz PLUS alle Monate (auch der
  // laufende), in denen wiederaufbaubare Journalzeilen mit Zukunftsdatum stehen. Der zweite
  // Teil raeumt die Tageszeilen ab, die der alte Stand in die Zukunft geschrieben hat, auch
  // wenn die zugehoerige overtime_balance-Zeile zufaellig ausgeglichen ist.
  const work = new Map<number, Set<string>>();
  const addWork = (userId: number, month: string): void => {
    const set = work.get(userId);
    if (set) {
      set.add(month);
    } else {
      work.set(userId, new Set([month]));
    }
  };

  for (const r of before.balanceRows) {
    addWork(r.userId, r.month);
  }

  const bookOncePlaceholders = BOOK_ONCE_TYPES.map(() => '?').join(', ');
  const futureJournalMonths = database
    .prepare(
      `SELECT DISTINCT ot.userId AS userId, substr(ot.date, 1, 7) AS month
       FROM overtime_transactions ot
       JOIN users u ON u.id = ot.userId
       WHERE u.status = 'active' AND u.deletedAt IS NULL
         AND ot.date > ?
         AND ot.type NOT IN (${bookOncePlaceholders})
       ORDER BY ot.userId ASC, month ASC`
    )
    .all(today, ...BOOK_ONCE_TYPES);

  for (const row of futureJournalMonths) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    if (isNumber(r.userId) && isString(r.month)) {
      addWork(r.userId, r.month);
    }
  }

  const totalJobs = [...work.values()].reduce((sum, set) => sum + set.size, 0);
  console.log(
    `Neu zu rechnen: ${totalJobs} Nutzer-Monat-Paare bei ${work.size} von ${before.users.length} aktiven Nutzern.`
  );

  const failures: Array<{ userId: number; month: string; message: string }> = [];
  let done = 0;

  for (const [userId, months] of [...work.entries()].sort((a, b) => a[0] - b[0])) {
    for (const month of [...months].sort()) {
      try {
        updateMonthlyOvertime(userId, month);
      } catch (err) {
        failures.push({
          userId,
          month,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      done++;
      if (done % 10 === 0 || done === totalJobs) {
        console.log(`  … ${done}/${totalJobs} neu gerechnet`);
      }
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.log(`Fehlerfaelle beim Neurechnen: ${failures.length}`);
    for (const f of failures) {
      console.log(`  Nutzer ${f.userId}, Monat ${f.month}: ${f.message}`);
    }
    console.log('');
  }

  const after = measure(database, currentMonth, today);
  printMeasurement('NACHHER', after);

  console.log('=== GEGENUEBERSTELLUNG ===');
  console.log(
    `  ${padLeft('userId', 8)} ${padRight('username', 34)} ${padRight('month', 8)} ${padLeft(
      'diff vorher',
      12
    )} ${padLeft('diff nachher', 13)}`
  );
  console.log('  ' + '-'.repeat(80));
  const afterByKey = new Map(after.balanceRows.map((r) => [`${r.userId}|${r.month}`, r]));
  for (const r of before.balanceRows) {
    const a = afterByKey.get(`${r.userId}|${r.month}`);
    console.log(
      `  ${padLeft(String(r.userId), 8)} ${padRight(r.username, 34)} ${padRight(r.month, 8)} ${padLeft(
        r.differenz.toFixed(2),
        12
      )} ${padLeft((a ? a.differenz : 0).toFixed(2), 13)}`
    );
  }
  console.log('  ' + '-'.repeat(80));
  console.log(
    `  Nutzer mit Zukunftsdifferenz: vorher ${before.affectedUserIds.size}, nachher ${after.affectedUserIds.size} (von ${after.users.length} aktiven)`
  );
  console.log(
    `  Wiederaufbaubare Journalzeilen mit Zukunftsdatum: vorher ${before.rebuildableFutureTotal}, nachher ${after.rebuildableFutureTotal}`
  );
  console.log(
    `  Book-once-Journalzeilen mit Zukunftsdatum (WR-10, duerfen bleiben): vorher ${before.bookOnceFutureTotal}, nachher ${after.bookOnceFutureTotal}`
  );
  console.log('');

  if (after.affectedUserIds.size > 0 || failures.length > 0) {
    console.log(
      'ERGEBNIS: F-5 NICHT GESCHLOSSEN — nach dem Neurechnen traegt mindestens ein aktiver Nutzer eine Zukunftsdifferenz (oder ein Lauf hat geworfen).'
    );
    process.exit(1);
  }

  console.log(
    `ERGEBNIS: F-5 GESCHLOSSEN — 0 von ${after.users.length} aktiven Nutzern tragen eine Zukunftsdifferenz.`
  );
}

// Laeuft nur, wenn diese Datei direkt als CLI ausgefuehrt wird — ein `import` (z. B. um
// parseArgs() zu testen) fuehrt main() NICHT aus.
const isMainModule =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((err) => {
    console.error('FATAL:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
