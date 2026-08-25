/**
 * Overtime Transaction Service
 *
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio, DATEV):
 * - Transaction-based overtime tracking (Arbeitszeitkonto)
 * - Immutable audit trail for all overtime changes
 * - Separate handling of earned overtime vs. compensation
 * - Compliance with German labor law (Arbeitszeitgesetz)
 *
 * TRANSACTION TYPES:
 * - 'time_entry': Daily overtime from time entries (Soll/Ist difference)
 * - 'compensation': Overtime deduction when taking time off
 * - 'correction': Manual adjustments by admin
 * - 'carryover': Year-end transfer (audit trail only, 0 hours)
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { formatDate, getCurrentDate, getTodayString } from '../utils/timezone.js';
// CR-01 (Phase 14.1): Fuer die Vormerkung bereits vergebener Ausgleichsstunden. Beide Module
// sind zyklusfrei erreichbar — `workingDays` zieht nur db/timezone/logger,
// `workPeriodContext` nur `workPeriodService` (db/logger/validation/timezone). Keines von
// beiden importiert diese Datei zurueck.
import { calculateAbsenceHoursWithWorkSchedule } from '../utils/workingDays.js';
import type { TargetHoursUser } from '../utils/workingDays.js';
import { createWorkPeriodContext } from './workPeriodContext.js';
import type { WorkSchedule } from '../types/index.js';

/**
 * CR-01 (Code-Review Phase 12) — WARUM `model_change` AUS JEDEM SUMMENPFAD FLIEGT:
 *
 * Ein Stundenwechsel (`workPeriodChangeService.applyWorkTimeChange()`) rechnet die
 * betroffenen Monate mit `rebuildOvertimeTransactionsForMonth()` vollständig neu. Dabei
 * entstehen neue `time_entry`-Tageszeilen mit dem NEUEN Tagessoll, und `overtime_balance`
 * wird neu geschrieben. Die Saldoänderung ist damit bereits vollständig eingetreten, BEVOR
 * anschließend die eine `model_change`-Zeile (D4/D5, REQ-29) in `overtime_transactions`
 * eingefügt wird.
 *
 * Diese Zeile ist deshalb eine reine JOURNALZEILE: Sie dokumentiert den Betrag, den die
 * Umstellung bewirkt hat, und macht ihn im Kontoauszug sichtbar — sie ist aber KEINE
 * zusätzliche Rechengröße. Jede Abfrage, die `SUM(hours)` über `overtime_transactions`
 * bildet, würde den Betrag ein zweites Mal zählen (die Tageszeilen tragen ihn schon).
 *
 * Konsequenz, an ALLEN Summenpfaden gleich umgesetzt und mit dieser Konstante markiert:
 *   - `getOvertimeBalanceAtDate()`
 *   - `getAggregatedOvertimeStats()`
 *   - `getMonthlyTransactionSummary()` (previousBalance UND Fensterinhalt)
 *   - `getBalanceBeforeDate()` (hier und in `overtimeTransactionManager.ts`)
 *   - `getPreviousMonthBalance()` in `overtimeTransactionRebuildService.ts` (CR-02)
 *
 * `getOvertimeBalance()` ist NICHT betroffen: die Funktion liest `overtime_balance`, nicht
 * `overtime_transactions`.
 *
 * Nicht betroffen sind außerdem die reinen ANZEIGE-Abfragen (`getOvertimeHistory()`,
 * `getOvertimeHistoryByDateRange()`) — dort MUSS die Zeile erscheinen, genau dafür ist sie da.
 */
const EXCLUDE_JOURNAL_ONLY_TYPES = `type <> 'model_change'`;

export interface OvertimeTransaction {
  id: number;
  userId: number;
  date: string;
  // WR (Plan 12-05): 'model_change' ergaenzt — Migration 011 (Plan 12-01) hat den
  // Buchungstyp bereits im CHECK-Constraint der Tabelle zugelassen; dieses Interface, der
  // Lesevertrag von getOvertimeHistory()/getOvertimeHistoryByDateRange(), kannte ihn bisher
  // nicht. Ohne diese Ergaenzung waere der Literalvergleich auf 'model_change' in
  // workPeriodChangeService.test.ts (REQ-29) ein TypeScript-Fehler gewesen. Die uebrigen,
  // bereits vor dieser Phase im CHECK-Constraint vorhandenen Werte (z. B. 'earned',
  // 'vacation_credit') bleiben unveraendert ausserhalb dieses Interfaces — vorbestehende
  // Ungenauigkeit, nicht Teil dieses Plans (Scope-Grenze).
  type: 'time_entry' | 'compensation' | 'correction' | 'carryover' | 'model_change';
  hours: number;
  description: string | null;
  // 'work_period' ergaenzt — Migration 011 (Plan 12-01) hat diesen Referenztyp fuer
  // model_change-Buchungen zugelassen (Referenz auf user_work_periods.id).
  referenceType: 'time_entry' | 'absence' | 'manual' | 'system' | 'work_period' | null;
  referenceId: number | null;
  createdAt: string;
  createdBy: number | null;
}

