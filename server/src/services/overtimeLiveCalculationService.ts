/**
 * Overtime Live Calculation Service
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - ON-DEMAND live calculation from source data
 * - NO database transactions needed
 * - Always up-to-date, reflects ALL changes instantly
 * - Single Source of Truth: time_entries + absence_requests + overtime_corrections
 *
 * TRANSACTION TYPES (calculated):
 * - 'earned': Daily overtime from time entries (actualHours - targetHours)
 * - 'vacation_credit': Approved vacation (credits target hours)
 * - 'sick_credit': Approved sick leave (credits target hours)
 * - 'overtime_comp_credit': Approved overtime compensation (credits target hours)
 * - 'special_credit': Approved special leave (credits target hours)
 * - 'unpaid_adjustment': Unpaid leave (reduces target hours, shown as 0h)
 * - 'correction': Manual admin corrections
 */

import { db } from '../database/connection.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import type { UserPublic } from '../types/index.js';
import logger from '../utils/logger.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';

/**
 * Get all working days between two dates (inclusive)
 *
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param workSchedule Work schedule object (optional)
 * @param weeklyHours Weekly hours fallback if no workSchedule
 * @returns Array of date strings (YYYY-MM-DD) for all working days
 */
function getAllWorkingDaysBetween(
  startDate: string,
  endDate: string,
  workSchedule: Record<string, number> | null,
  weeklyHours: number
): string[] {
  const workingDays: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  // Iterate through each day
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d, 'yyyy-MM-dd');
    const dayOfWeek = d.getDay();

    // Check if this day is a holiday
    const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (isHoliday) {
      continue; // Skip holidays
    }

    // Determine if this is a working day
    let isWorkingDay = false;

    if (workSchedule) {
      // Use workSchedule to determine working days
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      const hoursForDay = workSchedule[dayName] || 0;
      isWorkingDay = hoursForDay > 0;
    } else {
      // Default: Monday-Friday are working days (weeklyHours/5)
      isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    if (isWorkingDay) {
      workingDays.push(dateStr);
    }
  }

  return workingDays;
}

export interface LiveOvertimeTransaction {
  date: string;
  type: 'earned' | 'feiertag' | 'vacation_credit' | 'sick_credit' | 'overtime_comp_credit' | 'special_credit' | 'unpaid_adjustment' | 'correction';
  hours: number;
  description: string;
  source: 'time_entries' | 'absence_requests' | 'overtime_corrections' | 'holidays';
  referenceId?: number;
}

/**
 * Calculate live overtime transactions for a user
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for overtime display!
 * - Calculates from raw data (time_entries, absences, corrections)
 * - Always includes ALL days from hireDate to today
 * - Reflects changes instantly (no caching, no stale data)
 *
 * CONSISTENCY NOTE (Phase 2):
 * - Uses getDailyTargetHours() - same helper as UnifiedOvertimeService
 * - Calculation logic: overtime = actualHours - targetHours (consistent)
 * - This function focuses on transaction-level detail for UI display
 * - For aggregated results, use UnifiedOvertimeService or calculateCurrentOvertimeBalance()
 *
 * @param userId User ID
 * @param fromDate Optional start date (defaults to hireDate)
 * @param toDate Optional end date (defaults to today)
 * @returns Array of transactions, newest first
 */
