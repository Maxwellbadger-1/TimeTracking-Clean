/**
 * Reports Page - Enhanced Version
 *
 * Features (Best Practices):
 * - Monthly AND Yearly reports
 * - Overtime tracking with statistics
 * - Soll/Ist Vergleich (Target vs Actual Hours)
 * - Detailed time entries table
 * - Absence report (vacation, sick days)
 * - CSV Export functionality
 * - Role-based access (Admin: all users, Employee: own data)
 * - Filter by month/year, user
 */

import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { universalFetch } from '../lib/tauriHttpClient';
import {
  FileText,
  Download,
  Clock,
  Umbrella,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  useTimeEntries,
  useAbsenceRequests,
  useUsers,
  useOvertimeSummary,
  useAllUsersOvertime,
} from '../hooks';
import { formatHours, formatOvertimeHours } from '../utils/timeUtils';
import { eachDayOfInterval, isWeekend } from 'date-fns';

type ReportType = 'monthly' | 'yearly';

export function ReportsPage() {
  const { user: currentUser } = useAuthStore();
  const { data: users } = useUsers();

  // Filter States
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>(
    currentUser?.role === 'admin' ? 'all' : currentUser?.id || 0
  );

  // Historical Export Modal State
  const [showHistoricalExportModal, setShowHistoricalExportModal] = useState(false);
  const [historicalStartDate, setHistoricalStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [historicalEndDate, setHistoricalEndDate] = useState(`${new Date().getFullYear()}-12-31`);

  // Fetch data
  const { data: timeEntries, isLoading: loadingTimeEntries } = useTimeEntries(
    currentUser?.role === 'admin' && selectedUserId === 'all'
      ? undefined
      : { userId: selectedUserId === 'all' ? currentUser?.id || 0 : selectedUserId }
  );

  const { data: absenceRequests, isLoading: loadingAbsences } = useAbsenceRequests(
    currentUser?.role === 'admin' && selectedUserId === 'all'
      ? undefined
      : { userId: selectedUserId === 'all' ? currentUser?.id || 0 : selectedUserId }
  );

  // Overtime data
  const { data: overtimeData } = useOvertimeSummary(
    selectedUserId === 'all' ? currentUser?.id || 0 : selectedUserId,
    selectedYear
  );

  const { data: allUsersOvertimeData } = useAllUsersOvertime(selectedYear);

  const isLoading = loadingTimeEntries || loadingAbsences;

  // Filter data by selected period
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries) return [];

    if (reportType === 'monthly') {
      return timeEntries.filter((entry) => entry.date.startsWith(selectedMonth));
    } else {
      // Yearly
      return timeEntries.filter((entry) => entry.date.startsWith(selectedYear.toString()));
    }
  }, [timeEntries, selectedMonth, selectedYear, reportType]);

  const filteredAbsences = useMemo(() => {
    if (!absenceRequests) return [];

    const periodStart = reportType === 'monthly' ? selectedMonth + '-01' : selectedYear + '-01-01';
    const periodEnd = reportType === 'monthly'
      ? selectedMonth + '-31'
      : selectedYear + '-12-31';

    return absenceRequests.filter(
      (req) =>
        req.status === 'approved' &&
        ((req.startDate >= periodStart && req.startDate <= periodEnd) ||
          (req.endDate >= periodStart && req.endDate <= periodEnd) ||
          (req.startDate <= periodStart && req.endDate >= periodEnd))
    );
  }, [absenceRequests, selectedMonth, selectedYear, reportType]);

  // Calculate statistics
  const stats = useMemo(() => {
    // Helper: Count working days (Mo-Fr) in a period
    const countWorkingDays = (startDate: Date, endDate: Date): number => {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      return days.filter(day => !isWeekend(day)).length;
    };

    // Working Hours Stats
    const totalHours = filteredTimeEntries.reduce(
      (sum, entry) => sum + (entry.hours || 0),
      0
    );
    const totalDays = new Set(filteredTimeEntries.map((e) => e.date)).size;
    const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;

    // Soll/Ist Vergleich (Target vs Actual)
    // Get current user or selected user for individual reports
    const targetUser = selectedUserId === 'all'
      ? currentUser
      : users?.find((u) => u.id === selectedUserId) || currentUser;

    // Calculate target hours based on user's weeklyHours
    const weeklyHours = targetUser?.weeklyHours || 40;
    const targetHoursPerDay = weeklyHours / 5; // 5-day work week

    // Determine period bounds
    const [year, month] = reportType === 'monthly'
      ? selectedMonth.split('-').map(Number)
      : [selectedYear, 1];

    const monthStart = reportType === 'monthly'
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);

    const monthEnd = reportType === 'monthly'
      ? new Date(year, month, 0) // Last day of month
      : new Date(year, 11, 31); // Dec 31

    // Use hire date as start if later than period start
    const hireDate = targetUser?.hireDate ? new Date(targetUser.hireDate) : new Date('1900-01-01');
    const periodStart = hireDate > monthStart ? hireDate : monthStart;

    // Use today as end if current period
    const today = new Date();
    const isCurrentPeriod = reportType === 'monthly'
      ? (month === today.getMonth() + 1 && year === today.getFullYear())
      : (year === today.getFullYear());
    const periodEnd = isCurrentPeriod ? today : monthEnd;

    // Count working days in period (Mo-Fr, excluding weekends)
    const workingDaysInPeriod = countWorkingDays(periodStart, periodEnd);

    // BEST PRACTICE (Personio, DATEV, SAP):
    // Target hours = All working days (Soll bleibt konstant!)
    const targetHours = workingDaysInPeriod * targetHoursPerDay;

    // Calculate absence credits ("Krank/Urlaub = Gearbeitet")
    const absenceCredits = filteredAbsences
      .filter(a => a.status === 'approved')
      .reduce((sum, a) => {
        const days = a.days || 0;
        // vacation, sick, overtime_comp → Count as worked
        if (a.type === 'vacation' || a.type === 'sick' || a.type === 'overtime_comp') {
          return sum + (days * targetHoursPerDay);
        }
        // unpaid → Reduce target hours (handled below)
        return sum;
      }, 0);

    // Calculate unpaid leave reduction (reduces Soll!)
    const unpaidLeaveDays = filteredAbsences
      .filter(a => a.status === 'approved' && a.type === 'unpaid')
      .reduce((sum, a) => sum + (a.days || 0), 0);

    const unpaidLeaveReduction = unpaidLeaveDays * targetHoursPerDay;

    // Adjusted target hours (Soll minus unpaid leave)
    const adjustedTargetHours = targetHours - unpaidLeaveReduction;

    // Actual hours = worked hours + absence credits
    const actualHoursWithCredits = totalHours + absenceCredits;

    // Overtime = Ist (with credits) - Soll (adjusted)
    const targetVsActualDiff = actualHoursWithCredits - adjustedTargetHours;
    const targetVsActualPercent = targetHours > 0
      ? ((totalHours / targetHours) * 100).toFixed(1) + '%'
      : '0.0%';

    // Absence Stats - Calculate actual days (not just number of requests)
    const calculateDaysBetween = (startDate: string, endDate: string): number => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
      return diffDays;
    };

    const vacationDays = filteredAbsences
      .filter((r) => r.type === 'vacation')
      .reduce((sum, r) => sum + calculateDaysBetween(r.startDate, r.endDate), 0);

    const sickDays = filteredAbsences
      .filter((r) => r.type === 'sick')
      .reduce((sum, r) => sum + calculateDaysBetween(r.startDate, r.endDate), 0);

    const overtimeCompDays = filteredAbsences
      .filter((r) => r.type === 'overtime_comp')
      .reduce((sum, r) => sum + calculateDaysBetween(r.startDate, r.endDate), 0);

    // Overtime Stats
    // IMPORTANT: Überstunden = Ist - Soll (same as Differenz!)
    // Use the SAME calculation as targetVsActualDiff for consistency
    const overtimeHours = targetVsActualDiff;

    // By User (if admin viewing all)
    const byUser: Record<number, {
      name: string;
      hours: number;
      days: number;
      overtime: number;
      targetHours: number;
    }> = {};

    if (currentUser?.role === 'admin' && selectedUserId === 'all') {
      filteredTimeEntries.forEach((entry) => {
        if (!byUser[entry.userId]) {
          const user = users?.find((u) => u.id === entry.userId);
          const userOvertime = allUsersOvertimeData?.find((o) => o.userId === entry.userId);
          byUser[entry.userId] = {
            name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            hours: 0,
            days: 0,
            overtime: userOvertime?.totalOvertime || 0,
            targetHours: 0,
          };
        }
        byUser[entry.userId].hours += entry.hours || 0;
        byUser[entry.userId].days += 1;
      });

      // Calculate target hours per user using the SAME logic as single user view
      Object.keys(byUser).forEach((userId) => {
        const user = users?.find((u) => u.id === parseInt(userId));
        const userWeeklyHours = user?.weeklyHours || 40;
        const userTargetHoursPerDay = userWeeklyHours / 5;

        // Use same period bounds and hire date logic
        const [year, month] = reportType === 'monthly'
          ? selectedMonth.split('-').map(Number)
          : [selectedYear, 1];

        const monthStart = reportType === 'monthly'
          ? new Date(year, month - 1, 1)
          : new Date(year, 0, 1);

        const monthEnd = reportType === 'monthly'
          ? new Date(year, month, 0)
          : new Date(year, 11, 31);

        const userHireDate = user?.hireDate ? new Date(user.hireDate) : new Date('1900-01-01');
        const userPeriodStart = userHireDate > monthStart ? userHireDate : monthStart;

        const today = new Date();
        const isCurrentPeriod = reportType === 'monthly'
          ? (month === today.getMonth() + 1 && year === today.getFullYear())
          : (year === today.getFullYear());
        const userPeriodEnd = isCurrentPeriod ? today : monthEnd;

        const userWorkingDays = countWorkingDays(userPeriodStart, userPeriodEnd);

        // Get user's absences
        const userAbsences = filteredAbsences.filter(a => a.userId === parseInt(userId));

        // BEST PRACTICE: Same logic as single user view
        const userTargetHours = userWorkingDays * userTargetHoursPerDay;

        // Calculate absence credits for this user
        const userAbsenceCredits = userAbsences
          .filter(a => a.status === 'approved')
          .reduce((sum, a) => {
            const days = a.daysRequired || 0;
            if (a.type === 'vacation' || a.type === 'sick' || a.type === 'overtime_comp') {
              return sum + (days * userTargetHoursPerDay);
            }
            return sum;
          }, 0);

        // Calculate unpaid leave reduction for this user
        const userUnpaidDays = userAbsences
          .filter(a => a.status === 'approved' && a.type === 'unpaid')
          .reduce((sum, a) => sum + (a.daysRequired || 0), 0);
        const userUnpaidReduction = userUnpaidDays * userTargetHoursPerDay;

        // Adjusted target and actual with credits
        const userAdjustedTarget = userTargetHours - userUnpaidReduction;
        const userActualWithCredits = byUser[parseInt(userId)].hours + userAbsenceCredits;

        byUser[parseInt(userId)].targetHours = userAdjustedTarget;
        byUser[parseInt(userId)].overtime = userActualWithCredits - userAdjustedTarget;
      });
    }

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      targetHours: Math.round(adjustedTargetHours * 100) / 100, // Use adjusted target (with unpaid reduction)
      actualHours: Math.round(actualHoursWithCredits * 100) / 100, // Actual + credits
      absenceCredits: Math.round(absenceCredits * 100) / 100, // For display
      unpaidLeaveReduction: Math.round(unpaidLeaveReduction * 100) / 100, // For display
      targetVsActualDiff: Math.round(targetVsActualDiff * 100) / 100,
      targetVsActualPercent,
      vacationDays,
      sickDays,
      overtimeCompDays,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      byUser: Object.values(byUser).sort((a, b) => b.hours - a.hours),
    };
  }, [
    filteredTimeEntries,
    filteredAbsences,
    users,
    currentUser,
    selectedUserId,
    reportType,
    selectedMonth,
    selectedYear,
    overtimeData,
    allUsersOvertimeData,
  ]);

  // CSV Export using Tauri save dialog
  const handleExportCSV = async () => {
    console.log('🚀 CSV Export START');
    try {
      const periodLabel = reportType === 'monthly'
        ? selectedMonth
        : selectedYear.toString();
      console.log('📅 Period Label:', periodLabel);

      const headers = [
        'Zeitraum',
        'Mitarbeiter',
        'Arbeitstage',
        'Ist-Stunden',
        'Soll-Stunden',
        'Differenz',
        'Durchschnitt/Tag',
        'Überstunden',
        'Urlaubstage',
        'Kranktage',
        'Überstundenausgleich',
      ];

      let rows: string[][] = [];

      if (currentUser?.role === 'admin' && selectedUserId === 'all') {
        console.log('📊 Admin export: All users');
        console.log('👥 stats.byUser:', stats.byUser);
        // Admin: One row per user
        stats.byUser.forEach((userStats) => {
          const diff = userStats.hours - userStats.targetHours;
          rows.push([
            periodLabel,
            userStats.name,
            userStats.days.toString(),
            formatHours(userStats.hours).replace('h', ''),
            formatHours(userStats.targetHours).replace('h', ''),
            formatOvertimeHours(diff).replace('h', ''),
            formatHours(userStats.hours / Math.max(userStats.days, 1)).replace('h', ''),
            formatOvertimeHours(userStats.overtime).replace('h', ''),
            '-',
            '-',
            '-',
          ]);
        });
      } else {
        console.log('📊 Single user export');
        // Employee: Single row
        const user = users?.find((u) => u.id === (selectedUserId === 'all' ? currentUser?.id : selectedUserId));
        console.log('👤 User:', user);
        rows.push([
          periodLabel,
          user ? `${user.firstName} ${user.lastName}` : 'Current User',
          stats.totalDays.toString(),
          formatHours(stats.totalHours).replace('h', ''),
          formatHours(stats.targetHours).replace('h', ''),
          formatOvertimeHours(stats.targetVsActualDiff).replace('h', ''),
          formatHours(stats.avgHoursPerDay).replace('h', ''),
          formatOvertimeHours(stats.overtimeHours).replace('h', ''),
          stats.vacationDays.toString(),
          stats.sickDays.toString(),
          stats.overtimeCompDays.toString(),
        ]);
      }

      console.log('📝 Rows generated:', rows.length);

      // Create CSV content with UTF-8 BOM for Excel compatibility
      const csv = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
      console.log('📄 CSV Content Length:', csv.length);

      console.log('🔌 Importing Tauri plugins...');
      // Use Tauri's save dialog
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      console.log('✅ Tauri plugins imported');

      console.log('💾 Opening save dialog...');
      const filePath = await save({
        defaultPath: `bericht_${periodLabel}.csv`,
        filters: [{
          name: 'CSV',
          extensions: ['csv']
        }]
      });
      console.log('📂 Selected file path:', filePath);

      if (filePath) {
        console.log('✍️ Writing file...');
        await writeTextFile(filePath, csv);
        console.log('✅ File written successfully!');
        alert('✅ CSV erfolgreich exportiert!');
      } else {
        console.log('❌ User cancelled dialog');
      }
    } catch (error) {
      console.error('❌ CSV Export Error:', error);
      console.error('❌ Error stack:', (error as Error).stack);
      alert('Fehler beim CSV Export: ' + (error as Error).message);
    }
    console.log('🏁 CSV Export END');
  };

  // DATEV Export Handler
  const handleExportDATEV = async () => {
    console.log('🚀 DATEV Export START');
    try {
      const startDate = reportType === 'monthly'
        ? `${selectedMonth}-01`
        : `${selectedYear}-01-01`;
      const endDate = reportType === 'monthly'
        ? new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString().split('T')[0]
        : `${selectedYear}-12-31`;

      console.log('📅 Date Range:', { startDate, endDate });

      // Fetch DATEV export from API using universalFetch (handles session cookies correctly)
      const response = await universalFetch(
        `http://localhost:3000/api/exports/datev?startDate=${startDate}&endDate=${endDate}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`DATEV Export fehlgeschlagen: ${response.status}`);
      }

      // Get CSV content
      const csvContent = await response.text();
      console.log('✅ Received CSV content:', csvContent.length, 'bytes');

      // Use Tauri save dialog
      const filePath = await save({
        defaultPath: `DATEV_Export_${startDate}_${endDate}.csv`,
        filters: [{
          name: 'CSV',
          extensions: ['csv']
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, csvContent);
        toast.success('✅ DATEV Export erfolgreich!');
      }
    } catch (error) {
      console.error('❌ DATEV Export Error:', error);
      toast.error('Fehler beim DATEV Export: ' + (error as Error).message);
    }
  };

  // Historical Export Handler - Open Modal
  const handleExportHistoricalClick = () => {
    setShowHistoricalExportModal(true);
  };

  // Historical Export Handler - Execute Export
  const handleExportHistorical = async () => {
    console.log('🚀 Historical Export START');
    try {
      console.log('📅 Date Range:', { historicalStartDate, historicalEndDate });

      // Fetch historical export from API using universalFetch (handles session cookies correctly)
      const userId = selectedUserId === 'all' ? '' : `&userId=${selectedUserId}`;
      const response = await universalFetch(
        `http://localhost:3000/api/exports/historical/csv?startDate=${historicalStartDate}&endDate=${historicalEndDate}${userId}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Historical Export fehlgeschlagen: ${response.status}`);
      }

      // Get CSV content
      const csvContent = await response.text();
      console.log('✅ Received CSV content:', csvContent.length, 'bytes');

      // Use Tauri save dialog
      const userPart = selectedUserId === 'all' ? '_All' : `_User${selectedUserId}`;
      const filePath = await save({
        defaultPath: `Historical_Export${userPart}_${historicalStartDate}_${historicalEndDate}.csv`,
        filters: [{
          name: 'CSV',
          extensions: ['csv']
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, csvContent);
        toast.success('✅ Historischer Export erfolgreich!');
        setShowHistoricalExportModal(false); // Close modal on success
      }
    } catch (error) {
      console.error('❌ Historical Export Error:', error);
      toast.error('Fehler beim Historischen Export: ' + (error as Error).message);
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
                Monats- und Jahresberichte, Soll/Ist-Vergleich, Überstunden
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              CSV Export
            </Button>
            <Button onClick={handleExportDATEV} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              DATEV Export
            </Button>
            <Button onClick={handleExportHistoricalClick} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Historischer Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Berichtsart
                </label>
                <Select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  options={[
                    { value: 'monthly', label: 'Monatsbericht' },
                    { value: 'yearly', label: 'Jahresbericht' },
                  ]}
                />
              </div>

              {/* Month or Year Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {reportType === 'monthly' ? 'Monat' : 'Jahr'}
                </label>
                {reportType === 'monthly' ? (
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                ) : (
                  <Input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    min={2020}
                    max={2030}
                  />
                )}
              </div>

              {/* User Selector (Admin only) */}
              {currentUser.role === 'admin' && (
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

        {/* Statistics Cards - Best Practice Layout: Soll, Ist, Differenz */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Soll-Stunden (Target Hours) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Soll-Stunden
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {formatHours(stats.targetHours)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {stats.unpaidLeaveReduction > 0
                      ? `Reduziert um ${formatHours(stats.unpaidLeaveReduction)} (unbez. Urlaub)`
                      : `Stand: ${new Date().toLocaleDateString('de-DE')}`
                    }
                  </p>
                </div>
                <Clock className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Ist-Stunden (Actual Hours with Absence Credits) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ist-Stunden
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {formatHours(stats.actualHours)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatHours(stats.totalHours)} gearbeitet
                    {stats.absenceCredits > 0 && ` + ${formatHours(stats.absenceCredits)} Abwesenheit`}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          {/* Überstunden (Differenz = Ist - Soll) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Überstunden (Differenz)
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    stats.overtimeHours >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatOvertimeHours(stats.overtimeHours)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ist - Soll = Überstunden
                  </p>
                </div>
                {stats.overtimeHours >= 0 ? (
                  <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Absences */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Abwesenheiten
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.vacationDays + stats.sickDays + stats.overtimeCompDays}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    U:{stats.vacationDays} K:{stats.sickDays} Ü:{stats.overtimeCompDays}
                  </p>
                </div>
                <Umbrella className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Hours Report */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {reportType === 'monthly' ? 'Monatsbericht' : 'Jahresbericht'} - Arbeitsstunden & Soll/Ist-Vergleich
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentUser.role === 'admin' && selectedUserId === 'all' ? (
              // Admin: Show per-user table
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Mitarbeiter
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Tage
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Ist-Stunden
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Soll-Stunden
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Differenz
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Ø Std/Tag
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Überstunden
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byUser.length > 0 ? (
                      stats.byUser.map((userStats, idx) => {
                        const diff = userStats.hours - userStats.targetHours;
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                              {userStats.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-gray-100">
                              {userStats.days}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                              {formatHours(userStats.hours)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                              {formatHours(userStats.targetHours)}
                            </td>
                            <td className={`py-3 px-4 text-sm text-right font-semibold ${
                              diff >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatOvertimeHours(diff)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                              {formatHours(userStats.hours / Math.max(userStats.days, 1))}
                            </td>
                            <td className={`py-3 px-4 text-sm text-right font-semibold ${
                              userStats.overtime >= 0
                                ? 'text-purple-600 dark:text-purple-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatOvertimeHours(userStats.overtime)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          Keine Daten für diesen Zeitraum
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Employee: Show summary
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Arbeitstage
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {stats.totalDays}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Ist-Stunden (gearbeitet)
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {stats.totalHours}h
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Soll-Stunden (erwartet)
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {stats.targetHours}h
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Differenz (Soll/Ist)
                  </span>
                  <span className={`text-sm font-semibold ${
                    stats.targetVsActualDiff >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatOvertimeHours(stats.targetVsActualDiff)} ({stats.targetVsActualPercent}%)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Durchschnitt pro Tag
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {stats.avgHoursPerDay}h
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Überstunden (kumuliert)
                  </span>
                  <span className={`text-sm font-semibold ${
                    stats.overtimeHours >= 0
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatOvertimeHours(stats.overtimeHours)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Time Entries Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Detaillierte Zeiteinträge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Datum
                    </th>
                    {currentUser.role === 'admin' && selectedUserId === 'all' && (
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Mitarbeiter
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Beschreibung
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Stunden
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTimeEntries.length > 0 ? (
                    filteredTimeEntries
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 50) // Show max 50 entries
                      .map((entry, idx) => {
                        const user = users?.find((u) => u.id === entry.userId);
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                              {new Date(entry.date).toLocaleDateString('de-DE')}
                            </td>
                            {currentUser.role === 'admin' && selectedUserId === 'all' && (
                              <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                                {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                              </td>
                            )}
                            <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                              {entry.description || '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                              {entry.hours ? formatHours(entry.hours) : '-'}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td
                        colSpan={currentUser.role === 'admin' && selectedUserId === 'all' ? 4 : 3}
                        className="py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        Keine Zeiteinträge für diesen Zeitraum
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredTimeEntries.length > 50 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                Zeige die letzten 50 Einträge von {filteredTimeEntries.length} insgesamt
              </p>
            )}
          </CardContent>
        </Card>

        {/* Absence Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Umbrella className="w-5 h-5" />
              Abwesenheiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Urlaubstage
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  {stats.vacationDays}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Kranktage
                </p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                  {stats.sickDays}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                  Überstundenausgleich
                </p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                  {stats.overtimeCompDays}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Historical Export Modal */}
      {showHistoricalExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Historischer Export
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start-Datum
                </label>
                <Input
                  type="date"
                  value={historicalStartDate}
                  onChange={(e) => setHistoricalStartDate(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End-Datum
                </label>
                <Input
                  type="date"
                  value={historicalEndDate}
                  onChange={(e) => setHistoricalEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowHistoricalExportModal(false)}
                variant="secondary"
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleExportHistorical}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Export starten
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
