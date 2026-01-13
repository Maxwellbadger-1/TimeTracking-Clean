import type { TimeEntry, WorkSchedule, DayName } from '../types';

/**
 * Calculate hours from start time, end time, and break minutes
 * Handles overnight shifts correctly
 */
export function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  // Handle overnight shifts (e.g., 22:00 - 06:00)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const grossMinutes = endMinutes - startMinutes;
  const netMinutes = grossMinutes - breakMinutes;

  return Math.round((netMinutes / 60) * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate total hours from time entries
 */
export function calculateTotalHours(entries: TimeEntry[]): number {
  const total = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Format hours to HH:MM display
 * Example: 8.5 hours → "8:30h", -23.5 hours → "-23:30h"
 *
 * BUG FIX: Handle negative values correctly
 * Old bug: -23.5h → "-24:-30h" (wrong!)
 * Fixed: -23.5h → "-23:30h" (correct!)
 */
export function formatHours(hours: number): string {
  console.log('🔍 [formatHours] INPUT:', hours);

  // Handle negative values correctly
  const isNegative = hours < 0;
  const absHours = Math.abs(hours);

  const totalMinutes = Math.round(absHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  const result = `${isNegative ? '-' : ''}${h}:${m.toString().padStart(2, '0')}h`;

  console.log('🔍 [formatHours] OUTPUT:', result);
  console.log('🔍 [formatHours] Details:', {
    input: hours,
    isNegative,
    absHours,
    totalMinutes,
    h,
    m,
    result
  });

  return result;
}

/**
 * Format hours with sign for overtime display
 * Example: 2.5 → "+2:30h", -1.5 → "-1:30h"
 */
export function formatOvertimeHours(hours: number): string {
  const sign = hours >= 0 ? '+' : '-';
  const absHours = Math.abs(hours);
  const formattedTime = formatHours(absHours);
  return sign + formattedTime;
}

/**
 * Get today's date in YYYY-MM-DD format (timezone-safe)
 */
export function getTodayDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start of current week (Monday) in YYYY-MM-DD format
 */
export function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday (0)
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get end of current week (Sunday) in YYYY-MM-DD format
 */
export function getWeekEnd(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diff);

  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, '0');
  const day = String(sunday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format date to German locale (DD.MM.YYYY)
 */
export function formatDateDE(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Format date to readable German format (e.g., "30. Oktober 2025")
 */
export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Check if date is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayDate();
}

/**
 * Check if date is in current week
 */
export function isCurrentWeek(dateString: string): boolean {
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();
  return dateString >= weekStart && dateString <= weekEnd;
}

/**
 * Get day name in German
 */
export function getDayName(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { weekday: 'long' });
}

/**
 * Calculate expected hours for a date range (excluding weekends)
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param dailyHours - Expected daily hours (default: 8)
 */
export function calculateExpectedHours(
  startDate: string,
  endDate: string,
  dailyHours: number = 8
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let businessDays = 0;

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not Sunday (0) or Saturday (6)
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return businessDays * dailyHours;
}

/**
 * Calculate absence hours based on user's individual work schedule
 * If user has workSchedule, use actual hours for each day
 * Otherwise fall back to weeklyHours / 5
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param workSchedule - User's work schedule (optional)
 * @param weeklyHours - User's weekly hours (fallback if no workSchedule)
 * @returns Total hours for the absence period
 *
 * @example
 * // User with workSchedule: Mo=8h, Tu=0h, We=6h, Th=8h, Fr=8h
 * calculateAbsenceHoursWithWorkSchedule('2025-01-13', '2025-01-15', workSchedule, 30)
 * // Mo=8h, Tu=0h, We=6h → 14h (not 24h!)
 */
export function calculateAbsenceHoursWithWorkSchedule(
  startDate: string,
  endDate: string,
  workSchedule: WorkSchedule | null | undefined,
  weeklyHours: number
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dayNames: DayName[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  let totalHours = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dayName = dayNames[dayOfWeek];

    // Skip weekends (unless workSchedule specifies hours)
    if (workSchedule) {
      // Use individual work schedule
      totalHours += workSchedule[dayName] || 0;
    } else {
      // Fallback: weeklyHours / 5 for Mo-Fr, 0 for Sa-Su
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalHours += weeklyHours / 5;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return Math.round(totalHours * 100) / 100;
}

/**
 * Count working days based on user's individual work schedule
 *
 * Best Practice (Personio, DATEV, SAP):
 * - Days with 0 hours do NOT count as working days
 * - Only days with hours > 0 count as working days
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param workSchedule - User's work schedule (optional)
 * @param weeklyHours - User's weekly hours (fallback if no workSchedule)
 * @returns Number of working days (not hours!)
 *
 * @example
 * // User with workSchedule: Mo=8h, Tu=0h, We=6h, Th=8h, Fr=8h
 * // Date range: Mo 13.01. - Fr 17.01.2025 (5 calendar days)
 * countWorkingDaysForUser('2025-01-13', '2025-01-17', workSchedule, 30)
 * // → 4 working days (Tu is NOT counted because 0h)
 *
 * @example
 * // User WITHOUT workSchedule, 40h week
 * // Date range: Mo 13.01. - Fr 17.01.2025 (5 calendar days)
 * countWorkingDaysForUser('2025-01-13', '2025-01-17', null, 40)
 * // → 5 working days (standard Mo-Fr counting)
 */
export function countWorkingDaysForUser(
  startDate: string,
  endDate: string,
  workSchedule: WorkSchedule | null | undefined,
  weeklyHours: number
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dayNames: DayName[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dayName = dayNames[dayOfWeek];

    if (workSchedule) {
      // Use individual work schedule - only count days with hours > 0
      const hoursForDay = workSchedule[dayName] || 0;
      if (hoursForDay > 0) {
        workingDays++;
      }
      // Days with 0 hours do NOT count as working days!
    } else {
      // Fallback: Standard Mo-Fr counting (exclude weekends)
      // SPECIAL CASE: weeklyHours=0 → 0 working days
      if (weeklyHours > 0) {
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (!isWeekend) {
          workingDays++;
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}
