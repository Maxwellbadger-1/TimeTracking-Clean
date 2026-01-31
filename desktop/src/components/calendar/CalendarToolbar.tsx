/**
 * Unified Calendar Toolbar
 *
 * Compact header for all calendar views (Month, Week, Year, Team)
 * Features:
 * - Employee filter (admin only)
 * - Navigation (arrows + date picker)
 * - View mode tabs
 * - "Heute" button
 */

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { User } from '../../types';

interface CalendarToolbarProps {
  // Date Navigation
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;

  // View Mode
  viewMode: 'month' | 'week' | 'year' | 'team';
  onViewModeChange: (mode: 'month' | 'week' | 'year' | 'team') => void;

  // Employee Filter (Admin only)
  showEmployeeFilter?: boolean;
  employeeFilterComponent?: React.ReactNode;
}

export function CalendarToolbar({
  currentDate,
  onDateChange,
  onPrevious,
  onNext,
  onToday,
  viewMode,
  onViewModeChange,
  showEmployeeFilter = false,
  employeeFilterComponent,
}: CalendarToolbarProps) {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handleMonthChange = (month: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month);
    onDateChange(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    onDateChange(newDate);
  };

  // Generate year options (current year ± 5 years)
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // Format display text based on view mode
  const getDisplayText = () => {
    switch (viewMode) {
      case 'week':
        return `KW ${format(currentDate, 'w', { locale: de })} - ${format(currentDate, 'MMMM yyyy', { locale: de })}`;
      case 'year':
        return format(currentDate, 'yyyy', { locale: de });
      case 'team':
        return format(currentDate, 'MMMM yyyy', { locale: de });
      default:
        return format(currentDate, 'MMMM yyyy', { locale: de });
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      {/* Left: Employee Filter (Admin only) */}
      <div className="flex items-center gap-4">
        {showEmployeeFilter && employeeFilterComponent}
      </div>

      {/* Center: Navigation */}
      <div className="flex items-center gap-3">
        {/* Arrow Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Zurück"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onNext}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Vorwärts"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Current Date/Week Display */}
        <div className="px-4 py-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          {getDisplayText()}
        </div>

        {/* Combined Month/Year Picker (for month/week/team view) */}
        {(viewMode === 'month' || viewMode === 'week' || viewMode === 'team') && (
          <div className="flex items-center gap-2">
            <select
              value={currentMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={currentYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Year Picker (for year view) */}
        {viewMode === 'year' && (
          <select
            value={currentYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Right: Heute Button + View Mode Tabs */}
      <div className="flex items-center gap-3">
        {/* Heute Button */}
        <button
          onClick={onToday}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Heute
        </button>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'month'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Monat
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'week'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Woche
          </button>
          <button
            onClick={() => onViewModeChange('year')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'year'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Jahr
          </button>
          <button
            onClick={() => onViewModeChange('team')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'team'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Team
          </button>
        </div>
      </div>
    </div>
  );
}
