import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Receipt, TrendingUp, TrendingDown, AlertCircle, FileText, Info } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';
import { useOvertimeTransactions } from '../../hooks/useWorkTimeAccounts';

interface OvertimeTransactionsProps {
  userId?: number;
  year?: number;
  month?: number;  // Filter by specific month (1-12)
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
export function OvertimeTransactions({ userId, year, month, limit = 50 }: OvertimeTransactionsProps) {
  const { data, isLoading, error } = useOvertimeTransactions(userId, year, month, limit);

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
      case 'feiertag': return 'Feiertag';
      case 'compensation': return 'Ausgleich';
      case 'correction': return 'Korrektur';
      case 'carryover': return 'Übertrag';
      case 'vacation_credit': return 'Urlaub';
      case 'sick_credit': return 'Krankheit';
      case 'overtime_comp_credit': return 'Überstundenausgleich';
      case 'special_credit': return 'Sonderurlaub';
      case 'unpaid_adjustment': return 'Unbezahlter Urlaub';
      default: return type;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'earned':
        return 'Tägliche Soll/Ist-Differenz (inkl. Urlaub/Krankheit als Gutschrift)';
      case 'feiertag':
        return 'Gesetzlicher Feiertag (Soll: 0h, kein Arbeitstag)';
      case 'compensation':
        return 'Überstunden-Ausgleich genommen (freier Tag)';
      case 'correction':
        return 'Manuelle Korrektur durch Administrator';
      case 'carryover':
        return 'Jahreswechsel-Übertrag (Audit-Marker)';
      case 'vacation_credit':
        return 'Urlaub (gleicht Tagessoll aus, keine Überstunden)';
      case 'sick_credit':
        return 'Krankheit (gleicht Tagessoll aus, keine Überstunden)';
      case 'overtime_comp_credit':
        return 'Überstundenausgleich (gleicht Tagessoll aus, keine Überstunden)';
      case 'special_credit':
        return 'Sonderurlaub (gleicht Tagessoll aus, keine Überstunden)';
      case 'unpaid_adjustment':
        return 'Unbezahlter Urlaub (reduziert Tagessoll, keine Gutschrift)';
      default:
        return '';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'earned':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'feiertag':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'compensation':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'correction':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'carryover':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'vacation_credit':
      case 'sick_credit':
      case 'overtime_comp_credit':
      case 'special_credit':
      case 'unpaid_adjustment':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const isAbsenceType = (type: string) => {
    return ['feiertag', 'vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment'].includes(type);
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
            <div className="absolute left-0 top-6 w-80 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <p className="font-semibold mb-1">Was wird angezeigt?</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Tägliche Überstunden (Soll/Ist-Differenz)</li>
                <li>Überstunden-Ausgleich (genommene freie Tage)</li>
                <li>Admin-Korrekturen</li>
              </ul>
              <p className="mt-2 text-gray-300">
                <strong>Hinweis:</strong> Tage mit 0 Differenz (Soll = Ist) werden nicht angezeigt, da sie das Konto nicht ändern.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400" title="Kumulierter Saldo aller Transaktionen">Zeitkonto-Saldo:</span>
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
            {data.transactions.map((transaction: any, index: number) => (
              <tr
                key={`${transaction.date}-${transaction.type}-${index}`}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(transaction.date + 'T12:00:00').toLocaleDateString('de-DE')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="group relative inline-block">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-help ${getTypeBadgeColor(
                        transaction.type
                      )}`}
                    >
                      {getTypeLabel(transaction.type)}
                    </span>
                    {getTypeDescription(transaction.type) && (
                      <div className="absolute left-0 top-8 w-64 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        {getTypeDescription(transaction.type)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    {transaction.description || '-'}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isAbsenceType(transaction.type) ? (
                      // Absence types: neutral display (no icon, no hours shown)
                      <span className="text-gray-500 dark:text-gray-400 italic">
                        —
                      </span>
                    ) : (
                      // Regular types: show hours with +/- icons
                      <>
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {data.transactions.length} {data.transactions.length === 1 ? 'Transaktion' : 'Transaktionen'}
          {year && month && ` (${new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })})`}
          {year && !month && ` (${year})`}
          {limit && data.transactions.length >= limit && ` • Maximal ${limit} angezeigt`}
        </p>
      </div>
    </Card>
  );
}
