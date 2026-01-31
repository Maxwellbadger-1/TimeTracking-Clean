/**
 * Overtime User Table
 * Sortable table showing all users' overtime data
 */

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { OvertimeReportSummary } from '../../hooks/useOvertimeReports';
import { formatHours, formatOvertimeHours } from '../../utils/timeUtils';

interface User {
  id: number;
  firstName: string;
  lastName: string;
}

interface OvertimeUserTableProps {
  reports: OvertimeReportSummary[];
  users: User[];
  onUserClick?: (userId: number) => void;
}

type SortField = 'name' | 'target' | 'actual' | 'overtime';
type SortDirection = 'asc' | 'desc';

export function OvertimeUserTable({ reports, users, onUserClick }: OvertimeUserTableProps) {
  const [sortField, setSortField] = useState<SortField>('overtime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sorted reports
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case 'name': {
          const userA = users.find((u) => u.id === a.userId);
          const userB = users.find((u) => u.id === b.userId);
          aValue = userA ? `${userA.firstName} ${userA.lastName}` : `User ${a.userId}`;
          bValue = userB ? `${userB.firstName} ${userB.lastName}` : `User ${b.userId}`;
          break;
        }
        case 'target':
          aValue = a.summary.targetHours;
          bValue = b.summary.targetHours;
          break;
        case 'actual':
          aValue = a.summary.actualHours;
          bValue = b.summary.actualHours;
          break;
        case 'overtime':
          aValue = a.summary.overtime;
          bValue = b.summary.overtime;
          break;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [reports, users, sortField, sortDirection]);

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline" />
    ) : (
      <ChevronDown className="w-4 h-4 inline" />
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('name')}
              >
                Mitarbeiter <SortIcon field="name" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('target')}
              >
                Soll <SortIcon field="target" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('actual')}
              >
                Ist <SortIcon field="actual" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('overtime')}
              >
                Überstunden <SortIcon field="overtime" />
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedReports.map((report) => {
              const percentage =
                report.summary.targetHours > 0
                  ? Math.round((report.summary.actualHours / report.summary.targetHours) * 100)
                  : 0;

              return (
                <tr
                  key={report.userId}
                  onClick={() => onUserClick?.(report.userId)}
                  className={`${
                    onUserClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {(() => {
                      const user = users.find((u) => u.id === report.userId);
                      return user ? `${user.firstName} ${user.lastName}` : `User ${report.userId}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                    {formatHours(report.summary.targetHours)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 dark:text-blue-400 font-medium">
                    {formatHours(report.summary.actualHours)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      report.summary.overtime >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatOvertimeHours(report.summary.overtime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                    {percentage}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedReports.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          Keine Daten verfügbar
        </div>
      )}
    </div>
  );
}
