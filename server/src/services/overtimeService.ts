import { db } from '../database/connection.js';
import { startOfWeek, endOfWeek } from 'date-fns';
import {
  calculateDailyTargetHours,
  countWorkingDaysBetween,
} from '../utils/workingDays.js';
import logger from '../utils/logger.js';
import {
  getCurrentDate,
  getCurrentYear,
  formatDate,
} from '../utils/timezone.js';
import { getTotalCorrectionsForUserInMonth } from './overtimeCorrectionsService.js';
import { updateWorkTimeAccountBalance } from './workTimeAccountService.js';

/**
 * Professional 3-Level Overtime Service
 * Tracks overtime on DAILY, WEEKLY, and MONTHLY basis
 * Based on German labor law and industry best practices
 */

interface DailyOvertime {
  date: string;
  targetHours: number;
  actualHours: number;
  overtime: number;
}

interface WeeklyOvertime {
  week: string; // Format: "2025-W45" (ISO week)
  targetHours: number;
  actualHours: number;
  overtime: number;
}

interface MonthlyOvertime {
  month: string; // Format: "2025-11"
  targetHours: number;
  actualHours: number;
  overtime: number;
}

interface OvertimeSummary {
  daily: DailyOvertime[];
  weekly: WeeklyOvertime[];
  monthly: MonthlyOvertime[];
  totalOvertime: number; // Sum of all months in year
}

/**
 * Get ISO week string from date (Berlin timezone)
 * Format: "2025-W45"
 */
function getISOWeek(date: string): string {
  const d = new Date(date);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday
  return formatDate(weekStart, "yyyy-'W'II");
}

/**
 * Get week start and end dates from a date (Berlin timezone)
 */
function getWeekDateRange(date: string): { startDate: string; endDate: string } {
  const d = new Date(date);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(d, { weekStartsOn: 1 }); // Sunday
  return {
    startDate: formatDate(weekStart, 'yyyy-MM-dd'),
    endDate: formatDate(weekEnd, 'yyyy-MM-dd'),
  };
}

/**
 * Update DAILY overtime for a specific date
 * Called automatically when time entries are created/updated/deleted
 */
export function updateDailyOvertime(userId: number, date: string): void {
  // Get user's weekly hours and hire date
  const user = db
    .prepare('SELECT weeklyHours, hireDate FROM users WHERE id = ?')
    .get(userId) as { weeklyHours: number; hireDate: string } | undefined;

  if (!user) {
    logger.error({ userId }, 'updateDailyOvertime: User not found');
    throw new Error(`User not found: ${userId}`);
  }

  // Check if date is before hire date
  if (date < user.hireDate) {
    // Before hire date: no target, no actual hours
    db.prepare(
      `INSERT INTO overtime_daily (userId, date, targetHours, actualHours)
       VALUES (?, ?, 0, 0)
       ON CONFLICT(userId, date)
       DO UPDATE SET targetHours = 0, actualHours = 0`
    ).run(userId, date);
    logger.debug({ userId, date, hireDate: user.hireDate }, 'Skipped day before hire date');
    return;
  }

  const dailyTarget = calculateDailyTargetHours(user.weeklyHours);

  // Calculate actual hours for the day
  const actualHours = db
    .prepare(
      `SELECT COALESCE(SUM(hours), 0) as total
       FROM time_entries
       WHERE userId = ? AND date = ?`
    )
    .get(userId, date) as { total: number };

  // Upsert daily overtime
  db.prepare(
    `INSERT INTO overtime_daily (userId, date, targetHours, actualHours)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, date)
     DO UPDATE SET targetHours = ?, actualHours = ?`
  ).run(userId, date, dailyTarget, actualHours.total, dailyTarget, actualHours.total);
}

/**
 * Update WEEKLY overtime for a specific week
 * Called automatically after daily overtime is updated
 */
