import { db } from '../database/connection.js';
import type { DayName, UserPublic } from '../types/index.js';

/**
 * Working Days Utility Functions
 * Accurate calculation of working days and target hours
 * Supports flexible work schedules (individueller Wochenplan)
 */

/**
 * Day name mapping (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
const DAY_NAMES: Record<number, DayName> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Get day name from date
 * @param date - Date object or YYYY-MM-DD string
 * @returns Day name (monday, tuesday, ...)
 */
export function getDayName(date: Date | string): DayName {
  const d = typeof date === 'string' ? new Date(date) : date;
  return DAY_NAMES[d.getDay()];
}

/**
 * Get daily target hours for a specific user and date
 * Uses workSchedule if available, otherwise falls back to weeklyHours/5
 *
 * @param user - User object with weeklyHours and optional workSchedule
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Target hours for this specific day (0-24)
 *
 * @example
 * // User with workSchedule: Mo=8h, Fr=2h
 * getDailyTargetHours(hans, "2025-02-07") // Friday → 2h
 * getDailyTargetHours(hans, "2025-02-03") // Monday → 8h
 *
 * // User WITHOUT workSchedule (40h week)
 * getDailyTargetHours(user, "2025-02-03") // → 8h (40/5)
 */
export function getDailyTargetHours(user: UserPublic, date: Date | string): number {
  // If user has individual work schedule, use it
  if (user.workSchedule) {
    const dayName = getDayName(date);
    return user.workSchedule[dayName] || 0;
  }

  // Fallback: Standard 5-day week (weeklyHours / 5)
  // SPECIAL CASE: weeklyHours=0 (Aushilfen) → 0h per day
  if (user.weeklyHours === 0) {
    return 0;
  }

  return Math.round((user.weeklyHours / 5) * 100) / 100;
}

/**
 * Calculate number of working days (Monday-Friday) in a month
 * Excludes weekends (Saturday, Sunday)
 *
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Number of working days
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const date = new Date(year, month - 1, 1); // month is 1-indexed
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Calculate daily target hours from weekly hours
 * Standard: weeklyHours / 5 (5-day work week)
 *
 * @param weeklyHours - Target weekly hours
 * @returns Daily target hours
 */
export function calculateDailyTargetHours(weeklyHours: number): number {
  return Math.round((weeklyHours / 5) * 100) / 100;
}

/**
 * Calculate monthly target hours based on actual working days
 * More accurate than using averages (weeklyHours * 4.33)
 *
 * Formula: (weeklyHours / 5) * workingDaysInMonth
 *
 * Example:
 * - 40h week = 8h/day
 * - Januar 2025 has 23 working days
 * - Target = 8h * 23 = 184h
 *
 * @param weeklyHours - Target weekly hours
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Monthly target hours
 */
export function calculateMonthlyTargetHours(weeklyHours: number, year: number, month: number): number {
  const workingDays = getWorkingDaysInMonth(year, month);
  const dailyHours = weeklyHours / 5; // 5-day work week
  return Math.round((dailyHours * workingDays) * 100) / 100;
}

/**
 * Get all public holidays for a given year from database
 * Returns array of holiday dates in 'YYYY-MM-DD' format
 *
 * @param year - Year to fetch holidays for
 * @param dbInstance - Optional database instance (defaults to shared connection)
 */
function getPublicHolidays(year: number, dbInstance?: any): string[] {
  try {
    const database = dbInstance || db;

    const holidays = database
      .prepare('SELECT date FROM holidays WHERE date LIKE ? ORDER BY date')
      .all(`${year}-%`) as Array<{ date: string }>;

    return holidays.map(h => h.date);
  } catch (error) {
    console.error('❌ Error fetching holidays:', error);
    return [];
  }
}

/**
 * Check if a date is a public holiday
 */
function isPublicHoliday(date: Date, holidays: string[]): boolean {
  const dateStr = formatDate(date);
  return holidays.includes(dateStr);
}

/**
 * Format date to 'YYYY-MM-DD' string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Count working days between two dates (inclusive)
 * Excludes weekends (Sat/Sun) and public holidays
 *
 * @param fromDate - Start date (YYYY-MM-DD or Date)
 * @param toDate - End date (YYYY-MM-DD or Date)
 * @param dbInstance - Optional database instance (defaults to shared connection)
 * @returns Number of working days
 */
export function countWorkingDaysBetween(fromDate: string | Date, toDate: string | Date, dbInstance?: any): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  // Get all holidays for the relevant years
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getPublicHolidays(year, dbInstance));
  }

  let workingDays = 0;

  // CRITICAL: Use UTC dates to avoid DST issues (timezone changes can skip days!)
  // Create UTC dates at midnight
  // NOTE: Use LOCAL get*() methods when input dates are Berlin time (from parseDate())
  // Use UTC getUTC*() methods only when input dates are ISO strings parsed as UTC
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let time = startUTC; time <= endUTC; time += MS_PER_DAY) {
    const current = new Date(time);
    const dayOfWeek = current.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const isHoliday = isPublicHoliday(current, holidays);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Calculate target hours for a date range using individual work schedule
 * Iterates through each day and sums getDailyTargetHours()
 *
 * @param user - User object with weeklyHours and optional workSchedule
 * @param fromDate - Start date (YYYY-MM-DD or Date)
 * @param toDate - End date (YYYY-MM-DD or Date)
 * @returns Total target hours for the period
 *
 * @example
 * // Hans: Mo=8h, Fr=2h, Woche vom 03.02.-07.02.2025 (Mo-Fr)
 * calculateTargetHoursForPeriod(hans, "2025-02-03", "2025-02-07")
 * // → Mo 8h + Di 0h + Mi 0h + Do 0h + Fr 2h = 10h
 */
export function calculateTargetHoursForPeriod(
  user: UserPublic,
  fromDate: string | Date,
  toDate: string | Date
): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  let totalHours = 0;

  // Iterate through each day
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Skip weekends (unless user has workSchedule with weekend hours)
    if (isWeekend && !user.workSchedule) {
      continue;
    }

    totalHours += getDailyTargetHours(user, d);
  }

  return Math.round(totalHours * 100) / 100;
}

