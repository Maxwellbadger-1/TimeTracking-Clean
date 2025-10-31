/**
 * Validation utilities for form inputs
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTime(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Validate that end time is after start time
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return false;
  }

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  // Allow overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes > startMinutes;
}

/**
 * Validate that end date is after or equal to start date
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return false;
  }

  return endDate >= startDate;
}

/**
 * Validate password strength
 * At least 8 characters
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Validate break minutes (0-480, i.e., 0-8 hours)
 */
export function isValidBreakMinutes(minutes: number): boolean {
  return minutes >= 0 && minutes <= 480;
}

/**
 * Get error message for invalid time range
 */
export function getTimeRangeError(startTime: string, endTime: string): string | null {
  if (!isValidTime(startTime)) {
    return 'Ungültige Startzeit';
  }
  if (!isValidTime(endTime)) {
    return 'Ungültige Endzeit';
  }
  if (!isValidTimeRange(startTime, endTime)) {
    return 'Endzeit muss nach Startzeit liegen';
  }
  return null;
}

/**
 * Get error message for invalid date range
 */
export function getDateRangeError(startDate: string, endDate: string): string | null {
  if (!isValidDate(startDate)) {
    return 'Ungültiges Startdatum';
  }
  if (!isValidDate(endDate)) {
    return 'Ungültiges Enddatum';
  }
  if (!isValidDateRange(startDate, endDate)) {
    return 'Enddatum muss nach oder gleich Startdatum sein';
  }
  return null;
}
