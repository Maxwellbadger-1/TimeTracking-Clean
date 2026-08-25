/**
 * Overtime Live Calculation Service
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - ON-DEMAND live calculation from source data
 * - NO database transactions needed
 * - Always up-to-date, reflects ALL changes instantly
 * - Single Source of Truth: time_entries + absence_requests + overtime_corrections
 *
 * TRANSACTION TYPES (calculated):
 * - 'time_entry': Daily overtime from time entries (actualHours - targetHours)
 * - 'vacation_credit': Approved vacation (credits target hours)
 * - 'sick_credit': Approved sick leave (credits target hours)
 * - 'overtime_comp_credit': Approved overtime compensation (credits target hours)
 * - 'special_credit': Approved special leave (credits target hours)
 * - 'unpaid_deduction': Unpaid leave (reduces target hours, shown as 0h)
 * - 'correction': Manual admin corrections
 */

import { db } from '../database/connection.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import type { TargetHoursUser } from '../utils/workingDays.js';
import { isStoredWorkSchedule } from '../utils/workSchedule.js';
import type { WorkSchedule } from '../types/index.js';
import logger from '../utils/logger.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';
import { createWorkPeriodContext } from './workPeriodContext.js';
import type { WorkPeriodContext } from './workPeriodContext.js';

/**
 * Get all working days between two dates (inclusive)
 *
 * REQ-17: Diese Funktion entscheidet nicht mehr selbst, ob ein Tag ein Arbeitstag ist.
 * Die Entscheidung liegt ausschließlich bei getDailyTargetHours() — der kanonischen Stelle
 * für Sollstunden (server/src/utils/workingDays.ts:63). Vorher prüfte diese Funktion
 * Feiertage und Wochentage in einer eigenen, zweiten Kopie der Logik; für Nutzer ohne
 * workSchedule galt dabei pauschal "Montag-Freitag", wodurch ein Samstag mit
 * workSchedule.saturday > 0 nie in die Rückgabe gelangte, sobald der Aufrufer nur
 * workSchedule statt des vollständigen user-Objekts weiterreichte.
 *
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param user Vollständiges Nutzerobjekt (workSchedule und weeklyHours stecken bereits darin)
 * @param periods Perioden-Kontext (D3, PFLICHTPARAMETER OHNE VORGABEWERT): Diese Funktion
 *   ist exportiert und schleift über Tage — ein Vorgabewert würde hier einen neuen Cache je
 *   Aufruf erzeugen. Der Aufrufer in dieser Datei reicht seinen eigenen Kontext durch.
 * @returns Array of date strings (YYYY-MM-DD) for all working days
 */
export function getAllWorkingDaysBetween(
  startDate: string,
  endDate: string,
  user: TargetHoursUser,
  periods: WorkPeriodContext
): string[] {
  const workingDays: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  // Iterate through each day
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d, 'yyyy-MM-dd');

    // getDailyTargetHours() prüft Feiertag, workSchedule und Wochenende in dieser
    // Reihenfolge selbst (workingDays.ts:66-91). Ein Tag ist genau dann ein Arbeitstag,
    // wenn diese eine, kanonische Auflösung Stunden > 0 liefert.
    const targetHours = getDailyTargetHours(user, dateStr, periods);
    if (targetHours > 0) {
      workingDays.push(dateStr);
    }
  }

  return workingDays;
}

/**
 * WR-13: Liest den in `users.workSchedule` gespeicherten JSON-Text OHNE `any`.
 * `JSON.parse()` kann werfen (kaputter Text) und liefert sonst `any` — beides wird hier
 * abgefangen: das Ergebnis geht als `unknown` durch `isStoredWorkSchedule()`. Schlägt eine
 * der beiden Prüfungen fehl, wird das protokolliert und `null` zurückgegeben (Rückfall auf
 * die Wochenstunden der jeweiligen Periode), statt still mit einem unvollständigen Objekt
 * weiterzurechnen.
 */
