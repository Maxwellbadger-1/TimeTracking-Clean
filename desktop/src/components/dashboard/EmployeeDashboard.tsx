import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Clock, Calendar, Umbrella, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  useTodayTimeEntries,
  useWeekTimeEntries,
  useRemainingVacationDays,
} from '../../hooks';
import { calculateTotalHours, formatHours, formatDateDE } from '../../utils';
import type { TimeEntry, GDPRDataExport } from '../../types';
import { TimeEntryForm } from '../timeEntries/TimeEntryForm';
import { AbsenceRequestForm } from '../absences/AbsenceRequestForm';
import { BalanceSummaryWidget } from '../worktime/BalanceSummaryWidget';
import { WorkScheduleDisplay } from '../worktime/WorkScheduleDisplay';
import { apiClient } from '../../api/client';

export function EmployeeDashboard() {
  const { user } = useAuthStore();
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // Fetch data
  const { data: todayEntries, isLoading: loadingToday } = useTodayTimeEntries(user?.id || 0);
  const { data: weekEntries, isLoading: loadingWeek } = useWeekTimeEntries(user?.id || 0);
  const { data: vacationBalance, remaining: vacationDays, isLoading: loadingVacation } = useRemainingVacationDays(user?.id || 0);

  if (!user) return null;

  // Calculate totals
  const todayHours = todayEntries ? calculateTotalHours(todayEntries) : 0;
  const weekHours = weekEntries ? calculateTotalHours(weekEntries) : 0;

  // GDPR Data Export (DSGVO Art. 15)
  const handleDataExport = async () => {
    try {
      setExportingData(true);
      toast.info('📊 Exportiere deine Daten...');

      console.log('🔍 DEBUG: Sending data export request via apiClient');

      // Use apiClient instead of raw fetch() to ensure cookies are sent
      // apiClient uses Tauri HTTP Plugin which properly sends session cookies
      const response = await apiClient.get<GDPRDataExport>('/users/me/data-export');

      console.log('✅ DEBUG: Data export response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Keine Daten erhalten');
      }

      // Create JSON file
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      // Download file
      const link = document.createElement('a');
      link.href = url;
      link.download = `daten-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('✅ Daten erfolgreich exportiert!');
    } catch (error) {
      console.error('❌ Data export error:', error);
      toast.error('Fehler beim Exportieren der Daten');
    } finally {
      setExportingData(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Willkommen, {user.firstName}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {user.department || 'Keine Abteilung'}
          </p>
        </div>
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Today's Work Time */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Heute gearbeitet
                  </p>
                  {loadingToday ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {formatHours(todayHours)}
                    </p>
                  )}
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* This Week */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Diese Woche
                  </p>
                  {loadingWeek ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {formatHours(weekHours)}
                    </p>
                  )}
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vacation Days */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Resturlaub
                  </p>
                  {loadingVacation ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {vacationDays} Tage
                      </p>
                      {vacationBalance && (vacationBalance.pending > 0 || vacationBalance.taken > 0) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {vacationBalance.pending > 0 && `${vacationBalance.pending} beantragt`}
                          {vacationBalance.pending > 0 && vacationBalance.taken > 0 && ', '}
                          {vacationBalance.taken > 0 && `${vacationBalance.taken} genehmigt`}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <Umbrella className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Schedule */}
          <Card>
            <CardContent className="pt-6">
              <WorkScheduleDisplay
                user={user}
                mode="compact"
                onDetailsClick={() => setShowScheduleDetails(true)}
              />
            </CardContent>
          </Card>

        </div>

        {/* Balance Summary - Professional Year Breakdown */}
        <div className="mb-8">
          <BalanceSummaryWidget userId={user.id} />
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="primary" fullWidth onClick={() => setShowTimeEntryForm(true)}>
                <Clock className="w-4 h-4 mr-2" />
                Zeit erfassen
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setShowAbsenceForm(true)}>
                <Umbrella className="w-4 h-4 mr-2" />
                Abwesenheit beantragen
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={handleDataExport}
                disabled={exportingData}
              >
                <Download className="w-4 h-4 mr-2" />
                {exportingData ? 'Exportiere...' : 'Daten exportieren (DSGVO)'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Letzte Einträge</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWeek ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : weekEntries && weekEntries.length > 0 ? (
              <div className="space-y-3">
                {weekEntries.slice(0, 5).map((entry: TimeEntry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {formatDateDE(entry.date)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.startTime} - {entry.endTime}
                          {entry.breakMinutes ? ` (${entry.breakMinutes} Min Pause)` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {formatHours(entry.hours || 0)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {entry.location === 'office' && 'Büro'}
                        {entry.location === 'homeoffice' && 'Home Office'}
                        {entry.location === 'field' && 'Außendienst'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Noch keine Zeiteinträge vorhanden</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modals */}
      <TimeEntryForm isOpen={showTimeEntryForm} onClose={() => setShowTimeEntryForm(false)} />
      <AbsenceRequestForm isOpen={showAbsenceForm} onClose={() => setShowAbsenceForm(false)} />

      {/* Work Schedule Details Modal */}
      {showScheduleDetails && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Mein Arbeitszeitmodell
              </h2>
              <button
                onClick={() => setShowScheduleDetails(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <WorkScheduleDisplay user={user} mode="detailed" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