/**
 * Get balance before a specific date (for transaction tracking)
 * PHASE 4: Used to populate balanceBefore/balanceAfter columns
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD) - get balance before this date
 * @returns Balance before the given date
 */
function getBalanceBeforeDate(userId: number, date: string): number {
  // Get the most recent transaction before this date
  const result = db.prepare(`
    SELECT balanceAfter
    FROM overtime_transactions
    WHERE userId = ? AND date < ?
      AND ${EXCLUDE_JOURNAL_ONLY_TYPES}
    ORDER BY date DESC, createdAt DESC
    LIMIT 1
  `).get(userId, date) as { balanceAfter: number | null } | undefined;

  if (result && result.balanceAfter !== null) {
    return result.balanceAfter;
  }

  // No previous transactions, start from 0
  return 0;
}

/**
 * Record earned overtime from daily time tracking
 *
 * AUTOMATIC: Called after time entry CREATE/UPDATE/DELETE
 * Calculates daily overtime as: actualHours - targetHours
 *
 * PHASE 4: Now includes balanceBefore/balanceAfter tracking
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Overtime hours (positive or negative)
 * @param description Optional description
 */
export function recordOvertimeEarned(
  userId: number,
  date: string,
  hours: number,
  description?: string
): void {
  // ✅ ALLOW 0h transactions (important for complete audit trail!)
  // Even days with 0h overtime should be logged for transparency

  const desc = description || `Differenz Soll/Ist ${date}`;

  // PHASE 4: Calculate balance tracking
  const balanceBefore = getBalanceBeforeDate(userId, date);
  const balanceAfter = balanceBefore + hours;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, balanceBefore, balanceAfter)
    VALUES (?, ?, 'time_entry', ?, ?, 'time_entry', ?, ?)
  `).run(userId, date, hours, desc, balanceBefore, balanceAfter);

  logger.debug({
    userId,
    date,
    hours,
    type: 'time_entry',
    balanceBefore,
    balanceAfter
  }, `✅ Recorded earned overtime: ${hours > 0 ? '+' : ''}${hours}h (balance: ${balanceBefore} → ${balanceAfter})`);
}

/**
 * Record overtime compensation (time off in lieu)
 *
 * MANUAL: Called when admin approves overtime_comp absence
 * Deducts hours from overtime account
 *
 * @param userId User ID
 * @param date Start date of absence (YYYY-MM-DD)
 * @param hours Hours to deduct (will be stored as negative)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordOvertimeCompensation(
  userId: number,
  date: string,
  hours: number,
  absenceId: number,
  description?: string
): void {
  // Ensure hours are negative (deduction)
  const hoursToDeduct = -Math.abs(hours);

  const desc = description || `Überstunden-Ausgleich ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'compensation', ?, ?, 'absence', ?)
  `).run(userId, date, hoursToDeduct, desc, absenceId);

  logger.info({
    userId,
    date,
    hours: hoursToDeduct,
    absenceId,
    type: 'compensation'
  }, `✅ Recorded overtime compensation: ${hoursToDeduct}h`);
}

/**
 * Record manual overtime correction by admin
 *
 * MANUAL: Admin tool for fixing errors or making adjustments
 *
 * @param userId User ID
 * @param date Date of correction (YYYY-MM-DD)
 * @param hours Hours to add/subtract
 * @param description Reason for correction (required!)
 * @param adminId Admin user ID who made the correction
 * @param correctionId Optional FK to overtime_corrections table
 */
export function recordOvertimeCorrection(
  userId: number,
  date: string,
  hours: number,
  description: string,
  adminId: number,
  correctionId?: number
): void {
  if (!description || description.trim().length === 0) {
    throw new Error('Description is required for manual corrections');
  }

  // PHASE 4: Calculate balance tracking
  const balanceBefore = getBalanceBeforeDate(userId, date);
  const balanceAfter = balanceBefore + hours;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId, createdBy, balanceBefore, balanceAfter)
    VALUES (?, ?, 'correction', ?, ?, 'manual', ?, ?, ?, ?)
  `).run(userId, date, hours, description, correctionId || null, adminId, balanceBefore, balanceAfter);

  logger.warn({
    userId,
    date,
    hours,
    adminId,
    correctionId,
    description,
    type: 'correction',
    balanceBefore,
    balanceAfter
  }, `⚠️ Manual overtime correction: ${hours > 0 ? '+' : ''}${hours}h (balance: ${balanceBefore} → ${balanceAfter})`);
}

