/**
 * PROFESSIONAL OVERTIME TRANSACTION REBUILD SERVICE
 *
 * ARCHITECTURE DECISION (ADR-2026-001):
 * This service implements the Single Source of Truth pattern for overtime transactions.
 *
 * PRINCIPLES:
 * - IDEMPOTENT: Can be called multiple times, always produces same result
 * - ATOMIC: All changes in ONE database transaction
 * - COMPLETE: Rebuilds ALL transactions for a month from source data
 * - TRACEABLE: Full balance tracking (balanceBefore/balanceAfter)
 *
 * REPLACES:
 * - updateOvertimeTransactionsForDate() (incomplete, buggy)
 * - ensureAbsenceTransactionsForMonth() (duplication-prone)
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Transaction-based tracking with cumulative balance
 * - Transparent audit trail for compliance
 * - Consistency between overtime_transactions and overtime_balance
 */

import { db } from '../database/connection.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { getUserById } from './userService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import logger from '../utils/logger.js';
import * as transactionManager from './overtimeTransactionManager.js';
import type { TransactionParams } from './overtimeTransactionManager.js';
import type { WorkPeriodContext } from './workPeriodContext.js';
// Namensraum-Import statt Named Import (Plan 11-05, Task 2 Acceptance Criteria): der Name
// der Fabrikfunktion aus workPeriodContext.js soll ausschliesslich an ihrer tatsaechlichen
// Aufrufstelle unten im Quelltext stehen, nicht zusaetzlich in dieser Importzeile — ein
// grep auf diesen Funktionsnamen zeigt dadurch genau einen Treffer, den Aufruf selbst vor
// der Tagesschleife in rebuildOvertimeTransactionsForMonth.
import * as workPeriodContextModule from './workPeriodContext.js';
import type { UserPublic } from '../types/index.js';

/**
 * WR-09: Abwesenheitstypen als Wertliste UND als Typ — eine Quelle, kein `as any`.
 *
 * Vorher stand in `calculateDailyOvertimeForMonth()` `absence.type as any`. Damit
 * schmuggelte JEDER beliebige String aus der Datenbank in die enge Union von
 * `DayCalculation`: Ein neuer Abwesenheitstyp wäre unerkannt bis in `handleAbsenceDay()`
 * gerutscht und dort durch alle `case`-Zweige gefallen — stillschweigend falsch gebucht,
 * ohne Fehlermeldung. Der Typwächter unten macht daraus einen benannten, protokollierten
 * Zustand.
 */
const ABSENCE_TYPES = ['vacation', 'sick', 'overtime_comp', 'special', 'unpaid'] as const;
type AbsenceDayType = (typeof ABSENCE_TYPES)[number];

function isAbsenceDayType(value: unknown): value is AbsenceDayType {
  return typeof value === 'string' && (ABSENCE_TYPES as readonly string[]).includes(value);
}

interface DayCalculation {
  date: string;
  targetHours: number;
  timeEntriesHours: number;
  absence: {
    type: AbsenceDayType | null;
    id: number | null;
  };
  corrections: number;
  isHoliday: boolean;
  isWeekend: boolean;
}

/**
 * Rebuild ALL overtime transactions for a specific month
 *
 * IDEMPOTENT: Deletes existing transactions and rebuilds from scratch
 * ATOMIC: Wrapped in DB transaction for all-or-nothing guarantee
 *
 * @param userId User ID
 * @param month Month in 'YYYY-MM' format
 */
