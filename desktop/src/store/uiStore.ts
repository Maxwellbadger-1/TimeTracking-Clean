/**
 * UI State Store (Zustand)
 *
 * Manages UI state like current view, sidebar, modals, etc.
 */

import { create } from 'zustand';

type ViewType = 'dashboard' | 'calendar' | 'users' | 'vacation-balances' | 'overtime' | 'reports' | 'time-entries' | 'absences' | 'backups' | 'settings' | 'notifications' | 'year-end-rollover';

interface CalendarFilters {
  selectedUserIds: number[];  // Empty array = show all users
}

interface UIStore {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  calendarFilters: CalendarFilters;
  setCalendarFilters: (filters: CalendarFilters) => void;
}

export type { ViewType, CalendarFilters };

export const useUIStore = create<UIStore>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  calendarFilters: {
    selectedUserIds: [],  // Default: empty = all users visible
  },
  setCalendarFilters: (filters) => set({ calendarFilters: filters }),
}));