export function updateWeeklyOvertime(userId: number, date: string): void {
  // Get user's weekly hours and hire date
  const user = db
    .prepare('SELECT weeklyHours, hireDate FROM users WHERE id = ?')
    .get(userId) as { weeklyHours: number; hireDate: string } | undefined;

  if (!user) {
    logger.error({ userId }, 'updateWeeklyOvertime: User not found');
    throw new Error(`User not found: ${userId}`);
  }

  const weekString = getISOWeek(date);

  // Get week start/end dates
  const { startDate, endDate } = getWeekDateRange(date);

  // Check if week is entirely before hire date
  if (endDate < user.hireDate) {
    // Entire week before hire date
    db.prepare(
      `INSERT INTO overtime_weekly (userId, week, targetHours, actualHours)
       VALUES (?, ?, 0, 0)
       ON CONFLICT(userId, week)
       DO UPDATE SET targetHours = 0, actualHours = 0`
    ).run(userId, weekString);
    logger.debug({ userId, week: weekString, hireDate: user.hireDate }, 'Skipped week before hire date');
    return;
  }

  // Adjust start date if hire date is mid-week
  const actualStartDate = startDate < user.hireDate ? user.hireDate : startDate;

  // Count working days from actualStartDate to endDate
  const workingDays = countWorkingDaysBetween(actualStartDate, endDate);
  const dailyHours = user.weeklyHours / 5;
  const targetHours = Math.round((dailyHours * workingDays) * 100) / 100;

  // Calculate actual hours for the week
  const actualHours = db
    .prepare(
      `SELECT COALESCE(SUM(hours), 0) as total
       FROM time_entries
       WHERE userId = ? AND date >= ? AND date <= ?`
    )
    .get(userId, startDate, endDate) as { total: number };

  // Upsert weekly overtime
  db.prepare(
    `INSERT INTO overtime_weekly (userId, week, targetHours, actualHours)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, week)
     DO UPDATE SET targetHours = ?, actualHours = ?`
  ).run(userId, weekString, targetHours, actualHours.total, targetHours, actualHours.total);
}

/**
 * Update MONTHLY overtime for a specific month
 * Called automatically after weekly overtime is updated
 * Already exists in timeEntryService.ts - we just call it
 */