export function rebuildOvertimeTransactionsForMonth(
  userId: number,
  month: string
): void {
  logger.info({ userId, month }, '🔄 Rebuilding overtime transactions for month');

  // Wrap everything in DB transaction for atomicity
  const transaction = db.transaction(() => {
    // STEP 1: Get user (with workSchedule)
    const user = getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // STEP 2: Determine calculation period
    //
    // WR (09-INVENTAR-KREDITIERUNG.md, Plan 09-05 Task 4): new Date(month + '-01') parst
    // ISO-Datumsstrings ohne Zeitanteil als UTC-Mitternacht — in Europe/Berlin also 02:00
    // lokal im Sommer bzw. 01:00 im Winter. monthEnd wurde dagegen (korrekt) über
    // new Date(jahr, monat, 0) lokal um 00:00 gebildet. Die Tagesschleife in
    // collectDailyCalculations() (d <= endDate) brach dadurch einen Tag vor Monatsende ab,
    // weil monthStart einen Zeitanteil > 0 trug, den jeder nachfolgende d.setDate(...)-Schritt
    // beibehielt. Vorlage für die korrekte, rein lokale Bildung:
    // unifiedOvertimeService.ts:156-157 (Monatsgrenzen) und :164-165 (hireDate) — beide
    // zerlegen den ISO-String mit split('-').map(Number) statt ihn per new Date(String) zu
    // parsen.
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);

    const [hYear, hMonth, hDay] = user.hireDate.split('-').map(Number);
    const hireDate = new Date(hYear, hMonth - 1, hDay);
    const today = getCurrentDate();

    // Start = later of (month start, hire date)
    const startDate = new Date(Math.max(monthStart.getTime(), hireDate.getTime()));

    // F-5 (Phase 14.2, Plan 14.2-05) — DIE DECKELUNG IST UNBEDINGT, NICHT AN DEN
    // LAUFENDEN MONAT GEKOPPELT:
    //
    // Hier stand eine an den laufenden Monat gekoppelte Bedingung, die nur bei Gleichheit
    // von `month` und dem laufenden Monat auf `min(monthEnd, today)` deckelte. Fuer jeden
    // Monat NACH dem laufenden lief die Tagesberechnung damit bis zum Monatsletzten und
    // buchte fuer jeden kuenftigen Werktag ein volles Tagessoll ohne Ist — September 2026
    // wies dadurch „Ueberstunden (Zeitraum) -130:00h" aus, obwohl der Monat noch nicht
    // begonnen hatte.
    //
    // 14.1-BL-01 hat exakt dieses Muster bereits an zwei anderen Stellen behoben
    // (`unifiedOvertimeService.ts:186`, `overtimeLiveCalculationService.ts:227`) — beide
    // decken unbedingt (`X > today ? today : X`). Diese dritte Stelle lag damals nicht im
    // Umfang jener Phase und blieb stehen.
    //
    // WARUM SIE TROTZDEM SICHTBAR WURDE: `overtimeService.updateMonthlyOvertime()` ruft
    // diesen Rebuild NACH seinem eigenen, bereits korrekt gedeckelten Schreibvorgang in
    // `overtime_balance` auf (overtimeService.ts:163, nach dem Upsert bei :144). Der
    // ungedeckelte Wert von hier ueberschrieb also das richtige Ergebnis von dort.
    //
    // Fuer einen reinen Zukunftsmonat gilt danach `endDate = today < startDate`; die
    // Tagesschleife in collectDailyCalculations() laeuft null Mal, die Summen in
    // updateOvertimeBalanceForMonth() sind 0/0, und es entsteht keine Journalzeile mit
    // Zukunftsdatum. Das DELETE in STEP 3 laeuft weiterhin ueber den VOLLEN Monat und
    // raeumt zuvor faelschlich angelegte Zeilen ab — book-once-Zeilen (u. a.
    // `model_change`, die ein Zukunftsdatum tragen duerfen, WR-10) bleiben durch den
    // REBUILDABLE_TYPES-Filter unberuehrt.
    const endDate = monthEnd > today ? today : monthEnd;

    // Skip if user wasn't hired yet
    if (hireDate > endDate) {
      logger.debug({ month, hireDate, endDate }, 'Skipping month - user not hired yet');
      return;
    }

    logger.debug({
      month,
      startDate: formatDate(startDate, 'yyyy-MM-dd'),
      endDate: formatDate(endDate, 'yyyy-MM-dd')
    }, 'Calculation period determined');

    // STEP 3: Delete the DERIVED transactions for this month, then rebuild them.
    const monthFirstDay = formatDate(monthStart, 'yyyy-MM-dd');
    const monthLastDay = formatDate(monthEnd, 'yyyy-MM-dd');

    // FIX (2026-08-18): This used to delete EVERY transaction in the month with no type
    // filter. Rebuild only regenerates derived rows (time_entry + absence credits), so
    // book-once records were wiped and never came back.
    //
    // Affected types that are written exactly once and cannot be recomputed:
    //   'compensation'     — debit when a time-off-in-lieu day is approved
    //   'correction'       — manual admin adjustment
    //   'carry_over', 'payout', 'initial_balance', 'year_end_balance'
    //
    // Production had 0 'compensation' rows against 3 approved overtime_comp requests —
    // every one of them had been silently deleted by a later rebuild.
    //
    // SCOPE: This restores the audit trail. It does NOT by itself change any balance,
    // because getOvertimeBalance() sums the monthly overtime_balance aggregate rather
    // than these transactions. That the overtime_comp debit never reaches the balance at
    // all is a separate defect in the dual calculation system — tracked, not fixed here.
    // See .planning/debug/urlaubstage-bei-ablehnung-verloren.md (Bug 9/10)
    const REBUILDABLE_TYPES = [
      'worked',
      'time_entry',
      'earned',
      'vacation_credit',
      'sick_credit',
      'overtime_comp_credit',
      'special_credit',
      'unpaid_deduction',
      'unpaid_adjustment',
      'holiday_credit',
      'weekend_credit',
    ];

    const deleteResult = db.prepare(`
      DELETE FROM overtime_transactions
      WHERE userId = ?
        AND date BETWEEN ? AND ?
        AND type IN (${REBUILDABLE_TYPES.map(() => '?').join(', ')})
    `).run(userId, monthFirstDay, monthLastDay, ...REBUILDABLE_TYPES);

    logger.debug({ deletedCount: deleteResult.changes }, '🗑️  Deleted rebuildable transactions (book-once types preserved)');

    // STEP 4: Get previous month balance (for cumulative tracking)
    let runningBalance = getPreviousMonthBalance(userId, month);
    logger.debug({ runningBalance }, '💰 Starting balance from previous month');

    // STEP 4b: Perioden-Kontext fuer diesen Lauf (D1) — genau einmal je Rebuild angelegt,
    // nicht einmal je Tag; an collectDailyCalculations() durchgereicht.
    const periods: WorkPeriodContext = workPeriodContextModule.createWorkPeriodContext();

    // STEP 5: Collect daily calculations
    const dailyCalculations = collectDailyCalculations(userId, user, startDate, endDate, periods);

    // STEP 6: Insert transactions day-by-day with balance tracking
    let transactionsCreated = 0;

    for (const day of dailyCalculations) {
      const balanceBefore = runningBalance;

      // Handle absences specially (two transactions: earned + credit)
      if (day.absence.type) {
        transactionsCreated += handleAbsenceDay(
          userId,
          day,
          balanceBefore,
          runningBalance
        );

        // Update running balance
        runningBalance = calculateRunningBalanceAfterAbsence(
          runningBalance,
          day.targetHours,
          day.absence.type
        );
      } else {
        // Regular working day: earned = (actual - target + corrections)
        const overtime = day.timeEntriesHours - day.targetHours + day.corrections;

        insertTransactionWithBalance(
          userId,
          day.date,
          'time_entry',
          overtime,
          balanceBefore,
          `Differenz Soll/Ist ${day.date}`,
          null,
          null
        );

        transactionsCreated++;
        runningBalance += overtime;
      }
    }

    logger.info({ userId, month, transactionsCreated, finalBalance: runningBalance },
      '✅ Transactions rebuilt successfully');

    // STEP 7: Update overtime_balance (monthly aggregation)
    updateOvertimeBalanceForMonth(userId, month, dailyCalculations, runningBalance);
  });

  // Execute transaction (atomic!)
  transaction();
}