/**
 * Record year-end carryover (audit trail only, 0 hours)
 *
 * AUTOMATIC: Called by year-end rollover service
 * Creates a marker transaction for audit purposes
 *
 * @param userId User ID
 * @param year New year (e.g., 2026)
 */
export function recordYearEndCarryover(
  userId: number,
  year: number
): void {
  const date = `${year}-01-01`;
  const description = `Jahreswechsel ${year - 1} → ${year}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType)
    VALUES (?, ?, 'carryover', 0, ?, 'system')
  `).run(userId, date, description);

  logger.debug({
    userId,
    year,
    type: 'carryover'
  }, `📅 Recorded year-end carryover marker`);
}

/**
 * Record vacation credit (Urlaubs-Gutschrift)
 *
 * AUTOMATIC: Called when absence is approved or when ensuring transactions
 * Credits target hours for vacation days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordVacationCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Urlaubs-Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'vacation_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'vacation_credit'
  }, `✅ Recorded vacation credit: +${hours}h`);
}

/**
 * Record sick leave credit (Krankheits-Gutschrift)
 *
 * AUTOMATIC: Called when sick leave is approved or when ensuring transactions
 * Credits target hours for sick days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordSickCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Krankheits-Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'sick_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'sick_credit'
  }, `✅ Recorded sick credit: +${hours}h`);
}

/**
 * Record overtime compensation credit (Überstunden-Ausgleich Gutschrift)
 *
 * NICHT MEHR AUTOMATISCH AUFGERUFEN (REQ-19, CR-01, 09-REVIEW.md, Plan 09-05 Task 2):
 * ensureAbsenceTransactions() und ensureAbsenceTransactionsForMonth() (overtimeService.ts)
 * schließen 'overtime_comp' seit Plan 09-05 aus ihrer Abfrage auf absence_requests aus, weil
 * ein genehmigter Überstundenausgleich aus dem Überstundenkonto selbst bezahlt wird und keine
 * zusätzliche Gutschrift auf dasselbe Konto erhalten darf. Diese Funktion bleibt exportiert
 * und der Transaktionstyp 'overtime_comp_credit' bleibt im Schema und in Bestandsdaten
 * gültig — nur die automatische Erzeugung neuer Zeilen entfällt. Nicht als tote Funktion
 * missverstehen: Bestandsdaten mit diesem Typ sind weiterhin gültige historische Buchungen.
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordOvertimeCompCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Überstunden-Ausgleich Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'overtime_comp_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'overtime_comp_credit'
  }, `✅ Recorded overtime comp credit: +${hours}h`);
}

/**
 * Record special leave credit (Sonderurlaub-Gutschrift)
 *
 * AUTOMATIC: Called when special leave is approved or when ensuring transactions
 * Credits target hours for special leave days
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours to credit (target hours for this day)
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordSpecialCredit(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  const desc = description || `Sonderurlaub-Gutschrift ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'special_credit', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'special_credit'
  }, `✅ Recorded special credit: +${hours}h`);
}

/**
 * Record unpaid leave adjustment (Unbezahlter Urlaub Anpassung)
 *
 * AUTOMATIC: Called when unpaid leave is approved or when ensuring transactions
 * Adds target hours to compensate for the negative earned transaction
 * (because unpaid reduces target to 0, so earned = 0 - 0 = 0, no adjustment needed actually!)
 *
 * WAIT - this is wrong! Unpaid leave REDUCES target, so:
 * - earned for unpaid day = 0h - 0h = 0h (correct!)
 * - NO additional transaction needed!
 *
 * But to show transparency: We record the adjustment for audit trail
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 * @param hours Hours that were reduced from target
 * @param absenceId FK to absence_requests table
 * @param description Optional description
 */
