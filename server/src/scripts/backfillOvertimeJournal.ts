/**
 * Zwei-Stufen-Backfill der unvollständigen Monatsenden im `overtime_transactions`-Journal
 * (D3, 14-07-PLAN.md). Phase 9.1, Teil 1 (`14-URTEIL-PHASE-9.1.md`): der Datenlauf, nicht die
 * Code-Härtung.
 *
 *   DATABASE_PATH=<pfad> npx tsx src/scripts/backfillOvertimeJournal.ts
 *     [--userId=<id>] [--maxMonths=<n>]                        → Trockenlauf (findet, schreibt nichts)
 *
 *   ... [dieselben Argumente] --apply                          → schreibt
 *
 * Vorgeschriebene Aufrufform gegen die Produktionsdatenbank (D4, .claude/CLAUDE.md,
 * „Database Rules"):
 *
 *   DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
 *     npx tsx src/scripts/backfillOvertimeJournal.ts [--userId=<id>] [--maxMonths=<n>] \
 *     [--apply] --allow-production
 *
 * DER DEFEKT (ROADMAP.md, Abschnitt „Phase 9.1"): Plan 09-05 hat den Monatsend-Off-by-one in
 * `overtimeTransactionRebuildService.ts`/`overtimeService.ts` behoben, aber nur für KÜNFTIGE
 * Rebuilds. Bereits gespeicherte Journalzeilen bleiben unvollständig — jeder vollständig
 * durchlaufene Monat kann dort am vorletzten Kalendertag enden. Dieses Werkzeug FINDET die
 * betroffenen Nutzer und Monate am tatsächlichen Bestand (keine Kandidatenliste aus der
 * Erhebung der Phase 9 — die dient nur als Gegenprobe) und baut sie über den kanonischen
 * Rebuild-Weg `rebuildOvertimeTransactionsForMonth()` neu auf.
 *
 * KEINE EIGENE SCHREIBLOGIK: Jeder Monat, der neu geschrieben wird, läuft ausschließlich über
 * `rebuildOvertimeTransactionsForMonth(userId, month)`
 * (`overtimeTransactionRebuildService.ts`), denselben Weg wie jeder reguläre Rebuild seit
 * Phase 11/12/13. Die eigenen SQL-Anweisungen dieser Datei sind samt und sonders lesend
 * (`SELECT`); ein `DELETE`- oder `INSERT`-Befehl auf die Journaltabelle kommt hier nicht vor.
 * Das ist mechanisch nachprüfbar: Der grep aus dem Abnahmekriterium (14-07-PLAN.md, Task 2)
 * sucht die beiden schreibenden Anweisungen auf der Journaltabelle im Wortlaut und darf
 * keinen Treffer liefern. Deshalb sind sie auch hier im Kommentar bewusst nicht ausgeschrieben
 * — ein Nachweis, den seine eigene Dokumentation aushebelt, wäre keiner.
 *
 * TRANSAKTIONAL IST DER MONAT, NICHT DER LAUF (Fallstrick aus
 * `migrateOvertimeToTransactions.ts:14-23`, wörtlich übernommen): `rebuildOvertimeTransactionsForMonth`
 * klammert einen einzelnen Monat eines einzelnen Nutzers in eine eigene DB-Transaktion. Der
 * gesamte Backfill-Lauf über alle Nutzer/Monate ist NICHT selbst eine Transaktion. Bricht der
 * Lauf ab, bleiben alle vorher verarbeiteten Monate bereits festgeschrieben — das Skript gibt
 * beim Abbruch aus, wie viele Nutzer und Monate das waren. `--maxMonths` begrenzt die Zahl der
 * geschriebenen Monate in einem ersten Produktionslauf (T-14-40).
 *
 * MODEL_CHANGE-SCHUTZ (T-14-34): Der Rebuild darf keine `model_change`-Journalzeile anfassen
 * — sie ist der einzige Nachweis eines Arbeitszeitmodellwechsels
 * (`overtimeTransactionRebuildService.ts` REBUILDABLE_TYPES enthält `'model_change'` NICHT).
 * Dieses Skript zählt `model_change`-Zeilen vor und nach dem Lauf zusätzlich selbst und
 * bricht mit Exit 1 ab, wenn sich die Zahl unterscheidet — ein zweiter, unabhängiger Nachweis
 * neben der Struktur von `REBUILDABLE_TYPES`.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (zwingend, wie in `applyModelChange.ts`/
 * `snapshotBalances.ts`/`productionGuard.ts` begründet):
 *   1. Ausschließlich importsichere Module am Kopf: `path`, `url`, `./productionGuard.js`,
 *      `../config/database.js` (löst nur Strings auf, öffnet keine Datenbank).
 *   2. `DATABASE_PATH`-Pflichtprüfung — kein stiller Rückfall auf `database/development.db`
 *      (Muster aus `applyModelChange.ts`: läuft VOR `parseArgs()`, damit ein Aufruf ganz ohne
 *      Argumente und ohne `DATABASE_PATH` exakt die `DATABASE_PATH`-Fehlermeldung zeigt).
 *   3. Argumentauswertung (`parseArgs()` — reine Funktion, öffnet nichts).
 *   4. Nur wenn `--allow-production` NICHT gesetzt ist: `assertNotProduction(resolvedPath)`,
 *      synchron, bevor irgendetwas geöffnet wird.
 *   5. Erst danach `await import(...)` aller DB-berührenden Module — innerhalb von `main()`.
 *
 * `--allow-production` IST DIE EINZIGE STELLE, AN DER DER GUARD UMGANGEN WERDEN KANN — sie
 * existiert, weil derselbe Code in Plan 14-10 bewusst gegen die echte Produktion laufen muss.
 * Ohne `--apply` bleibt auch mit `--allow-production` der Trockenlauf.
 */

