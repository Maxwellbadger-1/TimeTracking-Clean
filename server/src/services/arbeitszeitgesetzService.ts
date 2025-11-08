/**
 * Arbeitszeitgesetz (ArbZG) Compliance Service
 * Validates working hours according to German labor law
 *
 * Key Rules:
 * - Max 10h per day (§3 ArbZG)
 * - Max 48h per week average over 6 months (§3 ArbZG)
 * - Min 30 Min break after 6h (§4 ArbZG)
 * - Min 45 Min break after 9h (§4 ArbZG)
 * - Min 11h rest period between shifts (§5 ArbZG)
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';

/**
 * Validate if working hours comply with ArbZG §3 (Max 10h/day)
 */
export function validateMaxDailyHours(
  userId: number,
  date: string,
  hours: number,
  excludeEntryId?: number
): { valid: boolean; error?: string; totalHours?: number } {
  logger.debug('🔍 Validating Max Daily Hours (ArbZG §3)');
  logger.debug({ userId, date, hours, excludeEntryId }, '  Parameters');

  // Get existing hours for this date
  const query = `
    SELECT SUM(hours) as totalHours
    FROM time_entries
    WHERE userId = ?
      AND date = ?
      AND id != ?
  `;

  const result = db
    .prepare(query)
    .get(userId, date, excludeEntryId || 0) as { totalHours: number | null } | undefined;

  const existingHours = result?.totalHours || 0;
  const totalHours = existingHours + hours;

  logger.debug({ existingHours, totalHours }, '  Hours calculation');

  // ArbZG §3: Max 10h per day
  const MAX_DAILY_HOURS = 10;

  if (totalHours > MAX_DAILY_HOURS) {
    logger.warn({ totalHours, existingHours, maxHours: MAX_DAILY_HOURS }, '  ❌ VIOLATION: Exceeds max daily hours');
    return {
      valid: false,
      error: `Arbeitszeitgesetz-Verstoß: Maximale Arbeitszeit von ${MAX_DAILY_HOURS}h pro Tag überschritten! (Bereits ${existingHours}h gebucht, gesamt würde ${totalHours}h)`,
      totalHours,
    };
  }

  // Warning if close to limit (>8h but <=10h)
  const STANDARD_DAILY_HOURS = 8;
  if (totalHours > STANDARD_DAILY_HOURS && totalHours <= MAX_DAILY_HOURS) {
    logger.warn({ totalHours, standardHours: STANDARD_DAILY_HOURS }, '  ⚠️ WARNING: Exceeds standard hours but within legal limit');
    // We allow it but could return a warning
  }

  logger.debug('  ✅ VALID: Within legal limits');
  return {
    valid: true,
    totalHours,
  };
}

/**
 * Validate if break time complies with ArbZG §4
 * - After 6h work: Min 30 Min break
 * - After 9h work: Min 45 Min break
 */
export function validateBreakTime(
  workingHours: number,
  breakMinutes: number
): { valid: boolean; error?: string; requiredBreak?: number } {
  logger.debug('🔍 Validating Break Time (ArbZG §4)');
  logger.debug({ workingHours, breakMinutes }, '  Parameters');

  let requiredBreak = 0;

  // ArbZG §4: Break requirements
  if (workingHours > 9) {
    requiredBreak = 45; // Min 45 Min after 9h
  } else if (workingHours > 6) {
    requiredBreak = 30; // Min 30 Min after 6h
  }

  logger.debug({ requiredBreak }, '  required break (min)');

  if (requiredBreak > 0 && breakMinutes < requiredBreak) {
    logger.warn({ workingHours, requiredBreak, breakMinutes }, '  ❌ VIOLATION: Insufficient break time');
    return {
      valid: false,
      error: `Arbeitszeitgesetz-Verstoß: Bei ${workingHours}h Arbeit sind mindestens ${requiredBreak} Minuten Pause erforderlich! (Aktuell: ${breakMinutes} Min)`,
      requiredBreak,
    };
  }

  logger.debug('  ✅ VALID: Break time sufficient');
  return {
    valid: true,
    requiredBreak,
  };
}

/**
 * Validate if rest period complies with ArbZG §5 (Min 11h between shifts)
 */
