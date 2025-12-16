/**
 * Input Validation Utilities
 * Centralized validation functions to prevent SQL injection and data corruption
 */

/**
 * Validate date string format (YYYY-MM-DD)
 * Throws error if invalid to prevent SQL injection and data corruption
 *
 * @param dateStr - Date string to validate
 * @param fieldName - Name of field (for error messages)
 * @throws {Error} If date format is invalid
 *
 * @example
 * validateDateString('2025-12-16', 'startDate'); // ✅ Valid
 * validateDateString('2025-13-01', 'startDate'); // ❌ Throws: Invalid month
 * validateDateString("'; DROP TABLE users; --", 'date'); // ❌ Throws: Invalid format
 */
export function validateDateString(dateStr: string, fieldName: string = 'date'): void {
  // Check format with regex
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid ${fieldName} format. Expected YYYY-MM-DD, got: ${dateStr}`);
  }

  // Parse and validate date components
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Validate year (reasonable range)
  if (year < 1900 || year > 2100) {
    throw new Error(`Invalid ${fieldName} year: ${year}. Must be between 1900-2100`);
  }

  // Validate month
  if (month < 1 || month > 12) {
    throw new Error(`Invalid ${fieldName} month: ${month}. Must be between 1-12`);
  }

  // Validate day
  if (day < 1 || day > 31) {
    throw new Error(`Invalid ${fieldName} day: ${day}. Must be between 1-31`);
  }

  // Create Date object and verify it's valid
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} value: ${dateStr} is not a valid date`);
  }

  // Check for rollover (e.g., Feb 31 → Mar 3)
  const parsedYear = date.getUTCFullYear();
  const parsedMonth = date.getUTCMonth() + 1;
  const parsedDay = date.getUTCDate();

  if (parsedYear !== year || parsedMonth !== month || parsedDay !== day) {
    throw new Error(
      `Invalid ${fieldName}: ${dateStr} rolled over to ${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(parsedDay).padStart(2, '0')}`
    );
  }
}

/**
 * Validate month string format (YYYY-MM)
 *
 * @param monthStr - Month string to validate
 * @param fieldName - Name of field (for error messages)
 * @throws {Error} If month format is invalid
 */
export function validateMonthString(monthStr: string, fieldName: string = 'month'): void {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) {
    throw new Error(`Invalid ${fieldName} format. Expected YYYY-MM, got: ${monthStr}`);
  }

  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);

  if (year < 1900 || year > 2100) {
    throw new Error(`Invalid ${fieldName} year: ${year}`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Invalid ${fieldName} month: ${month}`);
  }
}

/**
 * Validate time string format (HH:MM)
 *
 * @param timeStr - Time string to validate
 * @param fieldName - Name of field (for error messages)
 * @throws {Error} If time format is invalid
 */
export function validateTimeString(timeStr: string, fieldName: string = 'time'): void {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    throw new Error(`Invalid ${fieldName} format. Expected HH:MM, got: ${timeStr}`);
  }

  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid ${fieldName} hours: ${hours}. Must be between 0-23`);
  }

  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid ${fieldName} minutes: ${minutes}. Must be between 0-59`);
  }
}

/**
 * Validate email format
 *
 * @param email - Email to validate
 * @throws {Error} If email format is invalid
 */
export function validateEmail(email: string): void {
  // Basic email validation (not RFC 5322 compliant, but good enough)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  // Additional checks
  if (email.length > 254) {
    throw new Error('Email too long (max 254 characters)');
  }

  const [localPart, domain] = email.split('@');

  if (localPart.length > 64) {
    throw new Error('Email local part too long (max 64 characters)');
  }

  if (domain.length > 255) {
    throw new Error('Email domain too long (max 255 characters)');
  }
}

/**
 * Sanitize string input (prevent XSS)
 *
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate positive number
 *
 * @param value - Number to validate
 * @param fieldName - Name of field (for error messages)
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @throws {Error} If number is invalid
 */
export function validatePositiveNumber(
  value: number,
  fieldName: string,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number, got: ${value}`);
  }

  if (value < min) {
    throw new Error(`${fieldName} must be at least ${min}, got: ${value}`);
  }

  if (value > max) {
    throw new Error(`${fieldName} must be at most ${max}, got: ${value}`);
  }
}