/**
 * Calculate target hours from a start date up to today (inclusive)
 * Counts only working days (Mo-Fr, excluding public holidays)
 *
 * @param weeklyHours - Target weekly hours (e.g., 40)
 * @param fromDate - Start date (e.g., hire date) in 'YYYY-MM-DD' format
 * @returns Target hours from start date to today
 */
export function calculateTargetHoursUntilToday(weeklyHours: number, fromDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  // If start date is in the future, return 0
  if (start > today) {
    return 0;
  }

  const workingDays = countWorkingDaysBetween(start, today);
  const dailyHours = weeklyHours / 5; // 5-day work week

  return Math.round((dailyHours * workingDays) * 100) / 100;
}

/**
 * Calculate how many working days per week a user has based on their work schedule
 *
 * Best Practice (Personio, DATEV, SAP):
 * - Days with 0 hours do NOT count as working days
 * - Only days with hours > 0 count as working days
 *
 * @param workSchedule - User's individual work schedule (or null)
 * @param weeklyHours - User's weekly hours (fallback if no workSchedule)
 * @returns Number of working days per week (0-7)
 *
 * @example
 * // User with Mo=8h, Di=0h, Mi=6h, Do=8h, Fr=8h
 * calculateWorkingDaysPerWeek(workSchedule, 30)
 * // → 4 working days (Di is NOT counted)
 *
 * @example
 * // User WITHOUT workSchedule, 40h week
 * calculateWorkingDaysPerWeek(null, 40)
 * // → 5 working days (standard Mo-Fr)
 */
export function calculateWorkingDaysPerWeek(
  workSchedule: Record<DayName, number> | null | undefined,
  weeklyHours: number
): number {
  // If user has individual work schedule, count days with hours > 0
  if (workSchedule) {
    let workingDays = 0;

    // Check each day of the week
    const allDays: DayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of allDays) {
      if ((workSchedule[day] || 0) > 0) {
        workingDays++;
      }
    }

    return workingDays;
  }

  // Fallback: Standard 5-day work week (Mo-Fr)
  // SPECIAL CASE: weeklyHours=0 (Aushilfen) → 0 working days
  if (weeklyHours === 0) {
    return 0;
  }

  return 5; // Standard Mo-Fr
}

/**
 * Count working days for a specific user in a date range
 * Takes into account the user's individual work schedule
 *
 * Best Practice (Personio, DATEV, SAP):
 * - Days with 0 hours in work schedule do NOT count as working days
 * - Weekends only count if user has hours scheduled
 * - Public holidays are excluded
 *
 * @param fromDate - Start date (YYYY-MM-DD or Date)
 * @param toDate - End date (YYYY-MM-DD or Date)
 * @param workSchedule - User's individual work schedule (or null)
 * @param weeklyHours - User's weekly hours (fallback if no workSchedule)
 * @param dbInstance - Optional database instance (for holiday lookup)
 * @returns Number of working days for this specific user
 *
 * @example
 * // User with Mo=8h, Di=0h, Mi=6h, Do=8h, Fr=8h
 * // Date range: Mo 13.01. - Fr 17.01.2025 (5 calendar days)
 * countWorkingDaysForUser("2025-01-13", "2025-01-17", workSchedule, 30)
 * // → 4 working days (Di is NOT counted because 0h)
 *
 * @example
 * // User WITHOUT workSchedule, 40h week
 * // Date range: Mo 13.01. - Fr 17.01.2025 (no holidays)
 * countWorkingDaysForUser("2025-01-13", "2025-01-17", null, 40)
 * // → 5 working days (standard Mo-Fr counting)
 */
export function countWorkingDaysForUser(
  fromDate: string | Date,
  toDate: string | Date,
  workSchedule: Record<DayName, number> | null | undefined,
  weeklyHours: number,
  dbInstance?: any
): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  // Get all holidays for the relevant years
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getPublicHolidays(year, dbInstance));
  }

  let workingDays = 0;

  // CRITICAL: Use UTC dates to avoid DST issues
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let time = startUTC; time <= endUTC; time += MS_PER_DAY) {
    const current = new Date(time);
    const dayOfWeek = current.getUTCDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const isHoliday = isPublicHoliday(current, holidays);

    // Skip public holidays
    if (isHoliday) {
      continue;
    }

    // If user has individual work schedule, check if this day has hours > 0
    if (workSchedule) {
      const hoursForDay = workSchedule[dayName] || 0;
      if (hoursForDay > 0) {
        workingDays++;
      }
      // Days with 0 hours do NOT count as working days!
    } else {
      // Fallback: Standard Mo-Fr counting (exclude weekends)
      // SPECIAL CASE: weeklyHours=0 (Aushilfen) → 0 working days
      if (weeklyHours === 0) {
        continue;
      }

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (!isWeekend) {
        workingDays++;
      }
    }
  }

  return workingDays;
}
