/**
 * Modern Month Calendar Component
 *
 * Inspired by Google Calendar, Motion, Cal.com
 * Features:
 * - Clean grid layout
 * - Hover states on days
 * - Color-coded events
 * - Today highlight
 * - Soft shadows instead of borders
 */

import { useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import { CalendarHeader } from './CalendarHeader';
import { CalendarLegend } from './CalendarLegend';
import {
  getDaysInMonth,
  formatDay,
  formatWeekdayShort,
  isToday,
  isCurrentMonth,
  isWeekend,
  isHoliday,
  getHoliday,
  formatCalendarDate,
  getEventColor,
} from '../../utils/calendarUtils';
import { getUserColor, getInitials, getFullName } from '../../utils/userColors';
import type { TimeEntry, AbsenceRequest } from '../../types';

interface MonthCalendarProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  holidays?: Array<{ date: string; name: string }>;
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
}

export function MonthCalendar({
  timeEntries = [],
  absences = [],
  holidays = [],
  onDayClick,
  viewMode = 'month',
  onViewModeChange,
}: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // Group time entries by date
  const entriesByDate = timeEntries.reduce((acc, entry) => {
    acc[entry.date] = acc[entry.date] || [];
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  // Group absences by date
  const absencesByDate = absences.reduce((acc, absence) => {
    const start = new Date(absence.startDate);
    const end = new Date(absence.endDate);
    let current = start;

    while (current <= end) {
      const dateStr = formatCalendarDate(current);
      acc[dateStr] = acc[dateStr] || [];
      acc[dateStr].push(absence);
      current = new Date(current.setDate(current.getDate() + 1));
    }

    return acc;
  }, {} as Record<string, AbsenceRequest[]>);

  const handlePrevious = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNext = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  return (
    <div>
      {/* Modern Header */}
      <CalendarHeader
        currentDate={currentMonth}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {/* Legend */}
      <div className="mb-6">
        <CalendarLegend />
      </div>

      {/* Calendar Grid - Modern card style */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Weekday Headers - Subtle */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid - No borders, hover states */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateStr = formatCalendarDate(day);
            const dayEntries = entriesByDate[dateStr] || [];
            const dayAbsences = absencesByDate[dateStr] || [];
            const holiday = getHoliday(day, holidays);
            const totalHours = dayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

            const isCurrentMonthDay = isCurrentMonth(day, currentMonth);
            const isTodayDay = isToday(day);
            const isWeekendDay = isWeekend(day);
            const isHolidayDay = !!holiday;

            return (
              <div
                key={index}
                onClick={() => onDayClick?.(day)}
                className={`
                  relative min-h-[120px] p-2 transition-all
                  ${onDayClick ? 'cursor-pointer' : ''}
                  ${
                    isCurrentMonthDay
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-gray-50/50 dark:bg-gray-900/50'
                  }
                  ${
                    onDayClick
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      : ''
                  }
                  border-b border-r border-gray-100 dark:border-gray-700/50
                `}
              >
                {/* Day Number - Modern style */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`
                      inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                      ${
                        isTodayDay
                          ? 'bg-blue-600 text-white shadow-md'
                          : isCurrentMonthDay
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-600'
                      }
                      ${isWeekendDay && !isTodayDay ? 'text-gray-500' : ''}
                    `}
                  >
                    {formatDay(day)}
                  </span>
                </div>

                {/* Events - Modern pills */}
                <div className="space-y-1">
                  {/* Holiday */}
                  {isHolidayDay && (
                    <div
                      className={`
                        px-2 py-1 rounded-md text-xs font-medium truncate
                        ${getEventColor('holiday').bg}
                        ${getEventColor('holiday').text}
                      `}
                      title={holiday.name}
                    >
                      {holiday.name}
                    </div>
                  )}

                  {/* Absences - with User Info */}
                  {dayAbsences.slice(0, 2).map((absence, idx) => {
                    const type = absence.type === 'vacation' ? 'vacation' :
                                 absence.type === 'sick' ? 'sick' :
                                 absence.type === 'overtime_comp' ? 'overtime_comp' : 'unpaid';
                    const colors = getEventColor(type);
                    const initials = getInitials(absence.firstName, absence.lastName, absence.userInitials);
                    const fullName = getFullName(absence.firstName, absence.lastName);

                    return (
                      <div
                        key={idx}
                        className={`
                          px-2 py-1 rounded-md text-xs font-medium truncate flex items-center gap-1
                          ${colors.bg} ${colors.text}
                        `}
                        title={`${fullName}: ${
                          type === 'vacation' ? 'Urlaub' :
                          type === 'sick' ? 'Krank' :
                          type === 'overtime_comp' ? 'Überstunden-Ausgleich' : 'Unbezahlt'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                          {initials}
                        </span>
                        {type === 'vacation' ? '🏖️' :
                         type === 'sick' ? '🤒' :
                         type === 'overtime_comp' ? '⏰' : '📅'}
                      </div>
                    );
                  })}

                  {/* Time Entries - Individual entries with User Info */}
                  {dayEntries.slice(0, 3).map((entry, idx) => {
                    const userColor = getUserColor(entry.userId);
                    const initials = getInitials(entry.firstName, entry.lastName, entry.userInitials);
                    const fullName = getFullName(entry.firstName, entry.lastName);

                    return (
                      <div
                        key={idx}
                        className={`
                          px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1
                          ${userColor.bg} ${userColor.text}
                        `}
                        title={`${fullName}: ${entry.hours.toFixed(1)}h (${entry.startTime} - ${entry.endTime})`}
                      >
                        <span className={`w-4 h-4 rounded-full ${userColor.badge} text-white text-[10px] flex items-center justify-center font-bold`}>
                          {initials}
                        </span>
                        <span>{entry.hours.toFixed(1)}h</span>
                      </div>
                    );
                  })}

                  {/* More indicator */}
                  {(dayAbsences.length + dayEntries.length) > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                      +{(dayAbsences.length + dayEntries.length) - 3} mehr
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