import path from 'path';
import { pathToFileURL } from 'url';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';
import type { WorkPeriodContext } from '../services/workPeriodContext.js';
// Reiner Typ-Import: `workingDays.ts` öffnet beim Laden die Datenbankverbindung, `import type`
// wird jedoch vom Compiler restlos entfernt und erzeugt zur Laufzeit keinen Import — dieselbe
// Begründung wie beim Typ-Import von `workPeriodContext.js` darüber und wie in
// `snapshotBalances.ts` (WR-02, 10-REVIEW.md).
import type { TargetHoursUser } from '../utils/workingDays.js';

// ---------------------------------------------------------------------------------------
// Argumentauswertung — reine Funktion, öffnet keine Datenbank, keine Seiteneffekte außer
// process.exit(2) bei einem Aufruffehler (Muster: applyModelChange.ts parseArgs()).
// ---------------------------------------------------------------------------------------

export interface ParsedBackfillArgs {
  apply: boolean;
  allowProduction: boolean;
  userId: number | null;
  maxMonths: number | null;
}

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error(
    '  DATABASE_PATH=<pfad> npx tsx src/scripts/backfillOvertimeJournal.ts \\'
  );
  console.error(
    '    [--userId=<id>] [--maxMonths=<n>] [--apply] [--allow-production]'
  );
  console.error('');
  console.error('  --userId beschränkt den Lauf auf einen Nutzer, sonst laufen alle.');
  console.error('  --maxMonths begrenzt die Zahl der im Schreiblauf verarbeiteten Monate.');
  process.exit(2);
}

function parsePositiveInteger(raw: string, flagName: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    printUsageAndExit(`--${flagName} muss eine positive Ganzzahl sein, erhalten: "${raw}".`);
  }
  return value;
}

export function parseArgs(argv: string[]): ParsedBackfillArgs {
  let apply = false;
  let allowProduction = false;
  let userId: number | null = null;
  let maxMonths: number | null = null;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--allow-production') {
      allowProduction = true;
    } else if (arg.startsWith('--userId=')) {
      userId = parsePositiveInteger(arg.slice('--userId='.length), 'userId');
    } else if (arg.startsWith('--maxMonths=')) {
      maxMonths = parsePositiveInteger(arg.slice('--maxMonths='.length), 'maxMonths');
    } else if (arg.startsWith('--')) {
      printUsageAndExit(`Unbekanntes oder fehlerhaftes Argument: "${arg}".`);
    }
  }

  return { apply, allowProduction, userId, maxMonths };
}

