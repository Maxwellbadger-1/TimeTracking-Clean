import { useState } from 'react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useOvertimeHistory } from '../../hooks/useOvertimeReports';
import { TrendingUp, TrendingDown, Calendar, AlertCircle, Sparkles, Flag, ChevronDown, ChevronUp, Table, BarChart3 } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';
import { DailyOvertimeDetails } from './DailyOvertimeDetails';
import { OvertimeChart } from './OvertimeChart';

interface WorkTimeAccountHistoryProps {
  userId: number;
  year?: number;      // Filter by specific year
  month?: number;     // Filter by specific month (1-12)
  months?: number;    // DEPRECATED: Fallback for compatibility
}

export function WorkTimeAccountHistory({ userId, year, month, months = 12 }: WorkTimeAccountHistoryProps) {
  // Calculate how many months to fetch based on filters
  const fetchMonths = month
    ? 1                                     // Single month
    : year
    ? 12                                    // Full year
    : months;                               // Fallback (default 12)

  // ✅ CORRECT: Uses overtime_balance (Single Source of Truth) which includes ALL days
  // Includes days without time_entries (missing work = negative overtime)
  // ✅ FIXED: Now passes year/month for specific month selection
  const { data: rawHistory, isLoading, error } = useOvertimeHistory(userId, fetchMonths, year, month);

  // Filter history by year/month if specified (maximal bis heute!)
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const history = rawHistory?.filter(entry => {
    // Nie zukünftige Monate zeigen
    if (entry.month > currentMonth) return false;

    if (year && !entry.month.startsWith(`${year}-`)) return false;
    if (month) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      return entry.month === monthKey;
    }
    return true;
  });

  // State for expanded month (Tag-für-Tag Ansicht)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // State for view mode (table vs chart)
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Monatliche Entwicklung
          </h3>
        </div>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Monatliche Entwicklung
          </h3>
        </div>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Fehler beim Laden: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Monatliche Entwicklung
          </h3>
        </div>
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Keine Daten verfügbar
        </p>
      </Card>
    );
  }

  const getMonthLabel = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'short' });
  };

  // Check if any month has carryover (to show/hide carryover column)
  const hasCarryover = history.some(entry => entry.carryover !== 0);

  // Detect year changes for year-end markers
  const getYearFromMonth = (month: string) => parseInt(month.split('-')[0]);

  // Helper to check if this is January (carryover month)
  const isJanuary = (month: string) => month.endsWith('-01');

  // Helper to check if current year (for context badges)
  const currentYear = new Date().getFullYear();
  const isCurrentYear = (month: string) => getYearFromMonth(month) === currentYear;

  return (
    <Card className="p-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Monatliche Entwicklung
          </h3>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Table className="w-4 h-4" />
            Tabelle
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Chart
          </button>
        </div>
      </div>

      {/* Chart View */}
      {viewMode === 'chart' && (
        <OvertimeChart
          data={history}
          userId={userId}
          year={year}
          month={month}
        />
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Monat
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100" title="Überstunden verdient (Soll/Ist-Differenz)">
                Verdient
              </th>
              {hasCarryover && (
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Übertrag
                </th>
              )}
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100" title="Gesamte Änderung dieses Monats">
                Änderung
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100" title="Monatliche Überstunden (Ist - Soll)">
                Überstunden
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((entry, index) => {
              // Check if this is the start of a new year (January with carryover)
              const isYearStart = isJanuary(entry.month) && entry.carryover !== 0;
              const showYearBadge = isCurrentYear(entry.month);
              const previousYear = index > 0 ? getYearFromMonth(history[index - 1].month) : null;
              const currentEntryYear = getYearFromMonth(entry.month);
              const isFirstEntryOfNewYear = previousYear !== null && previousYear !== currentEntryYear;

              return (
                <>
                  {/* Year-End Marker Row */}
                  {isFirstEntryOfNewYear && (
                    <tr key={`year-marker-${entry.month}`} className="bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-blue-900/20">
                      <td colSpan={hasCarryover ? 5 : 4} className="px-4 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <Flag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                            Jahreswechsel {previousYear}/{currentEntryYear}
                          </span>
                          {entry.carryover !== 0 && (
                            <span className="text-xs px-2 py-0.5 bg-blue-600 text-white dark:bg-blue-500 rounded-full">
                              Übertrag: {entry.carryover > 0 ? '+' : ''}{formatHours(entry.carryover)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Regular Month Row - CLICKABLE for Daily Details */}
                  <tr
                    key={entry.month}
                    onClick={() => setExpandedMonth(expandedMonth === entry.month ? null : entry.month)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                      index === history.length - 1 ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                    } ${showYearBadge ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''} ${
                      expandedMonth === entry.month ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        {expandedMonth === entry.month ? (
                          <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                        {getMonthLabel(entry.month)}
                        {index === history.length - 1 && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full">
                            Aktuell
                          </span>
                        )}
                        {showYearBadge && index !== history.length - 1 && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                            {currentEntryYear}
                          </span>
                        )}
                        {isYearStart && (
                          <span title="Jahresübertrag">
                            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </span>
                        )}
                      </div>
                    </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={`font-medium ${
                    entry.earned > 0
                      ? 'text-green-600 dark:text-green-400'
                      : entry.earned < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {entry.earned > 0 ? '+' : ''}
                    {formatHours(entry.earned)}
                  </span>
                </td>
                {hasCarryover && (
                  <td className="px-4 py-3 text-sm text-right">
                    {entry.carryover !== 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {entry.carryover > 0 ? '+' : ''}
                          {formatHours(entry.carryover)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">-</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1">
                    {entry.balanceChange > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : entry.balanceChange < 0 ? (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : null}
                    <span
                      className={`font-medium ${
                        entry.balanceChange > 0
                          ? 'text-green-600 dark:text-green-400'
                          : entry.balanceChange < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {entry.balanceChange > 0 ? '+' : ''}
                      {formatHours(entry.balanceChange)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
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

                  {/* Daily Details Row (Expandable) */}
                  {expandedMonth === entry.month && (
                    <tr key={`${entry.month}-details`}>
                      <td colSpan={hasCarryover ? 5 : 4} className="px-4 pb-4 bg-blue-50/30 dark:bg-blue-900/10">
                        <DailyOvertimeDetails userId={userId} month={entry.month} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Gesamt Verdient
            </p>
            <p className={`text-lg font-bold ${
              history.reduce((sum, e) => sum + e.earned, 0) > 0
                ? 'text-green-600 dark:text-green-400'
                : history.reduce((sum, e) => sum + e.earned, 0) < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {history.reduce((sum, e) => sum + e.earned, 0) > 0 ? '+' : ''}
              {formatHours(history.reduce((sum, e) => sum + e.earned, 0))}
            </p>
          </div>
          {hasCarryover && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Jahresübertrag
              </p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {history.reduce((sum, e) => sum + e.carryover, 0) > 0 ? '+' : ''}
                {formatHours(history.reduce((sum, e) => sum + e.carryover, 0))}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Aktueller Saldo
            </p>
            <p
              className={`text-lg font-bold ${
                history[history.length - 1].balance > 0
                  ? 'text-green-600 dark:text-green-400'
                  : history[history.length - 1].balance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {history[history.length - 1].balance > 0 ? '+' : ''}
              {formatHours(history[history.length - 1].balance)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
