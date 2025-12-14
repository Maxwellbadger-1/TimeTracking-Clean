/**
 * Professional Date Navigation Component
 *
 * Inspired by: Google Calendar, Outlook, Toggl, Monday.com
 * Features:
 * - Quick Filters (Heute, Diese Woche, Dieser Monat, Dieses Jahr)
 * - Month/Year Dropdowns
 * - Navigation Arrows
 * - Date Picker (Click on Date to open)
 * - View Mode Tabs
 */

import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DateNavigationProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: 'month' | 'week' | 'year' | 'team';
  onViewModeChange: (mode: 'month' | 'week' | 'year' | 'team') => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateNavigation({
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  onPrevious,
  onNext,
  onToday,
}: DateNavigationProps) {
  // Month/Year Dropdowns
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
      default:
        return format(currentDate, 'MMMM yyyy', { locale: de });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Row: View Mode Tabs Only */}
      <div className="flex items-center justify-end gap-4 flex-wrap">
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
          {/* Team-Tab für alle (privacy-gefiltert in TeamCalendar) */}
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

      {/* Bottom Row: Navigation Controls */}
      <div className="flex items-center gap-4">
        {/* Arrow Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevious}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Zurück"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Vorwärts"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Month/Year Dropdowns (nur für Monat/Woche View) */}
        {(viewMode === 'month' || viewMode === 'week') && (
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

        {/* Year Dropdown (nur für Jahr View) */}
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

        {/* Current Date Display */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {getDisplayText()}
          </span>
        </div>

        {/* Heute Button (rechts) */}
        <button
          onClick={onToday}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors ml-auto"
        >
          Heute
        </button>
      </div>
    </div>
  );
}
