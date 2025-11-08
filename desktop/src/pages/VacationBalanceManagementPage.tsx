import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  useVacationBalanceSummary,
  useBulkInitializeVacationBalances,
  type VacationBalanceSummary,
} from '../hooks';
import { VacationBalanceEditModal } from '../components/vacation/VacationBalanceEditModal';
import { BulkInitializeModal } from '../components/vacation/BulkInitializeModal';

export default function VacationBalanceManagementPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [editingBalance, setEditingBalance] = useState<VacationBalanceSummary | null>(null);
  const [showBulkInitModal, setShowBulkInitModal] = useState(false);

  // Fetch vacation balance summary
  const { data: summary, isLoading, error } = useVacationBalanceSummary(selectedYear);

  // Bulk initialize mutation
  const bulkInitialize = useBulkInitializeVacationBalances();

  const handleBulkInitialize = async (year: number) => {
    await bulkInitialize.mutateAsync(year);
    setShowBulkInitModal(false);
  };

  // Calculate statistics
  const stats = {
    totalEmployees: summary?.length || 0,
    withBalance: summary?.filter(s => s.hasBalance).length || 0,
    withoutBalance: summary?.filter(s => !s.hasBalance).length || 0,
    totalEntitlement: summary?.reduce((sum, s) => sum + s.entitlement, 0) || 0,
    totalTaken: summary?.reduce((sum, s) => sum + s.taken, 0) || 0,
    totalRemaining: summary?.reduce((sum, s) => sum + s.remaining, 0) || 0,
  };

  // Generate year options (current year ± 2 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Urlaubskonto-Verwaltung
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Verwalten Sie Urlaubstage für alle Mitarbeiter
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

              {/* Bulk Initialize Button */}
              <Button
                variant="secondary"
                onClick={() => setShowBulkInitModal(true)}
              >
                Masseninitialisierung
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <StatCard
              title="Gesamt Mitarbeiter"
              value={stats.totalEmployees}
              color="blue"
            />
            <StatCard
              title="Mit Urlaubskonto"
              value={stats.withBalance}
              color="green"
            />
            <StatCard
              title="Ohne Urlaubskonto"
              value={stats.withoutBalance}
              color="orange"
              highlight={stats.withoutBalance > 0}
            />
            <StatCard
              title="Gesamt Verbleibend"
              value={`${stats.totalRemaining} Tage`}
              color="purple"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-800 dark:text-red-200">
              Fehler beim Laden der Urlaubskonten: {error instanceof Error ? error.message : 'Unbekannter Fehler'}
            </p>
          </div>
        ) : !summary || summary.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Keine Mitarbeiter gefunden
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Es wurden keine Mitarbeiter gefunden.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Anspruch
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Übertrag
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Genommen
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Verbleibend
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {summary.map((balance) => (
                  <tr
                    key={balance.userId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {balance.firstName} {balance.lastName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {balance.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                      {balance.entitlement || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                      {balance.carryover || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                      {balance.taken || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`text-sm font-semibold ${
                          balance.remaining > 10
                            ? 'text-green-600 dark:text-green-400'
                            : balance.remaining > 5
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {balance.remaining || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {balance.hasBalance ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                          Aktiv
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full">
                          Nicht initialisiert
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingBalance(balance)}
                      >
                        {balance.hasBalance ? 'Bearbeiten' : 'Initialisieren'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingBalance && (
        <VacationBalanceEditModal
          isOpen={!!editingBalance}
          onClose={() => setEditingBalance(null)}
          balance={editingBalance}
          year={selectedYear}
        />
      )}

      {/* Bulk Initialize Modal */}
      <BulkInitializeModal
        isOpen={showBulkInitModal}
        onClose={() => setShowBulkInitModal(false)}
        onConfirm={handleBulkInitialize}
        currentYear={currentYear}
      />
    </div>
  );
}

/**
 * Statistics Card Component
 */
interface StatCardProps {
  title: string;
  value: string | number;
  color: 'blue' | 'green' | 'orange' | 'purple';
  highlight?: boolean;
}

function StatCard({ title, value, color, highlight }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  };

  return (
    <div
      className={`p-6 rounded-lg ${colorClasses[color]} ${
        highlight ? 'ring-2 ring-orange-500' : ''
      }`}
    >
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
