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
// import { addMonths, subMonths } from 'date-fns'; // Unused - handlers commented out
import {
  getDaysInMonth,
  formatDay,
  isToday,
  isCurrentMonth,
  isWeekend,
  getHoliday,
  formatCalendarDate,
  getEventColor,
  getAbsenceTypeLabel,
  getAbsenceStatusLabel,
} from '../../utils/calendarUtils';
import { getUserColor, getInitials, getFullName } from '../../utils/userColors';
import { formatHours } from '../../utils/timeUtils';
import type { TimeEntry, AbsenceRequest } from '../../types';

interface MonthCalendarProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  holidays?: Array<{ date: string; name: string }>;
  isAdmin?: boolean;
  currentUserId?: number; // Current user's ID for privacy filtering
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
  currentDate?: Date; // Controlled component: Date from parent (for API calls)
  onDateChange?: (date: Date) => void; // Callback to parent when date changes
}

export function MonthCalendar({
  timeEntries = [],
  absences = [],
  holidays = [],
  isAdmin = false,
  currentUserId,
  onDayClick,
  viewMode: _viewMode = 'month',
  onViewModeChange: _onViewModeChange,
  currentDate: externalDate,
  onDateChange: _onDateChange,
}: MonthCalendarProps) {
  // Support both controlled (from parent) and uncontrolled (internal state) usage
  const [internalDate] = useState(new Date()); // setInternalDate unused - handlers commented out
  const currentMonth = externalDate || internalDate;
  // const setCurrentMonth = onDateChange || setInternalDate; // Unused - handlers commented out

  // Track which days are expanded
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Global "Show All" toggle
  const [showAllEntries, setShowAllEntries] = useState(false);

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // PRIVACY FILTERING (DSGVO-compliant)
  // Admin: Show ALL absences (approved + pending) for all users (not rejected)
  // Employee: Show ALL own absences + ONLY approved vacation from others
  const filteredAbsences = isAdmin
    ? absences.filter(a => a.status !== 'rejected')
    : absences.filter(a => {
        const isOwnAbsence = a.userId === currentUserId;
        const isVacation = a.type === 'vacation';
        const isApproved = a.status === 'approved';

        // Show if:
        // - Own absence (any type, any status)
        // OR
        // - Vacation from others (approved only)
        return isOwnAbsence || (isVacation && isApproved);
      });

  // Group time entries by date
  const entriesByDate = timeEntries.reduce((acc, entry) => {
    acc[entry.date] = acc[entry.date] || [];
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  // Group absences by date (using filtered absences!)
  const absencesByDate = filteredAbsences.reduce((acc, absence) => {
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

  // const handlePrevious = () => setCurrentMonth(subMonths(currentMonth, 1));
  // const handleToday = () => setCurrentMonth(new Date()); // Unused

  return (
    <div>
      {/* Show All Toggle - below legend */}
      <div className="flex items-center justify-end mb-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={showAllEntries}
            onChange={(e) => setShowAllEntries(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
          />
          <span className="font-medium">Alle Einträge anzeigen</span>
        </label>
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

            const isCurrentMonthDay = isCurrentMonth(day, currentMonth);
            const isTodayDay = isToday(day);
            const isWeekendDay = isWeekend(day);
            const isHolidayDay = !!holiday;

            // Check if this day is expanded (either individually or globally)
            const isExpanded = showAllEntries || expandedDays.has(dateStr);
            const filteredAbsences = dayAbsences.filter(a => a.status !== 'rejected');
            const totalItems = filteredAbsences.length + dayEntries.length;

            // Calculate how many items are actually visible when collapsed
            const visibleAbsences = Math.min(filteredAbsences.length, 2);
            const remainingSlots = 3 - visibleAbsences; // How many slots left for time entries
            const visibleEntries = Math.min(dayEntries.length, Math.max(0, remainingSlots));
            const visibleItems = visibleAbsences + visibleEntries;

            const hasMore = totalItems > visibleItems;

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

                  {/* Absences - with User Info, only approved/pending */}
                  {filteredAbsences
                    .slice(0, isExpanded ? undefined : visibleAbsences)
                    .map((absence, idx) => {
                    const isApproved = absence.status === 'approved';

                    // Type-based colors (professional standard like Google Calendar)
                    const colors = getEventColor(absence.type as any);
                    const borderStyle = isApproved ? 'border-2' : 'border-2 border-dashed';

                    const initials = getInitials(absence.firstName, absence.lastName, absence.userInitials);
                    const fullName = getFullName(absence.firstName, absence.lastName);
                    const statusLabel = getAbsenceStatusLabel(absence.status as any);
                    const typeLabel = getAbsenceTypeLabel(absence.type as any);

                    // Get emoji based on type
                    const typeEmoji =
                      absence.type === 'vacation' ? '🏖️' :
                      absence.type === 'sick' ? '🤒' :
                      absence.type === 'overtime_comp' ? '⏰' :
                      absence.type === 'unpaid' ? '📅' : '📋';

                    return (
                      <div
                        key={idx}
                        className={`
                          px-2 py-1 rounded-md text-xs font-medium truncate flex items-center gap-1
                          ${colors.bg} ${colors.text} ${colors.border} ${borderStyle}
                        `}
                        title={`${fullName}: ${typeLabel} (${statusLabel})`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                          {initials}
                        </span>
                        {typeEmoji} {typeLabel}
                      </div>
                    );
                  })}

                  {/* Time Entries - Individual entries with User Info */}
                  {dayEntries.slice(0, isExpanded ? undefined : visibleEntries).map((entry, idx) => {
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
                        title={`${fullName}: ${formatHours(entry.hours)} (${entry.startTime} - ${entry.endTime})`}
                      >
                        <span className={`w-4 h-4 rounded-full ${userColor.badge} text-white text-[10px] flex items-center justify-center font-bold`}>
                          {initials}
                        </span>
                        <span>{formatHours(entry.hours)}</span>
                      </div>
                    );
                  })}

                  {/* More indicator - Clickable Toggle (nur wenn nicht global expanded) */}
                  {hasMore && !showAllEntries && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger onDayClick
                        setExpandedDays(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(dateStr)) {
                            newSet.delete(dateStr);
                          } else {
                            newSet.add(dateStr);
                          }
                          return newSet;
                        });
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer font-medium"
                    >
                      {isExpanded ? '− weniger' : `+${totalItems - visibleItems} mehr`}
                    </button>
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
