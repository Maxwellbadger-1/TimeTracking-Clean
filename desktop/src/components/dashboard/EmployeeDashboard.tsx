import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Clock, Calendar, Umbrella, TrendingUp, LogOut } from 'lucide-react';
import {
  useTodayTimeEntries,
  useWeekTimeEntries,
  useTotalOvertime,
  useRemainingVacationDays,
} from '../../hooks';
import { calculateTotalHours, formatHours, formatOvertimeHours, formatDateDE } from '../../utils';
import type { TimeEntry } from '../../types';
import { TimeEntryForm } from '../timeEntries/TimeEntryForm';
import { AbsenceRequestForm } from '../absences/AbsenceRequestForm';

export function EmployeeDashboard() {
  const { user, logout } = useAuthStore();
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);

  // Fetch data
  const { data: todayEntries, isLoading: loadingToday } = useTodayTimeEntries(user?.id || 0);
  const { data: weekEntries, isLoading: loadingWeek } = useWeekTimeEntries(user?.id || 0);
  const { totalHours: overtimeHours, isLoading: loadingOvertime } = useTotalOvertime(user?.id || 0);
  const { remaining: vacationDays, isLoading: loadingVacation } = useRemainingVacationDays(user?.id || 0);

  if (!user) return null;

  // Calculate totals
  const todayHours = todayEntries ? calculateTotalHours(todayEntries) : 0;
  const weekHours = weekEntries ? calculateTotalHours(weekEntries) : 0;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Willkommen, {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user.department || 'Keine Abteilung'}
              </p>
            </div>
            <Button variant="ghost" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {vacationDays} Tage
                    </p>
                  )}
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <Umbrella className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overtime */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Überstunden
                  </p>
                  {loadingOvertime ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {formatOvertimeHours(overtimeHours)}
                    </p>
                  )}
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="primary" fullWidth onClick={() => setShowTimeEntryForm(true)}>
                <Clock className="w-4 h-4 mr-2" />
                Zeit erfassen
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setShowAbsenceForm(true)}>
                <Umbrella className="w-4 h-4 mr-2" />
                Urlaub beantragen
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
    </div>
  );
}