// ---------------------------------------------------------------------------------------
// Findelogik — reine Funktion. Bekommt die gelesenen Daten als Parameter, öffnet selbst keine
// Datenbank (Abnahmekriterium 14-07-PLAN.md, Task 2). Der DB-berührende Teil (Sollstunden je
// Tag, Höchstdatum der Journalzeilen je Monat) läuft in main()/collectMonthCandidates() und
// reicht das Ergebnis hierher durch.
// ---------------------------------------------------------------------------------------

export interface UserForBackfill {
  id: number;
  lastName: string;
  firstName: string;
  hireDate: string; // YYYY-MM-DD
  endDate: string | null;
  deletedAt: string | null;
}

export interface MonthCandidate {
  /** YYYY-MM */
  month: string;
  /**
   * Letzter Tag in diesem Monat (bereits auf hireDate/endDate/Monatsgrenzen beschnitten), an
   * dem der Nutzer nach seinem Arbeitszeitmodell Sollstunden hatte. `null`, wenn es in diesem
   * Monat für diesen Nutzer keinen solchen Tag gibt (z. B. Monat vollständig außerhalb der
   * Beschäftigung oder ausschließlich Feiertage/Wochenenden).
   */
  lastWorkday: string | null;
  /**
   * Höchstdatum der vorhandenen `earned`-Zeilen (`type IN ('time_entry', 'earned')`, s.
   * `overtimeTransactionService.ts:753-754` — beide Bezeichner sind semantisch identisch) des
   * Nutzers in diesem Monat. `null`, wenn keine solche Zeile existiert.
   */
  maxJournalDate: string | null;
}

export interface FindIncompleteMonthsResult {
  /** true, wenn der Nutzer wegen deletedAt IS NOT NULL übersprungen wurde. */
  skipped: boolean;
  incompleteMonths: string[];
}

function monthEndDate(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 0);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function monthStartDate(month: string): string {
  return `${month}-01`;
}

export function findIncompleteMonths(
  user: UserForBackfill,
  today: string,
  candidates: MonthCandidate[]
): FindIncompleteMonthsResult {
  // Soft-gelöschte Nutzer werden ausdrücklich übersprungen und gezählt, nicht stillschweigend
  // weggelassen (14-07-PLAN.md, <behavior>).
  if (user.deletedAt !== null) {
    return { skipped: true, incompleteMonths: [] };
  }

  const incompleteMonths: string[] = [];

  for (const candidate of candidates) {
    const mEnd = monthEndDate(candidate.month);
    const mStart = monthStartDate(candidate.month);

    // Ein Monat gilt nur als unvollständig, wenn er vollständig in der Vergangenheit liegt
    // (letzter Kalendertag < heute) — laufende und zukünftige Monate werden nicht gemeldet.
    if (mEnd >= today) {
      continue;
    }

    // Monate vor hireDate werden nicht gemeldet.
    if (mEnd < user.hireDate) {
      continue;
    }

    // Monate nach endDate werden nicht gemeldet.
    if (user.endDate !== null && mStart > user.endDate) {
      continue;
    }

    // Kein Tag mit Sollstunden in diesem Monat für diesen Nutzer (z. B. der Monat liegt
    // vollständig außerhalb der Beschäftigung innerhalb des Kalendermonats, oder ausschließlich
    // Feiertage/Wochenenden) — nichts zu vervollständigen.
    if (candidate.lastWorkday === null) {
      continue;
    }

    if (candidate.maxJournalDate === null || candidate.maxJournalDate < candidate.lastWorkday) {
      incompleteMonths.push(candidate.month);
    }
  }

  return { skipped: false, incompleteMonths };
}

// ---------------------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------------------

interface UserFinding {
  userId: number;
  name: string;
  incompleteMonths: string[];
}