/**
 * Get balance at the end of previous month
 * Used as starting point for cumulative balance tracking
 *
 * CRITICAL: Must use overtime_transactions (cumulative balance), NOT overtime_balance (monthly differences)!
 *
 * CR-02 (Code-Review Phase 12) — WARUM `type <> 'model_change'`:
 * Die `model_change`-Journalzeile eines Stundenwechsels wird NACH dem Rebuild eingefuegt und
 * traegt damit die hoechste `id` ihres Datums. Faellt `validFrom` auf den letzten Tag eines
 * Monats (oder ist sie der einzige Eintrag vor dem Monatsanfang), gewinnt sie das
 * `ORDER BY date DESC, id DESC` und liefert dem Rebuild des Folgemonats ihren Startwert.
 * Sie steht aber auf einer ANDEREN Skala als ihre Nachbarn: ihre
 * `balanceBefore`/`balanceAfter` stammen aus dem `overtime_balance`-Aggregat, die uebrigen
 * Zeilen tragen den kumulativen Laufsaldo der Journalkette. Ab dieser Zeile waere die
 * gesamte `balanceBefore`/`balanceAfter`-Spur — laut Kopfkommentar dieses Service der
 * Audit-Trail fuer DATEV/Personio-Konformitaet — falsch.
 *
 * Die Zeile ist eine reine Journalzeile ohne eigene Saldowirkung (ihr Betrag steckt bereits
 * in den neu gerechneten Tageszeilen, siehe overtimeTransactionService.ts, CR-01). Sie
 * gehoert deshalb nicht in die Laufsaldo-Kette.
 */
