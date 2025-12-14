/**
 * Team Calendar Component
 *
 * Inspired by Clockify Team Timeline
 * Features:
 * - Overview of all team members
 * - Who is working/absent each day
 * - Month view with all employees in rows
 * - Filter by department
 * - Color-coded absences
 * - Privacy: Employees see only APPROVED absences (no pending/rejected)
 * - Privacy: Admins see ALL absences (for management)
 */

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  parseISO,
  addMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarHeader } from './CalendarHeader';
import { CalendarLegend } from './CalendarLegend';
import { getEventColor, getAbsenceTypeLabel, getAbsenceStatusLabel } from '../../utils/calendarUtils';
import { formatHours } from '../../utils/timeUtils';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { User, TimeEntry, AbsenceRequest } from '../../types';
import { useActiveEmployees, useTimeEntries, useAbsenceRequests } from '../../hooks';

interface TeamCalendarProps {
  onDayClick?: (date: Date, user: User) => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
  isAdmin?: boolean; // Controls data visibility (employees see only approved absences)
}

export function TeamCalendar({
  onDayClick,
  viewMode = 'team',
  onViewModeChange,
  isAdmin = false,
}: TeamCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Fetch data
  const { data: employees, isLoading: loadingEmployees } = useActiveEmployees();
  const { data: allTimeEntries, isLoading: loadingEntries } = useTimeEntries(); // All entries

  // For team calendar: Use different API based on role
  // Employees: GET /absences/team (only approved absences of all users)
  // Admins: GET /absences (all absences for management)
  const { data: allAbsences, isLoading: loadingAbsences } = useAbsenceRequests(
    isAdmin ? undefined : { forTeamCalendar: true } // Special flag to use /team endpoint
  );

  // For admin: Still filter to show all
  // For employees: Already filtered by backend (/absences/team returns only approved)
  const filteredAbsences = useMemo(() => {
    if (!allAbsences) return [];
    return allAbsences;
  }, [allAbsences]);

  // Get all days of current month including buffer for full weeks
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter employees by department
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (selectedDepartment === 'all') return employees;
    return employees.filter((emp: User) => emp.department === selectedDepartment);
  }, [employees, selectedDepartment]);

  // Get unique departments
  const departments = useMemo(() => {
    if (!employees) return [];
    const depts = new Set(employees.map((emp: User) => emp.department).filter(Boolean) as string[]);
    return Array.from(depts);
  }, [employees]);

  // Group time entries by user and date
  const entriesByUserAndDay = useMemo(() => {
    if (!allTimeEntries) return new Map();

    const map = new Map<number, Map<string, TimeEntry[]>>();
    allTimeEntries.forEach((entry: TimeEntry) => {
      if (!map.has(entry.userId)) {
        map.set(entry.userId, new Map());
      }
      const userMap = map.get(entry.userId)!;
      const dateKey = entry.date;
      const existing = userMap.get(dateKey) || [];
      userMap.set(dateKey, [...existing, entry]);
    });
    return map;
  }, [allTimeEntries]);

  // Group absences by user and date (using filtered absences!)
  const absencesByUserAndDay = useMemo(() => {
    if (!filteredAbsences) return new Map();

    const map = new Map<number, Map<string, AbsenceRequest>>();
    filteredAbsences.forEach((absence: AbsenceRequest) => {
      const start = parseISO(absence.startDate);
      const end = parseISO(absence.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((day) => {
        if (!map.has(absence.userId)) {
          map.set(absence.userId, new Map());
        }
        const userMap = map.get(absence.userId)!;
        const dateKey = format(day, 'yyyy-MM-dd');
        userMap.set(dateKey, absence);
      });
    });
    return map;
  }, [filteredAbsences]);

  const handlePrevious = () => {
    setCurrentMonth((prev) => addMonths(prev, -1));
  };

  const handleNext = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  if (loadingEmployees || loadingEntries || loadingAbsences) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!filteredEmployees || filteredEmployees.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Keine Mitarbeiter gefunden
        </p>
      </div>
    );
  }

  return (
    <div>
      <CalendarHeader
        currentDate={currentMonth}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {/* Department Filter */}
      {departments.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Abteilung:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedDepartment('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDepartment === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Alle
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept as string)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDepartment === dept
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      )}

      <CalendarLegend />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full">
          {/* Header: Day Numbers */}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900/50 p-4 text-left border-r border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Mitarbeiter
                </span>
              </th>
              {allDays.map((day) => {
                const dayIsToday = isToday(day);
                const isCurrentMonth = day >= monthStart && day <= monthEnd;

                return (
                  <th
                    key={day.toISOString()}
                    className={`p-2 text-center border-b border-gray-200 dark:border-gray-700 min-w-[40px] ${
                      dayIsToday
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'bg-gray-50 dark:bg-gray-900/50'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {format(day, 'EEE', { locale: de })[0]}
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        dayIsToday
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body: Employee Rows */}
          <tbody>
            {filteredEmployees.map((employee: User) => {
              const userEntries = entriesByUserAndDay.get(employee.id) || new Map();
              const userAbsences = absencesByUserAndDay.get(employee.id) || new Map();

              return (
                <tr key={employee.id} className="border-b border-gray-200 dark:border-gray-700">
                  {/* Employee Name */}
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-4 border-r border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {employee.department || 'Keine Abteilung'}
                      </p>
                    </div>
                  </td>

                  {/* Day Cells */}
                  {allDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const entries = userEntries.get(dateKey) || [];
                    const absence = userAbsences.get(dateKey);
                    const isCurrentMonth = day >= monthStart && day <= monthEnd;
                    const dayIsToday = isToday(day);

                    let cellContent = null;
                    let colorClass = '';

                    if (absence) {
                      const colors = getEventColor(absence.type as any);
                      const isApproved = absence.status === 'approved';
                      const borderStyle = isApproved ? 'border-l-2' : 'border-l-2 border-dashed';
                      colorClass = `${colors.bg} ${colors.border} ${borderStyle}`;
                      const typeLabel = getAbsenceTypeLabel(absence.type as any);
                      const statusLabel = getAbsenceStatusLabel(absence.status as any);
                      cellContent = (
                        <div className={`w-full h-full ${colorClass} flex items-center justify-center`} title={`${typeLabel} (${statusLabel})`}>
                          <span className="text-xs">
                            {absence.type === 'vacation' && '🏖️'}
                            {absence.type === 'sick' && '🤒'}
                            {absence.type === 'unpaid' && '📅'}
                            {absence.type === 'overtime_comp' && '⏰'}
                          </span>
                        </div>
                      );
                    } else if (entries.length > 0) {
                      const totalHours = entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
                      const colors = getEventColor('work');
                      colorClass = `${colors.bg} ${colors.text}`;
                      cellContent = (
                        <div className={`w-full h-full ${colorClass} flex items-center justify-center`}>
                          <span className="text-xs font-medium">
                            {formatHours(totalHours)}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <td
                        key={day.toISOString()}
                        className={`p-0 min-w-[40px] h-12 ${
                          dayIsToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                        } ${!isCurrentMonth ? 'opacity-40' : ''} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                        onClick={() => onDayClick?.(day, employee)}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