export function validateRestPeriod(
  userId: number,
  newStartTime: string, // Format: "HH:MM"
  newDate: string, // Format: "YYYY-MM-DD"
  excludeEntryId?: number
): { valid: boolean; error?: string; lastEndTime?: string; hoursBetween?: number } {
  logger.debug('🔍 Validating Rest Period (ArbZG §5)');
  logger.debug({ userId, newDate, newStartTime, excludeEntryId }, '  Parameters');

  // Get the most recent time entry BEFORE this date
  const query = `
    SELECT date, endTime
    FROM time_entries
    WHERE userId = ?
      AND id != ?
      AND (
        date < ?
        OR (date = ? AND endTime < ?)
      )
    ORDER BY date DESC, endTime DESC
    LIMIT 1
  `;

  const lastEntry = db
    .prepare(query)
    .get(
      userId,
      excludeEntryId || 0,
      newDate,
      newDate,
      newStartTime
    ) as { date: string; endTime: string } | undefined;

  if (!lastEntry) {
    logger.debug('  ℹ️ No previous entry found - skipping validation');
    return { valid: true };
  }

  logger.debug({ lastEntry }, '  last entry');

  // Calculate time between last end and new start
  const lastEndDateTime = new Date(`${lastEntry.date}T${lastEntry.endTime}`);
  const newStartDateTime = new Date(`${newDate}T${newStartTime}`);

  const hoursBetween = (newStartDateTime.getTime() - lastEndDateTime.getTime()) / (1000 * 60 * 60);

  logger.debug({ hoursBetween }, '  hours between shifts');

  // ArbZG §5: Min 11h rest period
  const MIN_REST_HOURS = 11;

  if (hoursBetween < MIN_REST_HOURS) {
    logger.warn({ hoursBetween, minRestHours: MIN_REST_HOURS }, '  ❌ VIOLATION: Insufficient rest period');

    // Calculate earliest allowed start time
    const earliestStart = new Date(lastEndDateTime.getTime() + MIN_REST_HOURS * 60 * 60 * 1000);
    const earliestStartTime = earliestStart.toTimeString().substring(0, 5);
    const earliestStartDate = earliestStart.toISOString().split('T')[0];

    return {
      valid: false,
      error: `Arbeitszeitgesetz-Verstoß: Zwischen Schichten müssen mindestens ${MIN_REST_HOURS}h Ruhezeit liegen! Letzte Schicht endete am ${lastEntry.date} um ${lastEntry.endTime}. Frühester möglicher Start: ${earliestStartDate} ${earliestStartTime}`,
      lastEndTime: `${lastEntry.date} ${lastEntry.endTime}`,
      hoursBetween,
    };
  }

  logger.debug('  ✅ VALID: Rest period sufficient');
  return {
    valid: true,
    lastEndTime: `${lastEntry.date} ${lastEntry.endTime}`,
    hoursBetween,
  };
}

/**
 * Validate if weekly hours comply with ArbZG §3 (Max 48h/week average)
 * Note: This is calculated as average over 6 months, but we check current week as warning
 */
export function validateMaxWeeklyHours(
  userId: number,
  date: string,
  hours: number,
  excludeEntryId?: number
): { valid: boolean; warning?: string; totalWeekHours?: number } {
  logger.debug('🔍 Validating Max Weekly Hours (ArbZG §3)');
  logger.debug({ userId, date, hours }, '  Parameters');

  // Get week number (format: YYYY-WW)
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (dateObj.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  const week = `${year}-W${String(weekNumber).padStart(2, '0')}`;

  logger.debug({ week }, '  week number');

  // Get existing hours for this week
  const query = `
    SELECT SUM(hours) as totalHours
    FROM time_entries
    WHERE userId = ?
      AND strftime('%Y-W%W', date) = ?
      AND id != ?
  `;

  const result = db
    .prepare(query)
    .get(userId, week, excludeEntryId || 0) as { totalHours: number | null } | undefined;

  const existingWeekHours = result?.totalHours || 0;
  const totalWeekHours = existingWeekHours + hours;

  logger.debug({ existingWeekHours, totalWeekHours }, '  Week hours calculation');

  // ArbZG §3: Max 48h/week (average over 6 months)
  // We show a warning if current week exceeds 48h
  const MAX_WEEKLY_HOURS = 48;

  if (totalWeekHours > MAX_WEEKLY_HOURS) {
    logger.warn({ totalWeekHours, maxWeeklyHours: MAX_WEEKLY_HOURS }, '  ⚠️ WARNING: Exceeds recommended weekly hours');
    return {
      valid: true, // We don't reject, just warn
      warning: `Hinweis: Diese Woche bereits ${existingWeekHours}h gearbeitet. Mit dieser Buchung: ${totalWeekHours}h (über dem Richtwert von ${MAX_WEEKLY_HOURS}h/Woche).`,
      totalWeekHours,
    };
  }

  logger.debug('  ✅ VALID: Within weekly limits');
  return {
    valid: true,
    totalWeekHours,
  };
}

/**
 * Comprehensive validation for time entry creation
 * Checks all ArbZG rules
 */
export function validateTimeEntryArbZG(data: {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  breakMinutes: number;
  excludeEntryId?: number;
}): { valid: boolean; errors: string[]; warnings: string[] } {
  logger.debug('🏛️ Running comprehensive ArbZG validation');
  logger.debug({ data }, '  validation data');

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Max 10h per day (§3)
  const dailyCheck = validateMaxDailyHours(
    data.userId,
    data.date,
    data.hours,
    data.excludeEntryId
  );
  if (!dailyCheck.valid && dailyCheck.error) {
    errors.push(dailyCheck.error);
  }

  // 2. Break time validation (§4)
  const breakCheck = validateBreakTime(data.hours, data.breakMinutes);
  if (!breakCheck.valid && breakCheck.error) {
    errors.push(breakCheck.error);
  }

  // 3. Rest period validation (§5)
  const restCheck = validateRestPeriod(
    data.userId,
    data.startTime,
    data.date,
    data.excludeEntryId
  );
  if (!restCheck.valid && restCheck.error) {
    errors.push(restCheck.error);
  }

  // 4. Weekly hours check (§3 - warning only)
  const weeklyCheck = validateMaxWeeklyHours(
    data.userId,
    data.date,
    data.hours,
    data.excludeEntryId
  );
  if (weeklyCheck.warning) {
    warnings.push(weeklyCheck.warning);
  }

  const isValid = errors.length === 0;

  logger.debug({ isValid, errors, warnings }, '  ✅ Validation complete');

  return {
    valid: isValid,
    errors,
    warnings,
  };
}