function getPreviousMonthBalance(userId: number, month: string): number {
  // Get the first day of current month
  const monthStart = `${month}-01`;

  // Get the last transaction balance BEFORE this month starts
  const result = db.prepare(`
    SELECT COALESCE(balanceAfter, 0) as balance
    FROM overtime_transactions
    WHERE userId = ? AND date < ?
      AND type <> 'model_change'
    ORDER BY date DESC, id DESC
    LIMIT 1
  `).get(userId, monthStart) as { balance: number | null };

  // If no previous transactions exist, start at 0
  const balance = result?.balance ?? 0;

  logger.debug({
    userId,
    month,
    previousBalance: balance
  }, '💰 Previous month balance from transactions');

  return Math.round(balance * 100) / 100;
}

/**
 * Collect daily calculations for entire month
 * Returns array of DayCalculation objects
 */
function collectDailyCalculations(
  userId: number,
  user: UserPublic,
  startDate: Date,
  endDate: Date,
  periods: WorkPeriodContext
): DayCalculation[] {
  const calculations: DayCalculation[] = [];

  // Iterate day-by-day
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Check if holiday
    const isHoliday = !!db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);

    // Get target hours (respects holidays, weekends, workSchedule)
    const targetHours = getDailyTargetHours(user, dateStr, periods);

    // Get time entries
    const timeEntries = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM time_entries
      WHERE userId = ? AND date = ?
    `).get(userId, dateStr) as { total: number };

    // Get approved absence (if any)
    const absence = db.prepare(`
      SELECT id, type
      FROM absence_requests
      WHERE userId = ?
        AND status = 'approved'
        AND startDate <= ?
        AND endDate >= ?
      LIMIT 1
    `).get(userId, dateStr, dateStr) as { id: number; type: string } | undefined;

    // Get corrections (from overtime_corrections table)
    const corrections = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM overtime_corrections
      WHERE userId = ? AND date = ?
    `).get(userId, dateStr) as { total: number };

    // WR-09: Prüfen statt casten. Ein unbekannter Typ aus der Datenbank wird laut gemeldet
    // und wie "kein Abwesenheitstag" behandelt, statt unbemerkt durch alle case-Zweige von
    // handleAbsenceDay() zu fallen.
    if (absence && !isAbsenceDayType(absence.type)) {
      logger.error(
        { userId, date: dateStr, absenceId: absence.id, type: absence.type },
        '❌ Unbekannter Abwesenheitstyp in absence_requests — Tag wird ohne Abwesenheit gerechnet'
      );
    }
    const absenceType = absence && isAbsenceDayType(absence.type) ? absence.type : null;

    calculations.push({
      date: dateStr,
      targetHours,
      timeEntriesHours: timeEntries.total,
      absence: absenceType !== null && absence ? {
        type: absenceType,
        id: absence.id
      } : {
        type: null,
        id: null
      },
      corrections: corrections.total,
      isHoliday,
      isWeekend
    });
  }

  return calculations;
}

