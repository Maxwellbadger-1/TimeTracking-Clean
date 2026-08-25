/**
 * Unified Overtime Service - SINGLE SOURCE OF TRUTH
 *
 * PURPOSE: Consolidate all overtime calculation logic into one place
 * REPLACES: Dual calculation system (reportService, overtimeService, overtimeLiveCalc)
 * STANDARD: Professional pattern used by SAP, Personio, DATEV
 *
 * Architecture Decision: ADR-006
 * Migration Guide: MIGRATION_GUIDE.md Phase 2
 *
 * CRITICAL RULES:
 * 1. ALL overtime calculations MUST go through this service
 * 2. NO other service may calculate overtime independently
 * 3. Calculation formula is IMMUTABLE (change requires approval)
 * 4. Always uses timezone-safe date operations
 */

import { db } from '../database/connection.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import type { UserPublic } from '../types/index.js';
import logger from '../utils/logger.js';
import type { WorkPeriodContext } from './workPeriodContext.js';
import { createWorkPeriodContext, directWorkPeriodLookup } from './workPeriodContext.js';

/**
 * Daily overtime calculation result
 */
export interface DailyOvertimeResult {
  date: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
  breakdown: {
    worked: number;
    absenceCredit: number;
    corrections: number;
    unpaidReduction: number;
  };
}

/**
 * Monthly overtime calculation result
 */
export interface MonthlyOvertimeResult {
  month: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
  breakdown: {
    worked: number;
    absenceCredits: number;
    corrections: number;
    unpaidReduction: number;
  };
  dailyResults: DailyOvertimeResult[];
}

/**
 * Period overtime calculation result
 */
export interface PeriodOvertimeResult {
  startDate: string;
  endDate: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
  breakdown: {
    worked: number;
    absenceCredits: number;
    corrections: number;
    unpaidReduction: number;
  };
  dailyResults: DailyOvertimeResult[];
}

/**
 * Unified Overtime Service - Singleton
 */
export class UnifiedOvertimeService {
  private static instance: UnifiedOvertimeService;

  private constructor() {
    logger.info('UnifiedOvertimeService initialized - Single Source of Truth');
  }

  static getInstance(): UnifiedOvertimeService {
    if (!this.instance) {
      this.instance = new UnifiedOvertimeService();
    }
    return this.instance;
  }

  /**
   * Calculate overtime for a single day
   *
   * CORE FORMULA:
   * Overtime = Actual Hours - Target Hours
   *
   * Where:
   * - Target Hours = getDailyTargetHours(user, date), reduced to 0 for unpaid leave
   * - Actual Hours = Worked + Absence Credits + Corrections
   *
   * UNPAID LEAVE (CLAUDE.md): "Reduziert Soll-Stunden, keine Gutschrift"
   * → targetHours = 0, actualHours = 0, overtime = 0
   *
   * @param userId - User ID
   * @param date - Date in YYYY-MM-DD format
   * @param periods - Perioden-Kontext (Plan 11-05). Vorgabewert `directWorkPeriodLookup`:
   *   Diese Dienstmethode wird auch von Routen aufgerufen, die keinen eigenen
   *   Berechnungslauf kennen und daher keinen Kontext übergeben (D3 verlangt für
   *   `getDailyTargetHours` selbst einen Pflichtparameter, damit der Compiler jede
   *   Aufrufstelle im Projekt erzwingt — dieser Vorgabewert hier hält stattdessen die
   *   Signatur der Routen-Aufrufer stabil und liefert nach D2 dieselbe Semantik: kein
   *   prozessweiter Cache, nur ohne Vorladen). `calculateMonthlyOvertime`/
   *   `calculatePeriodOvertime` reichen ihren eigenen, einmal je Lauf gebauten Kontext
   *   durch, statt sich auf diesen Vorgabewert zu verlassen.
   * @returns Daily overtime result
   */
  calculateDailyOvertime(
    userId: number,
    date: string,
    periods: WorkPeriodContext = directWorkPeriodLookup
  ): DailyOvertimeResult {
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const rawTargetHours = getDailyTargetHours(user, date, periods);

    // Unbezahlter Urlaub: Soll auf 0 reduzieren, keine Ist-Gutschrift
    const unpaidReduction = this.getUnpaidReduction(userId, date, rawTargetHours);
    const targetHours = unpaidReduction > 0 ? 0 : rawTargetHours;

    const worked = this.getWorkedHours(userId, date);
    const absenceCredit = this.getAbsenceCredit(userId, date, rawTargetHours);
    const corrections = this.getCorrections(userId, date);

    const actualHours = worked + absenceCredit + corrections;
    const overtime = actualHours - targetHours;

    return {
      date,
      targetHours,
      actualHours,
      overtime,
      breakdown: {
        worked,
        absenceCredit,
        corrections,
        unpaidReduction,
      },
    };
  }

