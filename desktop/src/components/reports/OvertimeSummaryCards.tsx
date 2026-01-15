/**
 * Overtime Summary Cards
 * Shows 3 clear metrics: Target, Actual, Overtime
 */

import { Clock, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';

interface OvertimeSummaryCardsProps {
  targetHours: number;
  actualHours: number;
  overtime: number;
  period: string; // e.g., "November 2025" or "2025"
}

export function OvertimeSummaryCards({
  targetHours,
  actualHours,
  overtime,
  period,
}: OvertimeSummaryCardsProps) {
  // Calculate percentage
  const percentage = targetHours > 0 ? Math.round((actualHours / targetHours) * 100) : 0;

  // Format hours helper
  const formatHours = (hours: number, withSign = false): string => {
    const sign = withSign && hours >= 0 ? '+' : '';
    const absHours = Math.abs(hours);
    const h = Math.floor(absHours);
    const m = Math.round((absHours - h) * 60);
    return `${sign}${h}:${String(m).padStart(2, '0')}h`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* SOLL - Target Hours */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Soll-Stunden
          </span>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {formatHours(targetHours)}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Stand: {period}
        </p>
      </div>

      {/* IST - Actual Hours */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Ist-Stunden
          </span>
          <CheckCircle className="w-5 h-5 text-blue-500" />
        </div>
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {formatHours(actualHours)}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {percentage}% vom Soll
        </p>
      </div>

      {/* ÜBERSTUNDEN - Overtime (Difference) */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Überstunden
          </span>
          {overtime >= 0 ? (
            <TrendingUp className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
        <div
          className={`text-2xl font-bold ${
            overtime >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {formatHours(overtime, true)}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Ist - Soll
        </p>
      </div>
    </div>
  );
}
