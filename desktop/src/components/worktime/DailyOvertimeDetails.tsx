import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';

interface DailyOvertimeDetailsProps {
  userId: number;
  month: string; // "2026-01"
}

/**
 * Daily Overtime Details Component
 *
 * Shows day-by-day breakdown of overtime calculation for a specific month
 * Displays: Date | Soll | Ist | Differenz | Saldo
 *
 * Used inside WorkTimeAccountHistory when user clicks on a month row
 *
 * ✅ NOW USES: /api/overtime/balance/:userId/:month (Single Source of Truth!)
 * Consistent with all other components
 */
export function DailyOvertimeDetails({ userId, month }: DailyOvertimeDetailsProps) {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  // ✅ USE NEW BALANCE API (consistent with #1-7!)
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['overtime-report-daily', userId, year, monthNum],
    queryFn: async () => {
      const response = await apiClient.get(`/overtime/balance/${userId}/${month}`);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!userId && !!year && !!monthNum,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-red-600 dark:text-red-400 p-4">
        <AlertCircle className="w-5 h-5" />
        <p>Fehler beim Laden: {error.message}</p>
      </div>
    );
  }

  if (!report || !report.breakdown?.daily) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-4">
        Keine Tages-Daten verfügbar für {month}
      </p>
    );
  }

  const { daily } = report.breakdown;

  // Calculate cumulative balance for each day
  let runningBalance = 0;
  const dailyWithBalance = daily.map(entry => {
    runningBalance += entry.overtime;
    return {
      ...entry,
      balance: runningBalance,
    };
  });

  // Get day of week
  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('de-DE', { weekday: 'short' });
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Soll-Stunden</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatHours(report.summary.targetHours)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ist-Stunden</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatHours(report.summary.actualHours)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Differenz</p>
          <p
            className={`text-sm font-bold ${
              report.summary.overtime > 0
                ? 'text-green-600 dark:text-green-400'
                : report.summary.overtime < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {report.summary.overtime > 0 ? '+' : ''}
            {formatHours(report.summary.overtime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Arbeitstage</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {daily.filter(d => d.target > 0).length}
          </p>
        </div>
      </div>

      {/* Daily Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-100">
                Datum
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
                Soll
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
                Ist
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
                Differenz
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {dailyWithBalance.map((entry) => {
              const isWeekend = getDayOfWeek(entry.date) === 'Sa' || getDayOfWeek(entry.date) === 'So';
              const today = new Date().toISOString().split('T')[0];
              const isToday = entry.date === today;

              return (
                <tr
                  key={entry.date}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
                    isWeekend ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''
                  } ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {getDayOfWeek(entry.date)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {formatDate(entry.date)}
                      </span>
                      {isToday && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                          Heute
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-gray-600 dark:text-gray-400">
                      {entry.target > 0 ? formatHours(entry.target) : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {entry.actual > 0 ? formatHours(entry.actual) : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {entry.overtime > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      ) : entry.overtime < 0 ? (
                        <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      ) : null}
                      <span
                        className={`font-medium ${
                          entry.overtime > 0
                            ? 'text-green-600 dark:text-green-400'
                            : entry.overtime < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {entry.overtime !== 0 ? (
                          <>
                            {entry.overtime > 0 ? '+' : ''}
                            {formatHours(entry.overtime)}
                          </>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-bold ${
                        entry.balance > 0
                          ? 'text-green-600 dark:text-green-400'
                          : entry.balance < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {entry.balance > 0 ? '+' : ''}
                      {formatHours(entry.balance)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
