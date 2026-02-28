/**
 * Time Entries Management Page
 *
 * Features:
 * - View all time entries (employee: own, admin: all)
 * - Filter by date range (with presets), employee, location
 * - Sort by date, hours, employee
 * - Edit/Delete entries (with permission check)
 * - Statistics (total hours, average, breakdown)
 * - CSV Export with employee info
 * - Employee column in table (admin only)
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Calendar, Clock, Download, TrendingUp } from 'lucide-react';
import { useDeleteTimeEntry, useUsers } from '../hooks';
import { useInfiniteTimeEntries } from '../hooks/useInfiniteTimeEntries';
import InfiniteScroll from 'react-infinite-scroll-component';
import { formatDateDE, formatHours, calculateTotalHours } from '../utils';
import type { TimeEntry } from '../types';
import { EditTimeEntryModal } from '../components/timeEntries/EditTimeEntryModal';
import { TimeEntryForm } from '../components/timeEntries/TimeEntryForm';

// Date range presets
type DateRangePreset = 'all-time' | 'today' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'this-year' | 'custom';

export function TimeEntriesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Filter States (moved up for use in infinite query)
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');

  // Local state for immediate UI updates (user typing)
  const [customStartDateInput, setCustomStartDateInput] = useState('');
  const [customEndDateInput, setCustomEndDateInput] = useState('');

  // Debounced state for API requests (only update after user stops typing)
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [filterEmployee, setFilterEmployee] = useState<number | 'all'>('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'hours' | 'employee'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounce custom date inputs (wait 500ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomStartDate(customStartDateInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [customStartDateInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomEndDate(customEndDateInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [customEndDateInput]);

  // Fetch users for employee filter (admin only)
  const { data: users } = useUsers(isAdmin);

  // Calculate date range based on preset (moved up for use in infinite query)
  const getDateRange = (): { start: string; end: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Helper: Format Date to YYYY-MM-DD (timezone-safe, no UTC conversion!)
    const formatDateLocal = (date: Date): string => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    switch (dateRangePreset) {
      case 'all-time':
        return {
          start: '',
          end: '',
        };

      case 'today': {
        const dateStr = formatDateLocal(today);
        return {
          start: dateStr,
          end: dateStr,
        };
      }

      case 'this-week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          start: formatDateLocal(monday),
          end: formatDateLocal(sunday),
        };
      }

      case 'last-week': {
        const dayOfWeek = today.getDay();
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return {
          start: formatDateLocal(lastMonday),
          end: formatDateLocal(lastSunday),
        };
      }

      case 'this-month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          start: formatDateLocal(firstDay),
          end: formatDateLocal(lastDay),
        };
      }

      case 'last-month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: formatDateLocal(firstDay),
          end: formatDateLocal(lastDay),
        };
      }

      case 'this-year': {
        const firstDay = new Date(today.getFullYear(), 0, 1);
        const lastDay = new Date(today.getFullYear(), 11, 31);
        return {
          start: formatDateLocal(firstDay),
          end: formatDateLocal(lastDay),
        };
      }

      case 'custom':
        return {
          start: customStartDate || '',
          end: customEndDate || '',
        };

      default:
        return { start: '', end: '' };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Determine userId for API filter (backend filtering!)
  // - Employee: always their own ID
  // - Admin with employee filter: selected employee ID
  // - Admin without filter: undefined (load all)
  const apiUserId = user?.role === 'admin'
    ? (filterEmployee !== 'all' ? filterEmployee : undefined)
    : (user?.id || 0);

  // Use infinite scroll pagination with date range filter
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
  } = useInfiniteTimeEntries({
    userId: apiUserId,
    startDate,
    endDate,
  });

  // Flatten all pages into single array
  const timeEntries = useMemo(() => {
    const entries = data?.pages.flatMap((page) => page.rows) || [];
    return entries;
  }, [data, hasNextPage]);

  const deleteEntry = useDeleteTimeEntry();

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  // Delete Confirmation State
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  if (!user) return null;

  // Filter & Sort (date range and employee already applied server-side in query)
  const filteredEntries = useMemo(() => {
    if (!timeEntries) return [];

    let filtered = [...timeEntries];

    // Filter by location (client-side - only a few options)
    if (filterLocation !== 'all') {
      filtered = filtered.filter(entry => entry.location === filterLocation);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'asc'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      } else if (sortBy === 'hours') {
        const aHours = a.hours || 0;
        const bHours = b.hours || 0;
        return sortOrder === 'asc' ? aHours - bHours : bHours - aHours;
      } else if (sortBy === 'employee') {
        const aName = `${a.firstName || ''} ${a.lastName || ''}`;
        const bName = `${b.firstName || ''} ${b.lastName || ''}`;
        return sortOrder === 'asc'
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }
      return 0;
    });

    return filtered;
  }, [timeEntries, filterEmployee, filterLocation, sortBy, sortOrder, user?.role]);

  // Statistics
  const stats = useMemo(() => {
    const total = calculateTotalHours(filteredEntries);
    const count = filteredEntries.length;
    const average = count > 0 ? total / count : 0;

    const byLocation = {
      office: calculateTotalHours(filteredEntries.filter(e => e.location === 'office')),
      homeoffice: calculateTotalHours(filteredEntries.filter(e => e.location === 'homeoffice')),
      field: calculateTotalHours(filteredEntries.filter(e => e.location === 'field')),
    };

    return { total, count, average, byLocation };
  }, [filteredEntries]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredEntries.length) return;

    const headers = user?.role === 'admin'
      ? ['Datum', 'Mitarbeiter', 'Start', 'Ende', 'Pause (Min)', 'Stunden', 'Ort', 'Notiz']
      : ['Datum', 'Start', 'Ende', 'Pause (Min)', 'Stunden', 'Ort', 'Notiz'];

    const rows = filteredEntries.map(entry => {
      const baseRow = [
        entry.date,
        ...(user?.role === 'admin' ? [`${entry.firstName || ''} ${entry.lastName || ''}`] : []),
        entry.startTime,
        entry.endTime,
        entry.breakMinutes || 0,
        entry.hours || 0,
        entry.location === 'office' ? 'Büro' : entry.location === 'homeoffice' ? 'Home Office' : 'Außendienst',
        entry.notes || '',
      ];
      return baseRow;
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `zeiteintraege_${dateRangePreset}.csv`;
    link.click();
  };

  const handleDeleteClick = (id: number) => {
    setDeletingEntryId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntryId) return;

    try {
      await deleteEntry.mutateAsync(deletingEntryId);
      setDeletingEntryId(null);
    } catch (error) {
      console.error('❌ DELETE ERROR:', error);
      setDeletingEntryId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeletingEntryId(null);
  };

  const toggleSort = (field: 'date' | 'hours' | 'employee') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {user?.role === 'admin' ? 'Zeiteinträge (Alle Mitarbeiter)' : 'Meine Zeiteinträge'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {user?.role === 'admin'
                ? 'Übersicht aller Zeiteinträge aller Mitarbeiter'
                : 'Übersicht aller erfassten Arbeitszeiten'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setCreateModalOpen(true)}
          >
            + Zeit erfassen
          </Button>
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
                    {formatHours(stats.total)}
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Einträge
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.count}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Durchschnitt
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {formatHours(stats.average)}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Nach Ort
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Büro:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(stats.byLocation.office)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Home:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(stats.byLocation.homeoffice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Außendienst:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(stats.byLocation.field)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Filter & Export</CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                disabled={!filteredEntries.length}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range Preset */}
              <Select
                label="Zeitraum"
                value={dateRangePreset}
                onChange={(e) => setDateRangePreset(e.target.value as DateRangePreset)}
                options={[
                  { value: 'all-time', label: 'Alle Zeit' },
                  { value: 'today', label: 'Heute' },
                  { value: 'this-week', label: 'Diese Woche' },
                  { value: 'last-week', label: 'Letzte Woche' },
                  { value: 'this-month', label: 'Dieser Monat' },
                  { value: 'last-month', label: 'Letzter Monat' },
                  { value: 'this-year', label: 'Dieses Jahr' },
                  { value: 'custom', label: 'Benutzerdefiniert' },
                ]}
              />

              {/* Custom Date Range (shown when preset is 'custom') */}
              {dateRangePreset === 'custom' && (
                <>
                  <Input
                    type="date"
                    label="Von"
                    value={customStartDateInput}
                    onChange={(e) => setCustomStartDateInput(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="Bis"
                    value={customEndDateInput}
                    onChange={(e) => setCustomEndDateInput(e.target.value)}
                  />
                </>
              )}

              {/* Employee Filter (admin only) */}
              {user?.role === 'admin' && (
                <Select
                  label="Mitarbeiter"
                  value={filterEmployee === 'all' ? 'all' : String(filterEmployee)}
                  onChange={(e) => setFilterEmployee(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  options={[
                    { value: 'all', label: 'Alle Mitarbeiter' },
                    ...(users?.map((u) => ({
                      value: String(u.id),
                      label: `${u.firstName} ${u.lastName}`,
                    })) || []),
                  ]}
                />
              )}

              {/* Location Filter */}
              <Select
                label="Arbeitsort"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                options={[
                  { value: 'all', label: 'Alle Orte' },
                  { value: 'office', label: 'Büro' },
                  { value: 'homeoffice', label: 'Home Office' },
                  { value: 'field', label: 'Außendienst' },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Zeiteinträge ({filteredEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Keine Zeiteinträge gefunden.
                </p>
              </div>
            ) : (
              <InfiniteScroll
                dataLength={filteredEntries.length}
                next={fetchNextPage}
                hasMore={hasNextPage || false}
                loader={
                  <div className="flex justify-center py-4">
                    <LoadingSpinner />
                  </div>
                }
                endMessage={
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    Alle Einträge geladen ({filteredEntries.length} gesamt)
                  </p>
                }
                scrollableTarget="scrollableDiv"
              >
                <div id="scrollableDiv" className="overflow-x-auto" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                          onClick={() => toggleSort('date')}
                        >
                          Datum {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        {user?.role === 'admin' && (
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                            onClick={() => toggleSort('employee')}
                          >
                            Mitarbeiter {sortBy === 'employee' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Zeit
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                          onClick={() => toggleSort('hours')}
                        >
                          Stunden {sortBy === 'hours' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ort
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Notiz
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDateDE(entry.date)}
                        </td>
                        {user?.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3">
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                  {entry.userInitials || entry.firstName?.[0] || '?'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{entry.firstName} {entry.lastName}</div>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {entry.startTime} - {entry.endTime}
                          {entry.breakMinutes > 0 && (
                            <span className="text-gray-500 dark:text-gray-400 ml-2">
                              ({entry.breakMinutes} Min. Pause)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatHours(entry.hours || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              entry.location === 'office'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                : entry.location === 'homeoffice'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                            }`}
                          >
                            {entry.location === 'office'
                              ? 'Büro'
                              : entry.location === 'homeoffice'
                              ? 'Home Office'
                              : 'Außendienst'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {entry.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          {(user?.role === 'admin' || entry.userId === user?.id) && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingEntry(entry)}
                              >
                                Bearbeiten
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(entry.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                              >
                                Löschen
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InfiniteScroll>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create Modal */}
      <TimeEntryForm
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Edit Modal */}
      {editingEntry && (
        <EditTimeEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          entry={editingEntry}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntryId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Zeiteintrag löschen?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Möchten Sie diesen Zeiteintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={handleDeleteCancel}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