function parseStoredWorkSchedule(raw: string | null, userId: number): WorkSchedule | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    logger.warn(
      { userId, err: error },
      'users.workSchedule ist kein gültiges JSON — Tagesplan wird als nicht gesetzt behandelt'
    );
    return null;
  }

  if (!isStoredWorkSchedule(parsed)) {
    logger.warn(
      { userId },
      'users.workSchedule trägt nicht für alle sieben Wochentage eine endliche Zahl — ' +
        'Tagesplan wird als nicht gesetzt behandelt'
    );
    return null;
  }

  return parsed;
}

export interface LiveOvertimeTransaction {
  date: string;
  type: 'time_entry' | 'feiertag' | 'vacation_credit' | 'sick_credit' | 'overtime_comp_credit' | 'special_credit' | 'unpaid_deduction' | 'correction' | 'model_change';
  hours: number;
  description: string;
  source: 'time_entries' | 'absence_requests' | 'overtime_corrections' | 'holidays' | 'work_period';
  referenceId?: number;
  // Phase 12 (REQ-29): nur bei type === 'model_change' gesetzt — Grundlage fuer die zweite
  // Beschreibungszeile im Kontoauszug ("Periode ab ... eingetragen am ... von ...").
  createdAt?: string;
  adminName?: string | null;
  /**
   * CR-01 (Code-Review Phase 12): nur bei `type === 'model_change'` gesetzt. Traegt den in
   * `overtime_transactions.hours` dokumentierten Differenzbetrag des Stundenwechsels,
   * WAEHREND `hours` bei dieser Zeile bewusst 0 ist.
   *
   * Grund: Diese Liste wird vollstaendig aus den Rohdaten neu gerechnet — mit den AKTUELL
   * gueltigen Perioden. Die Wirkung des Stundenwechsels steckt damit bereits vollstaendig in
   * den Tageszeilen ab dem Stichtag. Traegt die Journalzeile ihren Betrag zusaetzlich in
   * `hours`, dann gilt Summe(transactions) = currentBalance + balanceDelta: die angezeigten
   * Zeilen summieren sich nicht mehr auf den daneben angezeigten Saldo (der Saldo kommt aus
   * `calculateCurrentOvertimeBalance()` ueber denselben Zeitraum und kennt `model_change`
   * nicht). Mit `hours: 0` bleibt die Zeile sichtbar (REQ-29) und die Summe stimmt. Diese
   * Regel gilt AUSDRUECKLICH auch fuer Gegenbuchungen (Storno-Paar, DD-26 aus 13-06-PLAN.md):
   * die Gegenbuchung ist keine Ausnahme und bekommt keinen zweiten Sonderpfad.
   */
  documentedDelta?: number;
  // Phase 13 (REQ-31, DD-25): die folgenden fuenf Felder sind nur bei
  // `type === 'model_change'` gesetzt und tragen die Storno-Geschichte des Kontoauszugs.
  /** Die Id der Buchungszeile selbst — die Sprungmarke, ueber die die Oberflaeche zur
   *  Partnerzeile eines Storno-Paars springt (Original <-> Gegenbuchung). */
  id?: number;
  /** Gesetzt auf der Gegenbuchung: die Id der stornierten Originalzeile. `null` auf einer
   *  Originalzeile, die (noch) nicht storniert wurde. Stammt direkt aus der Spalte
   *  `overtime_transactions.reversalOf` (Migration 014). */
  reversalOf?: number | null;
  /** Gesetzt auf der stornierten Originalzeile: die Id ihrer Gegenbuchung. `null`, solange
   *  keine Gegenbuchung existiert. Abgeleitet ueber einen Selbst-Join auf `reversalOf`, keine
   *  eigene Spalte (DD-25 — redundante Spalten waeren eine zweite Quelle fuer dieselbe
   *  Aussage, vgl. 13-01-PLAN.md DD-4). */
  reversedBy?: number | null;
  /** `createdAt` der Gegenbuchung — wann die Stornierung vorgenommen wurde. `null`, solange
   *  keine Gegenbuchung existiert. */
  reversedAt?: string | null;
  /** Vor- und Nachname des Admins, der die Gegenbuchung erzeugt hat (`createdBy` der
   *  Gegenbuchung). `null`, solange keine Gegenbuchung existiert ODER `createdBy` der
   *  Gegenbuchung selbst `null` ist. */
  reversedByName?: string | null;
}