export function updateMonthlyOvertime(userId: number, month: string): void {
  // Get user's weekly hours and hire date
  const user = db
    .prepare('SELECT weeklyHours, hireDate FROM users WHERE id = ?')
    .get(userId) as { weeklyHours: number; hireDate: string } | undefined;

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const [year, monthNum] = month.split('-').map(Number);
  const today = getCurrentDate();
  const currentMonth = formatDate(today, 'yyyy-MM');

  // Determine start and end dates for calculation
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0); // Last day of month

  // If this is the current month, only calculate up to today
  const endDate = (month === currentMonth) ? today : monthEnd;

  // Determine actual start date (hire date if in this month, otherwise month start)
  const hireDate = new Date(user.hireDate);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth() + 1;

  let startDate = monthStart;
  if (year === hireYear && monthNum === hireMonth) {
    startDate = hireDate;
  }

  // Calculate working days between start and end (excludes weekends + holidays)
  const workingDays = countWorkingDaysBetween(startDate, endDate);
  const dailyHours = user.weeklyHours / 5; // 5-day work week
  const targetHours = Math.round((dailyHours * workingDays) * 100) / 100;

  logger.debug({
    month,
    startDate: formatDate(startDate, 'yyyy-MM-dd'),
    endDate: formatDate(endDate, 'yyyy-MM-dd'),
    workingDays,
    targetHours
  }, `📅 updateMonthlyOvertime`);

  // Calculate actual worked hours for the month
  const workedHours = db
    .prepare(
      `SELECT COALESCE(SUM(hours), 0) as total
       FROM time_entries
       WHERE userId = ? AND date LIKE ?`
    )
    .get(userId, `${month}%`) as { total: number };

  // BEST PRACTICE: Calculate absence credits ("Krank/Urlaub = Gearbeitet")
  // Get approved absences for this month (only from hireDate onwards AND up to endDate!)
  const endDateString = formatDate(endDate, 'yyyy-MM-dd');
  const absenceCredits = db
    .prepare(
      `SELECT COALESCE(SUM(days * ?), 0) as total
       FROM absence_requests
       WHERE userId = ?
         AND status = 'approved'
         AND type IN ('sick', 'vacation', 'overtime_comp')
         AND startDate LIKE ?
         AND startDate >= ?
         AND startDate <= ?`
    )
    .get(dailyHours, userId, `${month}%`, user.hireDate, endDateString) as { total: number };

  // Calculate unpaid leave reduction (reduces target hours)
  // Only count unpaid leave from hireDate onwards AND up to endDate
  const unpaidLeaveDays = db
    .prepare(
      `SELECT COALESCE(SUM(days), 0) as total
       FROM absence_requests
       WHERE userId = ?
         AND status = 'approved'
         AND type = 'unpaid'
         AND startDate LIKE ?
         AND startDate >= ?
         AND startDate <= ?`
    )
    .get(userId, `${month}%`, user.hireDate, endDateString) as { total: number };

  const unpaidLeaveReduction = unpaidLeaveDays.total * dailyHours;

  // Adjusted target hours (Soll minus unpaid leave)
  const adjustedTargetHours = targetHours - unpaidLeaveReduction;

  // Get overtime corrections for this month
  const overtimeCorrections = getTotalCorrectionsForUserInMonth(userId, month);

  // Actual hours WITH absence credits AND corrections
  const actualHoursWithCredits = workedHours.total + absenceCredits.total + overtimeCorrections;

  logger.debug({
    workedHours: workedHours.total,
    absenceCredits: absenceCredits.total,
    overtimeCorrections,
    unpaidLeaveReduction,
    adjustedTargetHours,
    actualHoursWithCredits
  }, `📊 Monthly hours breakdown`);

  // Upsert monthly overtime
  db.prepare(
    `INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, month)
     DO UPDATE SET targetHours = ?, actualHours = ?`
  ).run(userId, month, adjustedTargetHours, actualHoursWithCredits, adjustedTargetHours, actualHoursWithCredits);

  // CRITICAL: Sync Work Time Account with total overtime
  // The Work Time Account shows the RUNNING BALANCE (sum of ALL months)
  const totalOvertime = db.prepare(`
    SELECT COALESCE(SUM(overtime), 0) as total
    FROM overtime_balance
    WHERE userId = ?
  `).get(userId) as { total: number };

  updateWorkTimeAccountBalance(userId, totalOvertime.total);
  logger.debug({ userId, totalOvertime: totalOvertime.total }, '✅ Work Time Account synced');
}

/**
 * Master function: Update ALL overtime levels for a date
 * This is called from timeEntryService when entries are created/updated/deleted
 */
export function updateAllOvertimeLevels(userId: number, date: string): void {
  const month = date.substring(0, 7); // "2025-11"

  // Update all 3 levels
  updateDailyOvertime(userId, date);
  updateWeeklyOvertime(userId, date);
  updateMonthlyOvertime(userId, month);
}

/**
 * Get complete overtime summary for a user and year
 * Returns daily, weekly, monthly breakdowns + total
 */
