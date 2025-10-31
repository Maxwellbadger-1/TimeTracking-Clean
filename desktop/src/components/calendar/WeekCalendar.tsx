/**
 * Week Calendar Component (Timeline View)
 *
 * Inspired by Toggl Track, Clockify Timeline
 * Features:
 * - Timeline view (hours 6:00-22:00)
 * - 7-day week view
 * - Time entries as blocks in timeline
 * - Current time indicator
 * - Color-coded by type
 * - Hover shows details
 */

import { useState, useMemo } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarHeader } from './CalendarHeader';
import { CalendarLegend } from './CalendarLegend';
import { getEventColor } from '../../utils/calendarUtils';
import { getUserColor, getInitials, getFullName } from '../../utils/userColors';
import type { TimeEntry, AbsenceRequest } from '../../types';

interface WeekCalendarProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 to 22:00
const HOUR_HEIGHT = 60; // pixels per hour

export function WeekCalendar({
  timeEntries = [],
  absences = [],
  onDayClick,
  viewMode = 'week',
  onViewModeChange,
}: WeekCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Get week days (Monday - Sunday)
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Current time indicator position
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimePosition = ((currentHour - 6) * HOUR_HEIGHT) + (currentMinute / 60 * HOUR_HEIGHT);

  // Group time entries by day
  const entriesByDay = useMemo(() => {
    const grouped: Record<string, TimeEntry[]> = {};
    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      grouped[dateKey] = timeEntries.filter((entry) =>
        isSameDay(parseISO(entry.date), day)
      );
    });
    return grouped;
  }, [timeEntries, weekDays]);

  // Group absences by day
  const absencesByDay = useMemo(() => {
    const grouped: Record<string, AbsenceRequest[]> = {};
    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      grouped[dateKey] = absences.filter((absence) => {
        const start = parseISO(absence.startDate);
        const end = parseISO(absence.endDate);
        return day >= start && day <= end;
      });
    });
    return grouped;
  }, [absences, weekDays]);

  const handlePrevious = () => {
    setCurrentWeek((prev) => addDays(prev, -7));
  };

  const handleNext = () => {
    setCurrentWeek((prev) => addDays(prev, 7));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  // Calculate time entry position and height
  const getEntryStyle = (entry: TimeEntry) => {
    if (!entry.startTime || !entry.endTime) return null;

    const [startHour, startMinute] = entry.startTime.split(':').map(Number);
    const [endHour, endMinute] = entry.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const durationMinutes = endMinutes - startMinutes;

    const top = ((startHour - 6) * HOUR_HEIGHT) + (startMinute / 60 * HOUR_HEIGHT);
    const height = (durationMinutes / 60) * HOUR_HEIGHT;

    return { top, height };
  };

  return (
    <div>
      <CalendarHeader
        currentDate={currentWeek}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
      <CalendarLegend />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Header: Days of Week */}
        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
          {/* Empty corner for time column */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50" />

          {/* Day Headers */}
          {weekDays.map((day) => {
            const dayIsToday = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={`p-4 text-center border-l border-gray-200 dark:border-gray-700 ${
                  dayIsToday
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-gray-50 dark:bg-gray-900/50'
                }`}
              >
                <div
                  className={`text-xs font-medium uppercase ${
                    dayIsToday
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {format(day, 'EEE', { locale: de })}
                </div>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    dayIsToday
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Grid */}
        <div className="grid grid-cols-8">
          {/* Time Column */}
          <div className="bg-gray-50 dark:bg-gray-900/50">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEntries = entriesByDay[dateKey] || [];
            const dayAbsences = absencesByDay[dateKey] || [];
            const dayIsToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-gray-200 dark:border-gray-700"
                onClick={() => onDayClick?.(day)}
              >
                {/* Hour Grid Lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className={`h-[60px] border-b border-gray-200 dark:border-gray-700 ${
                      dayIsToday
                        ? 'bg-blue-50/30 dark:bg-blue-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } transition-colors cursor-pointer`}
                  />
                ))}

                {/* Current Time Indicator */}
                {dayIsToday && currentHour >= 6 && currentHour <= 22 && (
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-red-500 dark:bg-red-400 z-20"
                    style={{ top: `${currentTimePosition}px` }}
                  >
                    <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 dark:bg-red-400 rounded-full border-2 border-white dark:border-gray-800" />
                  </div>
                )}

                {/* All-day Absences */}
                {dayAbsences.length > 0 && (
                  <div className="absolute top-2 left-2 right-2 z-10">
                    {dayAbsences.map((absence) => {
                      const type = absence.type === 'vacation' ? 'vacation' :
                                   absence.type === 'sick' ? 'sick' :
                                   absence.type === 'overtime_comp' ? 'overtime_comp' : 'unpaid';
                      const colors = getEventColor(type);
                      const initials = getInitials(absence.firstName, absence.lastName, absence.userInitials);
                      const fullName = getFullName(absence.firstName, absence.lastName);

                      return (
                        <div
                          key={absence.id}
                          className={`${colors.bg} ${colors.border} ${colors.text} border-l-4 px-2 py-1 rounded text-xs font-medium mb-1 shadow-sm flex items-center gap-1`}
                          title={`${fullName}: ${
                            type === 'vacation' ? 'Urlaub' :
                            type === 'sick' ? 'Krank' :
                            type === 'overtime_comp' ? 'Überstunden-Ausgleich' : 'Unbezahlt'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                            {initials}
                          </span>
                          {absence.type === 'vacation' && '🏖️ Urlaub'}
                          {absence.type === 'sick' && '🤒 Krank'}
                          {absence.type === 'unpaid' && '📅 Unbezahlt'}
                          {absence.type === 'overtime_comp' && '⏰ Ausgleich'}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Time Entry Blocks */}
                {dayEntries.map((entry) => {
                  const style = getEntryStyle(entry);
                  if (!style) return null;

                  const userColor = getUserColor(entry.userId);
                  const initials = getInitials(entry.firstName, entry.lastName, entry.userInitials);
                  const fullName = getFullName(entry.firstName, entry.lastName);

                  return (
                    <div
                      key={entry.id}
                      className={`absolute left-1 right-1 ${userColor.bg} ${userColor.border} ${userColor.text} border-l-4 rounded px-2 py-1 text-xs font-medium shadow-sm hover:shadow-md transition-all cursor-pointer z-10 overflow-hidden`}
                      style={{
                        top: `${style.top}px`,
                        height: `${style.height}px`,
                      }}
                      title={`${fullName}\n${entry.startTime} - ${entry.endTime} (${entry.hours}h)${entry.breakMinutes ? `\nPause: ${entry.breakMinutes}min` : ''}`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`w-4 h-4 rounded-full ${userColor.badge} text-white text-[10px] flex items-center justify-center font-bold`}>
                          {initials}
                        </span>
                        <span className="font-semibold truncate">{fullName}</span>
                      </div>
                      <div className="font-semibold truncate">
                        {entry.startTime} - {entry.endTime}
                      </div>
                      <div className="text-xs opacity-80 truncate">
                        {entry.hours}h
                        {entry.breakMinutes ? ` (${entry.breakMinutes}min Pause)` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