/**
 * Handle absence day: Creates ONE or TWO transactions, depending on absence type.
 * 1. earned: (0 - targetHours) = negative hours (Soll/Ist difference) — always created.
 * 2. credit: +targetHours (absence credit) — created for vacation/sick/special only.
 *
 * Result:
 * Paid FROM ANOTHER ACCOUNT (vacation/sick/special): earned(-targetHours) +
 *   credit(+targetHours) = 0 (net effect = 0, correct: the day is paid from the
 *   vacation/sick account, not from the overtime account).
 * Unpaid: earned(-targetHours) + unpaid_deduction(+targetHours) = 0 (net effect = 0; the
 *   actual Soll-Reduktion is handled in updateOvertimeBalanceForMonth).
 * overtime_comp (REQ-19, 09-REQ19-BEFUND.md): NO transaction 2 — the day is paid FROM the
 *   overtime account itself, so it must NOT be neutralized. Net effect = earned(-targetHours),
 *   correctly debiting the account by the day's target hours.
 */
function handleAbsenceDay(
  userId: number,
  day: DayCalculation,
  balanceBefore: number,
  _runningBalance: number
): number {
  let transactionsCreated = 0;
  let currentBalance = balanceBefore;

  // Transaction 1: earned (negative, because actual=0, target>0)
  const earnedHours = day.timeEntriesHours - day.targetHours; // Usually -targetHours

  insertTransactionWithBalance(
    userId,
    day.date,
    'time_entry',
    earnedHours,
    currentBalance,
    `Abwesenheit (${day.absence.type}): Soll/Ist-Differenz`,
    'absence',
    day.absence.id
  );

  transactionsCreated++;
  currentBalance += earnedHours;

  // Transaction 2: credit (positive, neutralizes earned) — NOT for unpaid, NOT for
  // overtime_comp. overtime_comp is paid FROM the overtime account itself (REQ-19); a
  // neutralizing credit here would pay the day twice (once via absence, once via credit).
  if (day.absence.type !== 'unpaid' && day.absence.type !== 'overtime_comp') {
    const creditType = getCreditType(day.absence.type!);
    const creditHours = day.targetHours; // Full target hours

    insertTransactionWithBalance(
      userId,
      day.date,
      creditType,
      creditHours,
      currentBalance,
      `${getCreditDescription(day.absence.type!)} ${day.date}`,
      'absence',
      day.absence.id
    );

    transactionsCreated++;
    currentBalance += creditHours;
  } else if (day.absence.type === 'unpaid') {
    // Unpaid: Create neutralizing transaction for audit trail transparency.
    // Net effect on running balance = 0 (earned + deduction = 0).
    // The actual overtime impact (Soll-Reduktion) is handled in updateOvertimeBalanceForMonth.
    insertTransactionWithBalance(
      userId,
      day.date,
      'unpaid_deduction',
      day.targetHours,
      currentBalance,
      `Unbezahlter Urlaub Anpassung ${day.date}`,
      'absence',
      day.absence.id
    );

    transactionsCreated++;
    currentBalance += day.targetHours;
  }
  // overtime_comp: no transaction 2 — only the earned(-targetHours) transaction stands,
  // correctly debiting the overtime account by the day's target hours.

  return transactionsCreated;
}