export function getOvertimeSummary(userId: number, year: number): OvertimeSummary {
  logger.debug('🔥🔥🔥 getOvertimeSummary CALLED 🔥🔥🔥');
  logger.debug({ userId, year }, '📌 Parameters');

  // Get user's hireDate to filter overtime calculations
  const user = db
    .prepare('SELECT hireDate FROM users WHERE id = ?')
    .get(userId) as { hireDate: string } | undefined;

  const hireDate = user?.hireDate || '1900-01-01'; // Default to very old date if not set

  logger.debug({ hireDate }, '📅 User hireDate');

  // Determine the end month (current month if current year, December if past year)
  const today = getCurrentDate();
  const currentYear = today.getFullYear();
  const endMonth = year === currentYear
    ? formatDate(today, 'yyyy-MM')
    : `${year}-12`;

  logger.debug({ endMonth }, '📅 Ensuring overtime entries up to');

  // Ensure all monthly overtime_balance entries exist
  ensureOvertimeBalanceEntries(userId, endMonth);

  logger.debug('✅ All monthly entries ensured');

  // Get daily overtime (only from hireDate onwards)
  const daily = db
    .prepare(
      `SELECT date, targetHours, actualHours, overtime
       FROM overtime_daily
       WHERE userId = ? AND date LIKE ? AND date >= ?
       ORDER BY date DESC`
    )
    .all(userId, `${year}-%`, hireDate) as DailyOvertime[];

  // Get weekly overtime (only from hireDate onwards)
  const weekly = db
    .prepare(
      `SELECT week, targetHours, actualHours, overtime
       FROM overtime_weekly
       WHERE userId = ? AND week LIKE ?
         AND week >= strftime('%Y-W%W', ?)
       ORDER BY week DESC`
    )
    .all(userId, `${year}-%`, hireDate) as WeeklyOvertime[];

  // Get monthly overtime (only from hireDate onwards)
  const monthlyRaw = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month LIKE ? AND month >= strftime('%Y-%m', ?)
       ORDER BY month DESC`
    )
    .all(userId, `${year}-%`, hireDate) as MonthlyOvertime[];

  // Ensure all numbers are properly typed (SQLite sometimes returns strings)
  const monthly = monthlyRaw.map(m => ({
    month: m.month,
    targetHours: Number(m.targetHours) || 0,
    actualHours: Number(m.actualHours) || 0,
    overtime: Number(m.overtime) || 0,
  }));

  logger.debug({ monthlyCount: monthly.length }, '📊 Monthly data');

  // Calculate total overtime for year
  const totalOvertime = monthly.reduce((sum, m) => sum + m.overtime, 0);

  logger.debug({ totalOvertime }, '📊 Total overtime');
  logger.debug('🔥🔥🔥 END getOvertimeSummary 🔥🔥🔥');

  return {
    daily,
    weekly,
    monthly,
    totalOvertime: Math.round(totalOvertime * 100) / 100,
  };
}

/**
 * Get daily overtime for a specific date
 */
export function getDailyOvertime(userId: number, date: string): DailyOvertime | null {
  const result = db
    .prepare(
      `SELECT date, targetHours, actualHours, overtime
       FROM overtime_daily
       WHERE userId = ? AND date = ?`
    )
    .get(userId, date) as DailyOvertime | undefined;

  return result || null;
}

/**
 * Get weekly overtime for a specific week
 */
export function getWeeklyOvertime(userId: number, week: string): WeeklyOvertime | null {
  const result = db
    .prepare(
      `SELECT week, targetHours, actualHours, overtime
       FROM overtime_weekly
       WHERE userId = ? AND week = ?`
    )
    .get(userId, week) as WeeklyOvertime | undefined;

  return result || null;
}

/**
 * Get monthly overtime for a specific month
 */
export function getMonthlyOvertime(userId: number, month: string): MonthlyOvertime | null {
  const result = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month = ?`
    )
    .get(userId, month) as MonthlyOvertime | undefined;

  return result || null;
}

/**
 * Get current overtime stats (for dashboard)
 * Returns: today, this week, this month, total year
 */
