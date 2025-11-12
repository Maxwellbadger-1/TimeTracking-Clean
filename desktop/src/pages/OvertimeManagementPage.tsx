import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useAllUsersOvertime } from '../hooks';
import { formatHours } from '../utils';

export default function OvertimeManagementPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [sortBy, setSortBy] = useState<'name' | 'overtime'>('overtime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCritical, setFilterCritical] = useState(false);

  // Fetch overtime data
  const { data: overtimeData, isLoading, error } = useAllUsersOvertime(selectedYear);

  // Filter & Sort
  const filteredData = useMemo(() => {
    if (!overtimeData) return [];

    let filtered = [...overtimeData];

    // Filter critical (>40h or <-40h)
    if (filterCritical) {
      filtered = filtered.filter(e => Math.abs(e.totalOvertime) > 40);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`;
        const nameB = `${b.firstName} ${b.lastName}`;
        return sortOrder === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      } else {
        return sortOrder === 'asc'
          ? a.totalOvertime - b.totalOvertime
          : b.totalOvertime - a.totalOvertime;
      }
    });

    return filtered;
  }, [overtimeData, filterCritical, sortBy, sortOrder]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!overtimeData) return { total: 0, positive: 0, negative: 0, critical: 0, average: 0 };

    const total = overtimeData.reduce((sum, e) => sum + e.totalOvertime, 0);
    const positive = overtimeData.filter(e => e.totalOvertime > 0).length;
    const negative = overtimeData.filter(e => e.totalOvertime < 0).length;
    const critical = overtimeData.filter(e => Math.abs(e.totalOvertime) > 40).length;
    const average = overtimeData.length > 0 ? total / overtimeData.length : 0;

    return { total, positive, negative, critical, average };
  }, [overtimeData]);

  const toggleSort = (field: 'name' | 'overtime') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'overtime' ? 'desc' : 'asc');
    }
  };

  // Generate year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Überstunden-Verwaltung
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {selectedYear === currentYear
                  ? `Aktueller Stand (bis heute, ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })})`
                  : `Jahresübersicht ${selectedYear}`
                }
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Year Selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
            <StatCard
              title="Gesamt Überstunden"
              value={formatHours(stats.total)}
              icon={<Clock className="w-5 h-5" />}
              color={stats.total >= 0 ? 'green' : 'red'}
            />
            <StatCard
              title="Durchschnitt"
              value={formatHours(stats.average)}
              icon={<TrendingUp className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              title="Positiv"
              value={stats.positive}
              subtitle="Mitarbeiter"
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
            />
            <StatCard
              title="Negativ"
              value={stats.negative}
              subtitle="Mitarbeiter"
              icon={<TrendingDown className="w-5 h-5" />}
              color="orange"
            />
            <StatCard
              title="Kritisch"
              value={stats.critical}
              subtitle=">40h oder <-40h"
              icon={<AlertTriangle className="w-5 h-5" />}
              color="red"
              highlight={stats.critical > 0}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterCritical}
                    onChange={(e) => setFilterCritical(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Nur kritische Werte anzeigen (&gt;40h oder &lt;-40h)
                  </span>
                </label>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {filteredData.length} von {overtimeData?.length || 0} Mitarbeitern
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Überstunden ({filteredData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <p className="text-red-800 dark:text-red-200">
                  Fehler beim Laden der Überstunden: {error instanceof Error ? error.message : 'Unbekannter Fehler'}
                </p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {filterCritical
                    ? 'Keine kritischen Überstunden gefunden.'
                    : 'Keine Überstunden-Daten verfügbar.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                        onClick={() => toggleSort('name')}
                      >
                        Mitarbeiter {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        E-Mail
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                        onClick={() => toggleSort('overtime')}
                      >
                        Überstunden {sortBy === 'overtime' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredData.map((employee) => {
                      const isCritical = Math.abs(employee.totalOvertime) > 40;
                      const isPositive = employee.totalOvertime > 0;

                      return (
                        <tr
                          key={employee.userId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                  {employee.firstName[0]}{employee.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {employee.firstName} {employee.lastName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {employee.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span
                              className={`text-sm font-bold ${
                                isPositive
                                  ? 'text-green-600 dark:text-green-400'
                                  : employee.totalOvertime < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {formatHours(employee.totalOvertime)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {isCritical && (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full inline-flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Kritisch
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Statistics Card Component
 */
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  highlight?: boolean;
}

function StatCard({ title, value, subtitle, icon, color, highlight }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  };

  return (
    <div
      className={`p-4 rounded-lg ${colorClasses[color]} ${
        highlight ? 'ring-2 ring-red-500 animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium opacity-80 uppercase">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
    </div>
  );
}