async function main(): Promise<void> {
  // DATABASE_PATH ist Pflicht — kein stiller Rückfall auf database/development.db (D4).
  // Läuft VOR parseArgs() (Muster aus applyModelChange.ts, 14-05-SUMMARY.md-Abweichung):
  // ein Aufruf ganz ohne Argumente und ohne DATABASE_PATH zeigt so exakt diese Meldung.
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

  // Allererste Ausgabezeile: aufgelöster Pfad (Lehre aus zwei gescheiterten
  // Phase-8-Deployments, applyModelChange.ts-Muster).
  console.log('Aufgelöster Datenbankpfad:', resolvedPath);

  if (args.allowProduction) {
    console.log(
      '### WARNUNG: --allow-production gesetzt — Produktionsschutz UMGANGEN. ###'
    );
    console.log(`  Zieldatenbank: ${resolvedPath}`);
  } else {
    assertNotProduction(resolvedPath);
  }

  console.log(
    args.apply
      ? '### MODUS: SCHREIBEN ###'
      : '### TROCKENLAUF — es wird nichts geschrieben ###'
  );
  console.log('');

  // Erst JETZT, nach dem Guard, werden DB-berührende Module geladen.
  const { db } = await import('../database/connection.js');
  const { getUserByIdIncludingDeleted } = await import('../services/userService.js');
  const { getDailyTargetHours } = await import('../utils/workingDays.js');
  const { createWorkPeriodContext } = await import('../services/workPeriodContext.js');
  const { rebuildOvertimeTransactionsForMonth } = await import(
    '../services/overtimeTransactionRebuildService.js'
  );
  const { getTodayString } = await import('../utils/timezone.js');

  const today = getTodayString();

  // Schritt 2: Nutzerkreis bestimmen — ungefiltert gelesen (soft-gelöschte werden weiter
  // unten je Nutzer ausdrücklich gezählt und übersprungen, nicht hier schon ausgeschlossen).
  const userIds: number[] = args.userId !== null
    ? [args.userId]
    : (db.prepare('SELECT id FROM users ORDER BY id ASC').all() as Array<{ id: number }>).map(
        (r) => r.id
      );

  if (args.userId !== null && userIds.length === 1) {
    const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(args.userId);
    if (!exists) {
      console.error(`FEHLER: Nutzer ${args.userId} existiert nicht in dieser Datenbank.`);
      process.exit(2);
    }
  }

  const findings: UserFinding[] = [];
  let skippedUsers = 0;

  for (const userId of userIds) {
    const user = getUserByIdIncludingDeleted(userId);
    if (!user) {
      continue;
    }

    const userForBackfill: UserForBackfill = {
      id: user.id,
      lastName: user.lastName,
      firstName: user.firstName,
      hireDate: user.hireDate,
      endDate: user.endDate,
      deletedAt: user.deletedAt ?? null,
    };

    if (userForBackfill.deletedAt !== null) {
      skippedUsers++;
      continue;
    }

    // Kandidaten-Monate: vom Eintrittsmonat bis zum letzten VOLLSTÄNDIG vergangenen Monat
    // (Kalendermonat vor dem aktuellen Monat). findIncompleteMonths() filtert hireDate/
    // endDate/"noch nicht vergangen" danach selbst noch einmal — das ist hier absichtlich
    // keine doppelte Prüfung, sondern hält die Erzeugung der Kandidatenliste unabhängig von
    // der reinen Entscheidungslogik testbar.
    const hireMonth = userForBackfill.hireDate.slice(0, 7);
    const currentMonth = today.slice(0, 7);
    const lastFullyPastMonth = previousMonth(currentMonth);

    const candidateMonths = monthsInRange(hireMonth, lastFullyPastMonth);
    if (candidateMonths.length === 0) {
      continue;
    }

    const periods: WorkPeriodContext = createWorkPeriodContext();
    const candidates: MonthCandidate[] = candidateMonths.map((month) => ({
      month,
      lastWorkday: computeLastWorkday(
        user,
        userForBackfill.hireDate,
        userForBackfill.endDate,
        month,
        getDailyTargetHours,
        periods
      ),
      maxJournalDate: computeMaxJournalDate(db, userId, month),
    }));

    const result = findIncompleteMonths(userForBackfill, today, candidates);
    if (result.incompleteMonths.length > 0) {
      findings.push({
        userId,
        name: `${user.firstName} ${user.lastName}`,
        incompleteMonths: result.incompleteMonths,
      });
    }
  }

  // Schritt 3: Fundliste drucken.
  console.log('=== Fundliste ===');
  if (findings.length === 0) {
    console.log('Keine unvollständigen Monate gefunden.');
  } else {
    for (const finding of findings) {
      console.log(
        `userId=${finding.userId} ${finding.name}: ${finding.incompleteMonths.length} unvollständige Monate — ${finding.incompleteMonths.join(', ')}`
      );
    }
  }
  const totalIncompleteMonths = findings.reduce((sum, f) => sum + f.incompleteMonths.length, 0);
  console.log(
    `Summe: ${findings.length} betroffene Nutzer, ${totalIncompleteMonths} unvollständige Monate. Übersprungene (soft-gelöschte) Nutzer: ${skippedUsers}.`
  );
  console.log('');

  const countBefore = getTransactionCount(db);
  const sumBefore = getTransactionHoursSum(db);
  const modelChangeCountBefore = getModelChangeCount(db);
  console.log(
    `overtime_transactions vor dem Lauf: COUNT=${countBefore}, SUM(hours)=${sumBefore}, model_change-Zeilen=${modelChangeCountBefore}`
  );
  console.log('');

  if (!args.apply) {
    console.log('Trockenlauf beendet. Mit --apply ausfuehren.');
    process.exit(0);
  }

  // Schritt 5: Schreiblauf — Einzeleinheit ist der Monat, nicht der Lauf (Fallstrick aus
  // migrateOvertimeToTransactions.ts).
  const jobs: Array<{ userId: number; month: string }> = [];
  for (const finding of findings) {
    for (const month of finding.incompleteMonths) {
      jobs.push({ userId: finding.userId, month });
    }
  }

  const limitedJobs = args.maxMonths !== null ? jobs.slice(0, args.maxMonths) : jobs;
  const totalJobs = limitedJobs.length;
  let monthsProcessed = 0;
  let usersProcessed = 0;
  let lastUserId: number | null = null;

  try {
    for (const job of limitedJobs) {
      rebuildOvertimeTransactionsForMonth(job.userId, job.month);
      monthsProcessed++;
      if (job.userId !== lastUserId) {
        usersProcessed++;
        lastUserId = job.userId;
      }
      console.log(
        `${monthsProcessed} von ${totalJobs} Monaten verarbeitet — userId=${job.userId}, Monat=${job.month}`
      );
    }
  } catch (error) {
    console.error(
      `\n⚠️ ABBRUCH — bereits festgeschrieben: ${usersProcessed} Nutzer, ${monthsProcessed} von ${totalJobs} Monaten. ` +
        'Der Lauf ist NICHT als Ganzes transaktional (Einzeleinheit ist der Monat) — der Bestand ' +
        'steht zwischen altem und neuem Stand.'
    );
    console.error('FEHLER:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log('');
  const countAfter = getTransactionCount(db);
  const sumAfter = getTransactionHoursSum(db);
  const modelChangeCountAfter = getModelChangeCount(db);
  console.log(
    `overtime_transactions nach dem Lauf: COUNT=${countAfter}, SUM(hours)=${sumAfter}, model_change-Zeilen=${modelChangeCountAfter}`
  );
  console.log(
    `Differenz: COUNT=${countAfter - countBefore}, SUM(hours)=${Math.round((sumAfter - sumBefore) * 1e6) / 1e6}`
  );
  console.log('integrity_check:', JSON.stringify(db.pragma('integrity_check')));

  // Schritt 7: model_change-Unversehrtheit — der Backfill darf keine Modellwechsel-Buchung
  // anfassen (T-14-34).
  if (modelChangeCountAfter !== modelChangeCountBefore) {
    console.error(
      `FEHLER: Zahl der model_change-Zeilen hat sich veraendert (${modelChangeCountBefore} -> ${modelChangeCountAfter}). ` +
        'Der Backfill darf Modellwechsel-Buchungen nicht anfassen.'
    );
    process.exit(1);
  }
  console.log(
    `model_change-Zeilen unveraendert (${modelChangeCountBefore} vor, ${modelChangeCountAfter} nach dem Lauf).`
  );

  console.log('');
  console.log('### FERTIG ###');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
// Hilfsfunktionen mit Datenbankzugriff (nur in main() aufgerufen, nach dem Guard).
// ---------------------------------------------------------------------------------------

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 - 1, 1); // ein Monat vor dem 1. des übergebenen Monats
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsInRange(startMonth: string, endMonthInclusive: string): string[] {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonthInclusive.split('-').map(Number);
  const result: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}

/**
 * Letzter Tag des Monats, an dem `targetUser` nach seinem Arbeitszeitmodell Sollstunden
 * hatte — bereits auf `hireDate`/`endDate` und die Monatsgrenzen beschnitten.
 *
 * `targetUser` ist der volle `TargetHoursUser`-Ausschnitt aus
 * `userService.getUserByIdIncludingDeleted()` und wird unverändert an `getDailyTargetHours()`
 * durchgereicht — kein Cast, kein zweiter, engerer Nutzerbegriff (WR-04/`.claude/CLAUDE.md`:
 * kein `any`, keine unbelegte Zusicherung). Seit Phase 11 (REQ-23) liest
 * `getDailyTargetHours()` aus diesem Ausschnitt zur Laufzeit nur noch `id` und `hireDate`; die
 * Sollstunden kommen aus `user_work_periods` (`workingDays.ts:59-82`, `:195`). Der Parameter
 * bleibt trotzdem der vollständige Typ, damit diese Datei keine Annahme über das Innere jener
 * Funktion festschreibt.
 *
 * `hireDate`/`endDate` kommen separat, weil sie hier den Beschnitt des Suchbereichs steuern —
 * dieselbe Quelle wie in `findIncompleteMonths()`, aber eine andere Aufgabe als die
 * Periodenauflösung.
 */
function computeLastWorkday(
  targetUser: TargetHoursUser,
  hireDate: string,
  endDate: string | null,
  month: string,
  getDailyTargetHoursFn: (
    user: TargetHoursUser,
    date: string,
    periods: WorkPeriodContext
  ) => number,
  periods: WorkPeriodContext
): string | null {
  const [y, mo] = month.split('-').map(Number);
  const monthStart = new Date(y, mo - 1, 1);
  const monthEnd = new Date(y, mo, 0);

  const [hy, hm, hd] = hireDate.split('-').map(Number);
  const hireDateObj = new Date(hy, hm - 1, hd);
  const rangeStart = monthStart < hireDateObj ? hireDateObj : monthStart;

  let rangeEnd = monthEnd;
  if (endDate !== null) {
    const [ey, em, ed] = endDate.split('-').map(Number);
    const endDateObj = new Date(ey, em - 1, ed);
    if (endDateObj < rangeEnd) {
      rangeEnd = endDateObj;
    }
  }

  if (rangeStart > rangeEnd) {
    return null;
  }

  let lastWorkday: string | null = null;
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (getDailyTargetHoursFn(targetUser, dateStr, periods) > 0) {
      lastWorkday = dateStr;
    }
  }
  return lastWorkday;
}

function computeMaxJournalDate(
  db: import('better-sqlite3').Database,
  userId: number,
  month: string
): string | null {
  const monthFirstDay = `${month}-01`;
  const monthLastDay = monthEndDate(month);
  const row = db
    .prepare(
      `SELECT MAX(date) as maxDate FROM overtime_transactions
       WHERE userId = ? AND date BETWEEN ? AND ? AND type IN ('time_entry', 'earned')`
    )
    .get(userId, monthFirstDay, monthLastDay) as { maxDate: string | null };
  return row.maxDate;
}

function getTransactionCount(db: import('better-sqlite3').Database): number {
  return (db.prepare('SELECT COUNT(*) as c FROM overtime_transactions').get() as { c: number }).c;
}

function getTransactionHoursSum(db: import('better-sqlite3').Database): number {
  const row = db
    .prepare('SELECT ROUND(SUM(hours), 6) as s FROM overtime_transactions')
    .get() as { s: number | null };
  return row.s ?? 0;
}

function getModelChangeCount(db: import('better-sqlite3').Database): number {
  return (
    db
      .prepare(`SELECT COUNT(*) as c FROM overtime_transactions WHERE type = 'model_change'`)
      .get() as { c: number }
  ).c;
}

// Läuft nur, wenn diese Datei direkt als CLI ausgeführt wird — ein `import` (z. B. aus
// backfillOvertimeJournal.test.ts, um parseArgs()/findIncompleteMonths() zu testen) führt
// main() NICHT aus.
const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
