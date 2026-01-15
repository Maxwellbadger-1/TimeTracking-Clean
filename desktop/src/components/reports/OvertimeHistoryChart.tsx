/**
 * Overtime History Chart
 * Shows monthly overtime balance history with transaction breakdown
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { OvertimeHistoryEntry } from '../../hooks/useOvertimeReports';

interface OvertimeHistoryChartProps {
  history: OvertimeHistoryEntry[];
}

export function OvertimeHistoryChart({ history }: OvertimeHistoryChartProps) {
  // Format hours helper
  const formatHours = (hours: number, withSign = false): string => {
    const sign = withSign && hours >= 0 ? '+' : '';
    const absHours = Math.abs(hours);
    const h = Math.floor(absHours);
    const m = Math.round((absHours - h) * 60);
    return `${sign}${h}:${String(m).padStart(2, '0')}h`;
  };

  // Format month for display (2025-11 -> Nov 2025)
  const formatMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
  };

  // Calculate max absolute balance for chart scaling
  const maxAbsBalance = Math.max(
    ...history.map((entry) => Math.abs(entry.balance)),
    1 // Minimum 1 to avoid division by zero
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Überstunden-Verlauf
      </h3>

      <div className="space-y-3">
        {history.map((entry, index) => {
          const barWidth = (Math.abs(entry.balance) / maxAbsBalance) * 100;
          const isPositive = entry.balance >= 0;
          const changeIcon =
            entry.balanceChange > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : entry.balanceChange < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            );

          return (
            <div key={entry.month} className="group">
              {/* Month Header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatMonth(entry.month)}
                </span>
                <div className="flex items-center gap-2">
                  {changeIcon}
                  <span
                    className={`text-sm font-semibold ${
                      isPositive
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatHours(entry.balance, true)}
                  </span>
                </div>
              </div>

              {/* Balance Bar */}
              <div className="relative h-8 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                <div
                  className={`absolute top-0 ${isPositive ? 'right-1/2' : 'left-1/2'} h-full ${
                    isPositive
                      ? 'bg-green-500 dark:bg-green-600'
                      : 'bg-red-500 dark:bg-red-600'
                  } transition-all duration-300`}
                  style={{ width: `${barWidth / 2}%` }}
                />
                {/* Zero Line */}
                <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 dark:bg-gray-500" />
              </div>

              {/* Transaction Breakdown (shown on hover) */}
              <div className="hidden group-hover:block mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Verdient:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatHours(entry.earned, true)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Ausgleich:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatHours(entry.compensation, true)}
                  </span>
                </div>
                {entry.correction !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Korrektur:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(entry.correction, true)}
                    </span>
                  </div>
                )}
                {entry.carryover !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Übertrag:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(entry.carryover, true)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Änderung:</span>
                  <span
                    className={`font-semibold ${
                      entry.balanceChange >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatHours(entry.balanceChange, true)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {history.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          Keine Verlaufsdaten verfügbar
        </div>
      )}
    </div>
  );
}
