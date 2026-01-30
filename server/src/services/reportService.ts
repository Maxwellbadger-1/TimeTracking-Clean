/**
 * Report Service
 *
 * PROFESSIONAL OVERTIME REPORTING
 * - Transaction-based calculations (single source of truth)
 * - Respects holidays, work schedules, hire dates
 * - Clear field meanings (earned, compensation, correction, balance)
 *
 * Used by: /api/reports endpoints
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { getUserById } from './userService.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { formatDate } from '../utils/timezone.js';
import { ensureYearCoverage } from './holidayService.js';
import { ensureOvertimeBalanceEntries } from './overtimeService.js';

export interface OvertimeReportSummary {
  userId: number;
  year: number;
  month?: number;
  summary: {
    targetHours: number;
    actualHours: number;
    overtime: number;
  };
  breakdown: {
    daily: Array<{ date: string; target: number; actual: number; overtime: number }>;
    weekly: Array<{ week: string; target: number; actual: number; overtime: number }>;
    monthly: Array<{ month: string; target: number; actual: number; overtime: number }>;
  };
}

export interface OvertimeHistoryEntry {
  month: string;           // "2025-11"
  earned: number;          // Überstunden verdient (Soll/Ist Differenz)
  compensation: number;    // Überstunden genommen (Urlaub/Ausgleich)
  correction: number;      // Admin-Korrekturen
  carryover: number;       // Jahresübertrag (nur Januar)
  balance: number;         // Saldo am Monatsende
  balanceChange: number;   // Änderung vs. Vormonat
}

/**
 * Get monthly overtime data from overtime_balance table (Single Source of Truth)
 * Returns null if no entry exists for this month
 *
 * PROFESSIONAL STANDARD (SAP, Personio, DATEV):
 * - overtime_balance is the authoritative source
 * - Data is pre-calculated and stored by overtimeService.ts
 * - Much faster than recalculating on every request
 *
 * @param userId - User ID
 * @param month - Month in 'YYYY-MM' format
 * @returns Monthly overtime data or null if not found
 */
function getMonthlyOvertimeFromDB(
  userId: number,
  month: string
): { target: number; actual: number; overtime: number } | null {
  const result = db.prepare(`
    SELECT targetHours, actualHours, overtime
    FROM overtime_balance
    WHERE userId = ? AND month = ?
  `).get(userId, month) as { targetHours: number; actualHours: number; overtime: number } | undefined;

  if (!result) {
    return null;
  }

  return {
    target: result.targetHours,
    actual: result.actualHours,
    overtime: result.overtime,
  };
}

/**
 * Get comprehensive overtime report for a user
 *
 * HYBRID APPROACH (Single Source of Truth + Fallback):
 * 1. For MONTHLY reports: Read from overtime_balance table (authoritative!)
 * 2. For YEARLY reports: Aggregate monthly data from overtime_balance
 * 3. Fallback: Calculate if DB empty (backward compatibility)
 * 4. Daily/Weekly breakdown: Always calculate for UI visualization
 *
 * PROFESSIONAL STANDARD (SAP, Personio, DATEV):
 * - overtime_balance is Single Source of Truth
 * - Ensures consistency across all endpoints
 * - Much faster than recalculating on every request
 */