export function getCurrentOvertimeStats(userId: number) {
  const today = formatDate(getCurrentDate(), 'yyyy-MM-dd');
  const currentWeek = getISOWeek(today);
  const currentMonth = formatDate(getCurrentDate(), 'yyyy-MM');
  const currentYear = getCurrentYear();

  logger.debug('🔥🔥🔥 getCurrentOvertimeStats CALLED 🔥🔥🔥');
  logger.debug({ userId, today, currentWeek, currentMonth, currentYear }, '📌 Parameters');

  const dailyData = getDailyOvertime(userId, today);
  logger.debug({ dailyData }, '📊 dailyData');

  const weeklyData = getWeeklyOvertime(userId, currentWeek);
  logger.debug({ weeklyData }, '📊 weeklyData');

  const monthlyData = getMonthlyOvertime(userId, currentMonth);
  logger.debug({ monthlyData }, '📊 monthlyData');

  const yearData = getOvertimeSummary(userId, currentYear);
  logger.debug({ yearDataTotal: yearData.totalOvertime }, '📊 yearData');

  const result = {
    today: dailyData?.overtime || 0,
    thisWeek: weeklyData?.overtime || 0,
    thisMonth: monthlyData?.overtime || 0,
    totalYear: yearData.totalOvertime,
  };

  logger.info({ result }, '✅ RETURNING RESULT');
  logger.debug('🔥🔥🔥 END getCurrentOvertimeStats 🔥🔥🔥');

  return result;
}

/**
 * Ensure overtime_balance entries exist for all months between hire date and target month
 * This is CRITICAL - without entries for months with 0 hours, negative overtime won't accumulate!
 */
export function ensureOvertimeBalanceEntries(userId: number, upToMonth: string): void {
  logger.debug({ userId, upToMonth }, '🔥 ensureOvertimeBalanceEntries called');

  // Get user's hire date and weekly hours
  const user = db
    .prepare('SELECT hireDate, weeklyHours FROM users WHERE id = ?')
    .get(userId) as { hireDate: string; weeklyHours: number } | undefined;

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const hireDate = new Date(user.hireDate);
  const targetDate = new Date(upToMonth + '-01');

  logger.debug({ hireDate: user.hireDate, targetMonth: upToMonth }, '📅 Date range');

  // Generate all months from hire date to target month
  const months: string[] = [];
  const current = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);

  while (current <= targetDate) {
    months.push(formatDate(current, 'yyyy-MM'));
    current.setMonth(current.getMonth() + 1);
  }

  logger.debug({ monthsCount: months.length }, '📅 Months to ensure');

  // For each month, ensure an overtime_balance entry exists
  for (const month of months) {
    const [year, monthNum] = month.split('-').map(Number);
    const today = getCurrentDate();
    const currentMonth = formatDate(today, 'yyyy-MM');

    // Determine start and end dates for this month
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0); // Last day of month

    // If this is the current month, only calculate up to today
    const endDate = (month === currentMonth) ? today : monthEnd;

    // Determine actual start date (hire date if in this month, otherwise month start)
    const hireYear = hireDate.getFullYear();
    const hireMonth = hireDate.getMonth() + 1;

    let startDate = monthStart;
    if (year === hireYear && monthNum === hireMonth) {
      startDate = hireDate;
    }

    // Calculate working days (excludes weekends + holidays)
    const workingDays = countWorkingDaysBetween(startDate, endDate);
    const dailyHours = user.weeklyHours / 5; // 5-day work week
    const targetHours = Math.round((dailyHours * workingDays) * 100) / 100;

    logger.debug({ month, workingDays, targetHours }, `📅 Month calculation`);

    // Check if entry exists
    const existing = db
      .prepare('SELECT id FROM overtime_balance WHERE userId = ? AND month = ?')
      .get(userId, month);

    if (!existing) {
      logger.debug({ month, targetHours }, `✨ Creating overtime_balance entry`);

      // Calculate actual worked hours for this month
      const workedHours = db
        .prepare(
          `SELECT COALESCE(SUM(hours), 0) as total
           FROM time_entries
           WHERE userId = ? AND date LIKE ?`
        )
        .get(userId, `${month}%`) as { total: number };

      // BEST PRACTICE: Calculate absence credits ("Krank/Urlaub = Gearbeitet")
      // Only count absences from hireDate onwards AND up to today (not future)
      const todayString = formatDate(endDate, 'yyyy-MM-dd'); // endDate is already capped at today
      const absenceCredits = db
        .prepare(
          `SELECT COALESCE(SUM(days * ?), 0) as total
           FROM absence_requests
           WHERE userId = ?
             AND status = 'approved'
             AND type IN ('sick', 'vacation', 'overtime_comp')
             AND startDate LIKE ?
             AND startDate >= ?
             AND startDate <= ?`
        )
        .get(dailyHours, userId, `${month}%`, user.hireDate, todayString) as { total: number };

      // Calculate unpaid leave reduction
      // Only count unpaid leave from hireDate onwards AND up to today
      const unpaidLeaveDays = db
        .prepare(
          `SELECT COALESCE(SUM(days), 0) as total
           FROM absence_requests
           WHERE userId = ?
             AND status = 'approved'
             AND type = 'unpaid'
             AND startDate LIKE ?
             AND startDate >= ?
             AND startDate <= ?`
        )
        .get(userId, `${month}%`, user.hireDate, todayString) as { total: number };

      const unpaidLeaveReduction = unpaidLeaveDays.total * dailyHours;
      const adjustedTargetHours = targetHours - unpaidLeaveReduction;
      const actualHoursWithCredits = workedHours.total + absenceCredits.total;

      // Insert the entry
      db.prepare(
        `INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
         VALUES (?, ?, ?, ?)`
      ).run(userId, month, adjustedTargetHours, actualHoursWithCredits);

      logger.debug({
        workedHours: workedHours.total,
        absenceCredits: absenceCredits.total,
        unpaidLeaveReduction,
        adjustedTargetHours,
        actualHoursWithCredits,
        overtime: actualHoursWithCredits - adjustedTargetHours
      }, `✅ Created entry`);
    }
  }
}

