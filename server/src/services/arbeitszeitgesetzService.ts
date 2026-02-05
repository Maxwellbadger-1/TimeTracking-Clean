/**
 * Arbeitszeitgesetz (ArbZG) Compliance Service
 * Validates working hours according to German labor law
 *
 * ⚠️ IMPORTANT: All validations return WARNINGS only, not errors!
 * Users can save time entries even if they violate ArbZG rules.
 *
 * Key Rules (enforced as warnings):
 * - Max 24h per day (for on-call/long shifts)
 * - Max 48h per week average over 6 months (§3 ArbZG)
 * - Min 30 Min break after 6h (§4 ArbZG)
 * - Min 45 Min break after 9h (§4 ArbZG)
 * - Min 11h rest period between shifts (§5 ArbZG)
 */

import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import { formatDate } from '../utils/timezone.js';

/**
 * Validate if working hours comply with ArbZG §3 (Max daily hours)
 * Returns WARNING if >10h, but allows up to 24h (for on-call/long shifts)
 */
export function validateMaxDailyHours(
  userId: number,
  date: string,
  hours: number,
  excludeEntryId?: number
): { valid: boolean; warning?: string; totalHours?: number } {
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

  // Hard limit: Max 24h per day (technical limit)
  const ABSOLUTE_MAX_HOURS = 24;
  if (totalHours > ABSOLUTE_MAX_HOURS) {
    logger.warn({ totalHours, existingHours, maxHours: ABSOLUTE_MAX_HOURS }, '  ⚠️ WARNING: Exceeds absolute max (24h)');
    return {
      valid: true,
      warning: `⚠️ Achtung: ${totalHours.toFixed(1)}h pro Tag überschreitet das absolute Maximum von ${ABSOLUTE_MAX_HOURS}h! (Bereits ${existingHours.toFixed(1)}h gebucht)`,
      totalHours,
    };
  }

  // ArbZG recommended limit: 10h per day (§3)
  const RECOMMENDED_MAX_HOURS = 10;
  if (totalHours > RECOMMENDED_MAX_HOURS) {
    logger.warn({ totalHours, existingHours, recommendedHours: RECOMMENDED_MAX_HOURS }, '  ⚠️ WARNING: Exceeds recommended daily hours (10h)');
    return {
      valid: true,
      warning: `⚠️ Arbeitszeitgesetz-Hinweis: ${totalHours.toFixed(1)}h überschreitet die empfohlene Arbeitszeit von ${RECOMMENDED_MAX_HOURS}h pro Tag! (Bereits ${existingHours.toFixed(1)}h gebucht, gesamt wird ${totalHours.toFixed(1)}h)`,
      totalHours,
    };
  }

  // Warning if close to limit (>8h but <=10h)
  const STANDARD_DAILY_HOURS = 8;
  if (totalHours > STANDARD_DAILY_HOURS) {
    logger.warn({ totalHours, standardHours: STANDARD_DAILY_HOURS }, '  ⚠️ WARNING: Exceeds standard hours (8h) but within legal limit');
    return {
      valid: true,
      warning: `ℹ️ Hinweis: ${totalHours.toFixed(1)}h überschreitet die Standard-Arbeitszeit von ${STANDARD_DAILY_HOURS}h pro Tag.`,
      totalHours,
    };
  }

  logger.debug('  ✅ VALID: Within all limits');
  return {
    valid: true,
    totalHours,
  };
}

/**
 * Validate if break time complies with ArbZG §4
 * Returns WARNING if breaks insufficient, but does not block entry
 * - After 6h work: Min 30 Min break
 * - After 9h work: Min 45 Min break
 */
export function validateBreakTime(
  workingHours: number,
  breakMinutes: number
): { valid: boolean; warning?: string; requiredBreak?: number } {
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
    logger.warn({ workingHours, requiredBreak, breakMinutes }, '  ⚠️ WARNING: Insufficient break time');
    return {
      valid: true, // CHANGED: Always valid, just warn
      warning: `⚠️ Arbeitszeitgesetz-Hinweis: Bei ${workingHours.toFixed(1)}h Arbeit werden mindestens ${requiredBreak} Minuten Pause empfohlen! (Aktuell: ${breakMinutes} Min)`,
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
 * Returns WARNING if insufficient, but does not block entry
 */
export function validateRestPeriod(
  userId: number,
  newStartTime: string, // Format: "HH:MM"
  newDate: string, // Format: "YYYY-MM-DD"
  excludeEntryId?: number
): { valid: boolean; warning?: string; lastEndTime?: string; hoursBetween?: number } {
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
    logger.warn({ hoursBetween, minRestHours: MIN_REST_HOURS }, '  ⚠️ WARNING: Insufficient rest period');

    // Calculate earliest allowed start time
    const earliestStart = new Date(lastEndDateTime.getTime() + MIN_REST_HOURS * 60 * 60 * 1000);
    const earliestStartTime = earliestStart.toTimeString().substring(0, 5);
    const earliestStartDate = formatDate(earliestStart, 'yyyy-MM-dd');

    return {
      valid: true, // CHANGED: Always valid, just warn
      warning: `⚠️ Arbeitszeitgesetz-Hinweis: Zwischen Schichten sollten mindestens ${MIN_REST_HOURS}h Ruhezeit liegen! Letzte Schicht endete am ${lastEntry.date} um ${lastEntry.endTime}. Empfohlener frühester Start: ${earliestStartDate} ${earliestStartTime} (Aktuell: ${hoursBetween.toFixed(1)}h Ruhezeit)`,
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
      warning: `⚠️ Hinweis: Diese Woche bereits ${existingWeekHours.toFixed(1)}h gearbeitet. Mit dieser Buchung: ${totalWeekHours.toFixed(1)}h (über dem Richtwert von ${MAX_WEEKLY_HOURS}h/Woche).`,
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
 * Checks all ArbZG rules and returns WARNINGS only (no errors)
 *
 * ⚠️ IMPORTANT: This function ALWAYS returns valid: true
 * All violations are returned as warnings, not errors
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
  logger.debug('🏛️ Running comprehensive ArbZG validation (WARNING MODE)');
  logger.debug({ data }, '  validation data');

  const warnings: string[] = [];

  // 1. Max daily hours check (warns if >10h, allows up to 24h)
  const dailyCheck = validateMaxDailyHours(
    data.userId,
    data.date,
    data.hours,
    data.excludeEntryId
  );
  if (dailyCheck.warning) {
    warnings.push(dailyCheck.warning);
  }

  // 2. Break time validation (§4) - warning only
  const breakCheck = validateBreakTime(data.hours, data.breakMinutes);
  if (breakCheck.warning) {
    warnings.push(breakCheck.warning);
  }

  // 3. Rest period validation (§5) - warning only
  const restCheck = validateRestPeriod(
    data.userId,
    data.startTime,
    data.date,
    data.excludeEntryId
  );
  if (restCheck.warning) {
    warnings.push(restCheck.warning);
  }

  // 4. Weekly hours check (§3) - warning only
  const weeklyCheck = validateMaxWeeklyHours(
    data.userId,
    data.date,
    data.hours,
    data.excludeEntryId
  );
  if (weeklyCheck.warning) {
    warnings.push(weeklyCheck.warning);
  }

  // CHANGED: Always return valid: true, no errors
  logger.debug({ warnings, count: warnings.length }, '  ✅ Validation complete (warnings only)');

  return {
    valid: true, // ALWAYS true - warnings don't block
    errors: [], // NEVER errors anymore
    warnings,
  };
}
