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
import { getOvertimeBalance } from './overtimeTransactionService.js';

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
 * Get comprehensive overtime report for a user
 */
export function getUserOvertimeReport(
  userId: number,
  year: number,
  month?: number
): OvertimeReportSummary {
  logger.info({ userId, year, month }, 'Generating overtime report');

  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Date range
  const today = new Date().toISOString().split('T')[0];
  const startDate = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`;

  // CRITICAL: Never calculate into the future!
  let endDate = month
    ? new Date(year, month, 0).toISOString().split('T')[0]  // Last day of month
    : `${year}-12-31`;

  // Cap endDate to today (don't calculate future target hours!)
  if (endDate > today) {
    endDate = today;
  }

  // Don't include dates before hire date
  const effectiveStartDate = startDate < user.hireDate ? user.hireDate : startDate;

  // Calculate daily breakdown
  const daily = calculateDailyBreakdown(userId, user, effectiveStartDate, endDate);

  // Aggregate to weekly
  const weekly = aggregateToWeekly(daily);

  // Aggregate to monthly
  const monthly = aggregateToMonthly(daily);

  // Calculate summary
  const summary = {
    targetHours: daily.reduce((sum, d) => sum + d.target, 0),
    actualHours: daily.reduce((sum, d) => sum + d.actual, 0),
    overtime: daily.reduce((sum, d) => sum + d.overtime, 0),
  };

  return {
    userId,
    year,
    month,
    summary,
    breakdown: {
      daily,
      weekly,
      monthly,
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
    const dateStr = d.toISOString().split('T')[0];
    const target = getDailyTargetHours(user, dateStr);

    // Only include if it's a working day OR has time entries
    if (target > 0 || allDates.has(dateStr)) {
      allDates.add(dateStr);
    }
  }

  // Calculate for each date
  Array.from(allDates).sort().forEach(date => {
    const target = getDailyTargetHours(user, date);

    const actualResult = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM time_entries
      WHERE userId = ? AND date = ?
    `).get(userId, date) as { total: number };

    const actual = actualResult.total;
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
    const weekKey = weekStart.toISOString().split('T')[0];

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

  // Calculate start month (N months ago from now)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

  // Get all transactions for this period
  const transactions = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      type,
      SUM(hours) as total
    FROM overtime_transactions
    WHERE userId = ?
      AND date >= ?
    GROUP BY strftime('%Y-%m', date), type
    ORDER BY month ASC
  `).all(userId, `${startMonth}-01`) as Array<{
    month: string;
    type: 'earned' | 'compensation' | 'correction' | 'carryover';
    total: number;
  }>;

  // Build month-by-month history
  const history: OvertimeHistoryEntry[] = [];
  let runningBalance = 0;

  // Get balance before start month
  const balanceBefore = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as balance
    FROM overtime_transactions
    WHERE userId = ?
      AND date < ?
  `).get(userId, `${startMonth}-01`) as { balance: number };

  runningBalance = balanceBefore.balance;

  // Generate entries for each month
  const monthSet = new Set<string>();
  transactions.forEach(t => monthSet.add(t.month));

  // Also include months with no transactions (to show balance continuity)
  for (let i = 0; i < months; i++) {
    const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(monthKey);
  }

  Array.from(monthSet).sort().forEach(month => {
    const monthTransactions = transactions.filter(t => t.month === month);

    const earned = monthTransactions
      .filter(t => t.type === 'earned')
      .reduce((sum, t) => sum + t.total, 0);

    const compensation = monthTransactions
      .filter(t => t.type === 'compensation')
      .reduce((sum, t) => sum + t.total, 0);

    const correction = monthTransactions
      .filter(t => t.type === 'correction')
      .reduce((sum, t) => sum + t.total, 0);

    const carryover = monthTransactions
      .filter(t => t.type === 'carryover')
      .reduce((sum, t) => sum + t.total, 0);

    const previousBalance = runningBalance;
    runningBalance += earned + compensation + correction + carryover;
    const balanceChange = runningBalance - previousBalance;

    history.push({
      month,
      earned,
      compensation,
      correction,
      carryover,
      balance: runningBalance,
      balanceChange,
    });
  });

  return history;
}
