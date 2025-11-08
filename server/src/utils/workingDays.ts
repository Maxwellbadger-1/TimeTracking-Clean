import { db } from '../database/connection.js';

/**
 * Working Days Utility Functions
 * Accurate calculation of working days and target hours
 */

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
 */
function getPublicHolidays(year: number): string[] {
  try {
    const holidays = db
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
 * @returns Number of working days
 */
export function countWorkingDaysBetween(fromDate: string | Date, toDate: string | Date): number {
  const start = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? new Date(toDate) : toDate;

  // Get all holidays for the relevant years
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getPublicHolidays(year));
  }

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const isHoliday = isPublicHoliday(current, holidays);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
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
