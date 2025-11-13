/**
 * Timezone Utilities - Best Practices (SAP, Personio, DATEV)
 *
 * RULES:
 * 1. Database: Store dates as TEXT in format YYYY-MM-DD (no timezone, represents CIVIL time in Europe/Berlin)
 * 2. Server Logic: Always work in Europe/Berlin timezone (German business time)
 * 3. Never use UTC for business logic (working days, overtime calculations)
 *
 * REFERENCES:
 * - https://stackoverflow.com/questions/44965545/best-practices-with-saving-datetime-timezone-info-in-database
 * - https://tech.hbc.com/2019-04-19-time-zones.html
 * - SAP Knowledge Base: Article 2089497
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format as dateFnsFormat } from 'date-fns';

/** Germany Timezone - Handles CET (UTC+1) and CEST (UTC+2) automatically */
export const TIMEZONE = 'Europe/Berlin';

/**
 * Get current date/time in Europe/Berlin timezone
 * Use this INSTEAD of `new Date()` for business logic!
 *
 * @example
 * const now = getCurrentDate(); // Returns Date in Berlin time
 * const today = format(now, 'yyyy-MM-dd'); // "2025-11-13"
 */
export function getCurrentDate(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Get today's date in YYYY-MM-DD format (Berlin timezone)
 * Use this for all date comparisons in business logic
 *
 * @example
 * const today = getTodayString(); // "2025-11-13"
 */
export function getTodayString(): string {
  return formatDate(getCurrentDate(), 'yyyy-MM-dd');
}

/**
 * Format a date in Berlin timezone
 *
 * @param date - Date to format
 * @param formatString - date-fns format string
 * @returns Formatted date string in Berlin timezone
 *
 * @example
 * formatDate(new Date(), 'yyyy-MM-dd') // "2025-11-13"
 * formatDate(new Date(), 'yyyy-MM') // "2025-11"
 * formatDate(new Date(), "yyyy-'W'II") // "2025-W46"
 */
export function formatDate(date: Date, formatString: string): string {
  const berlinDate = toZonedTime(date, TIMEZONE);
  return dateFnsFormat(berlinDate, formatString);
}

/**
 * Parse a date string (YYYY-MM-DD) as Berlin timezone
 * Use this when converting database dates to Date objects
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in Berlin timezone
 *
 * @example
 * parseDate('2025-11-13') // Date object representing 2025-11-13 00:00:00 CET
 */
export function parseDate(dateString: string): Date {
  // Parse as midnight Berlin time
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, 0, 0, 0);
  return fromZonedTime(localDate, TIMEZONE);
}

/**
 * Get current year in Berlin timezone
 */
export function getCurrentYear(): number {
  return getCurrentDate().getFullYear();
}

/**
 * Get current month in YYYY-MM format (Berlin timezone)
 */
export function getCurrentMonth(): string {
  return formatDate(getCurrentDate(), 'yyyy-MM');
}

/**
 * Get ISO week string in YYYY-WXX format (Berlin timezone)
 */
export function getCurrentISOWeek(): string {
  return formatDate(getCurrentDate(), "yyyy-'W'II");
}

/**
 * Check if a date is today (Berlin timezone)
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}