export function calculateLiveOvertimeTransactions(
  userId: number,
  fromDate?: string,
  toDate?: string
): LiveOvertimeTransaction[] {
  // Get user with work schedule
  const user = db.prepare(`
    SELECT id, hireDate, weeklyHours, workSchedule
    FROM users
    WHERE id = ?
  `).get(userId) as { id: number; hireDate: string; weeklyHours: number; workSchedule: string | null } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Parse workSchedule
  const workSchedule = user.workSchedule ? JSON.parse(user.workSchedule) : null;

  // Determine date range (never before hireDate!)
  const startDate = fromDate && fromDate > user.hireDate
    ? fromDate
    : user.hireDate;
  const endDate = toDate || formatDate(getCurrentDate(), 'yyyy-MM-dd'); // Today

  logger.debug({ userId, startDate, endDate }, '📊 Calculating live overtime transactions');

  const transactions: LiveOvertimeTransaction[] = [];

  // Build user object for getDailyTargetHours()
  const userForCalc: UserPublic = {
    id: user.id,
    weeklyHours: user.weeklyHours,
    workSchedule,
  } as UserPublic;

  // ========================================
  // 1. Get approved absences and build Set of absence dates
  // ========================================
  const absencesQuery = db.prepare(`
    SELECT id, type, startDate, endDate, days
    FROM absence_requests
    WHERE userId = ?
      AND status = 'approved'
      AND endDate >= ?
      AND startDate <= ?
    ORDER BY startDate DESC
  `);

  const absences = absencesQuery.all(userId, startDate, endDate) as Array<{
    id: number;
    type: 'vacation' | 'sick' | 'overtime_comp' | 'special' | 'unpaid';
    startDate: string;
    endDate: string;
    days: number;
  }>;

  // Build Set of absence dates (working days only, excluding holidays/weekends)
  const absenceDates = new Set<string>();
  for (const absence of absences) {
    const absenceStartDate = new Date(absence.startDate + 'T12:00:00');
    const absenceEndDate = new Date(absence.endDate + 'T12:00:00');

    for (let d = new Date(absenceStartDate); d <= absenceEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');

      if (dateStr < startDate || dateStr > endDate) continue;

      const dayOfWeek = d.getDay();
      if (!workSchedule && (dayOfWeek === 0 || dayOfWeek === 6)) continue;

      const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) continue;

      const targetHours = getDailyTargetHours(userForCalc, dateStr);
      if (targetHours === 0) continue;

      absenceDates.add(dateStr);
    }
  }

  // ========================================
  // 2. Load holidays and add as transactions
  // ========================================
  const holidaysQuery = db.prepare(`
    SELECT date, name, federal
    FROM holidays
    WHERE date >= ?
      AND date <= ?
    ORDER BY date DESC
  `);

  const holidays = holidaysQuery.all(startDate, endDate) as Array<{
    date: string;
    name: string;
    federal: number;
  }>;

  // Add holiday transactions (informational, hours = 0)
  for (const holiday of holidays) {
    const federalText = holiday.federal === 0 ? ' (Bayern)' : ' (Bundesweit)';
    transactions.push({
      date: holiday.date,
      type: 'feiertag',
      hours: 0,
      description: `${holiday.name}${federalText}`,
      source: 'holidays',
    });
  }

  // ========================================
  // 3. Load time_entries as Map for fast lookup
  // ========================================
  const timeEntryQuery = db.prepare(`
    SELECT date, SUM(hours) as totalHours
    FROM time_entries
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY date
  `);

  const timeEntries = timeEntryQuery.all(userId, startDate, endDate) as Array<{
    date: string;
    totalHours: number;
  }>;

  const timeEntriesMap = new Map<string, number>();
  for (const entry of timeEntries) {
    timeEntriesMap.set(entry.date, entry.totalHours);
  }

  // ========================================
  // 4. Calculate "earned" transactions for ALL working days
  // ========================================
  const allWorkingDays = getAllWorkingDaysBetween(startDate, endDate, workSchedule, user.weeklyHours);

  for (const date of allWorkingDays) {
    // Skip days with absences (they get their own credit transactions below)
    if (absenceDates.has(date)) {
      continue;
    }

    const targetHours = getDailyTargetHours(userForCalc, date);
    const actualHours = timeEntriesMap.get(date) || 0;
    const overtime = actualHours - targetHours;

    // Only show days with non-zero overtime
    if (overtime !== 0) {
      const description = actualHours === 0
        ? `Keine Zeiterfassung (Soll: ${targetHours}h)`
        : `Gearbeitet: ${actualHours}h (Soll: ${targetHours}h)`;

      transactions.push({
        date,
        type: 'earned',
        hours: Math.round(overtime * 100) / 100, // Round to 2 decimals
        description,
        source: 'time_entries',
      });
    }
  }

  // ========================================
  // 5. Add absence credit transactions
  // ========================================
  // Process each absence
  for (const absence of absences) {
    const absenceStartDate = new Date(absence.startDate + 'T12:00:00');
    const absenceEndDate = new Date(absence.endDate + 'T12:00:00');

    // Iterate through each day in the absence period
    for (let d = new Date(absenceStartDate); d <= absenceEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd');

      // Only include days within our calculation range
      if (dateStr < startDate || dateStr > endDate) {
        continue;
      }

      const dayOfWeek = d.getDay();

      // Skip weekends (unless workSchedule says otherwise)
      if (!workSchedule && (dayOfWeek === 0 || dayOfWeek === 6)) {
        continue;
      }

      // Check if this day is a holiday
      const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
      if (isHoliday) {
        continue; // Holidays don't count as absence days
      }

      // Get target hours for this day
      const targetHours = getDailyTargetHours(userForCalc, dateStr);

      // Skip days with 0 target hours (days off in workSchedule)
      if (targetHours === 0) {
        continue;
      }

      // Map absence type to transaction type
      let transactionType: LiveOvertimeTransaction['type'];
      let description: string;

      switch (absence.type) {
        case 'vacation':
          transactionType = 'vacation_credit';
          description = `Urlaub (genehmigt #${absence.id})`;
          break;
        case 'sick':
          transactionType = 'sick_credit';
          description = `Krankheit (genehmigt #${absence.id})`;
          break;
        case 'overtime_comp':
          transactionType = 'overtime_comp_credit';
          description = `Überstundenausgleich (genehmigt #${absence.id})`;
          break;
        case 'special':
          transactionType = 'special_credit';
          description = `Sonderurlaub (genehmigt #${absence.id})`;
          break;
        case 'unpaid':
          transactionType = 'unpaid_adjustment';
          description = `Unbezahlter Urlaub (genehmigt #${absence.id})`;
          break;
        default:
          continue; // Unknown type, skip
      }

      // Add transaction
      // IMPORTANT: unpaid_adjustment shows 0 hours (reduces target, no credit)
      const hours = absence.type === 'unpaid' ? 0 : targetHours;

      transactions.push({
        date: dateStr,
        type: transactionType,
        hours: Math.round(hours * 100) / 100,
        description,
        source: 'absence_requests',
        referenceId: absence.id,
      });
    }
  }

  // ========================================
  // 6. Add manual corrections
  // ========================================
  const correctionsQuery = db.prepare(`
    SELECT id, date, hours, reason
    FROM overtime_corrections
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    ORDER BY date DESC
  `);

  const corrections = correctionsQuery.all(userId, startDate, endDate) as Array<{
    id: number;
    date: string;
    hours: number;
    reason: string;
  }>;

  for (const correction of corrections) {
    transactions.push({
      date: correction.date,
      type: 'correction',
      hours: Math.round(correction.hours * 100) / 100,
      description: `Korrektur: ${correction.reason}`,
      source: 'overtime_corrections',
      referenceId: correction.id,
    });
  }

  // ========================================
  // 7. Check for work on non-working days (holidays, weekends, days off)
  // ========================================
  // If someone worked on a non-working day, we need to add those hours as overtime
  // (since these days are not in allWorkingDays)
  for (const [date, actualHours] of timeEntriesMap.entries()) {
    // Skip if already processed (in allWorkingDays or absenceDates)
    if (allWorkingDays.includes(date) || absenceDates.has(date)) {
      continue;
    }

    // Any work on non-working days counts as overtime
    if (actualHours > 0) {
      const targetHours = getDailyTargetHours(userForCalc, date);
      const overtime = actualHours - targetHours; // Usually targetHours = 0 for non-working days

      const isHoliday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(date);
      const description = isHoliday
        ? `Gearbeitet am Feiertag: ${actualHours}h (Soll: ${targetHours}h)`
        : `Gearbeitet: ${actualHours}h (Soll: ${targetHours}h)`;

      transactions.push({
        date,
        type: 'earned',
        hours: Math.round(overtime * 100) / 100,
        description,
        source: 'time_entries',
      });
    }
  }

  // ========================================
  // 8. Sort by date (newest first) and return
  // ========================================
  transactions.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;

    // If same date, sort by type priority (holidays first, then earned, then absences, then corrections)
    const typePriority: Record<string, number> = {
      feiertag: 0,
      earned: 1,
      vacation_credit: 2,
      sick_credit: 2,
      overtime_comp_credit: 2,
      special_credit: 2,
      unpaid_adjustment: 2,
      correction: 3,
    };
    return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
  });

  logger.debug({ userId, transactionCount: transactions.length }, '✅ Live transactions calculated');

  return transactions;
}

