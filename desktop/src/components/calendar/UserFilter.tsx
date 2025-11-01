/**
 * User Filter Component
 *
 * Professional calendar filter like Toggl, Clockify, Personio
 * Features:
 * - "Alle Mitarbeiter" option (aggregate view)
 * - Individual user selection
 * - Shows user count
 * - Color-coded badges
 */

import { useMemo } from 'react';
import type { User } from '../../types';

interface UserFilterProps {
  users: User[];
  selectedUserId: number | null; // null = "Alle Mitarbeiter"
  onUserChange: (userId: number | null) => void;
}

export function UserFilter({ users, selectedUserId, onUserChange }: UserFilterProps) {
  const activeUsers = useMemo(() => {
    return users.filter(u => !u.deletedAt);
  }, [users]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Mitarbeiter:
      </label>
      <select
        value={selectedUserId ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          onUserChange(value === '' ? null : Number(value));
        }}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
      >
        <option value="">📊 Alle Mitarbeiter ({activeUsers.length})</option>
        {activeUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.firstName} {user.lastName}
            {user.role === 'admin' ? ' (Admin)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
