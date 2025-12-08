/**
 * DevTool Store (Zustand)
 *
 * Manages state for the comprehensive QA Dev Tool
 * - Test execution state
 * - Test results
 * - Settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestResult {
  id: string;
  name: string;
  category: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  details?: string;
  timestamp?: number;
}

export interface TestCategory {
  id: string;
  name: string;
  description: string;
  testCount: number;
  passed: number;
  failed: number;
  running: number;
}

export interface DevToolSettings {
  enabled: boolean;
  autoRunOnStart: boolean;
  showNotifications: boolean;
  mockMode: boolean; // Use mocks instead of real API calls
  parallelExecution: boolean;
  maxConcurrent: number;
  testTimeout: number; // milliseconds
}

interface DevToolStore {
  // Settings
  settings: DevToolSettings;
  updateSettings: (settings: Partial<DevToolSettings>) => void;

  // Test execution
  isRunning: boolean;
  currentTest: string | null;
  testResults: TestResult[];
  categories: TestCategory[];

  // Actions
  startTests: (categoryId?: string) => void;
  stopTests: () => void;
  clearResults: () => void;
  addTestResult: (result: TestResult) => void;
  updateTestResult: (id: string, updates: Partial<TestResult>) => void;

  // UI State
  isVisible: boolean;
  selectedCategory: string | null;
  setVisible: (visible: boolean) => void;
  setSelectedCategory: (categoryId: string | null) => void;

  // Statistics
  getStatistics: () => {
    total: number;
    passed: number;
    failed: number;
    running: number;
    skipped: number;
    successRate: number;
    averageDuration: number;
  };
}

const defaultSettings: DevToolSettings = {
  enabled: false, // Default: disabled
  autoRunOnStart: false,
  showNotifications: true,
  mockMode: false,
  parallelExecution: false, // Sequential to avoid session conflicts
  maxConcurrent: 5,
  testTimeout: 30000, // 30 seconds
};

const defaultCategories: TestCategory[] = [
  {
    id: 'auth',
    name: 'Authentication & Session',
    description: 'Login, Logout, Session, CORS, Cookies',
    testCount: 15,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'users',
    name: 'User Management',
    description: 'CRUD, Permissions, Validation, GDPR',
    testCount: 25,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'timeEntries',
    name: 'Time Entries',
    description: 'CRUD, Validation, ArbZG, Overlaps',
    testCount: 30,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'absences',
    name: 'Absences & Vacation',
    description: 'Requests, Approval, Vacation Balance',
    testCount: 35,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'overtime',
    name: 'Overtime & Work Time',
    description: 'Calculations, Corrections, Accounts',
    testCount: 40,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'CRUD, Real-time, Desktop Notifications',
    testCount: 20,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'exports',
    name: 'Exports & Reports',
    description: 'DATEV, Historical, GoBD Compliance',
    testCount: 15,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'database',
    name: 'Database & Integrity',
    description: 'Schema, Constraints, Transactions',
    testCount: 25,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'businessLogic',
    name: 'Business Logic',
    description: 'Overtime Calc, Vacation Calc, Holidays',
    testCount: 30,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Auth, CSRF, XSS, SQL Injection, GDPR',
    testCount: 20,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Load Tests, Stress Tests, Memory',
    testCount: 15,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'frontend',
    name: 'Frontend & UI',
    description: 'Components, Hooks, State Management',
    testCount: 30,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'integration',
    name: 'Integration & E2E',
    description: 'Full workflows, Cross-feature tests',
    testCount: 25,
    passed: 0,
    failed: 0,
    running: 0,
  },
  {
    id: 'edgeCases',
    name: 'Edge Cases & Stress',
    description: 'Boundaries, Null checks, Large data',
    testCount: 25,
    passed: 0,
    failed: 0,
    running: 0,
  },
];

export const useDevToolStore = create<DevToolStore>()(
  persist(
    (set, get) => ({
      // Settings
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Test execution
      isRunning: false,
      currentTest: null,
      testResults: [],
      categories: defaultCategories,

      // Actions
      startTests: (_categoryId?: string) => {
        set({ isRunning: true, currentTest: null });
        // Reset category stats
        set((state) => ({
          categories: state.categories.map((cat) => ({
            ...cat,
            passed: 0,
            failed: 0,
            running: 0,
          })),
        }));
      },

      stopTests: () => {
        set({ isRunning: false, currentTest: null });
      },

      clearResults: () => {
        set({ testResults: [] });
        set((state) => ({
          categories: state.categories.map((cat) => ({
            ...cat,
            passed: 0,
            failed: 0,
            running: 0,
          })),
        }));
      },

      addTestResult: (result) => {
        set((state) => ({
          testResults: [...state.testResults, result],
        }));

        // Update category stats
        set((state) => ({
          categories: state.categories.map((cat) =>
            cat.id === result.category
              ? {
                  ...cat,
                  passed: cat.passed + (result.status === 'passed' ? 1 : 0),
                  failed: cat.failed + (result.status === 'failed' ? 1 : 0),
                  running: cat.running + (result.status === 'running' ? 1 : 0),
                }
              : cat
          ),
        }));
      },

      updateTestResult: (id, updates) => {
        set((state) => ({
          testResults: state.testResults.map((result) =>
            result.id === id ? { ...result, ...updates } : result
          ),
        }));

        // Update category stats if status changed
        if (updates.status) {
          const result = get().testResults.find((r) => r.id === id);
          if (result) {
            set((state) => ({
              categories: state.categories.map((cat) =>
                cat.id === result.category
                  ? {
                      ...cat,
                      passed: state.testResults.filter(
                        (r) => r.category === cat.id && r.status === 'passed'
                      ).length,
                      failed: state.testResults.filter(
                        (r) => r.category === cat.id && r.status === 'failed'
                      ).length,
                      running: state.testResults.filter(
                        (r) => r.category === cat.id && r.status === 'running'
                      ).length,
                    }
                  : cat
              ),
            }));
          }
        }
      },

      // UI State
      isVisible: false,
      selectedCategory: null,
      setVisible: (visible) => set({ isVisible: visible }),
      setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),

      // Statistics
      getStatistics: () => {
        const { testResults } = get();
        const total = testResults.length;
        const passed = testResults.filter((r) => r.status === 'passed').length;
        const failed = testResults.filter((r) => r.status === 'failed').length;
        const running = testResults.filter((r) => r.status === 'running').length;
        const skipped = testResults.filter((r) => r.status === 'skipped').length;
        const successRate = total > 0 ? (passed / total) * 100 : 0;
        const durations = testResults
          .filter((r) => r.duration !== undefined)
          .map((r) => r.duration!);
        const averageDuration =
          durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        return {
          total,
          passed,
          failed,
          running,
          skipped,
          successRate,
          averageDuration,
        };
      },
    }),
    {
      name: 'devtool-storage',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
