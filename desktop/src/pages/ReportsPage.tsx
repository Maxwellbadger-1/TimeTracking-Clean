/**
 * Reports Page
 *
 * Features:
 * - Monthly working hours report (per employee)
 * - Overtime report with statistics
 * - Absence report (vacation, sick days)
 * - CSV Export functionality
 * - Role-based access (Admin: all users, Employee: own data)
 * - Filter by month, year, user
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
  Calendar,
  Clock,
  Umbrella,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { useTimeEntries, useAbsenceRequests, useUsers } from '../hooks';

export function ReportsPage() {
  const { user: currentUser } = useAuthStore();
  const { data: users } = useUsers();

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
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

  const isLoading = loadingTimeEntries || loadingAbsences;

  // Filter data by selected month
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries) return [];
    return timeEntries.filter((entry) => entry.date.startsWith(selectedMonth));
  }, [timeEntries, selectedMonth]);

  const filteredAbsences = useMemo(() => {
    if (!absenceRequests) return [];
    return absenceRequests.filter(
      (req) =>
        req.status === 'approved' &&
        ((req.startDate.startsWith(selectedMonth) ||
          req.endDate.startsWith(selectedMonth)) ||
          (req.startDate <= selectedMonth + '-31' && req.endDate >= selectedMonth + '-01'))
    );
  }, [absenceRequests, selectedMonth]);

  // Calculate statistics
  const stats = useMemo(() => {
    // Working Hours Stats
    const totalHours = filteredTimeEntries.reduce(
      (sum, entry) => sum + (entry.hours || 0),
      0
    );
    const totalDays = new Set(filteredTimeEntries.map((e) => e.date)).size;
    const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;

    // Absence Stats
    const vacationDays = filteredAbsences.filter((r) => r.type === 'vacation').length;
    const sickDays = filteredAbsences.filter((r) => r.type === 'sick').length;
    const overtimeCompDays = filteredAbsences.filter(
      (r) => r.type === 'overtime_comp'
    ).length;

    // By User (if admin viewing all)
    const byUser: Record<number, { name: string; hours: number; days: number }> = {};
    if (currentUser?.role === 'admin' && selectedUserId === 'all') {
      filteredTimeEntries.forEach((entry) => {
        if (!byUser[entry.userId]) {
          const user = users?.find((u) => u.id === entry.userId);
          byUser[entry.userId] = {
            name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            hours: 0,
            days: 0,
          };
        }
        byUser[entry.userId].hours += entry.hours || 0;
        byUser[entry.userId].days += 1;
      });
    }

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      vacationDays,
      sickDays,
      overtimeCompDays,
      byUser: Object.values(byUser).sort((a, b) => b.hours - a.hours),
    };
  }, [filteredTimeEntries, filteredAbsences, users, currentUser, selectedUserId]);

  // CSV Export
  const handleExportCSV = () => {
    // Monthly Hours Report
    const headers = [
      'Monat',
      'Mitarbeiter',
      'Arbeitstage',
      'Gesamtstunden',
      'Durchschnitt/Tag',
      'Urlaubstage',
      'Kranktage',
      'Überstundenausgleich',
    ];

    let rows: string[][] = [];

    if (currentUser?.role === 'admin' && selectedUserId === 'all') {
      // Admin: One row per user
      stats.byUser.forEach((userStats) => {
        rows.push([
          selectedMonth,
          userStats.name,
          userStats.days.toString(),
          userStats.hours.toFixed(2),
          (userStats.hours / Math.max(userStats.days, 1)).toFixed(2),
          '-',
          '-',
          '-',
        ]);
      });
    } else {
      // Employee: Single row
      const user = users?.find((u) => u.id === (selectedUserId === 'all' ? currentUser?.id : selectedUserId));
      rows.push([
        selectedMonth,
        user ? `${user.firstName} ${user.lastName}` : 'Current User',
        stats.totalDays.toString(),
        stats.totalHours.toFixed(2),
        stats.avgHoursPerDay.toFixed(2),
        stats.vacationDays.toString(),
        stats.sickDays.toString(),
        stats.overtimeCompDays.toString(),
      ]);
    }

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bericht_${selectedMonth}.csv`;
    link.click();
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
                Berichte
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Monatsberichte, Überstunden, Abwesenheiten
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monat
                </label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>

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
                    Gesamtstunden
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalHours}h
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          {/* Working Days */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Arbeitstage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalDays}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          {/* Average Hours/Day */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ø Std/Tag</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.avgHoursPerDay}h
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
              Monatsbericht - Arbeitsstunden
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
                        Arbeitstage
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Gesamtstunden
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Ø Std/Tag
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byUser.length > 0 ? (
                      stats.byUser.map((userStats, idx) => (
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
                            {userStats.hours.toFixed(2)}h
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                            {(userStats.hours / Math.max(userStats.days, 1)).toFixed(2)}h
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          Keine Daten für diesen Monat
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
                    Gesamtstunden
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {stats.totalHours}h
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Durchschnitt pro Tag
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {stats.avgHoursPerDay}h
                  </span>
                </div>
              </div>
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