/**
 * Calculate live overtime transactions for a user
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for overtime display!
 * - Calculates from raw data (time_entries, absences, corrections)
 * - Always includes ALL days from hireDate to today
 * - Reflects changes instantly (no caching, no stale data)
 *
 * CONSISTENCY NOTE (Phase 2):
 * - Uses getDailyTargetHours() - same helper as UnifiedOvertimeService
 * - Calculation logic: overtime = actualHours - targetHours (consistent)
 * - This function focuses on transaction-level detail for UI display
 * - For aggregated results, use UnifiedOvertimeService or calculateCurrentOvertimeBalance()
 *
 * @param userId User ID
 * @param fromDate Optional start date (defaults to hireDate)
 * @param toDate Optional end date (defaults to today)
 * @returns Array of transactions, newest first
 */
export function calculateLiveOvertimeTransactions(
  userId: number,
  fromDate?: string,
  toDate?: string
): LiveOvertimeTransaction[] {
  // Get user with work schedule
  const user = db.prepare(`
    SELECT id, hireDate, weeklyHours, workSchedule
    FROM users
    WHERE id = ?
  `).get(userId) as { id: number; hireDate: string; weeklyHours: number; workSchedule: string | null } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Parse workSchedule
  //
  // WR-13 (Code-Review Phase 12): `JSON.parse()` liefert `any`. Der Wert wanderte ungeprüft
  // in `getDailyTargetHours()` und damit in jede Sollstundenrechnung — genau der Fall, den
  // `.claude/CLAUDE.md` mit "kein `any` — `unknown` + Type Guards" verbietet. Ein kaputter
  // oder unvollständiger Text darf nicht still weitergerechnet werden: er wird protokolliert
  // und wie ein fehlender Tagesplan behandelt (`null` → Rückfall auf die Wochenstunden der
  // jeweiligen Periode).
  const workSchedule = parseStoredWorkSchedule(user.workSchedule, userId);

  // Determine date range (never before hireDate!)
  const startDate = fromDate && fromDate > user.hireDate
    ? fromDate
    : user.hireDate;
  // WR-10 (Code-Review Phase 13) — ZWEI VERSCHIEDENE BEREICHSENDEN:
  //
  // `journalEndDate` ist das ANGEFRAGTE Ende (z. B. der letzte Tag des gewählten Monats,
  // auch wenn er in der Zukunft liegt). `endDate` ist das Ende der TAGESBERECHNUNG und wird
  // hart auf heute gedeckelt — für Zukunftstage gibt es keine Ist-Daten, eine Tageszeile
  // dort trüge ein volles Tagessoll ohne Ist.
  //
  // WARUM DIE TRENNUNG: Die Deckelung lag bisher im Client (`useWorkTimeAccounts.ts` setzte
  // `toDate = heute`). Damit fielen auch die reinen LEDGER-Zeilen aus dem Fenster: eine
  // Korrekturbuchung mit `date = validFrom` in der Zukunft (Korrektur einer geplanten
  // Periode) und ihre Gegenbuchung erschienen in KEINEM Zeitraum des Kontoauszugs. REQ-31
  // („die Storno-Geschichte bleibt im Auszug sichtbar") galt für diese Zeilen faktisch nicht.
  // Der Client deckelt deshalb nicht mehr; die Deckelung steht jetzt hier, wo sie hingehört
  // — und gilt nur für die Tageszeilen, nicht für das Journal.
  const today = formatDate(getCurrentDate(), 'yyyy-MM-dd');
  const journalEndDate = toDate || today;
  const endDate = journalEndDate > today ? today : journalEndDate;

  logger.debug(
    { userId, startDate, endDate, journalEndDate },
    '📊 Calculating live overtime transactions'
  );

  const transactions: LiveOvertimeTransaction[] = [];

  // D1/D2: EIN Perioden-Kontext für diesen gesamten Berechnungslauf, vor der ersten
  // Schleife gebaut und an alle Fundstellen unten sowie an getAllWorkingDaysBetween()
  // durchgereicht.
  const periods = createWorkPeriodContext();

  // Build user object for getDailyTargetHours()
  // hireDate ergänzt (D4-Ausnahme): ohne ihn würde ein Tag vor dem Eintrittsdatum die
  // Live-Anzeige mit MissingWorkPeriodError abbrechen lassen. Der Wert liegt hier bereits
  // vor (user.hireDate wird oben für die Bereichsgrenze benutzt).
  // WR-13: `TargetHoursUser` statt `as UserPublic` — der Cast unterdrückte, dass dieses
  // Objekt die meisten Pflichtfelder von `UserPublic` gar nicht trägt. Der schmalere Typ
  // beschreibt genau das, was hier vorliegt und was die Sollstunden-Auflösung braucht.
  const userForCalc: TargetHoursUser = {
    id: user.id,
    weeklyHours: user.weeklyHours,
    workSchedule,
    hireDate: user.hireDate,
  };

  // ========================================
  // 1. Get approved absences and build Set of absence dates
  // ========================================
  const absencesQuery = db.prepare(`
    SELECT id, type, startDate, endDate, days
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND endDate >= ?
      AND startDate <= ?
    ORDER BY startDate DESC
  `);

  const absences = absencesQuery.all(userId, startDate, endDate) as Array<{
    id: number;
    type: 'vacation' | 'sick' | 'overtime_comp' | 'special' | 'unpaid';
    startDate: string;
    endDate: string;
    days: number;
  }>;

  // Build Set of absence dates (working days only, excluding holidays/weekends)
  //
  // REQ-19, 09-REQ19-BEFUND.md, CR-01 (09-REVIEW.md), 09-INVENTAR-KREDITIERUNG.md #6:
  // absenceDates wird bewusst OHNE Typfilter aufgebaut (alle Abwesenheitstypen, inkl.
  // overtime_comp), weil Schritt 4 unten weiterhin für ALLE Abwesenheitstage keine eigene
  // "earned"-Buchung erzeugen darf, AUSSER für overtime_comp — dafür wird hier zusätzlich
  // overtimeCompDates befüllt: die Teilmenge der Abwesenheitstage, die vom Überstundenkonto
  // selbst bezahlt werden und deshalb wie ein normaler "kein Zeiteintrag"-Tag behandelt
  // werden müssen (negative earned-Buchung, keine Gutschrift).
  const absenceDates = new Set<string>();
  const overtimeCompDates = new Set<string>();
  for (const absence of absences) {
    const absenceStartDate = new Date(absence.startDate + 'T12:00:00');
    const absenceEndDate = new Date(absence.endDate + 'T12:00:00');

    for (let d = new Date(absenceStartDate); d <= absenceEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');

      if (dateStr < startDate || dateStr > endDate) continue;

      const dayOfWeek = d.getDay();
      if (!workSchedule && (dayOfWeek === 0 || dayOfWeek === 6)) continue;

      const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue;

      const targetHours = getDailyTargetHours(userForCalc, dateStr, periods);
      if (targetHours === 0) continue;

      absenceDates.add(dateStr);
      if (absence.type === 'overtime_comp') {
        overtimeCompDates.add(dateStr);
      }
    }
  }

  // ========================================
  // 2. Load holidays and add as transactions
  // ========================================
  const holidaysQuery = db.prepare(`
    SELECT date, name, federal
    FROM holidays
    WHERE date >= ?
      AND date <= ?
    ORDER BY date DESC
  `);

  const holidays = holidaysQuery.all(startDate, endDate) as Array<{
    date: string;
    name: string;
    federal: number;
  }>;

  // Add holiday transactions (informational, hours = 0)
  for (const holiday of holidays) {
    const federalText = holiday.federal === 0 ? ' (Bayern)' : ' (Bundesweit)';
    transactions.push({
      date: holiday.date,
      type: 'feiertag',
      hours: 0,
      description: `${holiday.name}${federalText}`,
      source: 'holidays',
    });
  }

  // ========================================
  // 3. Load time_entries as Map for fast lookup
  // ========================================
  const timeEntryQuery = db.prepare(`
    SELECT date, SUM(hours) as totalHours
    FROM time_entries
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY date
  `);

  const timeEntries = timeEntryQuery.all(userId, startDate, endDate) as Array<{
    date: string;
    totalHours: number;
  }>;

  const timeEntriesMap = new Map<string, number>();
  for (const entry of timeEntries) {
    timeEntriesMap.set(entry.date, entry.totalHours);
  }

  // ========================================
  // 4. Calculate "earned" transactions for ALL working days
  // ========================================
  const allWorkingDays = getAllWorkingDaysBetween(startDate, endDate, userForCalc, periods);

  for (const date of allWorkingDays) {
    // Skip days with absences (they get their own credit transactions below) — AUSSER
    // overtime_comp-Tagen (REQ-19, CR-01): Ein Überstundenausgleich wird AUS dem
    // Überstundenkonto selbst bezahlt, muss also die normale negative earned-Buchung
    // erhalten wie ein Tag ohne Zeiterfassung, statt übersprungen zu werden.
    if (absenceDates.has(date) && !overtimeCompDates.has(date)) {
      continue;
    }

    const targetHours = getDailyTargetHours(userForCalc, date, periods);
    const actualHours = timeEntriesMap.get(date) || 0;
    const overtime = actualHours - targetHours;

    // Only show days with non-zero overtime
    if (overtime !== 0) {
      const description = actualHours === 0
        ? `Keine Zeiterfassung (Soll: ${targetHours}h)`
        : `Gearbeitet: ${actualHours}h (Soll: ${targetHours}h)`;

      transactions.push({
        date,
        type: 'time_entry',
        hours: Math.round(overtime * 100) / 100, // Round to 2 decimals
        description,
        source: 'time_entries',
      });
    }
  }

  // ========================================
  // 5. Add absence credit transactions
  // ========================================
  // Process each absence
  for (const absence of absences) {
    const absenceStartDate = new Date(absence.startDate + 'T12:00:00');
    const absenceEndDate = new Date(absence.endDate + 'T12:00:00');

    // Iterate through each day in the absence period
    for (let d = new Date(absenceStartDate); d <= absenceEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');

      // Only include days within our calculation range
      if (dateStr < startDate || dateStr > endDate) {
        continue;
      }

      const dayOfWeek = d.getDay();

      // Skip weekends (unless workSchedule says otherwise)
      if (!workSchedule && (dayOfWeek === 0 || dayOfWeek === 6)) {
        continue;
      }

      // Check if this day is a holiday
      const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) {
        continue; // Holidays don't count as absence days
      }

      // Get target hours for this day
      const targetHours = getDailyTargetHours(userForCalc, dateStr, periods);

      // Skip days with 0 target hours (days off in workSchedule)
      if (targetHours === 0) {
        continue;
      }

      // Map absence type to transaction type
      let transactionType: LiveOvertimeTransaction['type'];
      let description: string;

      switch (absence.type) {
        case 'vacation':
          transactionType = 'vacation_credit';
          description = `Urlaub (genehmigt #${absence.id})`;
          break;
        case 'sick':
          transactionType = 'sick_credit';
          description = `Krankheit (genehmigt #${absence.id})`;
          break;
        case 'overtime_comp':
          // REQ-19, CR-01: overtime_comp erhält keine Gutschrift mehr (die negative
          // earned-Buchung entsteht bereits in Schritt 4 oben). Der Eintrag bleibt hier
          // als informationelle 0h-Zeile erhalten (wie unpaid_deduction), damit der
          // genehmigte Ausgleichstag in der Liste sichtbar bleibt — getTypePriority-
          // Sortierung (unten, Prio 2) und Anzeigelogik bleiben dadurch unverändert.
          transactionType = 'overtime_comp_credit';
          description = `Überstundenausgleich (genehmigt #${absence.id})`;
          break;
        case 'special':
          transactionType = 'special_credit';
          description = `Sonderurlaub (genehmigt #${absence.id})`;
          break;
        case 'unpaid':
          transactionType = 'unpaid_deduction';
          description = `Unbezahlter Urlaub (genehmigt #${absence.id})`;
          break;
        default:
          continue; // Unknown type, skip
      }

      // Add transaction
      // IMPORTANT: unpaid_adjustment shows 0 hours (reduces target, no credit).
      // overtime_comp likewise shows 0 hours (REQ-19, CR-01): the day is paid FROM the
      // overtime account itself via the negative earned-Buchung from Schritt 4, not
      // credited a second time here.
      const hours = (absence.type === 'unpaid' || absence.type === 'overtime_comp') ? 0 : targetHours;

      transactions.push({
        date: dateStr,
        type: transactionType,
        hours: Math.round(hours * 100) / 100,
        description,
        source: 'absence_requests',
        referenceId: absence.id,
      });
    }
  }

  // ========================================
  // 6. Add manual corrections
  // ========================================
  const correctionsQuery = db.prepare(`
    SELECT id, date, hours, reason
    FROM overtime_corrections
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    ORDER BY date DESC
  `);

  const corrections = correctionsQuery.all(userId, startDate, endDate) as Array<{
    id: number;
    date: string;
    hours: number;
    reason: string;
  }>;

  for (const correction of corrections) {
    transactions.push({
      date: correction.date,
      type: 'correction',
      hours: Math.round(correction.hours * 100) / 100,
      description: `Korrektur: ${correction.reason}`,
      source: 'overtime_corrections',
      referenceId: correction.id,
    });
  }

  // ========================================
  // 6b. Add model_change bookings (Phase 12, REQ-29)
  // ========================================
  // Die im Kontoauszug sichtbare Journalzeile fuer einen Stundenwechsel
  // (workPeriodChangeService.applyWorkTimeChange(), D5): ein unveraenderlicher
  // Ledger-Eintrag in `overtime_transactions`, den diese Live-Ansicht bisher nicht las (sie
  // rechnet ausschliesslich aus time_entries/absence_requests/overtime_corrections neu).
  // Rein additiv und rein informationell: veraendert weder die obige Tagesberechnung noch
  // calculateCurrentOvertimeBalance() (die getrennt ueber unifiedOvertimeService rechnet,
  // siehe 12-05-SUMMARY.md, "Bestaetigung des Saldo-Lesepfads" — Loeschen dieser einen Zeile
  // aendert den zurueckgegebenen Saldo nachweislich nicht).
  //
  // CR-01 (Code-Review Phase 12): "rein informationell" gilt seit dieser Korrektur auch
  // fuer `hours`. Die Zeile wird mit `hours: 0` angehaengt, ihr dokumentierter Betrag steht
  // in `documentedDelta`. Vorher trug sie `overtime_transactions.hours` — und weil die
  // Tageszeilen dieser Liste bereits mit dem NEUEN Tagessoll gerechnet werden, war der
  // Betrag darin ein zweites Mal enthalten: Summe(transactions) lag um genau diesen Betrag
  // ueber dem daneben angezeigten `currentBalance`. Der Kontoauszug zeigte damit Zeilen, die
  // sich nicht mehr auf den angezeigten Saldo summieren.
  // Phase 13 (REQ-31, DD-25): reversalOf zusaetzlich gelesen, plus ein Selbst-Join
  // (LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id) fuer die umgekehrte
  // Richtung — von der Originalzeile zu ihrer (falls vorhandenen) Gegenbuchung. `ru` ist
  // der Admin, der die Gegenbuchung angelegt hat (r.createdBy), nicht der Admin des
  // Originals (u). ORDER BY ... ot.id ASC (DD-27) haelt das Original bei gleichem Datum
  // stabil vor seiner Gegenbuchung — sonst haenge die Reihenfolge des Paares vom Zufall
  // der Abfrage ab.
  const modelChangeQuery = db.prepare(`
    SELECT ot.id, ot.date, ot.hours, ot.description, ot.createdAt, ot.reversalOf,
           u.firstName as adminFirstName, u.lastName as adminLastName,
           r.id as reversedBy, r.createdAt as reversedAt,
           ru.firstName as reversedByFirstName, ru.lastName as reversedByLastName
    FROM overtime_transactions ot
    LEFT JOIN users u ON u.id = ot.createdBy
    LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id
    LEFT JOIN users ru ON ru.id = r.createdBy
    WHERE ot.userId = ?
      AND ot.type = 'model_change'
      AND ot.date >= ?
      AND ot.date <= ?
    ORDER BY ot.date DESC, ot.id ASC
  `);

  // WR-10: `journalEndDate` statt `endDate` — Journalzeilen mit einem Datum in der Zukunft
  // (Korrektur/Storno einer geplanten Periode) bleiben sichtbar. Sie tragen ohnehin
  // `hours: 0` und gehen in keine Summe ein.
  const modelChangeRows = modelChangeQuery.all(userId, startDate, journalEndDate) as Array<{
    id: number;
    date: string;
    hours: number;
    description: string | null;
    createdAt: string;
    reversalOf: number | null;
    adminFirstName: string | null;
    adminLastName: string | null;
    reversedBy: number | null;
    reversedAt: string | null;
    reversedByFirstName: string | null;
    reversedByLastName: string | null;
  }>;

  for (const row of modelChangeRows) {
    const adminName =
      row.adminFirstName && row.adminLastName ? `${row.adminFirstName} ${row.adminLastName}` : null;
    const reversedByName =
      row.reversedByFirstName && row.reversedByLastName
        ? `${row.reversedByFirstName} ${row.reversedByLastName}`
        : null;

    transactions.push({
      date: row.date,
      type: 'model_change',
      hours: 0, // CR-01: siehe Kommentar oben — die Wirkung steckt in den Tageszeilen; gilt
      // unveraendert auch fuer Gegenbuchungen (DD-26)
      documentedDelta: Math.round(row.hours * 100) / 100,
      description: row.description || '',
      source: 'work_period',
      // DD-24: die gemeinsame Belegnummer beider Paarzeilen ist die Id der Originalbuchung —
      // auf der Gegenbuchung `row.reversalOf` (zeigt bereits auf das Original), auf der
      // Originalzeile (noch) ohne Gegenbuchung `row.id` selbst. Der maschinenlesbare Sprung
      // der Oberflaeche laeuft NICHT ueber referenceId, sondern ueber id/reversalOf/reversedBy.
      referenceId: row.reversalOf ?? row.id,
      createdAt: row.createdAt,
      adminName,
      id: row.id,
      reversalOf: row.reversalOf ?? null,
      reversedBy: row.reversedBy ?? null,
      reversedAt: row.reversedAt ?? null,
      reversedByName,
    });
  }

  // ========================================
  // 7. Check for work on non-working days (holidays, weekends, days off)
  // ========================================
  // If someone worked on a non-working day, we need to add those hours as overtime
  // (since these days are not in allWorkingDays)
  for (const [date, actualHours] of timeEntriesMap.entries()) {
    // Skip if already processed (in allWorkingDays or absenceDates)
    if (allWorkingDays.includes(date) || absenceDates.has(date)) {
      continue;
    }

    // Any work on non-working days counts as overtime
    if (actualHours > 0) {
      const targetHours = getDailyTargetHours(userForCalc, date, periods);
      const overtime = actualHours - targetHours; // Usually targetHours = 0 for non-working days

      const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(date);
      const description = isHoliday
        ? `Gearbeitet am Feiertag: ${actualHours}h (Soll: ${targetHours}h)`
        : `Gearbeitet: ${actualHours}h (Soll: ${targetHours}h)`;

      transactions.push({
        date,
        type: 'time_entry',
        hours: Math.round(overtime * 100) / 100,
        description,
        source: 'time_entries',
      });
    }
  }

  // ========================================
  // 8. Sort by date (newest first) and return
  // ========================================
  transactions.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;

    // If same date, sort by type priority (holidays first, then the daily booking, then
    // absence credits, then corrections, then the model change journal line).
    //
    // WR-06 (Code-Review Phase 12): Die Tabelle kannte 'earned' und 'unpaid_adjustment' —
    // beides Typen, die DIESE Funktion nie erzeugt — und ausgerechnet 'time_entry' und
    // 'unpaid_deduction' nicht. Beide fielen auf den Ersatzwert 99 und sortierten dadurch
    // HINTER das in Phase 12 ergaenzte 'model_change: 4'; am Stichtag stand die
    // Modellwechsel-Zeile also ueber der Tagesbuchung desselben Tages, entgegen der hier
    // beschriebenen Absicht ("dann Korrekturen", also zuletzt).
    //
    // Zusaetzlich verdeckte `|| 99` einen echten Nullwert: Prioritaet 0 ('feiertag') fiel
    // durch den falsy-Test ebenfalls auf 99. Deshalb `??` statt `||`.
    const typePriority: Record<string, number> = {
      feiertag: 0,
      time_entry: 1,
      vacation_credit: 2,
      sick_credit: 2,
      overtime_comp_credit: 2,
      special_credit: 2,
      unpaid_deduction: 2,
      correction: 3,
      model_change: 4,
    };
    return (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99);
  });

  logger.debug({ userId, transactionCount: transactions.length }, '✅ Live transactions calculated');

  return transactions;
}