/**
 * Get overtime for all users (Admin dashboard)
 * Calculates cumulative overtime from start of year UP TO CURRENT MONTH (inclusive)
 * This gives the CURRENT balance, not future projection
 * IMPORTANT: Only counts months from employee's hire date onwards!
 */
export function getAllUsersOvertimeSummary(year: number) {
  const today = getCurrentDate();
  const currentYear = today.getFullYear();

  const startMonth = `${year}-01`;
  const endMonth = year === currentYear
    ? formatDate(today, 'yyyy-MM')
    : `${year}-12`;

  // First, ensure all users have complete overtime_balance entries
  const users = db.prepare('SELECT id FROM users WHERE deletedAt IS NULL').all() as Array<{ id: number }>;

  for (const user of users) {
    ensureOvertimeBalanceEntries(user.id, endMonth);
  }

  const query = `
    SELECT
      u.id as userId,
      u.firstName,
      u.lastName,
      u.email,
      COALESCE(SUM(ob.overtime), 0) as totalOvertime
    FROM users u
    LEFT JOIN overtime_balance ob ON u.id = ob.userId
      AND ob.month >= ?
      AND ob.month <= ?
      AND ob.month >= strftime('%Y-%m', u.hireDate)
    WHERE u.deletedAt IS NULL
    GROUP BY u.id
    ORDER BY totalOvertime DESC
  `;

  return db.prepare(query).all(startMonth, endMonth) as Array<{
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    totalOvertime: number;
  }>;
}

/**
 * Get aggregated overtime statistics for all users (Admin dashboard)
 * Returns total sums for Soll, Ist, and Überstunden
 * Best Practice: Used for "Alle Mitarbeiter" view in reports
 */