export function recordUnpaidAdjustment(
  userId: number,
  date: string,
  hours: number,
  absenceId?: number,
  description?: string
): void {
  // ACTUALLY: For unpaid leave, we DON'T need an adjustment transaction
  // because the target is already reduced to 0, so earned = 0 - 0 = 0
  // This function is kept for completeness but may not be used

  const desc = description || `Unbezahlter Urlaub Anpassung ${date}`;

  db.prepare(`
    INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
    VALUES (?, ?, 'unpaid_deduction', ?, ?, 'absence', ?)
  `).run(userId, date, hours, desc, absenceId || null);

  logger.debug({
    userId,
    date,
    hours,
    type: 'unpaid_deduction'
  }, `✅ Recorded unpaid adjustment: +${hours}h`);
}

/**
 * Get current overtime balance for a user
 *
 * FIXED: Now uses overtime_balance (Single Source of Truth)
 * - overtime_balance contains CORRECTLY calculated cumulative overtime
 * - Includes unpaid leave reduction in target hours
 * - Professional standard (SAP, Personio, DATEV)
 *
 * @param userId User ID
 * @returns Current balance (cumulative sum from overtime_balance)
 */
export function getOvertimeBalance(userId: number): number {
  // FIXED: Sum overtime from overtime_balance (NOT transactions!)
  // overtime_balance contains cumulative overtime correctly calculated by updateMonthlyOvertime()
  // This ensures consistency with "Monatliche Entwicklung" display
  //
  // IMPORTANT: Filter month <= current month to exclude future months.
  // Future months may have negative balances (e.g. approved future vacation already
  // recorded in overtime_balance) which must NOT count against current balance.
  //
  // WR-01 (Code-Review Phase 12): Der Vergleichsmonat kommt als gebundener Parameter aus
  // `formatDate(getCurrentDate(), 'yyyy-MM')` — also aus Europe/Berlin — statt aus
  // `strftime('%Y-%m', 'now')`. SQLites `'now'` ist UTC. Am Monatsersten zwischen 00:00 und
  // 01:00/02:00 Berliner Zeit lieferte `strftime` noch den VORMONAT: `applyWorkTimeChange()`
  // baute den neuen Monat dann zwar auf (affectedMonths kommt aus `getTodayString()`,
  // Berlin), blendete ihn aber in beiden Messungen (balanceBefore/balanceAfter) aus — der
  // gemessene und gebuchte balanceDelta war zu klein bzw. 0.
  const currentMonth = formatDate(getCurrentDate(), 'yyyy-MM');
  const result = db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
    FROM overtime_balance
    WHERE userId = ?
      AND month <= ?
  `).get(userId, currentMonth) as { balance: number };

  return Math.round(result.balance * 100) / 100; // Round to 2 decimals
}

/**
 * Get overtime transaction history for a user
 *
 * @param userId User ID
 * @param year Optional year filter (e.g., 2026)
 * @param limit Optional limit (default: all)
 * @returns Array of transactions, newest first
 */
export function getOvertimeHistory(
  userId: number,
  year?: number,
  limit?: number
): OvertimeTransaction[] {
  let query = `
    SELECT *
    FROM overtime_transactions
    WHERE userId = ?
  `;

  const params: (number | string)[] = [userId];

  if (year) {
    query += ` AND date LIKE ?`;
    params.push(`${year}-%`);
  }

  query += ` ORDER BY date DESC, createdAt DESC`;

  if (limit) {
    query += ` LIMIT ?`;
    params.push(limit);
  }

  return db.prepare(query).all(...params) as OvertimeTransaction[];
}

/**
 * Get overtime transactions for a specific date range
 *
 * @param userId User ID
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Array of transactions, newest first
 */
export function getOvertimeHistoryByDateRange(
  userId: number,
  startDate: string,
  endDate: string
): OvertimeTransaction[] {
  return db.prepare(`
    SELECT *
    FROM overtime_transactions
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    ORDER BY date DESC, createdAt DESC
  `).all(userId, startDate, endDate) as OvertimeTransaction[];
}

/**
 * Get overtime balance at a specific date
 *
 * USEFUL FOR: Historical reports, year-end calculations
 *
 * @param userId User ID
 * @param date Date to calculate balance at (YYYY-MM-DD)
 * @returns Balance up to and including the specified date
 */
export function getOvertimeBalanceAtDate(
  userId: number,
  date: string
): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as balance
    FROM overtime_transactions
    WHERE userId = ?
      AND date <= ?
      AND ${EXCLUDE_JOURNAL_ONLY_TYPES}
  `).get(userId, date) as { balance: number };

  return Math.round(result.balance * 100) / 100;
}

