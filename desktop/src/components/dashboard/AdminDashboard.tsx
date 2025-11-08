import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Users, Clock, Umbrella, FileText, CheckCircle, User, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  useActiveEmployees,
  usePendingAbsenceRequests,
  useApproveAbsenceRequest,
  useRejectAbsenceRequest,
  useTodayTimeEntries,
  useAllUsersOvertime,
} from '../../hooks';
import { formatDateDE, calculateTotalHours, formatHours, formatOvertimeHours } from '../../utils';
import type { AbsenceRequest, User as UserType, TimeEntry } from '../../types';
import { useState } from 'react';

export function AdminDashboard() {
  const { user } = useAuthStore();
  const { setCurrentView } = useUIStore();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Fetch data
  const { data: employees, isLoading: loadingEmployees } = useActiveEmployees();
  const { data: pendingRequests, isLoading: loadingRequests } = usePendingAbsenceRequests();
  const { data: todayEntries } = useTodayTimeEntries(0); // All entries for today
  const { data: overtimeData, isLoading: loadingOvertime } = useAllUsersOvertime();

  // Mutations
  const approveRequest = useApproveAbsenceRequest();
  const rejectRequest = useRejectAbsenceRequest();

  if (!user) return null;

  // Calculate stats
  const employeeCount = employees?.length || 0;
  const pendingCount = pendingRequests?.length || 0;

  // Get employees working today (have time entries today)
  const workingToday = todayEntries?.reduce((acc: number[], entry: TimeEntry) => {
    if (!acc.includes(entry.userId)) acc.push(entry.userId);
    return acc;
  }, [] as number[]).length || 0;

  // Calculate total hours this month
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyHours = todayEntries
    ? calculateTotalHours(todayEntries.filter((e: TimeEntry) => e.date.startsWith(currentMonth)))
    : 0;

  const handleApprove = async (requestId: number) => {
    setApprovingId(requestId);
    try {
      await approveRequest.mutateAsync({
        id: requestId,
        data: { approvedBy: user.id },
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = prompt('Grund für Ablehnung:');
    if (!reason) return;

    setApprovingId(requestId);
    try {
      await rejectRequest.mutateAsync({
        id: requestId,
        data: { rejectedBy: user.id, reason },
      });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {user.firstName} {user.lastName} - Administrator
          </p>
        </div>
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Mitarbeiter
                  </p>
                  {loadingEmployees ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {employeeCount}
                    </p>
                  )}
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Currently Working */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Heute im Dienst
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {workingToday}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Requests */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Offene Anträge
                  </p>
                  {loadingRequests ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {pendingCount}
                    </p>
                  )}
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <Umbrella className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Hours */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Stunden (Monat)
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {formatHours(monthlyHours)}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="primary" fullWidth onClick={() => setCurrentView('users')}>
                <Users className="w-4 h-4 mr-2" />
                Mitarbeiter verwalten
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setCurrentView('absences')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Anträge genehmigen
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setCurrentView('reports')}>
                <FileText className="w-4 h-4 mr-2" />
                Berichte erstellen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Absence Requests */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Offene Urlaubsanträge ({pendingCount})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : pendingRequests && pendingRequests.length > 0 ? (
              <div className="space-y-4">
                {pendingRequests.map((request: AbsenceRequest) => {
                  const employee = employees?.find((e: UserType) => e.id === request.userId);
                  return (
                    <div
                      key={request.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded">
                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {employee?.firstName} {employee?.lastName}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {request.type === 'vacation' && 'Urlaub'}
                              {request.type === 'sick' && 'Krankmeldung'}
                              {request.type === 'unpaid' && 'Unbezahlter Urlaub'}
                              {request.type === 'overtime_comp' && 'Überstundenausgleich'}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {formatDateDE(request.startDate)} - {formatDateDE(request.endDate)}
                              <span className="text-gray-500 dark:text-gray-400 ml-2">
                                ({request.daysRequired} Tage)
                              </span>
                            </p>
                            {request.reason && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
                                "{request.reason}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApprove(request.id)}
                            disabled={approvingId === request.id}
                          >
                            {approvingId === request.id ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              'Genehmigen'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleReject(request.id)}
                            disabled={approvingId === request.id}
                          >
                            Ablehnen
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Keine offenen Anträge</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overtime Overview */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Überstunden-Übersicht (Aktueller Stand)</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView('overtime')}
              >
                Alle anzeigen →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingOvertime ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : overtimeData && overtimeData.length > 0 ? (
              <div className="space-y-3">
                {/* Show Top 5 by absolute overtime value */}
                {[...overtimeData]
                  .sort((a, b) => Math.abs(b.totalOvertime) - Math.abs(a.totalOvertime))
                  .slice(0, 5)
                  .map((overtime) => {
                    const isCritical = Math.abs(overtime.totalOvertime) > 40;
                    const isPositive = overtime.totalOvertime > 0;

                    return (
                      <div
                        key={overtime.userId}
                        className={`p-3 rounded-lg ${
                          isCritical
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            : 'bg-gray-50 dark:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded ${
                              isCritical
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : isPositive
                                ? 'bg-green-100 dark:bg-green-900/20'
                                : 'bg-orange-100 dark:bg-orange-900/20'
                            }`}>
                              {isCritical ? (
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                              ) : (
                                <TrendingUp className={`w-5 h-5 ${
                                  isPositive
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-orange-600 dark:text-orange-400'
                                }`} />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-gray-100">
                                {overtime.firstName} {overtime.lastName}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {overtime.email}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${
                              isPositive
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatOvertimeHours(overtime.totalOvertime)}
                            </p>
                            {isCritical && (
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                Kritisch
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Keine Überstunden-Daten verfügbar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Team-Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEmployees ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : employees && employees.length > 0 ? (
              <div className="space-y-3">
                {employees.map((employee: UserType) => {
                  const isWorkingToday = todayEntries?.some((e: TimeEntry) => e.userId === employee.id);
                  return (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded ${
                          isWorkingToday
                            ? 'bg-green-100 dark:bg-green-900/20'
                            : 'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          <User className={`w-5 h-5 ${
                            isWorkingToday
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {employee.department || 'Keine Abteilung'} • {employee.position || 'Keine Position'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          isWorkingToday
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {isWorkingToday ? 'Im Dienst' : 'Nicht im Dienst'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatHours(employee.weeklyHours)}/Woche
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Noch keine Mitarbeiter vorhanden</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
