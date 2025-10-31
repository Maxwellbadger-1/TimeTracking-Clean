/**
 * Absences Management Page
 *
 * Features:
 * - View all absence requests (employee: own, admin: all)
 * - Filter by status, type
 * - Employee: View own requests (pending, approved, rejected)
 * - Admin: Approve/Reject requests
 * - Delete pending requests
 * - Statistics (vacation days, sick days, etc.)
 */

import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Umbrella, CheckCircle, XCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import {
  useAbsenceRequests,
  useApproveAbsenceRequest,
  useRejectAbsenceRequest,
  useDeleteAbsenceRequest,
  useUsers,
} from '../hooks';
import { formatDateDE } from '../utils';

export function AbsencesPage() {
  const { user: currentUser } = useAuthStore();
  const { data: users } = useUsers();

  // Fetch absence requests
  const { data: absenceRequests, isLoading } = useAbsenceRequests(
    currentUser?.role === 'admin' ? undefined : { userId: currentUser?.id || 0 }
  );

  // Mutations
  const approveRequest = useApproveAbsenceRequest();
  const rejectRequest = useRejectAbsenceRequest();
  const deleteRequest = useDeleteAbsenceRequest();

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vacation' | 'sick' | 'overtime_compensation'>('all');
  const [userFilter, setUserFilter] = useState<number | 'all'>('all');

  // Action States
  const [processingId, setProcessingId] = useState<number | null>(null);

  if (!currentUser) return null;

  // Filter
  const filteredRequests = useMemo(() => {
    if (!absenceRequests) return [];

    let filtered = [...absenceRequests];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter);
    }

    // Filter by user (admin only)
    if (currentUser.role === 'admin' && userFilter !== 'all') {
      filtered = filtered.filter(r => r.userId === userFilter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [absenceRequests, statusFilter, typeFilter, userFilter, currentUser.role]);

  // Statistics
  const stats = useMemo(() => {
    if (!absenceRequests) return { total: 0, pending: 0, approved: 0, rejected: 0 };

    // Filter stats by current user if employee
    const relevantRequests = currentUser.role === 'admin'
      ? absenceRequests
      : absenceRequests.filter(r => r.userId === currentUser.id);

    return {
      total: relevantRequests.length,
      pending: relevantRequests.filter(r => r.status === 'pending').length,
      approved: relevantRequests.filter(r => r.status === 'approved').length,
      rejected: relevantRequests.filter(r => r.status === 'rejected').length,
    };
  }, [absenceRequests, currentUser]);

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await approveRequest.mutateAsync({
        id: requestId,
        data: { approvedBy: currentUser.id },
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = prompt('Grund für Ablehnung:');
    if (!reason) return;

    setProcessingId(requestId);
    try {
      await rejectRequest.mutateAsync({
        id: requestId,
        data: { rejectedBy: currentUser.id, reason },
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (requestId: number) => {
    if (!confirm('Antrag wirklich löschen?')) return;

    await deleteRequest.mutateAsync(requestId);
  };

  const getUserName = (userId: number): string => {
    const user = users?.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unbekannt';
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'vacation': return 'Urlaub';
      case 'sick': return 'Krankmeldung';
      case 'overtime_compensation': return 'Überstundenausgleich';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Ausstehend
          </span>
        );
      case 'approved':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 flex items-center">
            <CheckCircle className="w-3 h-3 mr-1" />
            Genehmigt
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 flex items-center">
            <XCircle className="w-3 h-3 mr-1" />
            Abgelehnt
          </span>
        );
      default:
        return status;
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setUserFilter('all');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {currentUser.role === 'admin' ? 'Abwesenheiten (Alle Mitarbeiter)' : 'Meine Abwesenheiten'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {currentUser.role === 'admin'
              ? 'Übersicht aller Abwesenheitsanträge'
              : 'Übersicht aller eigenen Urlaubs- und Krankmeldungen'}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Gesamt
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.total}
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Umbrella className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Ausstehend
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.pending}
                  </p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Genehmigt
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.approved}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Abgelehnt
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.rejected}
                  </p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'Alle Status' },
                  { value: 'pending', label: 'Nur Ausstehend' },
                  { value: 'approved', label: 'Nur Genehmigt' },
                  { value: 'rejected', label: 'Nur Abgelehnt' },
                ]}
              />

              {/* Type Filter */}
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                options={[
                  { value: 'all', label: 'Alle Arten' },
                  { value: 'vacation', label: 'Nur Urlaub' },
                  { value: 'sick', label: 'Nur Krankheit' },
                  { value: 'overtime_compensation', label: 'Nur Überstundenausgleich' },
                ]}
              />

              {/* User Filter (Admin only) */}
              {currentUser.role === 'admin' && (
                <Select
                  value={String(userFilter)}
                  onChange={(e) => setUserFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  options={[
                    { value: 'all', label: 'Alle Mitarbeiter' },
                    ...(users?.map(u => ({ value: String(u.id), label: `${u.firstName} ${u.lastName}` })) || []),
                  ]}
                />
              )}
            </div>

            {(statusFilter !== 'all' || typeFilter !== 'all' || userFilter !== 'all') && (
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Filter zurücksetzen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Abwesenheitsanträge ({filteredRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredRequests.length > 0 ? (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {currentUser.role === 'admin' && (
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {getUserName(request.userId)}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.type === 'vacation'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : request.type === 'sick'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          }`}>
                            {getTypeLabel(request.type)}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>

                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>{formatDateDE(request.startDate)}</strong> bis{' '}
                          <strong>{formatDateDE(request.endDate)}</strong>
                          <span className="text-gray-500 dark:text-gray-400 ml-2">
                            ({request.daysRequired} Tage)
                          </span>
                        </div>

                        {request.reason && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 italic mt-2">
                            "{request.reason}"
                          </div>
                        )}

                        {request.status === 'rejected' && request.adminNote && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                            <p className="text-sm text-red-800 dark:text-red-200 flex items-center">
                              <AlertCircle className="w-4 h-4 mr-1" />
                              <strong>Ablehnungsgrund:</strong> {request.adminNote}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2 ml-4">
                        {currentUser.role === 'admin' && request.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                            >
                              {processingId === request.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                'Genehmigen'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleReject(request.id)}
                              disabled={processingId === request.id}
                            >
                              Ablehnen
                            </Button>
                          </>
                        )}

                        {currentUser.role === 'employee' && request.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(request.id)}
                            disabled={deleteRequest.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Löschen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Umbrella className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Keine Abwesenheitsanträge gefunden
                </p>
                {(statusFilter !== 'all' || typeFilter !== 'all' || userFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={clearFilters}
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