  /**
   * Calculate overtime for an entire month
   *
   * @param userId - User ID
   * @param month - Month in YYYY-MM format
   * @param periods - Perioden-Kontext (Plan 11-05, D1). Vorgabewert baut einen neuen
   *   `createWorkPeriodContext()` bei JEDEM Aufruf (Parameter-Default, kein
   *   Modul-Konstanten-Objekt) — dadurch lädt ein Monatslauf die Perioden des Nutzers
   *   genau einmal, nicht einmal je Tag, ohne einen in D2 verbotenen prozessweiten Cache
   *   zu erzeugen.
   * @returns Monthly overtime result
   */
  calculateMonthlyOvertime(
    userId: number,
    month: string,
    periods: WorkPeriodContext = createWorkPeriodContext()
  ): MonthlyOvertimeResult {
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get date range for month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    const today = getCurrentDate();

    // Cap to today if in current month
    const effectiveEndDate = endDate > today ? today : endDate;

    // Respect hire date - parse in local timezone to match startDate/endDate
    const [hYear, hMonth, hDay] = user.hireDate.split('-').map(Number);
    const hireDate = new Date(hYear, hMonth - 1, hDay);
    const effectiveStartDate = startDate < hireDate ? hireDate : startDate;

    // Skip months entirely before employment
    if (effectiveStartDate > effectiveEndDate) {
      return {
        month,
        targetHours: 0,
        actualHours: 0,
        overtime: 0,
        breakdown: {
          worked: 0,
          absenceCredits: 0,
          corrections: 0,
          unpaidReduction: 0,
        },
        dailyResults: [],
      };
    }

    // Calculate daily overtime for each day in range
    const dailyResults: DailyOvertimeResult[] = [];
    for (let d = new Date(effectiveStartDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const dailyResult = this.calculateDailyOvertime(userId, dateStr, periods);
      dailyResults.push(dailyResult);
    }

    // Aggregate results
    const totals = dailyResults.reduce(
      (acc, day) => ({
        targetHours: acc.targetHours + day.targetHours,
        actualHours: acc.actualHours + day.actualHours,
        overtime: acc.overtime + day.overtime,
        worked: acc.worked + day.breakdown.worked,
        absenceCredits: acc.absenceCredits + day.breakdown.absenceCredit,
        corrections: acc.corrections + day.breakdown.corrections,
        unpaidReduction: acc.unpaidReduction + day.breakdown.unpaidReduction,
      }),
      {
        targetHours: 0,
        actualHours: 0,
        overtime: 0,
        worked: 0,
        absenceCredits: 0,
        corrections: 0,
        unpaidReduction: 0,
      }
    );

    return {
      month,
      targetHours: totals.targetHours,
      actualHours: totals.actualHours,
      overtime: totals.overtime,
      breakdown: {
        worked: totals.worked,
        absenceCredits: totals.absenceCredits,
        corrections: totals.corrections,
        unpaidReduction: totals.unpaidReduction,
      },
      dailyResults,
    };
  }

  /**
   * Calculate overtime for a custom date range
   *
   * @param userId - User ID
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @param periods - Perioden-Kontext (Plan 11-05, D1) — wie bei `calculateMonthlyOvertime`
   *   ein frischer `createWorkPeriodContext()` je Aufruf.
   * @returns Period overtime result
   */
  calculatePeriodOvertime(
    userId: number,
    startDate: string,
    endDate: string,
    periods: WorkPeriodContext = createWorkPeriodContext()
  ): PeriodOvertimeResult {
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Respect hire date - parse in local timezone for consistency
    const [hYear, hMonth, hDay] = user.hireDate.split('-').map(Number);
    const hireDate = new Date(hYear, hMonth - 1, hDay);
    const requestedStart = new Date(startDate);
    const requestedEnd = new Date(endDate);
    const effectiveStartDate = requestedStart < hireDate ? hireDate : requestedStart;

    // BL-01 (Phase 14.1, D-01) — DECKELUNG AUF HEUTE, wie im Schwestermodell
    // `calculateMonthlyOvertime()` (dort `effectiveEndDate`, weiter oben in dieser Datei).
    // Fuer Tage in der Zukunft gibt es keine Ist-Daten; eine Tageszeile dort truege ein volles
    // Tagessoll ohne Ist und zoege den Zeitraumsaldo ins Minus. Die Deckelung steht hier in der
    // Berechnung selbst, damit sie kein Aufrufer erneut vergessen kann.
    // `today` kommt aus `getCurrentDate()` (Berlin), nicht aus `new Date()` — Projektregel.
    const today = getCurrentDate();
    const effectiveEndDate = requestedEnd > today ? today : requestedEnd;

    // Calculate daily overtime for each day in range
    const dailyResults: DailyOvertimeResult[] = [];
    for (let d = new Date(effectiveStartDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const dailyResult = this.calculateDailyOvertime(userId, dateStr, periods);
      dailyResults.push(dailyResult);
    }

    // Aggregate results
    const totals = dailyResults.reduce(
      (acc, day) => ({
        targetHours: acc.targetHours + day.targetHours,
        actualHours: acc.actualHours + day.actualHours,
        overtime: acc.overtime + day.overtime,
        worked: acc.worked + day.breakdown.worked,
        absenceCredits: acc.absenceCredits + day.breakdown.absenceCredit,
        corrections: acc.corrections + day.breakdown.corrections,
        unpaidReduction: acc.unpaidReduction + day.breakdown.unpaidReduction,
      }),
      {
        targetHours: 0,
        actualHours: 0,
        overtime: 0,
        worked: 0,
        absenceCredits: 0,
        corrections: 0,
        unpaidReduction: 0,
      }
    );

    return {
      startDate: formatDate(effectiveStartDate, 'yyyy-MM-dd'),
      // BL-01 (Phase 14.1, D-01): `endDate` bleibt das ANGEFRAGTE Bereichsende und beschreibt
      // damit den Auftrag, nicht den Rechenweg. Gerechnet wurde bis `effectiveEndDate` (auf
      // heute gedeckelt) — dieselbe Trennung von angefragtem und berechnetem Ende wie in
      // `calculateLiveOvertimeTransactions()` (`journalEndDate` gegen `endDate`).
      endDate,
      targetHours: totals.targetHours,
      actualHours: totals.actualHours,
      overtime: totals.overtime,
      breakdown: {
        worked: totals.worked,
        absenceCredits: totals.absenceCredits,
        corrections: totals.corrections,
        unpaidReduction: totals.unpaidReduction,
      },
      dailyResults,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getUser(userId: number): UserPublic | null {
    const user = db
      .prepare(
        // WR-04 (Code-Review Phase 11, Durchlauf 2): `vacationDaysPerYear`, `status`,
        // `privacyConsentAt` und `createdAt` in die SELECT-Liste aufgenommen.
        //
        // WARUM: Die Zusicherung darunter behauptet ein vollständiges `UserPublic` minus
        // `workSchedule`. In `UserPublic` (types/index.ts:54-73) sind diese vier Felder
        // PFLICHTIG; die Abfrage lieferte sie nicht. Zur Laufzeit standen sie damit auf
        // `undefined`, während der Compiler ihre Existenz garantierte — und die Funktion
        // gibt das Objekt anschließend als vollständiges `UserPublic` zurück. Ein `any`
        // sagt "ich weiß es nicht"; dieser Typ sagte "ich weiß es" und lag falsch. Heute
        // liest nur `user.hireDate` (Zeile 189, 277) und `getDailyTargetHours()` daraus,
        // der Schaden war also latent — genau das machte ihn zur Falle für den nächsten
        // Aufrufer.
        //
        // Von den beiden im Befund genannten Wegen ist das der weniger invasive: Die
        // Spalten nachzuziehen kostet nichts (dieselbe Zeile, derselbe Index) und hält den
        // Rückgabetyp `UserPublic` — den `getDailyTargetHours(user: UserPublic, …)`
        // ohnehin verlangt. Dieselbe SELECT-Liste benutzt `absenceService.ts:772-777`.
        `SELECT id, username, firstName, lastName, email, role, department, position,
         weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status,
         privacyConsentAt, createdAt
         FROM users WHERE id = ? AND deletedAt IS NULL`
      )
      // WR-09: `as any` ersetzt. `workSchedule` kommt als rohe JSON-Zeichenkette aus
      // SQLite und wird direkt darunter geparst — der Zeilentyp bildet genau das ab.
      .get(userId) as (Omit<UserPublic, 'workSchedule'> & { workSchedule: string | null }) | undefined;

    if (!user) return null;

    // Parse workSchedule JSON string to object.
    // WR-04: Die abschließende `as UserPublic`-Zusicherung ist entfallen — nach der
    // Ergänzung oben stimmt die Form ohne Nachhelfen, und der Compiler prüft sie wieder.
    return {
      ...user,
      workSchedule: user.workSchedule ? JSON.parse(user.workSchedule) : null,
    };
  }

  private getWorkedHours(userId: number, date: string): number {
    const result = db
      .prepare(
        `SELECT COALESCE(SUM(hours), 0) as total
         FROM time_entries
         WHERE userId = ? AND date = ?`
      )
      .get(userId, date) as { total: number };

    return result.total;
  }

  private getAbsenceCredit(userId: number, date: string, targetHours: number): number {
    // Only credit for absences that give credit FROM ANOTHER ACCOUNT (vacation, sick, special).
    // NOT for unpaid leave (reduces target instead, see getUnpaidReduction()).
    // NOT for overtime_comp (REQ-19, 09-REQ19-BEFUND.md, Hypothese H1): Ein genehmigter
    // Überstundenausgleich wird AUS dem Überstundenkonto selbst bezahlt. Eine zusätzliche
    // Tagesgutschrift auf genau dieses Konto würde den Tag zweimal zahlen und den Ausgleichstag
    // saldoneutral halten, statt den Saldo um die Sollstunden dieses Tages zu senken
    // (.claude/CLAUDE.md → Überstunden-Berechnung).
    const result = db
      .prepare(
        `SELECT type
         FROM absence_requests
         WHERE userId = ?
           AND status = 'approved'
           AND date(?) BETWEEN date(startDate) AND date(endDate)
           AND type IN ('vacation', 'sick', 'special')`
      )
      .get(userId, date) as { type: string } | undefined;

    // If there's an approved absence on this day, credit the target hours
    // (as if the user worked that day)
    return result && targetHours > 0 ? targetHours : 0;
  }

  private getCorrections(userId: number, date: string): number {
    const result = db
      .prepare(
        `SELECT COALESCE(SUM(hours), 0) as total
         FROM overtime_corrections
         WHERE userId = ? AND date = ?`
      )
      .get(userId, date) as { total: number };

    return result.total;
  }

  private getUnpaidReduction(userId: number, date: string, targetHours: number): number {
    // Unpaid leave reduces target hours (effectively reducing actual hours)
    const result = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM absence_requests
         WHERE userId = ?
           AND status = 'approved'
           AND type = 'unpaid'
           AND date(?) BETWEEN date(startDate) AND date(endDate)`
      )
      .get(userId, date) as { count: number };

    // If there's unpaid leave on this day, it reduces actual hours by the target
    return result.count > 0 && targetHours > 0 ? targetHours : 0;
  }
}

// Export singleton instance
export const unifiedOvertimeService = UnifiedOvertimeService.getInstance();
