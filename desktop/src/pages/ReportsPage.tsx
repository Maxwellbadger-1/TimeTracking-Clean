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

    // Subtract approved absences (vacation + sick days)
    const approvedAbsenceDays = filteredAbsences
      .filter(a => a.status === 'approved' && (a.type === 'vacation' || a.type === 'sick'))
      .reduce((sum, a) => sum + (a.daysRequired || 0), 0);

    const actualWorkDays = workingDaysInPeriod - approvedAbsenceDays;
    const targetHours = actualWorkDays * targetHoursPerDay;
    const targetVsActualDiff = totalHours - targetHours;
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
    const overtimeHours = overtimeData?.totalOvertime || 0;

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
        const userApprovedAbsenceDays = userAbsences
          .filter(a => a.status === 'approved' && (a.type === 'vacation' || a.type === 'sick'))
          .reduce((sum, a) => sum + (a.daysRequired || 0), 0);

        const userActualWorkDays = userWorkingDays - userApprovedAbsenceDays;
        byUser[parseInt(userId)].targetHours = userActualWorkDays * userTargetHoursPerDay;
      });
    }

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      targetHours: Math.round(targetHours * 100) / 100,
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

          <Button onClick={handleExportCSV} variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            CSV Export
          </Button>
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Hours */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ist-Stunden
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {formatHours(stats.totalHours)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Soll: {formatHours(stats.targetHours)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          {/* Soll/Ist Vergleich */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Soll/Ist Vergleich
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    stats.targetVsActualDiff >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatOvertimeHours(stats.targetVsActualDiff)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {stats.targetVsActualPercent} vom Soll
                  </p>
                </div>
                {stats.targetVsActualDiff >= 0 ? (
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Overtime */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Überstunden
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    stats.overtimeHours >= 0
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatOvertimeHours(stats.overtimeHours)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Stand: {reportType === 'monthly' ? 'Monat' : 'Jahr'}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
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
    </div>
  );
}
