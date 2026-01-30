/**
 * Reports Page - REBUILT with Transaction-Based API
 *
 * USES NEW ENDPOINTS:
 * - GET /api/reports/overtime/user/:userId?year=&month=
 * - GET /api/reports/overtime/history/:userId?months=
 *
 * REPLACES OLD ENDPOINTS:
 * - /api/overtime/summary (deprecated)
 * - /api/work-time-accounts/history (deprecated)
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUsers } from '../hooks';
import { useAllUsersOvertimeReports, useOvertimeReport } from '../hooks/useOvertimeReports';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { OvertimeSummaryCards } from '../components/reports/OvertimeSummaryCards';
import { OvertimeUserTable } from '../components/reports/OvertimeUserTable';
import { WorkTimeAccountHistory } from '../components/worktime/WorkTimeAccountHistory';
import { OvertimeTransactions } from '../components/worktime/OvertimeTransactions';
import { AbsencesBreakdown } from '../components/reports/AbsencesBreakdown';
import { CorrectionsTable } from '../components/corrections/CorrectionsTable';
import { OvertimeCorrectionModal } from '../components/corrections/OvertimeCorrectionModal';
import { Download, BarChart3, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { exportDATEV, exportHistoricalCSV } from '../api/exports';
import { getDateRangeFromFilters } from '../utils/dateRangeUtils';
import { downloadBlob } from '../utils/downloadFile';

export function ReportsPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  // Filter states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>(
    isAdmin ? 'all' : currentUser?.id || 0
  );

  // Correction modal state
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionUserId, setCorrectionUserId] = useState<number | undefined>(undefined);
  const [correctionUserName, setCorrectionUserName] = useState<string | undefined>(undefined);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const { data: users } = useUsers(isAdmin);
  const { data: reports, isLoading } = useAllUsersOvertimeReports(selectedYear, selectedMonth, isAdmin);

  // For single user view: Use overtime_balance (Single Source of Truth)
  const { data: balanceReport } = useOvertimeReport(
    selectedUserId === 'all' ? 0 : (typeof selectedUserId === 'number' ? selectedUserId : 0),
    selectedYear,
    selectedMonth,
    selectedUserId !== 'all' && typeof selectedUserId === 'number' // Only fetch when single user selected
  );

  // Filter report for selected user (kept for backward compatibility, but Cards now use balanceReport)
  const currentReport = selectedUserId === 'all'
    ? undefined
    : reports?.find(r => r.userId === selectedUserId);

  // Aggregate stats for all users (filter out reports without summary)
  const aggregatedStats = reports
    ?.filter(report => report?.summary)
    .reduce(
      (acc, report) => ({
        targetHours: acc.targetHours + report.summary.targetHours,
        actualHours: acc.actualHours + report.summary.actualHours,
        overtime: acc.overtime + report.summary.overtime,
      }),
      { targetHours: 0, actualHours: 0, overtime: 0 }
    );

  // Period string for display
  const periodString = selectedMonth
    ? `${new Date(selectedYear, selectedMonth - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
    : `${selectedYear}`;

  // Export handlers
  const handleExportCSV = async () => {
    if (!isAdmin) {
      toast.error('Nur Administratoren können Exporte erstellen');
      return;
    }

    try {
      setIsExporting(true);
      const { startDate, endDate } = getDateRangeFromFilters(selectedYear, selectedMonth);
      const userId = selectedUserId !== 'all' ? selectedUserId : undefined;

      toast.loading('CSV wird erstellt...', { id: 'csv-export' });

      const blob = await exportHistoricalCSV(startDate, endDate, userId);

      // Generate filename
      const userPart = userId ? `_User${userId}` : '_Alle';
      const periodPart = selectedMonth
        ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
        : `${selectedYear}`;
      const filename = `Zeiterfassung${userPart}_${periodPart}.csv`;

      downloadBlob(blob, filename);
      toast.success('CSV erfolgreich heruntergeladen!', { id: 'csv-export' });
    } catch (error) {
      console.error('CSV Export Error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Fehler beim CSV Export',
        { id: 'csv-export' }
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDATEV = async () => {
    if (!isAdmin) {
      toast.error('Nur Administratoren können Exporte erstellen');
      return;
    }

    try {
      setIsExporting(true);
      const { startDate, endDate } = getDateRangeFromFilters(selectedYear, selectedMonth);

      toast.loading('DATEV Export wird erstellt...', { id: 'datev-export' });

      const blob = await exportDATEV(startDate, endDate);

      // Generate filename
      const periodPart = selectedMonth
        ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
        : `${selectedYear}`;
      const filename = `DATEV_Export_${periodPart}.csv`;

      downloadBlob(blob, filename);
      toast.success('DATEV Export erfolgreich!', { id: 'datev-export' });
    } catch (error) {
      console.error('DATEV Export Error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Fehler beim DATEV Export',
        { id: 'datev-export' }
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400 text-center">
              Bitte anmelden, um Berichte anzuzeigen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Berichte & Auswertungen
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Transaction-basierte Überstunden-Berechnung
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <Button
                onClick={handleExportCSV}
                variant="secondary"
                disabled={isExporting}
              >
                {isExporting ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                CSV Export
              </Button>
              <Button
                onClick={handleExportDATEV}
                variant="secondary"
                disabled={isExporting}
              >
                {isExporting ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                DATEV Export
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Year Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Jahr
                </label>
                <Input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  min={2020}
                  max={2030}
                />
              </div>

              {/* Month Selector (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monat (optional)
                </label>
                <Select
                  value={selectedMonth?.toString() || ''}
                  onChange={(e) =>
                    setSelectedMonth(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  options={[
                    { value: '', label: 'Ganzes Jahr' },
                    ...Array.from({ length: 12 }, (_, i) => ({
                      value: (i + 1).toString(),
                      label: new Date(2000, i).toLocaleDateString('de-DE', { month: 'long' }),
                    })),
                  ]}
                />
              </div>

              {/* User Selector (Admin only) */}
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mitarbeiter
                  </label>
                  <Select
                    value={selectedUserId.toString()}
                    onChange={(e) =>
                      setSelectedUserId(
                        e.target.value === 'all' ? 'all' : parseInt(e.target.value)
                      )
                    }
                    options={[
                      { value: 'all', label: 'Alle Mitarbeiter' },
                      ...(users?.map((u) => ({
                        value: u.id.toString(),
                        label: `${u.firstName} ${u.lastName}`,
                      })) || []),
                    ]}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {selectedUserId === 'all' && aggregatedStats && (
          <div className="mb-6">
            <OvertimeSummaryCards
              targetHours={aggregatedStats.targetHours}
              actualHours={aggregatedStats.actualHours}
              overtime={aggregatedStats.overtime}
              period={periodString}
            />
          </div>
        )}

        {selectedUserId !== 'all' && balanceReport?.summary && (
          <div className="mb-6">
            <OvertimeSummaryCards
              targetHours={balanceReport.summary.targetHours}
              actualHours={balanceReport.summary.actualHours}
              overtime={balanceReport.summary.overtime}
              period={periodString}
            />
          </div>
        )}

        {/* User Table (Admin viewing all users) */}
        {isAdmin && selectedUserId === 'all' && reports && (
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Übersicht nach Mitarbeiter</CardTitle>
              </CardHeader>
              <CardContent>
                <OvertimeUserTable
                  reports={reports}
                  users={users || []}
                  onUserClick={(userId) => setSelectedUserId(userId)}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Single User View */}
        {selectedUserId !== 'all' && typeof selectedUserId === 'number' && (
          <>
            {/* History Chart */}
            <div className="mb-6">
              <WorkTimeAccountHistory
                userId={selectedUserId}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>

            {/* Transactions */}
            <div className="mb-6">
              <OvertimeTransactions
                userId={selectedUserId}
                year={selectedYear}
                month={selectedMonth}
                limit={100}
              />
            </div>

            {/* Absences Breakdown */}
            <div className="mb-6">
              <AbsencesBreakdown
                userId={selectedUserId}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>

            {/* Corrections (Admin only) */}
            {isAdmin && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Überstunden-Korrekturen</CardTitle>
                    <Button
                      onClick={() => {
                        setCorrectionUserId(selectedUserId);
                        const user = users?.find((u) => u.id === selectedUserId);
                        setCorrectionUserName(
                          user ? `${user.firstName} ${user.lastName}` : undefined
                        );
                        setShowCorrectionModal(true);
                      }}
                      size="sm"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Neue Korrektur
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CorrectionsTable
                    userId={selectedUserId}
                    isAdmin={true}
                    year={selectedYear}
                    month={selectedMonth}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Overtime Correction Modal */}
      <OvertimeCorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => {
          setShowCorrectionModal(false);
          setCorrectionUserId(undefined);
          setCorrectionUserName(undefined);
        }}
        userId={correctionUserId}
        userName={correctionUserName}
      />
    </div>
  );
}
