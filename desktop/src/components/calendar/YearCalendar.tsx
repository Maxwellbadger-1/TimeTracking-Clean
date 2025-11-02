/**
 * Year Calendar Component (Heatmap View)
 *
 * Inspired by GitHub Contribution Graph
 * Features:
 * - GitHub-style heatmap (52 weeks x 7 days)
 * - Color intensity based on work hours
 * - Hover shows details
 * - Click navigates to day
 * - Legend for color scale
 */

import { useState, useMemo } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  startOfWeek,
  getDay,
  parseISO,
  addDays,
  isToday,
  eachDayOfInterval,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { DateNavigation } from './DateNavigation';
import { UserFilter } from './UserFilter';
import { useUsers } from '../../hooks/useUsers';
import type { TimeEntry, AbsenceRequest } from '../../types';

interface YearCalendarProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

// Color intensity levels (based on hours worked)
const getIntensityColor = (hours: number, hasAbsence: boolean) => {
  if (hasAbsence) {
    return 'bg-red-200 dark:bg-red-900/40 border-red-400 dark:border-red-600';
  }

  if (hours === 0) {
    return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  }
  if (hours < 4) {
    return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
  }
  if (hours < 6) {
    return 'bg-blue-300 dark:bg-blue-900/50 border-blue-400 dark:border-blue-700';
  }
  if (hours < 8) {
    return 'bg-blue-500 dark:bg-blue-900/70 border-blue-600 dark:border-blue-600';
  }
  // 8+ hours
  return 'bg-blue-600 dark:bg-blue-800 border-blue-700 dark:border-blue-500';
};