export async function getUserOvertimeReport(
  userId: number,
  year: number,
  month?: number
): Promise<OvertimeReportSummary> {
  logger.info({ userId, year, month }, 'Generating overtime report (HYBRID APPROACH)');

  // Ensure holidays are loaded for this year
  await ensureYearCoverage(year);

  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // CRITICAL: Ensure overtime_balance entries exist BEFORE reading!
  const today = new Date().toISOString().split('T')[0];
  const targetMonth = month
    ? `${year}-${String(month).padStart(2, '0')}`
    : `${year}-12`;

  // Ensure DB is up-to-date (creates/updates entries if needed)
  await ensureOvertimeBalanceEntries(userId, targetMonth);

  // Date range (for daily breakdown calculation)
  const startDate = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`;

  // CRITICAL: Never calculate into the future!
  let endDate = month
    ? formatDate(new Date(year, month, 0), 'yyyy-MM-dd')  // Last day of month (timezone-safe)
    : `${year}-12-31`;

  // Cap endDate to today (don't calculate future target hours!)
  if (endDate > today) {
    endDate = today;
  }

  // Don't include dates before hire date
  const effectiveStartDate = startDate < user.hireDate ? user.hireDate : startDate;

  // STRATEGY: Read summary from overtime_balance (Single Source of Truth)
  let summary: { targetHours: number; actualHours: number; overtime: number };

  if (month) {
    // MONTHLY REPORT: Read from overtime_balance table
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const dbData = getMonthlyOvertimeFromDB(userId, monthKey);

    if (dbData) {
      // ✅ Use Database as Single Source of Truth
      summary = {
        targetHours: dbData.target,
        actualHours: dbData.actual,
        overtime: dbData.overtime,
      };
      logger.info({ monthKey, summary }, '✅ Read summary from overtime_balance (authoritative)');
    } else {
      // FALLBACK: Calculate (should not happen after ensureOvertimeBalanceEntries)
      logger.warn({ monthKey }, '⚠️  overtime_balance entry missing, falling back to calculation');
      const daily = calculateDailyBreakdown(userId, user, effectiveStartDate, endDate);
      summary = {
        targetHours: daily.reduce((sum, d) => sum + d.target, 0),
        actualHours: daily.reduce((sum, d) => sum + d.actual, 0),
        overtime: daily.reduce((sum, d) => sum + d.overtime, 0),
      };
    }
  } else {
    // YEARLY REPORT: Aggregate monthly entries from overtime_balance
    // CRITICAL: Only aggregate up to CURRENT MONTH (don't include future months!)
    const currentMonth = today.substring(0, 7); // "2026-01"

    const monthlyEntries = db.prepare(`
      SELECT month, targetHours, actualHours, overtime
      FROM overtime_balance
      WHERE userId = ? AND month LIKE ? AND month <= ?
      ORDER BY month ASC
    `).all(userId, `${year}-%`, currentMonth) as Array<{
      month: string;
      targetHours: number;
      actualHours: number;
      overtime: number;
    }>;

    if (monthlyEntries.length > 0) {
      // ✅ Aggregate from overtime_balance (authoritative)
      const totalTarget = monthlyEntries.reduce((sum, m) => sum + m.targetHours, 0);
      const totalActual = monthlyEntries.reduce((sum, m) => sum + m.actualHours, 0);
      const totalOvertime = monthlyEntries.reduce((sum, m) => sum + m.overtime, 0);

      // Get year-end carryover from January
      const januaryBalance = db.prepare(`
        SELECT carryoverFromPreviousYear
        FROM overtime_balance
        WHERE userId = ? AND month = ?
      `).get(userId, `${year}-01`) as { carryoverFromPreviousYear: number } | undefined;

      const yearEndCarryover = januaryBalance?.carryoverFromPreviousYear || 0;

      summary = {
        targetHours: totalTarget,
        actualHours: totalActual,
        overtime: totalOvertime + yearEndCarryover, // Include carryover
      };
      logger.info({
        monthsFound: monthlyEntries.length,
        currentMonth,
        summary
      }, '✅ Aggregated from overtime_balance (authoritative, up to current month)');
    } else {
      // FALLBACK: Calculate (should not happen after ensureOvertimeBalanceEntries)
      logger.warn({ year }, '⚠️  No overtime_balance entries found, falling back to calculation');
      const daily = calculateDailyBreakdown(userId, user, effectiveStartDate, endDate);
      summary = {
        targetHours: daily.reduce((sum, d) => sum + d.target, 0),
        actualHours: daily.reduce((sum, d) => sum + d.actual, 0),
        overtime: daily.reduce((sum, d) => sum + d.overtime, 0),
      };
    }
  }

  // ALWAYS calculate daily breakdown for UI visualization
  // This is needed for charts, day-by-day view, etc.
  const daily = calculateDailyBreakdown(userId, user, effectiveStartDate, endDate);

  // Aggregate to weekly
  const weekly = aggregateToWeekly(daily);

  // Aggregate to monthly
  const monthly = aggregateToMonthly(daily);

  logger.info({
    userId,
    year,
    month,
    startDate: effectiveStartDate,
    endDate,
    dailyCount: daily.length,
    summary,
    source: 'overtime_balance (Single Source of Truth)'
  }, '✅ OVERTIME REPORT GENERATED');

  return {
    userId,
    year,
    month,
    summary, // ← FROM DATABASE (authoritative!)
    breakdown: {
      daily,    // ← For UI visualization only
      weekly,   // ← For UI visualization only
      monthly,  // ← For UI visualization only
    },
  };
}

/**
 * Calculate daily breakdown for date range
 */
function calculateDailyBreakdown(
  userId: number,
  user: any,
  startDate: string,
  endDate: string
): Array<{ date: string; target: number; actual: number; overtime: number }> {
  const days: Array<{ date: string; target: number; actual: number; overtime: number }> = [];

  // Get all dates with time entries OR working days in range
  const dates = db.prepare(`
    SELECT DISTINCT date
    FROM time_entries
    WHERE userId = ? AND date >= ? AND date <= ?
    ORDER BY date
  `).all(userId, startDate, endDate) as Array<{ date: string }>;

  // Also include working days without entries (they have negative overtime)
  const allDates = new Set(dates.map(d => d.date));
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // FIX: Use formatDate() instead of toISOString() to avoid timezone issues
    // toISOString() returns UTC, but we need Europe/Berlin timezone!
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const target = getDailyTargetHours(user, dateStr);

    // Only include if it's a working day OR has time entries
    if (target > 0 || allDates.has(dateStr)) {
      allDates.add(dateStr);
    }
  }

  // Calculate for each date
  Array.from(allDates).sort().forEach(date => {
    let target = getDailyTargetHours(user, date);

    // Get worked hours from time_entries
    const workedResult = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM time_entries
      WHERE userId = ? AND date = ?
    `).get(userId, date) as { total: number };

    // Check for unpaid leave (REDUCES target hours, NO absence credit!)
    const unpaidLeaveResult = db.prepare(`
      SELECT COUNT(*) as hasUnpaidLeave
      FROM absence_requests
      WHERE userId = ?
        AND status = 'approved'
        AND type = 'unpaid'
        AND ? >= startDate
        AND ? <= endDate
    `).get(userId, date, date) as { hasUnpaidLeave: number };

    // If unpaid leave on this day, reduce target to 0 (user doesn't need to work)
    if (unpaidLeaveResult.hasUnpaidLeave > 0 && target > 0) {
      target = 0;
    }

    // Get absence credits (vacation, sick, overtime_comp, special)
    // Check if date falls within any approved absence period
    // IMPORTANT: Give credit = target hours for WORKING days only!
    const absenceResult = db.prepare(`
      SELECT COUNT(*) as hasAbsence
      FROM absence_requests
      WHERE userId = ?
        AND status = 'approved'
        AND type IN ('vacation', 'sick', 'overtime_comp', 'special')
        AND ? >= startDate
        AND ? <= endDate
    `).get(userId, date, date) as { hasAbsence: number };

    const absenceCredit = (absenceResult.hasAbsence > 0 && target > 0) ? target : 0;

    // Get manual corrections for this date
    // PROFESSIONAL: Manual adjustments work ALWAYS (like Personio)
    const correctionsResult = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM overtime_corrections
      WHERE userId = ? AND date = ?
    `).get(userId, date) as { total: number };

    // FINAL: Actual = Worked + Absences + Corrections (Single Source of Truth)
    const actual = workedResult.total + absenceCredit + correctionsResult.total;
    const overtime = actual - target;

    days.push({ date, target, actual, overtime });
  });

  return days;
}

/**
 * Aggregate daily data to weekly
 */
function aggregateToWeekly(
  daily: Array<{ date: string; target: number; actual: number; overtime: number }>
): Array<{ week: string; target: number; actual: number; overtime: number }> {
  const weekMap = new Map<string, { target: number; actual: number; overtime: number }>();

  daily.forEach(day => {
    const date = new Date(day.date);
    // ISO week: Monday is start of week
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday
    // FIX: Use formatDate() instead of toISOString() to avoid timezone bugs
    const weekKey = formatDate(weekStart, 'yyyy-MM-dd');

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { target: 0, actual: 0, overtime: 0 });
    }

    const week = weekMap.get(weekKey)!;
    week.target += day.target;
    week.actual += day.actual;
    week.overtime += day.overtime;
  });

  return Array.from(weekMap.entries())
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Aggregate daily data to monthly
 */
function aggregateToMonthly(
  daily: Array<{ date: string; target: number; actual: number; overtime: number }>
): Array<{ month: string; target: number; actual: number; overtime: number }> {
  const monthMap = new Map<string, { target: number; actual: number; overtime: number }>();

  daily.forEach(day => {
    const month = day.date.substring(0, 7); // "2025-11"

    if (!monthMap.has(month)) {
      monthMap.set(month, { target: 0, actual: 0, overtime: 0 });
    }

    const monthData = monthMap.get(month)!;
    monthData.target += day.target;
    monthData.actual += day.actual;
    monthData.overtime += day.overtime;
  });

  return Array.from(monthMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get overtime history with transaction breakdown
 * FALLBACK: Uses overtime_balance if no transactions exist
 */
export function getOvertimeHistory(
  userId: number,
  months: number = 12
): OvertimeHistoryEntry[] {
  logger.info({ userId, months }, 'Getting overtime history');

  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // CRITICAL FIX: ALWAYS use overtime_balance (Single Source of Truth)
  // Transactions are only an audit trail and may contain migration errors
  // overtime_balance is the authoritative source calculated by overtimeService
  logger.info({ userId }, 'Using overtime_balance (Single Source of Truth)');
  return getOvertimeHistoryFromBalance(userId, months);
}

/**
 * FALLBACK: Get overtime history from overtime_balance table
 * Used when no transactions exist (e.g., legacy users)
 */
function getOvertimeHistoryFromBalance(
  userId: number,
  months: number = 12
): OvertimeHistoryEntry[] {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  // CRITICAL: Only get months up to CURRENT MONTH (don't include future months!)
  const currentMonth = now.toISOString().substring(0, 7); // "2026-01"

  // Get all overtime_balance entries for this user
  const balances = db.prepare(`
    SELECT month, targetHours, actualHours, overtime, carryoverFromPreviousYear
    FROM overtime_balance
    WHERE userId = ?
      AND month >= ?
      AND month <= ?
    ORDER BY month ASC
  `).all(
    userId,
    `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
    currentMonth
  ) as Array<{
    month: string;
    targetHours: number;
    actualHours: number;
    overtime: number;
    carryoverFromPreviousYear: number;
  }>;

  const history: OvertimeHistoryEntry[] = [];
  let runningBalance = 0;

  // Get carryover from previous year (if exists)
  const prevYearBalance = db.prepare(`
    SELECT COALESCE(SUM(overtime), 0) as carryover
    FROM overtime_balance
    WHERE userId = ?
      AND month < ?
  `).get(userId, `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`) as { carryover: number };

  runningBalance = prevYearBalance.carryover;

  // CRITICAL FIX: Only show months that actually exist in overtime_balance
  // Don't add "missing months" with 0 values - they didn't exist (user not hired yet or no data)
  const monthSet = new Set<string>();
  balances.forEach(b => monthSet.add(b.month));

  Array.from(monthSet).sort().forEach(month => {
    const balance = balances.find(b => b.month === month);

    // earned = actualHours - targetHours (overtime for this month)
    const earned = balance ? balance.overtime : 0;

    // Check if this month has a year-end carryover (from overtime rollover)
    const yearEndCarryover = balance?.carryoverFromPreviousYear || 0;

    runningBalance += earned + yearEndCarryover;
    const balanceChange = earned + yearEndCarryover;

    // For balance-based system, we don't have detailed transaction breakdown
    // carryover shows the year-end rollover (if any)
    history.push({
      month,
      earned,
      compensation: 0,
      correction: 0,
      carryover: yearEndCarryover,
      balance: runningBalance,  // Cumulative balance (for summary display)
      balanceChange,
    });
  });

  return history;
}