/**
 * Delete all transactions for a specific date
 *
 * INTERNAL USE: Called when recalculating daily overtime
 * Only deletes 'time_entry' transactions to avoid data loss
 *
 * @param userId User ID
 * @param date Date (YYYY-MM-DD)
 */
export function deleteEarnedTransactionsForDate(
  userId: number,
  date: string
): void {
  db.prepare(`
    DELETE FROM overtime_transactions
    WHERE userId = ?
      AND date = ?
      AND type = 'time_entry'
  `).run(userId, date);

  logger.debug({ userId, date }, 'Deleted earned transactions for recalculation');
}

/**
 * Get aggregated overtime stats for admin dashboard
 *
 * @param year Optional year filter (default: current year)
 * @returns Summary stats for all users
 */
export function getAggregatedOvertimeStats(year?: number): {
  totalUsers: number;
  totalBalance: number;
  averageBalance: number;
  maxBalance: number;
  minBalance: number;
} {
  let query = `
    SELECT
      COUNT(DISTINCT userId) as totalUsers,
      COALESCE(SUM(hours), 0) as totalBalance,
      COALESCE(AVG(hours), 0) as averageBalance,
      COALESCE(MAX(hours), 0) as maxBalance,
      COALESCE(MIN(hours), 0) as minBalance
    FROM (
      SELECT
        userId,
        SUM(hours) as hours
      FROM overtime_transactions
      WHERE ${EXCLUDE_JOURNAL_ONLY_TYPES}
  `;

  const params: (number | string)[] = [];

  if (year) {
    query += ` AND date LIKE ?`;
    params.push(`${year}-%`);
  }

  query += `
      GROUP BY userId
    )
  `;

  const result = db.prepare(query).get(...params) as {
    totalUsers: number;
    totalBalance: number;
    averageBalance: number;
    maxBalance: number;
    minBalance: number;
  };

  return {
    totalUsers: result.totalUsers || 0,
    totalBalance: Math.round((result.totalBalance || 0) * 100) / 100,
    averageBalance: Math.round((result.averageBalance || 0) * 100) / 100,
    maxBalance: Math.round((result.maxBalance || 0) * 100) / 100,
    minBalance: Math.round((result.minBalance || 0) * 100) / 100,
  };
}

