/**
 * Modern Calendar Header Component
 *
 * Inspired by Google Calendar, Motion, Cal.com
 * Features: Date navigation, view switcher, "Today" button
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatMonthYear } from '../../utils/calendarUtils';

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  viewMode?: 'month' | 'week' | 'year' | 'team';
  onViewModeChange?: (mode: 'month' | 'week' | 'year' | 'team') => void;
  title?: string; // Override title (for custom views)
}

export function CalendarHeader({
  currentDate,
  onPrevious,
  onNext,
  onToday,
  viewMode = 'month',
  onViewModeChange,
  title,
}: CalendarHeaderProps) {
  const displayTitle = title || formatMonthYear(currentDate);

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Left: Title + Navigation */}
      <div className="flex items-center space-x-4">
        {/* Today Button - Modern pill shape */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onToday}
          className="rounded-full px-4 font-medium"
        >
          Heute
        </Button>

        {/* Navigation Arrows - Subtle, rounded */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onPrevious}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Vorheriger"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onNext}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Nächster"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Current Month/Week/Year - Large, bold */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {displayTitle}
        </h2>
      </div>

      {/* Right: View Switcher (if enabled) */}
      {onViewModeChange && (
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <ViewModeButton
            active={viewMode === 'month'}
            onClick={() => onViewModeChange('month')}
          >
            Monat
          </ViewModeButton>
          <ViewModeButton
            active={viewMode === 'week'}
            onClick={() => onViewModeChange('week')}
          >
            Woche
          </ViewModeButton>
          <ViewModeButton
            active={viewMode === 'year'}
            onClick={() => onViewModeChange('year')}
          >
            Jahr
          </ViewModeButton>
          <ViewModeButton
            active={viewMode === 'team'}
            onClick={() => onViewModeChange('team')}
          >
            Team
          </ViewModeButton>
        </div>
      )}
    </div>
  );
}

// View Mode Button Component (Segmented Control Style)
function ViewModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-md text-sm font-medium transition-all
        ${
          active
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
        }
      `}
    >
      {children}
    </button>
  );
}
