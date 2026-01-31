/**
 * Calendar Filters Component
 *
 * Multi-select dropdown for filtering calendar views by employees.
 * Admin-only feature. Default: All employees selected.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import type { User } from '../../types';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface CalendarFiltersProps {
  users: User[];
}

export function CalendarFilters({ users }: CalendarFiltersProps) {
  const { calendarFilters, setCalendarFilters } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sort users by lastName, firstName
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [users]);

  // Calculate selection state
  const selectedIds = calendarFilters.selectedUserIds;
  const selectedCount = selectedIds.length === 1 && selectedIds[0] === -1 ? 0 : selectedIds.length;
  const totalCount = users.length;
  const allSelected = (selectedIds.length === 0 || selectedCount === totalCount) && !(selectedIds.length === 1 && selectedIds[0] === -1);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Toggle all selection
  const handleToggleAll = () => {
    if (allSelected) {
      // Deselect all → Show NONE (use sentinel value -1)
      setCalendarFilters({ selectedUserIds: [-1] });
    } else {
      // Select all → Show ALL (empty array)
      setCalendarFilters({ selectedUserIds: [] });
    }
  };

  // Toggle individual user
  const handleToggleUser = (userId: number) => {
    const currentIds = calendarFilters.selectedUserIds;

    // If "none selected" (sentinel value -1), start fresh with just this user
    if (currentIds.length === 1 && currentIds[0] === -1) {
      setCalendarFilters({ selectedUserIds: [userId] });
      return;
    }

    // If currently showing all (empty array), start with all IDs
    if (currentIds.length === 0) {
      // Remove the clicked user from selection
      const allIds = users.map(u => u.id);
      setCalendarFilters({
        selectedUserIds: allIds.filter(id => id !== userId)
      });
      return;
    }

    // Otherwise toggle the user
    if (currentIds.includes(userId)) {
      const newIds = currentIds.filter(id => id !== userId);
      setCalendarFilters({ selectedUserIds: newIds });
    } else {
      // Remove sentinel value if present and add the real user
      const filteredIds = currentIds.filter(id => id !== -1);
      setCalendarFilters({
        selectedUserIds: [...filteredIds, userId]
      });
    }
  };

  // Check if user is selected
  const isUserSelected = (userId: number) => {
    const ids = calendarFilters.selectedUserIds;

    // If "none selected" (sentinel value -1), no users are selected
    if (ids.length === 1 && ids[0] === -1) {
      return false;
    }

    // If showing all (empty array), all users are selected
    if (ids.length === 0) {
      return true;
    }

    return ids.includes(userId);
  };

  // Display text for button
  const displayText = useMemo(() => {
    if (allSelected) {
      return `Alle Mitarbeiter (${totalCount})`;
    }
    if (selectedCount === 0) {
      return `Keine Mitarbeiter ausgewählt`;
    }
    return `${selectedCount} von ${totalCount} Mitarbeitern`;
  }, [allSelected, selectedCount, totalCount]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {displayText}
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {/* Header with Toggle All */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Alle auswählen
              </span>
            </label>
          </div>

          {/* User List */}
          <div className="max-h-96 overflow-y-auto p-2">
            {sortedUsers.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isUserSelected(user.id)}
                  onChange={() => handleToggleUser(user.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.lastName}, {user.firstName}
                  </div>
                  {user.department && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.department}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
