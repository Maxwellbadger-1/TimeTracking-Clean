import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useWorkTimeAccountHistory } from '../../hooks/useWorkTimeAccounts';
import { TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';

interface WorkTimeAccountHistoryProps {
  userId?: number;
  months?: number;
}

export function WorkTimeAccountHistory({ userId, months = 12 }: WorkTimeAccountHistoryProps) {
  const { data: history, isLoading, error } = useWorkTimeAccountHistory(userId, months);

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

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Monatliche Entwicklung
        </h3>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Monat
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Überstunden
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Änderung
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((entry, index) => (
              <tr
                key={entry.month}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  index === 0 ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    {getMonthLabel(entry.month)}
                    {index === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full">
                        Aktuell
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span
                    className={`font-medium ${
                      entry.overtime > 0
                        ? 'text-green-600 dark:text-green-400'
                        : entry.overtime < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {entry.overtime > 0 ? '+' : ''}
                    {formatHours(entry.overtime)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1">
                    {entry.delta > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : entry.delta < 0 ? (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : null}
                    <span
                      className={`font-medium ${
                        entry.delta > 0
                          ? 'text-green-600 dark:text-green-400'
                          : entry.delta < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {entry.delta > 0 ? '+' : ''}
                      {formatHours(entry.delta)}
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Gesamt Überstunden
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatHours(history.reduce((sum, e) => sum + e.overtime, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Durchschnitt/Monat
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatHours(history.reduce((sum, e) => sum + e.overtime, 0) / history.length)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Aktueller Saldo
            </p>
            <p
              className={`text-lg font-bold ${
                history[0].balance > 0
                  ? 'text-green-600 dark:text-green-400'
                  : history[0].balance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {history[0].balance > 0 ? '+' : ''}
              {formatHours(history[0].balance)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
