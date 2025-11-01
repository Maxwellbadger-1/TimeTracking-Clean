/**
 * Week Calendar - Team Timeline View
 *
 * Professional Multi-User Timeline like Toggl, Clockify, Teamwork
 * Features:
 * - ROWS PER USER (no overlapping!)
 * - Timeline view (hours 6:00-22:00)
 * - 7-day week view
 * - Color-coded per user
 * - User filter (all or individual)
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
import { UserFilter } from './UserFilter';
import { getUserColor, getInitials, getFullName } from '../../utils/userColors';
import { useUsers } from '../../hooks/useUsers';
import type { TimeEntry, AbsenceRequest, User } from '../../types';

interface WeekCalendarTeamProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 to 22:00
const HOUR_HEIGHT = 80; // pixels per hour (taller for better visibility)
const USER_ROW_HEIGHT = HOUR_HEIGHT * HOURS.length; // Total height per user row

export function WeekCalendarTeam({
  timeEntries = [],
  absences = [],
  onDayClick,
  viewMode = 'week',
  onViewModeChange,
}: WeekCalendarTeamProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: users } = useUsers();
  const usersList = users || [];

  // Get week days (Monday - Sunday)
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter users
  const displayUsers = useMemo(() => {
    const activeUsers = usersList.filter(u => !u.deletedAt);
    if (selectedUserId) {
      return activeUsers.filter(u => u.id === selectedUserId);
    }
    return activeUsers;
  }, [usersList, selectedUserId]);

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

  // Group absences by user and day
  const absencesByUserAndDay = useMemo(() => {
    const grouped: Record<number, Record<string, AbsenceRequest[]>> = {};

    absences.forEach((absence) => {
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
  }, [absences, weekDays]);

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
    <div>
      <CalendarHeader
        currentDate={currentWeek}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {/* User Filter */}
      <div className="mb-4">
        <UserFilter
          users={usersList}
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Header: Days of Week */}
        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 bg-white dark:bg-gray-800">
          {/* User Column Header */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-700 dark:text-gray-300">
            Mitarbeiter
          </div>

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

        {/* User Rows */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {displayUsers.map((user) => {
            const userColor = getUserColor(user.id);
            const initials = getInitials(user.firstName, user.lastName);
            const fullName = getFullName(user.firstName, user.lastName);
            const userEntries = entriesByUserAndDay[user.id] || {};
            const userAbsences = absencesByUserAndDay[user.id] || {};

            return (
              <div key={user.id} className="grid grid-cols-8">
                {/* User Info Column */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full ${userColor.badge} text-white text-sm flex items-center justify-center font-bold`}>
                    {initials}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {fullName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                    </div>
                  </div>
                </div>

                {/* Day Columns for this User */}
                {weekDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayEntries = userEntries[dateKey] || [];
                  const dayAbsences = userAbsences[dateKey] || [];
                  const dayIsToday = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className="relative border-l border-gray-200 dark:border-gray-700"
                      style={{ height: `${USER_ROW_HEIGHT}px` }}
                      onClick={() => onDayClick?.(day)}
                    >
                      {/* Hour Grid Lines */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className={`h-[${HOUR_HEIGHT}px] border-b border-gray-100 dark:border-gray-700/50 ${
                            dayIsToday
                              ? 'bg-blue-50/30 dark:bg-blue-900/10'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          } transition-colors cursor-pointer`}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        />
                      ))}

                      {/* Current Time Indicator */}
                      {dayIsToday && currentHour >= 6 && currentHour <= 22 && (
                        <div
                          className="absolute left-0 right-0 h-0.5 bg-red-500 dark:bg-red-400 z-10"
                          style={{ top: `${currentTimePosition}px` }}
                        >
                          <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 dark:bg-red-400 rounded-full border-2 border-white dark:border-gray-800" />
                        </div>
                      )}

                      {/* Absence Banner (if any) */}
                      {dayAbsences.length > 0 && (
                        <div className="absolute top-0 left-0 right-0 z-5 p-2 bg-yellow-100 dark:bg-yellow-900/30 border-b-2 border-yellow-400 dark:border-yellow-600">
                          <div className="text-xs font-medium text-yellow-800 dark:text-yellow-200 truncate">
                            {dayAbsences[0].type === 'vacation' && '🏖️ Urlaub'}
                            {dayAbsences[0].type === 'sick' && '🤒 Krank'}
                            {dayAbsences[0].type === 'unpaid' && '📅 Unbezahlt'}
                            {dayAbsences[0].type === 'overtime_comp' && '⏰ Ausgleich'}
                          </div>
                        </div>
                      )}

                      {/* Time Entry Blocks */}
                      {dayEntries.map((entry) => {
                        const style = getEntryStyle(entry);
                        if (!style) return null;

                        return (
                          <div
                            key={entry.id}
                            className={`absolute left-1 right-1 ${userColor.bg} ${userColor.border} ${userColor.text} border-l-4 rounded px-2 py-2 text-xs font-medium shadow-sm hover:shadow-md transition-all cursor-pointer z-10 overflow-hidden`}
                            style={{
                              top: `${style.top}px`,
                              height: `${Math.max(style.height, 40)}px`, // Minimum height for readability
                            }}
                            title={`${entry.startTime} - ${entry.endTime} (${entry.hours}h)${entry.breakMinutes ? `\nPause: ${entry.breakMinutes}min` : ''}${entry.description ? `\n${entry.description}` : ''}`}
                          >
                            <div className="font-semibold truncate">
                              {entry.startTime} - {entry.endTime}
                            </div>
                            <div className="opacity-80 truncate">
                              {entry.hours}h
                              {entry.breakMinutes ? ` (${entry.breakMinutes}min)` : ''}
                            </div>
                            {entry.description && style.height > 60 && (
                              <div className="text-[10px] opacity-70 truncate mt-1">
                                {entry.description}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {displayUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Keine aktiven Mitarbeiter gefunden.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          💡 <strong>Tipp:</strong> Klicken Sie auf einen Tag, um Details zu sehen. Jede Zeile zeigt einen Mitarbeiter.
        </div>
      </div>
    </div>
  );
}
