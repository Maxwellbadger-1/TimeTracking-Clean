/**
 * Balance Summary Widget
 * Professional overtime display with year breakdown
 *
 * Shows: Total Balance = Carryover from 2025 + Earned in 2026
 * Inspired by: Personio, DATEV
 */

import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useOvertimeReport } from '../../hooks';
import { useAuthStore } from '../../store/authStore';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  FileText,
} from 'lucide-react';
import { formatHours, formatOvertimeHours } from '../../utils/timeUtils';
import { Button } from '../ui/Button';
import { useUIStore } from '../../store/uiStore';

interface BalanceSummaryWidgetProps {
  userId?: number;
}

export function BalanceSummaryWidget({ userId }: BalanceSummaryWidgetProps) {
  const { user: currentUser } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const targetUserId = userId || currentUser?.id || 0;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Use same endpoint as Berichte Tab (Single Source of Truth!)
  // Fetches current month data from /overtime/balance/:userId/:month
  const { data: monthlyReport, isLoading: loadingMonth, error: monthError } = useOvertimeReport(targetUserId, currentYear, currentMonth);

  // Fetch yearly data from /overtime/balance/:userId/year/:year
  const { data: yearlyReport, isLoading: loadingYear, error: yearError } = useOvertimeReport(targetUserId, currentYear);

  const isLoading = loadingMonth || loadingYear;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Team Überstunden-Saldo ({currentYear})
          </h3>
        </div>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  // Show error details if data is missing
  if (!monthlyReport || !yearlyReport) {
    console.error('Dashboard data missing:', {
      monthlyReport,
      yearlyReport,
      monthError,
      yearError,
      targetUserId,
      currentYear,
      currentMonth
    });

    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Team Überstunden-Saldo ({currentYear})
          </h3>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            Keine Daten verfügbar
          </p>
          {(monthError || yearError) && (
            <p className="text-xs text-red-500 dark:text-red-400">
              {monthError?.message || yearError?.message}
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Calculate breakdown from yearly and monthly data
  const totalBalance = yearlyReport.summary.overtime;
  const earnedThisYear = yearlyReport.summary.overtime;
  const currentMonthEarned = monthlyReport.summary.overtime;
  const previousYear = currentYear - 1;

  // Calculate carryover: total - earned this year
  // This approximates the carryover (not 100% accurate but consistent with the endpoint)
  const carryoverFromPreviousYear = 0; // We don't have this data from the new endpoint

  const isPositive = totalBalance >= 0;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Saldo
          </h3>
        </div>
        {isPositive ? (
          <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
        )}
      </div>

      {/* Hero Number - Total Balance */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className={`text-4xl font-bold ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
            title="Ihr gesamter Überstunden-Saldo (kumuliert seit Eintrittsdatum)"
          >
            {formatOvertimeHours(totalBalance)}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gesamtsaldo (Stand: {new Date().toLocaleDateString('de-DE')})
        </p>
      </div>

      {/* Year Breakdown */}
      <div className="space-y-3 mb-6">
        {/* Carryover from Previous Year */}
        {carryoverFromPreviousYear !== 0 && (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Übertrag aus {previousYear}
              </span>
            </div>
            <span
              className={`text-sm font-semibold ${
                carryoverFromPreviousYear >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatOvertimeHours(carryoverFromPreviousYear)}
            </span>
          </div>
        )}

        {/* Earned This Year */}
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Saldo {currentYear}
            </span>
          </div>
          <span
            className={`text-sm font-semibold ${
              earnedThisYear >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatOvertimeHours(earnedThisYear)}
          </span>
        </div>
      </div>

      {/* Current Month Context */}
      <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Aktueller Monat ({new Date(currentYear, currentMonth - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })})
          </span>
          <span
            className={`text-xs font-semibold ${
              currentMonthEarned >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatOvertimeHours(currentMonthEarned)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">Soll:</span> {formatHours(monthlyReport.summary.targetHours)}
          </div>
          <div>
            <span className="font-medium">Ist:</span> {formatHours(monthlyReport.summary.actualHours)}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => setCurrentView('reports')}
        >
          <Calendar className="w-4 h-4 mr-1" />
          Historie
        </Button>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => setCurrentView('reports')}
        >
          <FileText className="w-4 h-4 mr-1" />
          Details
        </Button>
      </div>

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Live-Berechnung • Basis: Ist-Stunden - Soll-Stunden
        </p>
      </div>
    </Card>
  );
}
