import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Receipt, TrendingUp, TrendingDown, AlertCircle, FileText } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';
import { useOvertimeTransactions } from '../../hooks/useWorkTimeAccounts';

interface OvertimeTransactionsProps {
  userId?: number;
  year?: number;
  limit?: number;
}

/**
 * Overtime Transactions Component
 *
 * PROFESSIONAL TRANSACTION-BASED OVERTIME TRACKING
 * (Like SAP SuccessFactors, Personio, DATEV)
 *
 * Shows immutable audit trail of all overtime changes:
 * - 'earned': Daily overtime from time entries (Soll/Ist difference)
 * - 'compensation': Overtime deduction when taking time off
 * - 'correction': Manual adjustments by admin
 * - 'carryover': Year-end transfer markers
 */
export function OvertimeTransactions({ userId, year, limit = 50 }: OvertimeTransactionsProps) {
  const { data, isLoading, error } = useOvertimeTransactions(userId, year, limit);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
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
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
        </div>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Fehler beim Laden: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.transactions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
        </div>
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Keine Transaktionen verfügbar
        </p>
      </Card>
    );
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'earned': return 'Überstunden';
      case 'compensation': return 'Ausgleich';
      case 'correction': return 'Korrektur';
      case 'carryover': return 'Übertrag';
      default: return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'earned':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'compensation':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'correction':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'carryover':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Aktueller Saldo:</span>
          <span
            className={`font-bold ${
              data.currentBalance > 0
                ? 'text-green-600 dark:text-green-400'
                : data.currentBalance < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {data.currentBalance > 0 ? '+' : ''}
            {formatHours(data.currentBalance)}
          </span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Typ
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Beschreibung
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Stunden
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.transactions.map((transaction: any) => (
              <tr
                key={transaction.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(transaction.date).toLocaleDateString('de-DE')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(
                      transaction.type
                    )}`}
                  >
                    {getTypeLabel(transaction.type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    {transaction.description || '-'}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1">
                    {transaction.hours > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : transaction.hours < 0 ? (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : null}
                    <span
                      className={`font-bold ${
                        transaction.hours > 0
                          ? 'text-green-600 dark:text-green-400'
                          : transaction.hours < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {transaction.hours > 0 ? '+' : ''}
                      {formatHours(transaction.hours)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Banner */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Transaction-Based Tracking:</strong> Jede Änderung wird als unveränderliche Transaktion
          protokolliert. Dies entspricht den Standards von SAP SuccessFactors, Personio und DATEV.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {data.transactions.length} {data.transactions.length === 1 ? 'Transaktion' : 'Transaktionen'}
          {year && ` (${year})`}
          {limit && data.transactions.length >= limit && ` • Maximal ${limit} angezeigt`}
        </p>
      </div>
    </Card>
  );
}
