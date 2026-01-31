import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useOvertimeCorrections, useDeleteOvertimeCorrection } from '../../hooks/useOvertimeCorrections';
import { Trash2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';

interface CorrectionsTableProps {
  userId?: number;
  isAdmin: boolean;
  year?: number;
  month?: number;
}

export function CorrectionsTable({ userId, isAdmin, year, month }: CorrectionsTableProps) {
  const { data: corrections, isLoading, error } = useOvertimeCorrections(userId, year, month);
  const deleteCorrection = useDeleteOvertimeCorrection();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diese Korrektur wirklich löschen?')) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteCorrection.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete correction:', error);
      alert('Fehler beim Löschen der Korrektur');
    } finally {
      setDeletingId(null);
    }
  };

  const getCorrectionTypeLabel = (type: string) => {
    const labels = {
      manual: 'Manuelle Korrektur',
      system_error: 'Systemfehler',
      absence_credit: 'Abwesenheits-Gutschrift',
      migration: 'Daten-Migration',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getCorrectionTypeBadgeColor = (type: string) => {
    const colors = {
      manual: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      system_error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      absence_credit: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      migration: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  };

  if (isLoading) {
    return (
      <Card className="p-8 flex justify-center">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Fehler beim Laden der Korrekturen: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!corrections || corrections.length === 0) {
    return (
      <Card className="p-8">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Keine Korrekturen vorhanden
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Stunden
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Typ
              </th>
              {isAdmin && (
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Mitarbeiter
                </th>
              )}
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Begründung
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Erstellt von
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Erstellt am
              </th>
              {isAdmin && (
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Aktionen
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {corrections.map((correction) => (
              <tr
                key={correction.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(correction.date).toLocaleDateString('de-DE')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {correction.hours > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <span
                      className={`font-semibold ${
                        correction.hours > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {correction.hours > 0 ? '+' : ''}
                      {formatHours(correction.hours)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCorrectionTypeBadgeColor(
                      correction.correctionType
                    )}`}
                  >
                    {getCorrectionTypeLabel(correction.correctionType)}
                  </span>
                </td>
                {isAdmin && correction.user && (
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {correction.user.firstName} {correction.user.lastName}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                  <div className="truncate" title={correction.reason}>
                    {correction.reason}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {correction.creator?.firstName} {correction.creator?.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {new Date(correction.createdAt).toLocaleString('de-DE')}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-sm text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(correction.id)}
                      disabled={deletingId === correction.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                    >
                      {deletingId === correction.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
