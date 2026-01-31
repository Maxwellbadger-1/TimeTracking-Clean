/**
 * Team Overtime Summary
 * Admin view: Aggregate team statistics + individual year breakdowns
 *
 * Shows: Total team balance, carryover from 2025, earned in 2026
 */

import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAllUsersOvertimeReports } from '../../hooks';
import { useActiveEmployees } from '../../hooks';
import {
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Calendar,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { formatOvertimeHours } from '../../utils/timeUtils';
import { useState } from 'react';

export function TeamOvertimeSummary() {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const { data: reports, isLoading: loadingReports } = useAllUsersOvertimeReports(currentYear, currentMonth, true);
  const { data: employees, isLoading: loadingEmployees } = useActiveEmployees();
  const [showAll, setShowAll] = useState(false);

  if (loadingReports || loadingEmployees) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Überstunden-Saldo ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Überstunden-Saldo ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Keine Daten verfügbar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate team aggregates
  const teamStats = reports.reduce(
    (acc, report) => ({
      totalBalance: acc.totalBalance + report.summary.overtime,
      totalTarget: acc.totalTarget + report.summary.targetHours,
      totalActual: acc.totalActual + report.summary.actualHours,
      count: acc.count + 1,
    }),
    { totalBalance: 0, totalTarget: 0, totalActual: 0, count: 0 }
  );

  const teamAverage = teamStats.count > 0 ? teamStats.totalBalance / teamStats.count : 0;
  const isTeamPositive = teamStats.totalBalance >= 0;

  // Sort users by overtime (highest first, including negative)
  const sortedReports = [...reports].sort((a, b) => b.summary.overtime - a.summary.overtime);

  // Limit to top 5 if not showing all
  const displayReports = showAll ? sortedReports : sortedReports.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <CardTitle>Team Überstunden-Saldo ({currentYear})</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Team Aggregate Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Gesamt-Saldo (Team)
              </p>
            </div>
            <p
              className={`text-2xl font-bold ${
                isTeamPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatOvertimeHours(teamStats.totalBalance)}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Durchschnitt
              </p>
            </div>
            <p
              className={`text-2xl font-bold ${
                teamAverage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatOvertimeHours(teamAverage)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              pro Mitarbeiter ({teamStats.count})
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Monat {currentMonth}/{currentYear}
              </p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatOvertimeHours(reports.reduce((sum, r) => sum + r.summary.overtime, 0) / reports.length)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ø aktueller Monat</p>
          </div>
        </div>

        {/* Individual User Breakdowns */}
        <div className="space-y-3">
          {displayReports.map((report) => {
            const user = employees?.find((e) => e.id === report.userId);
            const isPositive = report.summary.overtime >= 0;
            const isCritical = Math.abs(report.summary.overtime) > 40;

            return (
              <div
                key={report.userId}
                className={`p-3 rounded-lg border ${
                  isCritical
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded ${
                        isCritical
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : isPositive
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-orange-100 dark:bg-orange-900/20'
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      ) : isPositive ? (
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {user?.firstName || 'N/A'} {user?.lastName || ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Soll: {formatOvertimeHours(report.summary.targetHours)} • Ist: {formatOvertimeHours(report.summary.actualHours)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xl font-bold ${
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatOvertimeHours(report.summary.overtime)}
                    </p>
                    {isCritical && (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 justify-end">
                        <AlertTriangle className="w-3 h-3" />
                        Kritisch
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show More/Less Toggle */}
        {reports.length > 5 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {showAll ? `Weniger anzeigen` : `Alle ${reports.length} Mitarbeiter anzeigen`}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
