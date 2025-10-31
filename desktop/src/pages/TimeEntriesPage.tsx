/**
 * Time Entries Management Page
 *
 * Features:
 * - View all time entries (employee: own, admin: all)
 * - Filter by date range, location, month
 * - Sort by date, hours
 * - Edit/Delete entries (with permission check)
 * - Statistics (total hours, average, breakdown)
 * - CSV Export
 */

import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Calendar, Clock, Download, Filter, TrendingUp } from 'lucide-react';
import { useTimeEntries, useDeleteTimeEntry } from '../hooks';
import { formatDateDE, formatHours, calculateTotalHours } from '../utils';
import type { TimeEntry } from '../types';
import { EditTimeEntryModal } from '../components/timeEntries/EditTimeEntryModal';

export function TimeEntriesPage() {
  const { user } = useAuthStore();
  // Admin sees all entries (no userId filter), Employee sees only own entries
  const { data: timeEntries, isLoading } = useTimeEntries(
    user?.role === 'admin' ? undefined : { userId: user?.id || 0 }
  );
  const deleteEntry = useDeleteTimeEntry();

  // Filter States
  const [filterMonth, setFilterMonth] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [searchDate, setSearchDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'hours'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  if (!user) return null;

  // Filter & Sort
  const filteredEntries = useMemo(() => {
    if (!timeEntries) return [];

    let filtered = [...timeEntries];

    // Filter by month
    if (filterMonth) {
      filtered = filtered.filter(entry => entry.date.startsWith(filterMonth));
    }

    // Filter by location
    if (filterLocation !== 'all') {
      filtered = filtered.filter(entry => entry.location === filterLocation);
    }

    // Search by date
    if (searchDate) {
      filtered = filtered.filter(entry => entry.date.includes(searchDate));
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'asc'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      } else {
        const aHours = a.hours || 0;
        const bHours = b.hours || 0;
        return sortOrder === 'asc' ? aHours - bHours : bHours - aHours;
      }
    });

    return filtered;
  }, [timeEntries, filterMonth, filterLocation, searchDate, sortBy, sortOrder]);

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

    const headers = ['Datum', 'Start', 'Ende', 'Pause (Min)', 'Stunden', 'Ort', 'Notiz'];
    const rows = filteredEntries.map(entry => [
      entry.date,
      entry.startTime,
      entry.endTime,
      entry.breakMinutes || 0,
      entry.hours || 0,
      entry.location === 'office' ? 'Büro' : entry.location === 'homeoffice' ? 'Home Office' : 'Außendienst',
      entry.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `zeiteintraege_${filterMonth || 'alle'}.csv`;
    link.click();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Zeiteintrag wirklich löschen?')) return;
    await deleteEntry.mutateAsync(id);
  };

  const toggleSort = (field: 'date' | 'hours') => {
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {user?.role === 'admin' ? 'Zeiteinträge (Alle Mitarbeiter)' : 'Meine Zeiteinträge'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {user?.role === 'admin'
              ? 'Übersicht aller Zeiteinträge aller Mitarbeiter'
              : 'Übersicht aller erfassten Arbeitszeiten'}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Month Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Monat
                </label>
                <Input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                />
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ort
                </label>
                <Select
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

              {/* Date Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Datum suchen
                </label>
                <Input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => {
                    setFilterMonth('');
                    setFilterLocation('all');
                    setSearchDate('');
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filter zurücksetzen
                </Button>
              </div>
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
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => toggleSort('date')}
                      >
                        <div className="flex items-center">
                          Datum
                          {sortBy === 'date' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Zeit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Pause
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => toggleSort('hours')}
                      >
                        <div className="flex items-center">
                          Stunden
                          {sortBy === 'hours' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ort
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Notiz
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatDateDE(entry.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {entry.startTime} - {entry.endTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {entry.breakMinutes || 0} Min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatHours(entry.hours || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            entry.location === 'office'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : entry.location === 'homeoffice'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          }`}>
                            {entry.location === 'office' && 'Büro'}
                            {entry.location === 'homeoffice' && 'Home Office'}
                            {entry.location === 'field' && 'Außendienst'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {entry.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingEntry(entry)}
                            >
                              Bearbeiten
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deleteEntry.isPending}
                            >
                              Löschen
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Keine Zeiteinträge gefunden
                </p>
                {(filterMonth || filterLocation !== 'all' || searchDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setFilterMonth('');
                      setFilterLocation('all');
                      setSearchDate('');
                    }}
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Modal */}
      {editingEntry && (
        <EditTimeEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          entry={editingEntry}
        />
      )}
    </div>
  );
}
