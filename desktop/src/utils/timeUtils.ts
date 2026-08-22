import type { TimeEntry, DayName, WorkTimePeriod } from '../types';

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
  // Handle negative values correctly
  const isNegative = hours < 0;
  const absHours = Math.abs(hours);

  const totalMinutes = Math.round(absHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return `${isNegative ? '-' : ''}${h}:${m.toString().padStart(2, '0')}h`;
}

/**
 * Format hours with sign for overtime display
 * Example: 2.5 → "+2:30h", -1.5 → "-1:30h"
 */
export function formatOvertimeHours(hours: number): string {
  const sign = hours >= 0 ? '+' : '';
  const absHours = Math.abs(hours);

  const totalMinutes = Math.round(absHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return `${sign}${hours < 0 ? '-' : ''}${h}:${m.toString().padStart(2, '0')}h`;
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

const DAY_NAMES: DayName[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Bildet einen zeitzonensicheren Tagesschluessel (YYYY-MM-DD) aus einem Date-Objekt, das per
 * `new Date(dateStr + 'T12:00:00')` erzeugt wurde. Die in `.claude/CLAUDE.md` verbotene
 * UTC-Split-Variante wuerde an Tagesgrenzen ein falsches Datum liefern.
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * DIE EINE Auflösungsstelle im Desktop, zeichengleich zu `resolveWorkPeriodIn()`
 * (server/src/services/workPeriodService.ts:241-251). Jede Abweichung von dieser Bedingung
 * ist ein Dual-Calculation-Fehler — die Auslegung des Intervalls darf im Client nicht von
 * der Serverauslegung abweichen.
 */
export function resolveWorkTimePeriodIn(periods: WorkTimePeriod[], date: string): WorkTimePeriod | null {
  for (const period of periods) {
    if (period.validFrom <= date && (period.validTo === null || period.validTo > date)) {
      return period;
    }
  }
  return null;
}

/**
 * Client-Kopie der Server-Regel `calculateAbsenceHoursWithWorkSchedule`
 * (server/src/utils/workingDays.ts:240). Ihre vollstaendige Aufloesung ist WR-12
 * "mittelfristig" (siehe `11-DESKTOP-DISPOSITION.md`) und bleibt ausserhalb dieser Phase
 * offen — wer diese Funktion aendert, MUSS das Server-Gegenstueck danebenlegen und
 * pruefen, ob beide noch zeichengleich denselben Wert liefern.
 *
 * Ablauf je Tag, in exakt dieser Reihenfolge (wie im Server):
 * 1. Wochenende (Sonntag=0, Samstag=6) -> uebersprungen, auch wenn ein Tagesplan dort
 *    Stunden vorsieht.
 * 2. Feiertag (Treffer in `holidayDates`) -> uebersprungen.
 * 3. Periode zum Datum ueber `resolveWorkTimePeriodIn` aufloesen; keine Periode -> 0 Stunden
 *    fuer diesen Tag, kein Fehler.
 * 4. `period.workSchedule ? (period.workSchedule[dayName] || 0) :
 *    Math.round((period.weeklyHours / 5) * 100) / 100`.
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param periods - Arbeitszeitperioden des Nutzers (aus `useWorkPeriods`)
 * @param holidayDates - Feiertagsdaten als `Set<string>` im Format YYYY-MM-DD
 * @returns Total hours for the absence period
 */
export function calculateAbsenceHoursWithWorkSchedule(
  startDate: string,
  endDate: string,
  periods: WorkTimePeriod[],
  holidayDates: ReadonlySet<string>
): number {
  const end = new Date(endDate + 'T12:00:00');

  let totalHours = 0;
  for (
    const current = new Date(startDate + 'T12:00:00');
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const dayOfWeek = current.getDay();

    // 1. Wochenende -> uebersprungen
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const dateStr = formatDateKey(current);

    // 2. Feiertag -> uebersprungen
    if (holidayDates.has(dateStr)) {
      continue;
    }

    // 3. Periode zum Datum aufloesen; keine Periode -> 0 Stunden, kein Fehler
    const period = resolveWorkTimePeriodIn(periods, dateStr);
    if (!period) {
      continue;
    }

    // 4. Tagesplan oder Wochenstunden/5
    const dayName = DAY_NAMES[dayOfWeek];
    if (period.workSchedule) {
      totalHours += period.workSchedule[dayName] || 0;
    } else {
      totalHours += Math.round((period.weeklyHours / 5) * 100) / 100;
    }
  }

  return Math.round(totalHours * 100) / 100;
}

/**
 * Client-Kopie des Server-Gegenstuecks (siehe Kopfkommentar von
 * `calculateAbsenceHoursWithWorkSchedule` oben — dieselbe Aufloesungsstelle, dieselbe
 * Reihenfolge, dasselbe Verhaeltnis zu WR-12 "mittelfristig").
 *
 * Best Practice (Personio, DATEV, SAP): Tage mit 0 Stunden zaehlen NICHT als Arbeitstage.
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param periods - Arbeitszeitperioden des Nutzers (aus `useWorkPeriods`)
 * @param holidayDates - Feiertagsdaten als `Set<string>` im Format YYYY-MM-DD
 * @returns Number of working days (not hours!)
 */
export function countWorkingDaysForUser(
  startDate: string,
  endDate: string,
  periods: WorkTimePeriod[],
  holidayDates: ReadonlySet<string>
): number {
  const end = new Date(endDate + 'T12:00:00');

  let workingDays = 0;
  for (
    const current = new Date(startDate + 'T12:00:00');
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const dayOfWeek = current.getDay();

    // 1. Wochenende -> uebersprungen
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const dateStr = formatDateKey(current);

    // 2. Feiertag -> uebersprungen
    if (holidayDates.has(dateStr)) {
      continue;
    }

    // 3. Periode zum Datum aufloesen; keine Periode -> 0 Stunden, zaehlt nicht
    const period = resolveWorkTimePeriodIn(periods, dateStr);
    if (!period) {
      continue;
    }

    // 4. Tagesplan oder Wochenstunden/5 — nur Tage mit > 0 Stunden zaehlen
    const dayName = DAY_NAMES[dayOfWeek];
    const hoursForDay = period.workSchedule
      ? (period.workSchedule[dayName] || 0)
      : Math.round((period.weeklyHours / 5) * 100) / 100;
    if (hoursForDay > 0) {
      workingDays++;
    }
  }

  return workingDays;
}
