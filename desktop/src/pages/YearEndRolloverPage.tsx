/**
 * Year-End Rollover Admin Page
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Preview rollover before executing
 * - Manual trigger for emergency rollover
 * - History of all past rollovers
 * - Clear warnings and confirmations
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Play, History, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface YearEndPreview {
  year: number;
  previousYear: number;
  users: Array<{
    userId: number;
    firstName: string;
    lastName: string;
    vacationCarryover: number;
    overtimeCarryover: number;
    warnings: string[];
  }>;
}

interface YearEndHistory {
  year: number;
  executedAt: string;
  executedBy: string;
  vacationUsersProcessed: number;
  overtimeUsersProcessed: number;
  success: boolean;
}

export default function YearEndRolloverPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmExecute, setConfirmExecute] = useState(false);

  // Fetch preview
  const { data: preview, isLoading: previewLoading } = useQuery<YearEndPreview>({
    queryKey: ['year-end-rollover-preview', selectedYear],
    queryFn: async () => {
      const response = await apiClient.get<YearEndPreview>(
        `/year-end-rollover/preview/${selectedYear}`
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch preview');
      }
      return response.data;
    },
    enabled: showPreview,
  });

  // Fetch history
  const { data: history, isLoading: historyLoading } = useQuery<YearEndHistory[]>({
    queryKey: ['year-end-rollover-history'],
    queryFn: async () => {
      const response = await apiClient.get<YearEndHistory[]>(
        '/year-end-rollover/history'
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch history');
      }
      return response.data || [];
    },
  });

  // Execute rollover mutation
  const executeRolloverMutation = useMutation({
    mutationFn: async (year: number) => {
      const response = await apiClient.post(`/year-end-rollover/execute/${year}`);
      if (!response.success) {
        throw new Error(response.error || 'Failed to execute rollover');
      }
      return response;
    },
    onSuccess: () => {
      toast.success('Jahreswechsel erfolgreich durchgeführt!');
      setConfirmExecute(false);
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ['year-end-rollover-history'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
      queryClient.invalidateQueries({ queryKey: ['overtime-balances'] });
    },
    onError: (error: Error) => {
      toast.error(`Jahreswechsel fehlgeschlagen: ${error.message}`);
    },
  });

  const handleExecute = () => {
    if (!confirmExecute) {
      setConfirmExecute(true);
      return;
    }
    executeRolloverMutation.mutate(selectedYear);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Jahreswechsel
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Überstunden und Urlaubstage in neues Jahr übertragen
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Automatischer Jahreswechsel
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Der Jahreswechsel läuft automatisch am 1. Januar um 00:05 Uhr.
              Diese Seite ist nur für manuelle Korrekturen oder Notfälle.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Vorschau
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Jahr
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setShowPreview(false);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={() => setShowPreview(true)}
              variant="secondary"
              className="w-full"
            >
              Vorschau anzeigen
            </Button>

            {showPreview && previewLoading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            )}

            {showPreview && preview && (
              <div className="space-y-4 mt-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Übertragung: {preview.previousYear} → {preview.year}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {preview.users.length} Mitarbeiter betroffen
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {preview.users.map((user) => (
                    <div
                      key={user.userId}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Urlaub: {user.vacationCarryover} Tage
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Überstunden: {user.overtimeCarryover.toFixed(1)}h
                      </div>
                      {user.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {user.warnings.map((warning, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {warning}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  {confirmExecute ? (
                    <div className="space-y-3">
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                          WARNUNG: Diese Aktion kann nicht rückgängig gemacht werden!
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleExecute}
                          variant="primary"
                          className="flex-1 bg-red-600 hover:bg-red-700"
                          disabled={executeRolloverMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {executeRolloverMutation.isPending
                            ? 'Wird ausgeführt...'
                            : 'Jetzt ausführen'}
                        </Button>
                        <Button
                          onClick={() => setConfirmExecute(false)}
                          variant="secondary"
                          disabled={executeRolloverMutation.isPending}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={handleExecute}
                      variant="primary"
                      className="w-full"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Jahreswechsel durchführen
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Verlauf
          </h2>

          {historyLoading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          )}

          {history && history.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Noch keine Jahreswechsel durchgeführt
            </div>
          )}

          {history && history.length > 0 && (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {history.map((entry, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      Jahr {entry.year}
                    </div>
                    {entry.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>
                      Durchgeführt: {new Date(entry.executedAt).toLocaleString('de-DE')}
                    </div>
                    <div>Von: {entry.executedBy}</div>
                    <div>Urlaub: {entry.vacationUsersProcessed} Mitarbeiter</div>
                    <div>Überstunden: {entry.overtimeUsersProcessed} Mitarbeiter</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