/**
 * CR-01 (Code-Review Phase 14.1) — BEREITS VERGEBENE, NOCH NICHT VERRECHNETE
 * AUSGLEICHSSTUNDEN.
 *
 * WOZU: `getOvertimeBalance()` beantwortet „wie viele Ueberstunden hat der Mitarbeiter?".
 * Diese Funktion beantwortet „wie viele davon sind bereits verplant?". Die Differenz ist das,
 * was noch vergeben werden darf (`getAvailableOvertimeBalance()`).
 *
 * WARUM DIE TRENNLINIE GENAU BEI „TAG > HEUTE" LIEGT — gemessen, nicht angenommen
 * (14.1-NACHWEIS-CR01.md, Abschnitt 2):
 *
 * Ein Ausgleichstag erzeugt in `overtime_balance` KEINE eigene Abbuchung. Er wirkt dadurch,
 * dass der Tag sein Tagessoll behaelt und keine Gutschrift bekommt (`handleAbsenceDay()`
 * legt fuer `overtime_comp` bewusst keine zweite, neutralisierende Zeile an, REQ-19) — der
 * Tag steht also als Fehlbetrag in Hoehe des Tagessolls im Monat. Genau deshalb ist der
 * Zeitpunkt der Wirkung nicht die Genehmigung, sondern der Moment, in dem der Tag in das
 * Rechenfenster faellt.
 *
 * Das Rechenfenster endet bei HEUTE:
 *   - `rebuildOvertimeTransactionsForMonth()` deckelt den laufenden Monat auf
 *     `min(Monatsende, heute)` (Zeile 115-119 dort),
 *   - `getOvertimeBalance()` blendet Monate > laufender Monat vollstaendig aus.
 * Beides zusammen ergibt: in `overtime_balance` beruecksichtigt  <=>  Tag <= heute.
 *
 * Gemessen an Nutzer 2 (Wochenplan: nur Donnerstag 5 h):
 *   - Ausgleich 2026-08-06/13/20 (Vergangenheit): Saldo 10,00 -> 10,00 h. Der Fehlbetrag
 *     stand bereits im Monat — eine zusaetzliche Vormerkung waere eine DOPPELZAEHLUNG.
 *   - Ausgleich 2026-08-27 (Zukunft, laufender Monat): Saldo 10,00 -> 10,00 h.
 *   - Ausgleich 2026-09-03 ff. (kuenftiger Monat): Saldo 10,00 -> 10,00 h.
 * Die beiden letzten Faelle sind die Luecke; der erste darf nicht mitgezaehlt werden.
 *
 * WARUM `absence_requests` UND NICHT DAS JOURNAL: Der Befundbericht schlaegt vor, ueber
 * `overtime_transactions` mit `type = 'compensation' AND date > heute` zu summieren. Das
 * traegt hier nicht: In der Arbeitsdatenbank stehen 0 solche Zeilen gegen 5 genehmigte
 * Ausgleiche — darunter der einzige echte Zukunftsfall (Antrag #64, Nutzer 3, 2026-09-29).
 * Aeltere Neuberechnungen haben die Zeilen bis zum Fix vom 18.08.2026 stillschweigend
 * geloescht, und `purgeFutureOvertimeRows.ts --apply` hat die Zukunftszeilen zusaetzlich
 * entfernt. Eine Vormerkung auf dieser Grundlage haette fuer Antrag #64 genau 0,00 h ergeben,
 * also nichts behoben. `absence_requests` ist dagegen eine geschuetzte Tabelle, wird von
 * keinem Neuaufbau angefasst und ist die Quelle, gegen die auch genehmigt wird.
 *
 * TAGEGENAU statt antragsweise: Die Journalzeile traegt den Gesamtbetrag eines Antrags und
 * das Startdatum. Ein Zeitraum, der heute ueberspannt (Start <= heute < Ende), waere damit
 * entweder ganz oder gar nicht vorgemerkt. Hier wird stattdessen der Teil ab morgen
 * gerechnet — mit `calculateAbsenceHoursWithWorkSchedule()`, also woertlich derselben
 * Funktion, die auch der Genehmigungsvorbehalt und die Abbuchung benutzen. Es entsteht KEINE
 * dritte Rechenregel.
 *
 * NEUBERECHNUNG STATT GESPEICHERTEM BETRAG: Aendert sich der Wochenplan nach der
 * Genehmigung, aendert sich damit auch, was der kuenftige Tag spaeter tatsaechlich kosten
 * wird — der Neuaufbau rechnet ihn dann mit dem neuen Plan. Die Vormerkung folgt dieser
 * Rechnung, statt einen bei der Genehmigung eingefrorenen Betrag zu konservieren.
 *
 * FEHLERVERHALTEN: `MissingWorkPeriodError` wird NICHT abgefangen. Laesst sich fuer einen
 * kuenftigen Tag keine Arbeitszeitperiode aufloesen, ist das nach Migration 009 ein
 * Datendefekt (D4: „kein Rueckfall auf users.weeklyHours/workSchedule"). Ein geratener
 * Ersatzwert waere genau der stille Rueckfall, den D4 verbietet. Derselbe Fehler kann aus
 * dem Aufruf unmittelbar davor in `approveAbsenceRequest()` schon heute kommen — die
 * Fehlerklasse dieses Pfades ist also unveraendert.
 *
 * @param userId User ID
 * @returns Bereits genehmigte Ausgleichsstunden fuer Tage nach heute (>= 0)
 */