/**
 * Get overtime balance breakdown by year
 * Shows how current balance is composed: carryover from previous year + current year
 */
export interface OvertimeYearBreakdown {
  userId: number;
  currentYear: number;
  totalBalance: number;
  carryoverFromPreviousYear: number;
  earnedThisYear: number;
  currentMonth: {
    month: string;
    earned: number;
    targetHours: number;
    actualHours: number;
  };
}

export function getOvertimeYearBreakdown(userId: number): OvertimeYearBreakdown {
  logger.info({ userId }, 'Getting overtime year breakdown');

  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Calculate REAL carryover from previous year's overtime_balance (Single Source of Truth!)
  // Don't use stored carryoverFromPreviousYear - calculate it fresh from actual data
  const previousYear = currentYear - 1;
  const previousYearBalances = db.prepare(`
    SELECT SUM(actualHours - targetHours) as totalOvertime
    FROM overtime_balance
    WHERE userId = ? AND month LIKE ?
  `).get(userId, `${previousYear}-%`) as { totalOvertime: number | null } | undefined;

  const carryoverFromPreviousYear = previousYearBalances?.totalOvertime || 0;

  // Get all monthly balances for current year (up to current month)
  const yearBalances = db.prepare(`
    SELECT month, overtime, targetHours, actualHours
    FROM overtime_balance
    WHERE userId = ? AND month LIKE ? AND month <= ?
    ORDER BY month ASC
  `).all(userId, `${currentYear}-%`, currentMonth) as Array<{
    month: string;
    overtime: number;
    targetHours: number;
    actualHours: number;
  }>;

  // Sum overtime earned this year (excluding carryover)
  const earnedThisYear = yearBalances.reduce((sum, m) => sum + m.overtime, 0);

  // Current month data
  const currentMonthData = yearBalances.find(m => m.month === currentMonth);

  // Total balance = carryover + earned this year
  const totalBalance = carryoverFromPreviousYear + earnedThisYear;

  logger.info(
    { userId, currentYear, carryoverFromPreviousYear, earnedThisYear, totalBalance },
    'Year breakdown calculated'
  );

  return {
    userId,
    currentYear,
    totalBalance,
    carryoverFromPreviousYear,
    earnedThisYear,
    currentMonth: currentMonthData ? {
      month: currentMonthData.month,
      earned: currentMonthData.overtime,
      targetHours: currentMonthData.targetHours,
      actualHours: currentMonthData.actualHours,
    } : {
      month: currentMonth,
      earned: 0,
      targetHours: 0,
      actualHours: 0,
    },
  };
}
