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
import { getAbsenceTypeLabel } from '../../utils/calendarUtils';
import { formatHours } from '../../utils/timeUtils';
import { useUsers } from '../../hooks/useUsers';
import { useUIStore } from '../../store/uiStore';
import type { TimeEntry, AbsenceRequest } from '../../types';

interface YearCalendarProps {
  timeEntries?: TimeEntry[];
  absences?: AbsenceRequest[];
  holidays?: Array<{ date: string; name: string }>;
  currentUserId: number;
  currentUser: { id: number; firstName: string; lastName: string };
  isAdmin: boolean;
  onDayClick?: (date: Date) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
  currentDate?: Date; // NEW: Controlled date from parent
  onDateChange?: (date: Date) => void; // NEW: Notify parent of date changes
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

// Color intensity levels (based on hours worked + absence type & status)
// Priority: Absence > Work hours
const getIntensityColor = (hours: number, absences: AbsenceRequest[], _isHoliday: boolean) => {
  // Priority 1: Check if there are any approved or pending absences
  const approvedAbsence = absences.find(a => a.status === 'approved');
  const pendingAbsence = absences.find(a => a.status === 'pending');

  // Priority: Approved > Pending
  const primaryAbsence = approvedAbsence || pendingAbsence;

  if (primaryAbsence) {
    const isApproved = primaryAbsence.status === 'approved';
    const borderStyle = isApproved ? 'border-2' : 'border-2 border-dashed';

    // Urlaub (vacation) - Green
    if (primaryAbsence.type === 'vacation') {
      return `bg-green-200 dark:bg-green-900/40 ${borderStyle} border-green-${isApproved ? '500' : '400'} dark:border-green-${isApproved ? '500' : '600'}`;
    }

    // Krankmeldung (sick) - Red
    if (primaryAbsence.type === 'sick') {
      return `bg-red-200 dark:bg-red-900/40 ${borderStyle} border-red-${isApproved ? '500' : '400'} dark:border-red-${isApproved ? '500' : '600'}`;
    }

    // Überstundenausgleich (overtime_comp) - Purple
    if (primaryAbsence.type === 'overtime_comp') {
      return `bg-purple-200 dark:bg-purple-900/40 ${borderStyle} border-purple-${isApproved ? '500' : '400'} dark:border-purple-${isApproved ? '500' : '600'}`;
    }

    // Unbezahlter Urlaub (unpaid) - Orange
    if (primaryAbsence.type === 'unpaid') {
      return `bg-orange-200 dark:bg-orange-900/40 ${borderStyle} border-orange-${isApproved ? '500' : '400'} dark:border-orange-${isApproved ? '500' : '600'}`;
    }
  }

  // Normale Arbeitstage: Blau (Intensität nach Stunden)
  if (hours === 0) {
    return 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
  }
  if (hours < 4) {
    return 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800';
  }
  if (hours < 6) {
    return 'bg-blue-300 dark:bg-blue-900/50 border border-blue-400 dark:border-blue-700';
  }
  if (hours < 8) {
    return 'bg-blue-500 dark:bg-blue-900/70 border border-blue-600 dark:border-blue-600';
  }
  // 8+ hours
  return 'bg-blue-600 dark:bg-blue-800 border border-blue-700 dark:border-blue-500';
};

export function YearCalendar({
  timeEntries = [],
  absences = [],
  holidays = [],
  currentUserId,
  currentUser,
  isAdmin,
  onDayClick,
  viewMode: _viewMode = 'year',
  onViewModeChange: _onViewModeChange,
  currentDate, // NEW: Optional controlled date
  onDateChange: _onDateChange, // NEW: Optional callback (unused - handlers commented out)
}: YearCalendarProps) {
  // Use controlled date if provided, otherwise fallback to internal state
  const [internalYear] = useState(new Date()); // setInternalYear unused - handlers commented out
  const effectiveYear = currentDate || internalYear;

  const { calendarFilters } = useUIStore();

  // Admin: Load all users for selection
  // Employee: Query disabled (prevents 403)
  const { data: users } = useUsers(isAdmin);
  const usersList = users || [];

  // Get year boundaries
  const yearStart = startOfYear(effectiveYear);
  const yearEnd = endOfYear(effectiveYear);

  // Determine which users to display
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

    // Admin: Use centralized calendar filter from uiStore
    const activeUsers = usersList.filter(u => !u.deletedAt);

    // Apply user filter if any users are selected
    const hasUserFilter = calendarFilters.selectedUserIds.length > 0;
    if (hasUserFilter) {
      return activeUsers.filter(u => calendarFilters.selectedUserIds.includes(u.id));
    }

    return activeUsers;
  }, [usersList, calendarFilters.selectedUserIds, isAdmin, currentUser]);

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

  // Helper function to calculate data for a specific user
  const calculateUserData = (userId: number) => {
    const userEntries = timeEntries.filter(e => e.userId === userId);
    const userAbsences = filteredAbsences.filter(a => a.userId === userId);

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

    // Generate 53 weeks (to cover full year including last days of December)
    for (let i = 0; i < 53; i++) {
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

  // Unused handlers - commented out
  /*
  const handlePrevious = () => {
    const newDate = new Date(effectiveYear.getFullYear() - 1, 0, 1);
    if (onDateChange) {
      onDateChange(newDate); // Notify parent (controlled)
    } else {
      setInternalYear(newDate); // Update internal state (uncontrolled)
    }
  };

  const handleNext = () => {
    const newDate = new Date(effectiveYear.getFullYear() + 1, 0, 1);
    if (onDateChange) {
      onDateChange(newDate); // Notify parent (controlled)
    } else {
      setInternalYear(newDate); // Update internal state (uncontrolled)
    }
  };

  const handleToday = () => {
    const newDate = new Date();
    if (onDateChange) {
      onDateChange(newDate); // Notify parent (controlled)
    } else {
      setInternalYear(newDate); // Update internal state (uncontrolled)
    }
  };
  */

  // Calculate weeks per month for grid layout alignment
  const weeksPerMonth = useMemo(() => {
    const monthWeeks = new Array(12).fill(0);

    weeks.forEach(week => {
      const firstDay = week[0];
      if (firstDay) {
        const monthIndex = firstDay.getMonth();
        monthWeeks[monthIndex]++;
      }
    });

    return monthWeeks;
  }, [weeks]);

  // Render a single user's heatmap
  const renderUserHeatmap = (user: { id: number; firstName: string; lastName: string }) => {
    const { hoursByDay, entriesByDay, absencesByDay } = calculateUserData(user.id);
    const totalHours = Array.from(hoursByDay.values()).reduce((sum, h) => sum + h, 0);
    const totalDays = hoursByDay.size;
    const avgHoursPerDay = totalDays > 0 ? formatHours(totalHours / totalDays) : '0h';

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
              {formatHours(totalHours)}
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
          {/* Unified Grid: Month Labels + Day Labels + Heatmap */}
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `48px ${weeksPerMonth.map(count => `repeat(${count}, minmax(12px, 1fr))`).join(' ')}`,
              gridTemplateRows: 'auto repeat(7, minmax(12px, 1fr))',
              maxWidth: 'calc(48px + 53 * 20px + 53 * 4px)'
            }}
          >
            {/* Row 1: Empty cell + Month Labels */}
            <div />
            {MONTHS.map((month, idx) => (
              <div
                key={month}
                className="text-xs text-gray-600 dark:text-gray-400 font-medium text-center mb-2"
                style={{ gridColumn: `span ${weeksPerMonth[idx]}` }}
              >
                {month}
              </div>
            ))}

            {/* Rows 2-8: Day Labels + Week Boxes */}
            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
              const dayLabel = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][dayIdx];
              return (
                <>
                  {/* Day Label */}
                  <div
                    key={`label-${dayIdx}`}
                    className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-end pr-1"
                  >
                    {dayIdx % 2 === 0 ? dayLabel : ''}
                  </div>

                  {/* Week Boxes for this day */}
                  {weeks.map((week, weekIdx) => {
                    const day = week.find((d) => getDay(d) === (dayIdx + 1) % 7);

                    if (!day) {
                      return (
                        <div
                          key={dayIdx}
                          className="rounded-sm"
                          style={{ aspectRatio: '1 / 1', minWidth: '12px', minHeight: '12px' }}
                        />
                      );
                    }

                    const dateKey = format(day, 'yyyy-MM-dd');
                    const hours = hoursByDay.get(dateKey) || 0;
                    const dayEntries = entriesByDay.get(dateKey) || [];
                    const dayAbsences = absencesByDay.get(dateKey) || [];

                    // Check if day is a holiday
                    const holiday = holidays.find(h => h.date === dateKey);
                    const isHoliday = !!holiday;

                    // Filter: Nur genehmigte oder pending Absences anzeigen (rejected nicht)
                    const visibleAbsences = dayAbsences.filter(a => a.status !== 'rejected');
                    const hasAbsence = visibleAbsences.length > 0;

                    const colorClass = getIntensityColor(hours, visibleAbsences, isHoliday);
                    const dayIsToday = isToday(day);

                    // Build tooltip
                    let tooltipText = `${format(day, 'd. MMM yyyy', { locale: de })}`;

                    // Show holiday first (highest priority)
                    if (holiday) {
                      tooltipText += `\n\n🎉 Feiertag: ${holiday.name}`;
                    }

                    if (dayEntries.length > 0) {
                      tooltipText += `\n\n📊 ${formatHours(hours)} gearbeitet`;
                      dayEntries.forEach((entry) => {
                        tooltipText += `\n• ${formatHours(entry.hours)} (${entry.startTime}-${entry.endTime})`;
                      });
                    } else if (!holiday) {
                      tooltipText += `\n${formatHours(hours)} gearbeitet`;
                    }
                    if (hasAbsence) {
                      // Group absences by type
                      const absencesByType = visibleAbsences.reduce((acc, absence) => {
                        if (!acc[absence.type]) acc[absence.type] = [];
                        acc[absence.type].push(absence);
                        return acc;
                      }, {} as Record<string, typeof visibleAbsences>);

                      Object.entries(absencesByType).forEach(([type, absences]) => {
                        const typeEmoji =
                          type === 'vacation' ? '🏖️' :
                          type === 'sick' ? '🤒' :
                          type === 'overtime_comp' ? '⏰' :
                          type === 'unpaid' ? '📅' : '📋';
                        const typeLabel = getAbsenceTypeLabel(type as any);

                        tooltipText += `\n\n${typeEmoji} ${typeLabel}:`;
                        absences.forEach((absence) => {
                          const statusLabel = absence.status === 'approved' ? '✅ Genehmigt' : '⏳ Beantragt';
                          tooltipText += `\n• ${statusLabel}`;
                        });
                      });
                    }

                    return (
                      <div
                        key={`${weekIdx}-${dayIdx}`}
                        className={`rounded-sm border transition-all cursor-pointer hover:scale-150 hover:shadow-lg ${colorClass} ${
                          dayIsToday ? 'ring-2 ring-blue-500' : ''
                        }`}
                        style={{ aspectRatio: '1 / 1', minWidth: '12px', minHeight: '12px' }}
                        onClick={() => onDayClick?.(day)}
                        title={tooltipText}
                      />
                    );
                  })}
                </>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 space-y-2">
            {/* Zeiterfassung Intensität */}
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">Weniger</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
                <div className="w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800" />
                <div className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-900/50 border border-blue-400 dark:border-blue-700" />
                <div className="w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-900/70 border border-blue-600 dark:border-blue-600" />
                <div className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-800 border border-blue-700 dark:border-blue-500" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Mehr</span>
            </div>

            {/* Abwesenheiten */}
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">Abwesenheiten:</span>

                {/* Urlaub - Green */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40 border-2 border-green-500 dark:border-green-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">🏖️ Urlaub</span>
                </div>

                {/* Krankmeldung - Red */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/40 border-2 border-red-500 dark:border-red-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">🤒 Krankmeldung</span>
                </div>

                {/* Überstundenausgleich - Purple */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-purple-200 dark:bg-purple-900/40 border-2 border-purple-500 dark:border-purple-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">⏰ Überstunden-Ausgleich</span>
                </div>

                {/* Unbezahlter Urlaub - Orange */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-orange-200 dark:bg-orange-900/40 border-2 border-orange-500 dark:border-orange-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">📅 Unbezahlt</span>
                </div>
              </div>

              {/* Status Legend */}
              <div className="flex items-center justify-end gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 border-2 border-gray-500 dark:border-gray-500" />
                  <span>Genehmigt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 border-2 border-dashed border-gray-500 dark:border-gray-500" />
                  <span>Beantragt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>

      {/* Render all user heatmaps */}
      {displayUsers.map((user) => renderUserHeatmap(user))}
    </div>
  );
}