export function getCommittedFutureCompensationHours(userId: number): number {
  const today = getTodayString();

  const requests = db.prepare(`
    SELECT id, startDate, endDate
    FROM absence_requests
    WHERE userId = ?
      AND type = 'overtime_comp'
      AND status = 'approved'
      AND endDate > ?
  `).all(userId, today) as Array<{ id: number; startDate: string; endDate: string }>;

  if (requests.length === 0) {
    return 0;
  }

  // Nutzer ueber eine eigene Abfrage laden statt ueber `userService.getUserById()`:
  // `userService` importiert `getOvertimeBalance` aus DIESER Datei — der Import waere ein
  // Modulzyklus. Gelesen werden ohnehin nur `id` und `hireDate` (siehe `TargetHoursUser`).
  const user = db.prepare(`
    SELECT id, hireDate, weeklyHours, workSchedule
    FROM users
    WHERE id = ?
  `).get(userId) as
    | { id: number; hireDate: string; weeklyHours: number; workSchedule: string | null }
    | undefined;

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const targetUser: TargetHoursUser = {
    id: user.id,
    hireDate: user.hireDate,
    weeklyHours: user.weeklyHours,
    workSchedule: user.workSchedule ? (JSON.parse(user.workSchedule) as WorkSchedule) : null,
  };

  // EIN Perioden-Kontext fuer den gesamten Aufruf — nicht einer je Antrag und schon gar nicht
  // einer je Tag (derselbe Grund, aus dem `approveAbsenceRequest()` seinen Kontext vorlaedt).
  const periods = createWorkPeriodContext();
  const tomorrow = addOneDay(today);

  let committed = 0;
  for (const request of requests) {
    // Nur der Teil ab morgen. `startDate > today` ist der Regelfall (eintaegige Ausgleiche);
    // `tomorrow` greift, wenn der Zeitraum heute ueberspannt.
    const from = request.startDate > today ? request.startDate : tomorrow;
    committed += calculateAbsenceHoursWithWorkSchedule(
      targetUser,
      from,
      request.endDate,
      periods
    );
  }

  return Math.round(committed * 100) / 100;
}

/**
 * Naechster Kalendertag zu einem YYYY-MM-DD-String.
 *
 * Reine Kalenderarithmetik auf UTC-Mittag: Der Mittagsanker macht den Schritt gegen
 * Sommerzeitspruenge unempfindlich, die UTC-Getter schliessen eine Zonenverschiebung aus.
 * Dasselbe Muster wie in `workingDays.ts` (`formatDateUtc`). KEIN `toISOString().split('T')[0]`
 * — das waere der von `.claude/CLAUDE.md` ausdruecklich verbotene Zeitzonenfehler.
 */
function addOneDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * CR-01 — Das Guthaben, gegen das noch vergeben werden darf.
 *
 * `getOvertimeBalance()` bleibt unveraendert: Das ist die Zahl, die der Mitarbeiter als
 * seinen Ueberstundensaldo sieht, und sie ist richtig — er HAT die Stunden noch, sie sind
 * nur verplant. Verplante Stunden duerfen aber kein zweites Mal vergeben werden; dafuer
 * ist diese Funktion da. Sie ist die einzige Groesse, gegen die geprueft wird.
 *
 * @param userId User ID
 * @returns Saldo abzueglich der bereits vergebenen, noch nicht verrechneten Ausgleichsstunden
 */
export function getAvailableOvertimeBalance(userId: number): number {
  const balance = getOvertimeBalance(userId);
  const committed = getCommittedFutureCompensationHours(userId);

  return Math.round((balance - committed) * 100) / 100;
}

/**
 * Check if user has sufficient overtime balance
 *
 * VALIDATION: Used before approving overtime_comp absence
 *
 * CR-01 (Code-Review Phase 14.1): Grundlage ist `getAvailableOvertimeBalance()` statt
 * `getOvertimeBalance()`. Vorher sah jede Pruefung denselben Saldo, egal wie viele
 * Ausgleichstage in der Zukunft schon genehmigt waren — gemessen wurden Nutzer 2 gegen ein
 * Guthaben von 10,00 h bei Minusgrenze -20 h (also 30,00 h zulaessig) in sechs Runden
 * 55,00 h genehmigt, bei unveraendertem Saldo von 10,00 h.
 *
 * @param userId User ID
 * @param hoursRequired Hours needed for absence
 * @param maxMinusHours Limit from work_time_accounts (e.g., -20)
 * @returns true if user has enough balance (considering limit)
 */
export function hasSufficientOvertimeBalance(
  userId: number,
  hoursRequired: number,
  maxMinusHours: number
): boolean {
  const availableBalance = getAvailableOvertimeBalance(userId);
  const balanceAfterDeduction = availableBalance - hoursRequired;

  return balanceAfterDeduction >= maxMinusHours;
}

/**
 * Monthly Transaction Summary Entry
 * Used for Monatliche Entwicklung (Monthly Development) display
 */