/**
 * Calculate running balance after absence day.
 *
 * Paid FROM ANOTHER ACCOUNT (vacation/sick/special) and unpaid produce net = 0 change in
 * the running balance:
 * Paid: earned(-targetHours) + credit(+targetHours) = 0
 * Unpaid: earned(-targetHours) + unpaid_deduction(+targetHours) = 0
 * overtime_comp (REQ-19) produces net = -targetHours: earned(-targetHours), no credit — the
 * day is paid FROM the overtime account itself and must actually reduce the balance.
 *
 * The Soll-Reduktion for unpaid is captured separately in updateOvertimeBalanceForMonth
 * (excludes unpaid days from the targetHours sum).
 */
function calculateRunningBalanceAfterAbsence(
  currentBalance: number,
  targetHours: number,
  absenceType: string
): number {
  const earnedChange = -targetHours;
  // overtime_comp: no neutralizing credit (REQ-19) — the day genuinely debits the account.
  // All other absence types (paid-from-elsewhere and unpaid) neutralize to net 0 here; the
  // Soll-Reduktion for unpaid happens separately in updateOvertimeBalanceForMonth.
  const creditChange = absenceType === 'overtime_comp' ? 0 : targetHours;

  return currentBalance + earnedChange + creditChange;
}

/**
 * Get transaction type for absence credit
 */
// WR-09: konkreter Rückgabetyp statt `string` — der Aufrufer reicht ihn direkt an
// insertTransactionWithBalance() weiter.
function getCreditType(absenceType: AbsenceDayType): RebuildTransactionType {
  const mapping: Record<AbsenceDayType, RebuildTransactionType> = {
    'vacation': 'vacation_credit',
    'sick': 'sick_credit',
    'overtime_comp': 'overtime_comp_credit',
    'special': 'special_credit',
    // 'unpaid' erreicht diese Funktion nicht (der Aufrufer schliesst ihn vorher aus); der
    // Eintrag steht trotzdem hier, damit die Union vollstaendig abgedeckt ist und ein
    // kuenftiger neuer Typ einen Uebersetzungsfehler statt eines stillen Fallbacks erzeugt.
    'unpaid': 'unpaid_deduction'
  };

  return mapping[absenceType] || 'time_entry';
}

/**
 * Get description for absence credit
 */
function getCreditDescription(absenceType: string): string {
  const mapping: Record<string, string> = {
    'vacation': 'Urlaubs-Gutschrift',
    'sick': 'Krankheits-Gutschrift',
    'overtime_comp': 'Überstunden-Ausgleich Gutschrift',
    'special': 'Sonderurlaub-Gutschrift'
  };

  return mapping[absenceType] || 'Gutschrift';
}

/**
 * Insert transaction with balance tracking
 * REFACTORED: Now uses OvertimeTransactionManager for centralized transaction creation
 */
/**
 * WR-09: Die beiden `as any` in dieser Funktion sind ersetzt.
 *
 * `type` war `string` und wurde per `as any` in die enge Union von `TransactionParams`
 * gedrückt. Die Werte, die diese Funktion tatsächlich bekommt, sind abzählbar und stehen
 * jetzt in `RebuildTransactionType`. Zwei davon — 'time_entry' und 'unpaid_deduction' —
 * fehlen in `TransactionParams["type"]`, obwohl die CHECK-Bedingung von
 * `overtime_transactions` (schema.ts:517-522) sie ausdrücklich erlaubt. Diese Lücke im
 * Typmodell wird hier NICHT einseitig geschlossen (das wäre eine Änderung an der
 * Schnittstelle eines anderen Moduls); stattdessen steht am Übergabepunkt eine enge,
 * benannte Zusicherung statt eines `any`, das jeden beliebigen String durchgelassen hätte.
 */
