import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, RefreshCw, Trash2, Clock, Database } from 'lucide-react';
import { apiClient } from '../api/client';

interface Backup {
  filename: string;
  size: number;
  created: string;
}

interface BackupStats {
  totalBackups: number;
  oldestBackup: string | null;
  newestBackup: string | null;
  totalSize: number;
  scheduler: {
    running: boolean;
    schedule: string;
  };
}

export default function BackupPage() {
  const queryClient = useQueryClient();
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Fetch backups
  const { data: backups, isLoading } = useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await apiClient.get<Backup[]>('/backup');
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch backups');
      }
      return response.data || [];
    },
  });

  // Fetch backup stats
  const { data: stats } = useQuery<BackupStats>({
    queryKey: ['backup-stats'],
    queryFn: async () => {
      const response = await apiClient.get<BackupStats>('/backup/stats');
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch stats');
      }
      return response.data;
    },
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/backup');
      if (!response.success) {
        throw new Error(response.error || 'Failed to create backup');
      }
      return response;
    },
    onSuccess: () => {
      toast.success('Backup erfolgreich erstellt!');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Backup fehlgeschlagen: ${error.message}`);
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await apiClient.post(`/backup/restore/${filename}`);
      if (!response.success) {
        throw new Error(response.error || 'Failed to restore backup');
      }
      return response;
    },
    onSuccess: () => {
      toast.success('Backup wiederhergestellt! Kein Neustart nötig - sofort einsatzbereit!');
      setConfirmRestore(null);
      // Refresh all data after restore
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(`Wiederherstellung fehlgeschlagen: ${error.message}`);
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await apiClient.delete(`/backup/${filename}`);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete backup');
      }
      return response;
    },
    onSuccess: () => {
      toast.success('Backup gelöscht');
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Löschen fehlgeschlagen: ${error.message}`);
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Datenbank Backups
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Verwalten Sie Ihre Datenbank-Backups und stellen Sie frühere Versionen wieder her
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gesamt Backups</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalBackups}
                  </p>
                </div>
                <Download className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gesamt Größe</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatBytes(stats.totalSize)}
                  </p>
                </div>
                <Database className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Automatisch</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.scheduler.running ? 'Aktiv' : 'Inaktiv'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Täglich um 2:00 Uhr
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Create Backup Button */}
        <div className="mb-6">
          <button
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-5 w-5" />
            {createBackupMutation.isPending ? 'Erstelle Backup...' : 'Jetzt Backup erstellen'}
          </button>
        </div>

        {/* Backups Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Dateiname
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Erstellt am
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Größe
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {backups?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Keine Backups vorhanden
                  </td>
                </tr>
              ) : (
                backups?.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {backup.filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(backup.created)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatBytes(backup.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {/* Restore Button */}
                        {confirmRestore === backup.filename ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 dark:text-red-400">
                              Sicher?
                            </span>
                            <button
                              onClick={() => restoreBackupMutation.mutate(backup.filename)}
                              disabled={restoreBackupMutation.isPending}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              Ja
                            </button>
                            <button
                              onClick={() => setConfirmRestore(null)}
                              className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                            >
                              Nein
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestore(backup.filename)}
                            className="flex items-center gap-1 px-3 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Wiederherstellen
                          </button>
                        )}

                        {/* Delete Button */}
                        {confirmDelete === backup.filename ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 dark:text-red-400">
                              Löschen?
                            </span>
                            <button
                              onClick={() => deleteBackupMutation.mutate(backup.filename)}
                              disabled={deleteBackupMutation.isPending}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              Ja
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                            >
                              Nein
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(backup.filename)}
                            className="flex items-center gap-1 px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                            Löschen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>⚠️ Wichtig:</strong> Das Wiederherstellen eines Backups überschreibt die aktuelle Datenbank!
            Der Server muss danach neu gestartet werden. Ein Sicherheitsbackup wird automatisch erstellt.
          </p>
        </div>
      </div>
    </div>
  );
}
