/**
 * MonthPicker - Professional Month Selection with Dropdown
 *
 * Features:
 * - Clean dropdown with month grid
 * - Previous/Next year navigation
 * - Click outside to close
 * - Keyboard navigation (Escape)
 * - Dark mode support
 *
 * Usage:
 * <MonthPicker value="2026-01" onChange={(month) => setMonth(month)} />
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface MonthPickerProps {
  value: string; // Format: "2026-01"
  onChange: (month: string) => void;
  label?: string;
  min?: string; // Format: "2020-01"
  max?: string; // Format: "2030-12"
  className?: string;
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export function MonthPicker({
  value,
  onChange,
  label = 'Monat',
  min,
  max,
  className = '',
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownYear, setDropdownYear] = useState(parseInt(value.split('-')[0]));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const [currentYear, currentMonth] = value.split('-').map(Number);
  const displayMonth = format(new Date(value + '-01'), 'MMMM yyyy', { locale: de });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Handle month selection
  const handleMonthSelect = (monthIndex: number) => {
    const month = String(monthIndex + 1).padStart(2, '0');
    const newValue = `${dropdownYear}-${month}`;

    // Check boundaries
    if (min && newValue < min) return;
    if (max && newValue > max) return;

    onChange(newValue);
    setIsOpen(false);
  };

  // Year navigation in dropdown
  const handlePrevYear = () => {
    setDropdownYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setDropdownYear(prev => prev + 1);
  };

  // Check if month is disabled
  const isMonthDisabled = (monthIndex: number): boolean => {
    const month = String(monthIndex + 1).padStart(2, '0');
    const testValue = `${dropdownYear}-${month}`;

    if (min && testValue < min) return true;
    if (max && testValue > max) return true;
    return false;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5
                 bg-white dark:bg-gray-700
                 border border-gray-300 dark:border-gray-600
                 rounded-lg shadow-sm
                 hover:bg-gray-50 dark:hover:bg-gray-600
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 transition-colors cursor-pointer"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
          {displayMonth}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800
                      border border-gray-200 dark:border-gray-700
                      rounded-lg shadow-lg overflow-hidden">

          {/* Year Navigation */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={handlePrevYear}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dropdownYear}
            </span>

            <button
              type="button"
              onClick={handleNextYear}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-1 p-2">
            {MONTHS.map((month, index) => {
              const isSelected = dropdownYear === currentYear && index === currentMonth - 1;
              const isDisabled = isMonthDisabled(index);

              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => !isDisabled && handleMonthSelect(index)}
                  disabled={isDisabled}
                  className={`
                    px-3 py-2 text-sm rounded-md transition-colors
                    ${isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : isDisabled
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {month.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