export function YearCalendar({
  timeEntries = [],
  absences = [],
  onDayClick,
  viewMode = 'year',
  onViewModeChange,
}: YearCalendarProps) {
  const [currentYear, setCurrentYear] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: users } = useUsers();
  const usersList = users || [];

  // Get year boundaries
  const yearStart = startOfYear(currentYear);
  const yearEnd = endOfYear(currentYear);

  // Determine which users to display
  const displayUsers = useMemo(() => {
    const activeUsers = usersList.filter(u => !u.deletedAt);
    if (selectedUserId) {
      return activeUsers.filter(u => u.id === selectedUserId);
    }
    return activeUsers;
  }, [usersList, selectedUserId]);

  // Helper function to calculate data for a specific user
  const calculateUserData = (userId: number) => {
    const userEntries = timeEntries.filter(e => e.userId === userId);
    const userAbsences = absences.filter(a => a.userId === userId);

    // Calculate hours per day
    const hoursByDay = new Map<string, number>();
    userEntries.forEach((entry) => {
      const dateKey = entry.date;
      hoursByDay.set(dateKey, (hoursByDay.get(dateKey) || 0) + (entry.hours || 0));
    });

    // Get entries by day
    const entriesByDay = new Map<string, TimeEntry[]>();
    userEntries.forEach((entry) => {
      const dateKey = entry.date;
      const existing = entriesByDay.get(dateKey) || [];
      entriesByDay.set(dateKey, [...existing, entry]);
    });

    // Calculate absences per day
    const absencesByDay = new Map<string, AbsenceRequest[]>();
    userAbsences.forEach((absence) => {
      const start = parseISO(absence.startDate);
      const end = parseISO(absence.endDate);
      const days = eachDayOfInterval({ start, end });
      days.forEach((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const existing = absencesByDay.get(dateKey) || [];
        absencesByDay.set(dateKey, [...existing, absence]);
      });
    });

    return { hoursByDay, entriesByDay, absencesByDay };
  };

  // Group days into weeks
  const weeks = useMemo(() => {
    const firstDayOfYear = yearStart;
    const weekStart = startOfWeek(firstDayOfYear, { weekStartsOn: 1 });

    const weeksArray: Date[][] = [];
    let currentWeekStart = weekStart;

    // Generate 52 weeks
    for (let i = 0; i < 52; i++) {
      const week: Date[] = [];
      for (let j = 0; j < 7; j++) {
        const day = addDays(currentWeekStart, j);
        // Only include if day is in current year
        if (day >= yearStart && day <= yearEnd) {
          week.push(day);
        }
      }
      if (week.length > 0) {
        weeksArray.push(week);
      }
      currentWeekStart = addDays(currentWeekStart, 7);
    }

    return weeksArray;
  }, [yearStart, yearEnd]);

  const handlePrevious = () => {
    setCurrentYear((prev) => new Date(prev.getFullYear() - 1, 0, 1));
  };

  const handleNext = () => {
    setCurrentYear((prev) => new Date(prev.getFullYear() + 1, 0, 1));
  };

  const handleToday = () => {
    setCurrentYear(new Date());
  };

  // Render a single user's heatmap
  const renderUserHeatmap = (user: { id: number; firstName: string; lastName: string }) => {
    const { hoursByDay, entriesByDay, absencesByDay } = calculateUserData(user.id);
    const totalHours = Array.from(hoursByDay.values()).reduce((sum, h) => sum + h, 0);
    const totalDays = hoursByDay.size;
    const avgHoursPerDay = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : '0';

    return (
      <div key={user.id} className="mb-8 last:mb-0">
        {/* User Header (nur bei Multi-User View) */}
        {displayUsers.length > 1 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {user.firstName} {user.lastName}
            </h3>
          </div>
        )}

        {/* Stats Summary */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400">Gesamt gearbeitet</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400">Arbeitstage</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {totalDays}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400">Ø Stunden/Tag</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {avgHoursPerDay}h
            </p>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 overflow-x-auto">
          {/* Month Labels */}
          <div className="flex mb-2 ml-12">
            {MONTHS.map((month, idx) => (
              <div
                key={month}
                className="text-xs text-gray-600 dark:text-gray-400 font-medium"
                style={{ width: `${100 / 12}%`, marginLeft: idx === 0 ? '0' : '0' }}
              >
                {month}
              </div>
            ))}
          </div>

          {/* Heatmap Grid */}
          <div className="flex">
            {/* Day Labels */}
            <div className="mr-2">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, idx) => (
                <div
                  key={day}
                  className="h-3 mb-1 text-xs text-gray-600 dark:text-gray-400 flex items-center justify-end pr-1"
                >
                  {idx % 2 === 0 ? day : ''}
                </div>
              ))}
            </div>

            {/* Weeks Grid */}
            <div className="flex gap-1">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                    const day = week.find((d) => getDay(d) === (dayIdx + 1) % 7);

                    if (!day) {
                      return <div key={dayIdx} className="w-3 h-3 rounded-sm" />;
                    }

                    const dateKey = format(day, 'yyyy-MM-dd');
                    const hours = hoursByDay.get(dateKey) || 0;
                    const dayEntries = entriesByDay.get(dateKey) || [];
                    const dayAbsences = absencesByDay.get(dateKey) || [];
                    const hasAbsence = dayAbsences.length > 0;
                    const colorClass = getIntensityColor(hours, hasAbsence);
                    const dayIsToday = isToday(day);

                    // Build tooltip
                    let tooltipText = `${format(day, 'd. MMM yyyy', { locale: de })}`;
                    if (dayEntries.length > 0) {
                      tooltipText += `\n\n📊 ${hours.toFixed(1)}h gearbeitet`;
                      dayEntries.forEach((entry) => {
                        tooltipText += `\n• ${entry.hours}h (${entry.startTime}-${entry.endTime})`;
                      });
                    } else {
                      tooltipText += `\n${hours.toFixed(1)}h gearbeitet`;
                    }
                    if (hasAbsence) {
                      tooltipText += `\n\n🏖️ Abwesenheiten:`;
                      dayAbsences.forEach((absence) => {
                        const typeLabel =
                          absence.type === 'vacation'
                            ? 'Urlaub'
                            : absence.type === 'sick'
                            ? 'Krank'
                            : absence.type === 'overtime_comp'
                            ? 'Ausgleich'
                            : 'Unbezahlt';
                        tooltipText += `\n• ${typeLabel}`;
                      });
                    }

                    return (
                      <div
                        key={dateKey}
                        className={`w-3 h-3 rounded-sm border transition-all cursor-pointer hover:scale-150 hover:shadow-lg ${colorClass} ${
                          dayIsToday ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => onDayClick?.(day)}
                        title={tooltipText}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Weniger</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
              <div className="w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800" />
              <div className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-900/50 border border-blue-400 dark:border-blue-700" />
              <div className="w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-900/70 border border-blue-600 dark:border-blue-600" />
              <div className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-800 border border-blue-700 dark:border-blue-500" />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Mehr</span>
            <div className="ml-4 flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/40 border border-red-400 dark:border-red-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Abwesend</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <DateNavigation
        currentDate={currentYear}
        onDateChange={setCurrentYear}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange || (() => {})}
      />

      {/* User Filter */}
      <div className="mb-4">
        <UserFilter
          users={usersList}
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
        />
      </div>

      {/* Render all user heatmaps */}
      {displayUsers.map((user) => renderUserHeatmap(user))}
    </div>
  );
}