/**
 * Calculate current overtime balance (cumulative sum)
 *
 * MIGRATION TO UNIFIED SERVICE (Phase 2):
 * Delegates to UnifiedOvertimeService for consistent calculation logic
 *
 * IMPORTANT: This matches the balance displayed in WorkTimeAccountWidget
 * - Calculates from single source of truth (UnifiedOvertimeService)
 * - Includes worked hours, absence credits, corrections, unpaid adjustments
 *
 * @param userId User ID
 * @param fromDate Optional start date (defaults to hireDate)
 * @param toDate Optional end date (defaults to today)
 * @returns Total overtime balance
 */
export function calculateCurrentOvertimeBalance(
  userId: number,
  fromDate?: string,
  toDate?: string
): number {
  // Get user to determine date range
  const user = db.prepare(`
    SELECT id, hireDate
    FROM users
    WHERE id = ?
  `).get(userId) as { id: number; hireDate: string } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  // Determine date range (never before hireDate!)
  const startDate = fromDate && fromDate > user.hireDate
    ? fromDate
    : user.hireDate;
  const endDate = toDate || formatDate(getCurrentDate(), 'yyyy-MM-dd'); // Today

  // Delegate to UnifiedOvertimeService (Single Source of Truth)
  const periodResult = unifiedOvertimeService.calculatePeriodOvertime(
    userId,
    startDate,
    endDate
  );

  return Math.round(periodResult.overtime * 100) / 100; // Round to 2 decimals
}