type RebuildTransactionType =
  | 'time_entry'
  | 'unpaid_deduction'
  | 'vacation_credit'
  | 'sick_credit'
  | 'overtime_comp_credit'
  | 'special_credit';

type RebuildReferenceType = 'time_entry' | 'absence' | 'manual' | 'system';

function insertTransactionWithBalance(
  userId: number,
  date: string,
  type: RebuildTransactionType,
  hours: number,
  balanceBefore: number,
  description: string,
  referenceType: RebuildReferenceType | null,
  referenceId: number | null
): void {
  const balanceAfter = balanceBefore + hours;

  transactionManager.createTransaction({
    userId,
    date,
    // Enge, benannte Zusicherung statt `any` — s. Kopfkommentar dieser Funktion.
    type: type as TransactionParams['type'],
    hours,
    description,
    referenceType,
    referenceId,
    balanceBefore,
    balanceAfter
  });
}

/**
 * Update overtime_balance table (monthly aggregation)
 * This is derived from transactions, not source of truth!
 *
 * UNPAID LEAVE RULE (CLAUDE.md): "Reduziert Soll-Stunden, keine Gutschrift"
 * For unpaid days: targetHours contribution = 0 (Soll reduced), actualHours = 0 (no credit)
 * Net overtime impact = 0 - 0 = 0 per unpaid day.
 */
function updateOvertimeBalanceForMonth(
  userId: number,
  month: string,
  dailyCalculations: DayCalculation[],
  _finalBalance: number
): void {
  // Calculate monthly totals
  // FIX (Bug #3): Unpaid days reduce Soll to 0 — exclude their targetHours from the sum.
  const targetHours = dailyCalculations.reduce((sum, day) => {
    // Unpaid leave reduces Soll-Stunden to 0 for those days (CLAUDE.md rule)
    if (day.absence.type === 'unpaid') {
      return sum; // Add 0 for unpaid days
    }
    return sum + day.targetHours;
  }, 0);

  const actualHours = dailyCalculations.reduce((sum, day) => {
    // Actual = time entries + absence credits (vacation/sick/special only) + corrections.
    // NOT for unpaid (no credit, CLAUDE.md rule). NOT for overtime_comp (REQ-19,
    // 09-REQ19-BEFUND.md): the day is paid FROM the overtime account itself — crediting it
    // here as well would pay the day twice and keep the balance saldoneutral instead of
    // reducing it by the day's target hours.
    let dayActual = day.timeEntriesHours;

    if (day.absence.type && day.absence.type !== 'unpaid' && day.absence.type !== 'overtime_comp') {
      dayActual += day.targetHours; // Absence credit
    }

    // Add corrections
    dayActual += day.corrections;

    return sum + dayActual;
  }, 0);

  // Upsert to overtime_balance
  const result = db.prepare(`
    INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, month)
    DO UPDATE SET targetHours = ?, actualHours = ?
  `).run(
    userId,
    month,
    Math.round(targetHours * 100) / 100,
    Math.round(actualHours * 100) / 100,
    Math.round(targetHours * 100) / 100,
    Math.round(actualHours * 100) / 100
  );

  logger.info({
    userId,
    month,
    targetHours,
    actualHours,
    overtime: actualHours - targetHours,
    dbChanges: result.changes
  }, '📊 Updated overtime_balance');
}

/**
 * Get current overtime balance from overtime_balance table
 * (Maintained by this service, used by work_time_accounts sync)
 */
export function getCurrentOvertimeBalance(userId: number): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
    FROM overtime_balance
    WHERE userId = ?
  `).get(userId) as { balance: number };

  return Math.round(result.balance * 100) / 100;
}
