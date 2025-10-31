/**
 * Calendar Utility Functions
 *
 * Helper functions for calendar views (Month, Week, Year)
 */

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, startOfYear, endOfYear, addMonths, isWeekend as dateFnsIsWeekend } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Get all days in a month (for MonthCalendar grid)
 * Returns array including days from previous/next month to fill grid
 */
export function getDaysInMonth(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let currentDay = startDate;

  while (currentDay <= endDate) {
    days.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  return days;
}

/**
 * Get all days in a week (for WeekCalendar)
 */
export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days: Date[] = [];

  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }

  return days;
}

/**
 * Get all months in a year (for YearCalendar)
 */
export function getMonthsInYear(year: number): Date[] {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const months: Date[] = [];

  for (let i = 0; i < 12; i++) {
    months.push(addMonths(yearStart, i));
  }

  return months;
}

/**
 * Check if date is weekend
 */
export function isWeekend(date: Date): boolean {
  return dateFnsIsWeekend(date);
}

/**
 * Check if date is a holiday
 */
export function isHoliday(date: Date, holidays: Array<{ date: string; name: string }>): boolean {
  const dateString = format(date, 'yyyy-MM-dd');
  return holidays.some(h => h.date === dateString);
}

/**
 * Get holiday for a specific date
 */
export function getHoliday(date: Date, holidays: Array<{ date: string; name: string }>): { date: string; name: string } | null {
  const dateString = format(date, 'yyyy-MM-dd');
  return holidays.find(h => h.date === dateString) || null;
}

/**
 * Format month name (e.g., "Januar 2025")
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: de });
}

/**
 * Format short month name (e.g., "Jan")
 */
export function formatMonthShort(date: Date): string {
  return format(date, 'MMM', { locale: de });
}

/**
 * Format weekday name (e.g., "Montag")
 */
export function formatWeekday(date: Date): string {
  return format(date, 'EEEE', { locale: de });
}

/**
 * Format short weekday (e.g., "Mo")
 */
export function formatWeekdayShort(date: Date): string {
  return format(date, 'EEEEEE', { locale: de });
}

/**
 * Format day number (e.g., "15")
 */
export function formatDay(date: Date): string {
  return format(date, 'd');
}

/**
 * Format calendar date (e.g., "2025-10-31")
 */
export function formatCalendarDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if date is in current month
 */
export function isCurrentMonth(date: Date, currentMonth: Date): boolean {
  return isSameMonth(date, currentMonth);
}

/**
 * Get color class for event type
 */
export function getEventColor(type: 'work' | 'vacation' | 'sick' | 'overtime_comp' | 'unpaid' | 'holiday'): {
  bg: string;
  text: string;
  border: string;
  hover: string;
} {
  const colors = {
    work: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
    },
    vacation: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
      hover: 'hover:bg-green-100 dark:hover:bg-green-900/30',
    },
    sick: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
      hover: 'hover:bg-red-100 dark:hover:bg-red-900/30',
    },
    overtime_comp: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
    },
    unpaid: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800',
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-900/30',
    },
    holiday: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-300 dark:border-gray-700',
      hover: 'hover:bg-gray-200 dark:hover:bg-gray-700',
    },
  };

  return colors[type];
}

/**
 * Get hours in a week (for WeekCalendar timeline)
 */
export function getHoursArray(): number[] {
  return Array.from({ length: 24 }, (_, i) => i);
}

/**
 * Format time (e.g., "08:00")
 */
export function formatTime(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/**
 * Calculate position for time entry in WeekCalendar
 * Returns top and height percentages
 */
export function getTimeEntryPosition(startTime: string, endTime: string): {
  top: number;
  height: number;
} {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const duration = endMinutes - startMinutes;

  const top = (startMinutes / (24 * 60)) * 100;
  const height = (duration / (24 * 60)) * 100;

  return { top, height };
}
