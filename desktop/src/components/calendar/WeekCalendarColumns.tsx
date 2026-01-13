/**
 * Week Calendar - Columns per User (Google Calendar / Teamwork Style)
 *
 * Professional Multi-User Timeline
 * Features:
 * - COLUMNS per user (side-by-side)
 * - Sticky header (days always visible)
 * - Shared timeline (hours 6:00-22:00)
 * - Horizontal scroll for many users
 * - User filter
 */

import { useState, useMemo } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  parseISO,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { DateNavigation } from './DateNavigation';
import { CalendarLegend } from './CalendarLegend';
import { UserFilter } from './UserFilter';
import { getUserColor, getInitials } from '../../utils/userColors';
import { getAbsenceTypeLabel, getEventColor } from '../../utils/calendarUtils';
import { formatHours } from '../../utils/timeUtils';
import { useUsers } from '../../hooks/useUsers';
import type { TimeEntry, AbsenceRequest } from '../../types';

interface WeekCalendarColumnsProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  currentUserId: number;
  currentUser: { id: number; firstName: string; lastName: string };
  isAdmin: boolean;
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 to 22:00
const HOUR_HEIGHT = 60; // pixels per hour

export function WeekCalendarColumns({
  timeEntries = [],
  absences = [],
  currentUserId,
  currentUser,
  isAdmin,
  onDayClick,
  viewMode = 'week',
  onViewModeChange,
}: WeekCalendarColumnsProps) {
  console.log('🚀🚀🚀 WEEK CALENDAR COLUMNS COMPONENT RENDERED 🚀🚀🚀');
  console.log('📊 Total absences received:', absences?.length || 0);
  console.log('📊 Absences data:', absences);
  console.log('🚀🚀🚀 END WEEK CALENDAR COLUMNS INIT DEBUG 🚀🚀🚀');

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Admin: Load all users for selection
  // Employee: Query disabled (prevents 403)
  const { data: users } = useUsers(isAdmin);
  const usersList = users || [];

  // Get week days (Monday - Sunday)
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter users
  const displayUsers = useMemo(() => {
    // Employee: Nutze currentUser aus authStore
    if (!isAdmin) {
      const employeeUser = [{
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        email: '',
        role: 'employee' as const,
        deletedAt: null,
        createdAt: '',
        updatedAt: ''
      }];

      return employeeUser;
    }

    // Admin: normale User-Liste von API
    const activeUsers = usersList.filter(u => !u.deletedAt);
    if (selectedUserId) {
      return activeUsers.filter(u => u.id === selectedUserId);
    }
    return activeUsers;
  }, [usersList, selectedUserId, isAdmin, currentUserId, timeEntries]);

  // Calculate column width based on number of users
  const columnWidthPerUser = 180; // pixels per user
  const dayColumnWidth = Math.max(columnWidthPerUser * displayUsers.length, 200); // minimum 200px

  // Group time entries by user and day
  const entriesByUserAndDay = useMemo(() => {
    const grouped: Record<number, Record<string, TimeEntry[]>> = {};

    timeEntries.forEach((entry) => {
      if (!grouped[entry.userId]) {
        grouped[entry.userId] = {};
      }

      const dateKey = entry.date;
      if (!grouped[entry.userId][dateKey]) {
        grouped[entry.userId][dateKey] = [];
      }

      grouped[entry.userId][dateKey].push(entry);
    });

    return grouped;
  }, [timeEntries]);

  // PRIVACY FILTERING (DSGVO-compliant)
  // Employee: Show ONLY own absences in Month/Week/Year calendars
  // Admin: Show all absences
  const filteredAbsences = isAdmin
    ? absences
    : absences.filter(a => a.userId === currentUserId);

  // Group absences by user and day (using filtered absences!)
  const absencesByUserAndDay = useMemo(() => {
    const grouped: Record<number, Record<string, AbsenceRequest[]>> = {};

    filteredAbsences.forEach((absence) => {
      if (!grouped[absence.userId]) {
        grouped[absence.userId] = {};
      }

      const start = parseISO(absence.startDate);
      const end = parseISO(absence.endDate);

      weekDays.forEach((day) => {
        if (day >= start && day <= end) {
          const dateKey = format(day, 'yyyy-MM-dd');
          if (!grouped[absence.userId][dateKey]) {
            grouped[absence.userId][dateKey] = [];
          }
          grouped[absence.userId][dateKey].push(absence);
        }
      });
    });

    return grouped;
  }, [filteredAbsences, weekDays]);

  // Current time indicator position
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimePosition = ((currentHour - 6) * HOUR_HEIGHT) + (currentMinute / 60 * HOUR_HEIGHT);

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
    <div className="flex flex-col" style={{ height: 'calc(100vh - 100px)' }}>
      <DateNavigation
        currentDate={currentWeek}
        onDateChange={setCurrentWeek}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange || (() => {})}
      />

      {/* User Filter - nur für Admins */}
      {isAdmin && (
        <div className="mb-4">
          <UserFilter
            users={usersList}
            selectedUserId={selectedUserId}
            onUserChange={setSelectedUserId}
          />
        </div>
      )}

      {/* Legend */}
      <div className="mb-6">
        <CalendarLegend />
      </div>

      {/* Calendar Container - SINGLE SCROLL CONTAINER */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-auto">
        <div className="inline-block min-w-full">
          {/* Sticky Header: Days + Users */}
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {/* Week Days Row */}
            <div className="flex">
                {/* Time Column Header - STICKY */}
                <div className="sticky left-0 z-30 w-16 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 p-2 text-xs font-medium text-gray-600 dark:text-gray-400 text-center">
                  Zeit
                </div>

                {/* Day + User Grid */}
                <div className="flex">
                  {weekDays.map((day) => {
                    const dayIsToday = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                          dayIsToday ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50 dark:bg-gray-900/50'
                        }`}
                        style={{ width: `${dayColumnWidth}px` }}
                      >
                      {/* Day Header */}
                      <div className="p-3 text-center border-b border-gray-200 dark:border-gray-700">
                        <div
                          className={`text-xs font-medium uppercase ${
                            dayIsToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {format(day, 'EEE', { locale: de })}
                        </div>
                        <div
                          className={`text-2xl font-bold mt-1 ${
                            dayIsToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {format(day, 'd')}
                        </div>
                      </div>

                        {/* User Columns for this Day */}
                        <div className="flex">
                          {displayUsers.map((user) => {
                            const userColor = getUserColor(user.id);
                            const initials = getInitials(user.firstName, user.lastName);
                            return (
                              <div
                                key={user.id}
                                className="border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 p-2"
                                style={{ width: `${columnWidthPerUser}px` }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full ${userColor.badge} text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0`}>
                                    {initials}
                                  </span>
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                    {user.firstName}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex">
              {/* Time Column (STICKY LEFT) */}
              <div className="sticky left-0 z-20 w-16 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Day + User Grid */}
              <div className="flex">
                {weekDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayIsToday = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className="border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                      style={{ width: `${dayColumnWidth}px` }}
                    >
                    <div className="flex h-full">
                      {displayUsers.map((user) => {
                        const userColor = getUserColor(user.id);
                        const userEntries = entriesByUserAndDay[user.id] || {};
                        const dayEntries = userEntries[dateKey] || [];
                        const userAbsences = absencesByUserAndDay[user.id] || {};
                        const dayAbsences = userAbsences[dateKey] || [];

                        return (
                          <div
                            key={user.id}
                            className="border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 relative"
                            style={{ width: `${columnWidthPerUser}px` }}
                          >
                            {/* Hour Grid Lines */}
                            {HOURS.map((hour) => (
                              <div
                                key={hour}
                                className={`h-[60px] border-b border-gray-100 dark:border-gray-700/50 ${
                                  dayIsToday ? 'bg-blue-50/30 dark:bg-blue-900/5' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                } transition-colors cursor-pointer`}
                                onClick={() => onDayClick?.(day)}
                              />
                            ))}

                            {/* Current Time Indicator */}
                            {dayIsToday && currentHour >= 6 && currentHour <= 22 && (
                              <div
                                className="absolute left-0 right-0 h-0.5 bg-red-500 dark:bg-red-400 z-10"
                                style={{ top: `${currentTimePosition}px` }}
                              >
                                <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full" />
                              </div>
                            )}

                            {/* Absence Banner - nur approved/pending, nicht rejected */}
                            {dayAbsences.filter(a => a.status !== 'rejected').map((absence, idx) => {
                              const isApproved = absence.status === 'approved';

                              // Type-based colors (professional standard like Google Calendar)
                              const colors = getEventColor(absence.type as any);
                              const borderStyle = isApproved ? 'border-2' : 'border-2 border-dashed';
                              const typeLabel = getAbsenceTypeLabel(absence.type as any);

                              // Get emoji based on type
                              const typeEmoji =
                                absence.type === 'vacation' ? '🏖️' :
                                absence.type === 'sick' ? '🤒' :
                                absence.type === 'overtime_comp' ? '⏰' :
                                absence.type === 'unpaid' ? '📅' : '📋';

                              return (
                                <div key={idx} className={`absolute top-${1 + idx * 8} left-1 right-1 z-5 p-1 ${colors.bg} ${colors.text} ${colors.border} ${borderStyle} rounded text-[10px] font-medium text-center`}>
                                  {typeEmoji} {typeLabel}
                                </div>
                              );
                            })}

                            {/* Time Entry Blocks */}
                            {dayEntries.map((entry) => {
                              const style = getEntryStyle(entry);
                              if (!style) return null;

                              return (
                                <div
                                  key={entry.id}
                                  className={`absolute left-2 right-2 ${userColor.bg} ${userColor.border} ${userColor.text} border-l-2 rounded px-2 py-1 text-[10px] font-medium shadow-sm hover:shadow-md transition-all cursor-pointer z-10 overflow-hidden`}
                                  style={{
                                    top: `${style.top}px`,
                                    height: `${Math.max(style.height, 30)}px`,
                                  }}
                                  title={`${entry.startTime} - ${entry.endTime}\n${formatHours(entry.hours)}${entry.breakMinutes ? ` (${entry.breakMinutes}min Pause)` : ''}${entry.description ? `\n${entry.description}` : ''}`}
                                >
                                  <div className="font-semibold truncate">
                                    {entry.startTime}-{entry.endTime}
                                  </div>
                                  <div className="opacity-80 truncate">
                                    {formatHours(entry.hours)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          {/* Empty State */}
          {displayUsers.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Keine aktiven Mitarbeiter gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
