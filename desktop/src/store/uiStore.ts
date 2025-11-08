/**
 * UI State Store (Zustand)
 *
 * Manages UI state like current view, sidebar, modals, etc.
 */

import { create } from 'zustand';

type ViewType = 'dashboard' | 'calendar' | 'users' | 'vacation-balances' | 'overtime' | 'reports' | 'time-entries' | 'absences' | 'backups' | 'settings';

interface UIStore {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

export type { ViewType };

export const useUIStore = create<UIStore>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
}));