export interface MonthlyTransactionSummary {
  month: string;           // "2025-11"
  earned: number;          // Sum of 'time_entry' transactions
  compensation: number;    // Sum of 'compensation' transactions
  correction: number;      // Sum of 'correction' transactions
  carryover: number;       // Sum of 'carryover' transactions (usually 0 except January)
  balance: number;         // Cumulative balance at end of month
  balanceChange: number;   // Change from previous month
}

/**
 * Get monthly transaction summary for overtime history
 * PROFESSIONAL STANDARD (SAP SuccessFactors, Personio):
 * - Groups transactions by month
 * - Shows earned/compensation/correction separately (full transparency)
 * - Calculates cumulative balance (like bank account)
 *
 * REPLACES: reportService.getOvertimeHistory() which used overtime_balance (wrong!)
 * NOW USES: overtime_transactions as Single Source of Truth
 *
 * @param userId User ID
 * @param months Number of months to retrieve (default: 12)
 * @returns Array of monthly summaries, newest first
 */
export function getMonthlyTransactionSummary(
  userId: number,
  months: number = 12
): MonthlyTransactionSummary[] {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get all transactions for this user in the date range
  const transactions = db.prepare(`
    SELECT
      substr(date, 1, 7) as month,
      type,
      SUM(hours) as totalHours
    FROM overtime_transactions
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
      AND ${EXCLUDE_JOURNAL_ONLY_TYPES}
    GROUP BY month, type
    ORDER BY month ASC
  `).all(userId, `${startMonth}-01`, `${currentMonth}-31`) as Array<{
    month: string;
    type: string; // Can be any transaction type (earned, time_entry, compensation, correction, vacation_credit, etc.)
    totalHours: number;
  }>;

  // Get balance before start month (for cumulative calculation)
  //
  // CR-01: `AND type <> 'model_change'` ist hier NICHT kosmetisch. Vor der Korrektur bildete
  // diese Abfrage die Summe ueber ALLE Typen vor dem Fensterbeginn — inklusive
  // `model_change` —, waehrend `model_change` innerhalb des Fensters (siehe Abfrage oben und
  // die Vier-Typen-Zuordnung unten) verworfen wurde. Ein Wechsel aelter als das Fenster
  // (Standard 12 Monate) wurde dadurch doppelt gezaehlt, ein Wechsel innerhalb des Fensters
  // verschwand stillschweigend. Beide Varianten waren falsch; jetzt gilt an beiden Stellen
  // dieselbe Regel.
  const previousBalance = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as balance
    FROM overtime_transactions
    WHERE userId = ?
      AND date < ?
      AND ${EXCLUDE_JOURNAL_ONLY_TYPES}
  `).get(userId, `${startMonth}-01`) as { balance: number };

  // Group by month
  const monthsMap = new Map<string, {
    earned: number;
    compensation: number;
    correction: number;
    carryover: number;
  }>();

  transactions.forEach(t => {
    if (!monthsMap.has(t.month)) {
      monthsMap.set(t.month, { earned: 0, compensation: 0, correction: 0, carryover: 0 });
    }
    const monthData = monthsMap.get(t.month)!;

    // Map modern types to legacy types for this summary (backward compatibility)
    // 'time_entry' and 'earned' are semantically identical (daily overtime from time entries)
    const mappedType = t.type === 'time_entry' ? 'earned' : t.type;

    // Only count the 4 main types (ignore credit types like vacation_credit, etc.)
    if (mappedType === 'earned' || mappedType === 'compensation' ||
        mappedType === 'correction' || mappedType === 'carryover') {
      monthData[mappedType] += t.totalHours;
    }
  });

  // Build summary array with cumulative balance
  const summary: MonthlyTransactionSummary[] = [];
  let runningBalance = previousBalance.balance;

  // Sort months and calculate balances
  const sortedMonths = Array.from(monthsMap.keys()).sort();

  sortedMonths.forEach(month => {
    const data = monthsMap.get(month)!;

    // Balance change = sum of all transaction types
    const balanceChange = data.earned + data.compensation + data.correction + data.carryover;
    runningBalance += balanceChange;

    summary.push({
      month,
      earned: Math.round(data.earned * 100) / 100,
      compensation: Math.round(data.compensation * 100) / 100,
      correction: Math.round(data.correction * 100) / 100,
      carryover: Math.round(data.carryover * 100) / 100,
      balance: Math.round(runningBalance * 100) / 100,
      balanceChange: Math.round(balanceChange * 100) / 100,
    });
  });

  // Return newest first (for display)
  return summary.reverse();
}