/**
 * Calculate current overtime balance (cumulative sum)
 *
 * MIGRATION TO UNIFIED SERVICE (Phase 2):
 * Delegates to UnifiedOvertimeService for consistent calculation logic
 *
 * IMPORTANT: This matches the balance displayed in WorkTimeAccountWidget
 * - Calculates from single source of truth (UnifiedOvertimeService)
 * - Includes worked hours, absence credits, corrections, unpaid adjustments
 *
 * @param userId User ID
 * @param fromDate Optional start date (defaults to hireDate)
 * @param toDate Optional end date (defaults to today)
 * @returns Total overtime balance
 */
export function calculateCurrentOvertimeBalance(
  userId: number,
  fromDate?: string,
  toDate?: string
): number {
  // Get user to determine date range
  // BL-01 (Phase 14.1, D-01): `AND deletedAt IS NULL` wie in `userService.getUserById()` und
  // `unifiedOvertimeService.getUser()`. Ohne den Filter lieferte diese Abfrage auch fuer einen
  // soft-geloeschten Nutzer eine Zeile, und der `throw` unten blieb wirkungslos.
  const user = db.prepare(`
    SELECT id, hireDate
    FROM users
    WHERE id = ? AND deletedAt IS NULL
  `).get(userId) as { id: number; hireDate: string } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Determine date range (never before hireDate!)
  const startDate = fromDate && fromDate > user.hireDate
    ? fromDate
    : user.hireDate;
  // BL-01 (Phase 14.1, D-01) — DECKELUNG AUF HEUTE:
  //
  // Diese Zahl steht im Kontoauszug direkt ueber der Buchungsliste, die
  // `calculateLiveOvertimeTransactions()` liefert. Jene Schwesterfunktion deckelt ihr
  // Berechnungsende seit dem WR-10-Fix hart auf heute (siehe dort). Hier fehlte die Deckelung:
  // ein `toDate` in der Zukunft (der Client schickt den Monatsletzten) wurde ungeprueft
  // uebernommen, und jeder kuenftige Arbeitstag ging mit vollem Tagessoll ohne Ist als Minus
  // ein. Beide Zahlen muessen aus demselben Zeitraum stammen — deshalb gilt hier dieselbe Regel.
  const today = formatDate(getCurrentDate(), 'yyyy-MM-dd');
  const requestedEndDate = toDate || today;
  const endDate = requestedEndDate > today ? today : requestedEndDate;

  // Delegate to UnifiedOvertimeService (Single Source of Truth)
  const periodResult = unifiedOvertimeService.calculatePeriodOvertime(
    userId,
    startDate,
    endDate
  );

  return Math.round(periodResult.overtime * 100) / 100; // Round to 2 decimals
}