export function getAggregatedOvertimeStats(year: number, month?: string) {
  const today = getCurrentDate();
  const currentYear = today.getFullYear();

  // Ensure all users have complete overtime_balance entries
  const users = db.prepare('SELECT id FROM users WHERE deletedAt IS NULL').all() as Array<{ id: number }>;

  const targetMonth = month || formatDate(today, 'yyyy-MM');

  for (const user of users) {
    ensureOvertimeBalanceEntries(user.id, targetMonth);
  }

  // Query for monthly aggregation
  if (month) {
    const query = `
      SELECT
        SUM(ob.targetHours) as totalTargetHours,
        SUM(ob.actualHours) as totalActualHours,
        SUM(ob.overtime) as totalOvertime,
        COUNT(DISTINCT ob.userId) as userCount
      FROM overtime_balance ob
      JOIN users u ON ob.userId = u.id
      WHERE u.deletedAt IS NULL
        AND ob.month = ?
    `;

    const baseStats = db.prepare(query).get(month) as {
      totalTargetHours: number;
      totalActualHours: number;
      totalOvertime: number;
      userCount: number;
    };

    // IMPORTANT: overtime_balance.actualHours ALREADY includes corrections!
    // DON'T add them again (would be double-counting)
    return {
      totalTargetHours: baseStats.totalTargetHours || 0,
      totalActualHours: baseStats.totalActualHours || 0,
      totalOvertime: baseStats.totalOvertime || 0,
      userCount: baseStats.userCount || 0,
    };
  }

  // Query for yearly aggregation
  const startMonth = `${year}-01`;
  const endMonth = year === currentYear
    ? formatDate(today, 'yyyy-MM')
    : `${year}-12`;

  const query = `
    SELECT
      SUM(ob.targetHours) as totalTargetHours,
      SUM(ob.actualHours) as totalActualHours,
      SUM(ob.overtime) as totalOvertime,
      COUNT(DISTINCT ob.userId) as userCount
    FROM overtime_balance ob
    JOIN users u ON ob.userId = u.id
    WHERE u.deletedAt IS NULL
      AND ob.month >= ?
      AND ob.month <= ?
      AND ob.month >= strftime('%Y-%m', u.hireDate)
  `;

  const baseStats = db.prepare(query).all(startMonth, endMonth)[0] as {
    totalTargetHours: number;
    totalActualHours: number;
    totalOvertime: number;
    userCount: number;
  };

  // IMPORTANT: overtime_balance.actualHours ALREADY includes corrections!
  // DON'T add them again (would be double-counting)
  return {
    totalTargetHours: baseStats.totalTargetHours || 0,
    totalActualHours: baseStats.totalActualHours || 0, // ✅ NO double-counting
    totalOvertime: baseStats.totalOvertime || 0, // ✅ NO double-counting
    userCount: baseStats.userCount || 0,
  };
}

/**
 * Deduct overtime when overtime compensation absence is approved
 */
export function deductOvertimeForAbsence(
  userId: number,
  hours: number,
  absenceDate: string
): void {
  const currentYear = getCurrentYear();
  const summary = getOvertimeSummary(userId, currentYear);

  if (summary.totalOvertime < hours) {
    throw new Error(
      `Insufficient overtime hours (need ${hours}h, have ${summary.totalOvertime}h)`
    );
  }

  // Deduct from the month where absence is taken
  const absenceMonth = absenceDate.substring(0, 7);
  const monthData = getMonthlyOvertime(userId, absenceMonth);

  if (monthData) {
    const newActualHours = monthData.actualHours - hours;
    db.prepare(
      'UPDATE overtime_balance SET actualHours = ? WHERE userId = ? AND month = ?'
    ).run(newActualHours, userId, absenceMonth);
  }
}

/**
 * Check if user has enough overtime for compensation request
 */
export function hasEnoughOvertime(userId: number, requestedHours: number): boolean {
  const currentYear = getCurrentYear();
  const summary = getOvertimeSummary(userId, currentYear);
  return summary.totalOvertime >= requestedHours;
}

/**
 * LEGACY COMPATIBILITY FUNCTIONS
 * These are kept for backwards compatibility with old API endpoints
 */

export function getOvertimeBalance(userId: number, year: number) {
  return getOvertimeSummary(userId, year);
}

export function getOvertimeByMonth(userId: number, month: string) {
  const monthlyData = getMonthlyOvertime(userId, month);
  if (!monthlyData) {
    return { targetHours: 0, actualHours: 0, overtime: 0 };
  }
  return monthlyData;
}

export function getOvertimeStats(userId: number) {
  return getCurrentOvertimeStats(userId);
}
