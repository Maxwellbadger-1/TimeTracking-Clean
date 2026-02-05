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
   * CORE FORMULA (IMMUTABLE):
   * Overtime = Actual Hours - Target Hours
   *
   * Where:
   * - Target Hours = getDailyTargetHours(user, date) // Respects workSchedule, holidays
   * - Actual Hours = Worked + Absence Credits + Corrections - Unpaid Reduction
   *
   * @param userId - User ID
   * @param date - Date in YYYY-MM-DD format
   * @returns Daily overtime result
   */
  calculateDailyOvertime(userId: number, date: string): DailyOvertimeResult {
    // Get user data
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Calculate target hours (respects workSchedule, holidays, weekends)
    const targetHours = getDailyTargetHours(user, date);

    // Get worked hours for this date
    const worked = this.getWorkedHours(userId, date);

    // Get absence credits (vacation, sick, overtime_comp, special)
    const absenceCredit = this.getAbsenceCredit(userId, date, targetHours);

    // Get manual corrections
    const corrections = this.getCorrections(userId, date);

    // Get unpaid leave reduction
    const unpaidReduction = this.getUnpaidReduction(userId, date, targetHours);

    // CORE FORMULA
    const actualHours = worked + absenceCredit + corrections - unpaidReduction;
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
   * @returns Monthly overtime result
   */
  calculateMonthlyOvertime(userId: number, month: string): MonthlyOvertimeResult {
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

    // Respect hire date
    const hireDate = new Date(user.hireDate);
    const effectiveStartDate = startDate < hireDate ? hireDate : startDate;

    // Calculate daily overtime for each day in range
    const dailyResults: DailyOvertimeResult[] = [];
    for (let d = new Date(effectiveStartDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const dailyResult = this.calculateDailyOvertime(userId, dateStr);
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
   * @returns Period overtime result
   */
  calculatePeriodOvertime(
    userId: number,
    startDate: string,
    endDate: string
  ): PeriodOvertimeResult {
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Respect hire date
    const hireDate = new Date(user.hireDate);
    const requestedStart = new Date(startDate);
    const requestedEnd = new Date(endDate);
    const effectiveStartDate = requestedStart < hireDate ? hireDate : requestedStart;

    // Calculate daily overtime for each day in range
    const dailyResults: DailyOvertimeResult[] = [];
    for (let d = new Date(effectiveStartDate); d <= requestedEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');
      const dailyResult = this.calculateDailyOvertime(userId, dateStr);
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
        `SELECT id, username, firstName, lastName, email, role,
         weeklyHours, workSchedule, hireDate, endDate, position, department
         FROM users WHERE id = ? AND deletedAt IS NULL`
      )
      .get(userId) as UserPublic | undefined;

    return user || null;
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
    // Only credit for absences that give credit (vacation, sick, overtime_comp, special)
    // NOT for unpaid leave
    const result = db
      .prepare(
        `SELECT type
         FROM absence_requests
         WHERE userId = ?
           AND status = 'approved'
           AND date(?) BETWEEN date(startDate) AND date(endDate)
           AND type IN ('vacation', 'sick', 'overtime_comp', 'special')`
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
