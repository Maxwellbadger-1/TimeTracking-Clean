/**
 * Custom hook for overtime reports
 * ✅ MIGRATED to Single Source of Truth: /api/overtime/balance/*
 *
 * NEW ENDPOINTS (Direct DB read, no recalculation):
 * - /api/overtime/balance/:userId/:month (monthly)
 * - /api/overtime/balance/:userId/year/:year (yearly)
 *
 * OLD ENDPOINTS (deprecated, kept for backward compatibility):
 * - /api/reports/overtime/user/:userId (uses hybrid approach)
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// API Response Types for new balance endpoints
interface MonthlyBalanceResponse {
  userId: number;
  month: string;
  summary: {
    targetHours: number;
    actualHours: number;
    overtime: number;
  };
  breakdown?: {
    daily: Array<{ date: string; target: number; actual: number; overtime: number }>;
  };
  carryoverFromPreviousYear: number;
}

interface YearlyBalanceResponse {
  userId: number;
  year: number;
  monthsIncluded: number;
  targetHours: number;
  actualHours: number;
  overtime: number;
  carryoverFromPreviousYear: number;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface OvertimeReportSummary {
  userId: number;
  year: number;
  month?: number;
  summary: {
    targetHours: number;
    actualHours: number;
    overtime: number;
  };
  // breakdown is now optional (monthly endpoint returns only daily, yearly returns nothing)
  breakdown?: {
    daily?: Array<{ date: string; target: number; actual: number; overtime: number }>;
    weekly?: Array<{ week: string; target: number; actual: number; overtime: number }>;
    monthly?: Array<{ month: string; target: number; actual: number; overtime: number }>;
  };
}

export interface OvertimeHistoryEntry {
  month: string;           // "2025-11"
  earned: number;          // Überstunden verdient (Soll/Ist Differenz)
  compensation: number;    // Überstunden genommen (Urlaub/Ausgleich)
  correction: number;      // Admin-Korrekturen
  carryover: number;       // Jahresübertrag (nur Januar)
  balance: number;         // Saldo am Monatsende
  balanceChange: number;   // Änderung vs. Vormonat
}

export interface OvertimeYearBreakdown {
  userId: number;
  currentYear: number;
  totalBalance: number;                    // Gesamtsaldo
  carryoverFromPreviousYear: number;       // Übertrag aus Vorjahr
  earnedThisYear: number;                  // Im aktuellen Jahr verdient
  currentMonth: {
    month: string;                         // "2026-01"
    earned: number;                        // Überstunden im aktuellen Monat
    targetHours: number;                   // Soll-Stunden
    actualHours: number;                   // Ist-Stunden
  };
}

/**
 * Fetch overtime report for a user
 *
 * ⚠️ USES DEPRECATED ENDPOINT for breakdown.daily (needed for daily charts)
 * 🔄 TODO: Create new endpoint /api/overtime/balance/:userId/:month/daily
 *
 * When month is specified: Uses deprecated /api/reports/overtime/user/:userId WITH breakdown
 * When year only: Uses new /api/overtime/balance/:userId/year/:year (fast, no breakdown)
 */
export function useOvertimeReport(userId: number, year: number, month?: number, enabledOverride?: boolean) {
  return useQuery({
    queryKey: ['overtime-report', userId, year, month],
    queryFn: async (): Promise<OvertimeReportSummary> => {
      if (month) {
        // Monthly: Use overtime_balance endpoint (Single Source of Truth!)
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const response = await apiClient.get(`/overtime/balance/${userId}/${monthKey}`);
        if (!response.success) throw new Error(response.error);

        const data = response.data as MonthlyBalanceResponse;
        return {
          userId: data.userId,
          year,
          month,
          summary: {
            targetHours: data.summary.targetHours,
            actualHours: data.summary.actualHours,
            overtime: data.summary.overtime,
          },
          breakdown: data.breakdown, // ✅ Pass through daily breakdown for chart
        };
      } else {
        // Yearly: Use new yearly balance endpoint (fast, no breakdown)
        const response = await apiClient.get(`/overtime/balance/${userId}/year/${year}`);
        if (!response.success) throw new Error(response.error);

        const data = response.data as YearlyBalanceResponse;
        return {
          userId: data.userId,
          year: data.year,
          summary: {
            targetHours: data.targetHours,
            actualHours: data.actualHours,
            overtime: data.overtime,
          },
        };
      }
    },
    enabled: enabledOverride !== undefined ? enabledOverride : (!!userId && !!year),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Auto-refresh every 30 seconds (consistent with other components)
  });
}

/**
 * Get monthly overtime history from overtime_balance (Single Source of Truth)
 * Uses /api/reports/overtime/history/:userId which reads from overtime_balance table
 * ✅ CORRECT: Includes ALL days (even days without time_entries)
 *
 * @param userId - User ID
 * @param months - Number of months (default: 12) - IGNORED if year/month specified
 * @param year - Specific year (e.g., 2026) - optional
 * @param month - Specific month (1-12) - requires year, optional
 */
export function useOvertimeHistory(userId: number, months: number = 12, year?: number, month?: number) {
  return useQuery({
    queryKey: ['overtime-history', userId, months, year, month],
    queryFn: async (): Promise<OvertimeHistoryEntry[]> => {
      // Build query parameters
      const params = new URLSearchParams({ months: months.toString() });
      if (year) params.append('year', year.toString());
      if (month) params.append('month', month.toString());

      const response = await apiClient.get(`/reports/overtime/history/${userId}?${params}`);
      if (!response.success) throw new Error(response.error);
      return response.data as OvertimeHistoryEntry[];
    },
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Auto-refresh every 30 seconds (catches backend updates)
  });
}

/**
 * @deprecated Use useOvertimeHistory() instead (reads from overtime_balance)
 * Fetch overtime history from transactions
 * ⚠️ INCOMPLETE: Missing days without time_entries (NOW FIXED with ensureDailyOvertimeTransactions)
 *
 * Returns monthly summary with earned/compensation/correction breakdown
 */
export function useOvertimeHistoryFromTransactions(userId: number, months: number = 12) {
  return useQuery({
    queryKey: ['overtime-history-transactions', userId, months],
    queryFn: async (): Promise<OvertimeHistoryEntry[]> => {
      const params = new URLSearchParams({
        userId: userId.toString(),
        months: months.toString()
      });
      const response = await apiClient.get(`/overtime/transactions/monthly-summary?${params}`);
      if (!response.success) throw new Error(response.error);

      // Response data includes { summary, currentBalance, userId }
      const data = response.data as { summary: OvertimeHistoryEntry[]; currentBalance: number; userId: number };
      return data.summary;
    },
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch overtime year breakdown (carryover + earned this year)
 * NEW: For Balance Summary Widget
 */
export function useOvertimeYearBreakdown(userId: number) {
  return useQuery({
    queryKey: ['overtime-year-breakdown', userId],
    queryFn: async (): Promise<OvertimeYearBreakdown> => {
      const response = await apiClient.get(`/reports/overtime/year-breakdown/${userId}`);
      if (!response.success) throw new Error(response.error);
      return response.data as OvertimeYearBreakdown;
    },
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch overtime reports for ALL users (admin only)
 * ✅ MIGRATED to /api/overtime/balance/* (Single Source of Truth)
 *
 * @param year Year to fetch reports for
 * @param month Optional month (1-12)
 * @param isAdmin Whether current user is admin (REQUIRED for enabled check)
 */
export function useAllUsersOvertimeReports(year: number, month?: number, isAdmin?: boolean) {
  return useQuery({
    queryKey: ['all-users-overtime-reports', year, month],
    queryFn: async (): Promise<OvertimeReportSummary[]> => {
      // Fetch all users first
      const usersResponse = await apiClient.get('/users');
      if (!usersResponse.success) throw new Error(usersResponse.error);

      const users = usersResponse.data as User[];

      // Fetch reports for each user using new balance endpoints
      const reports = await Promise.all(
        users.map(async (user: User) => {
          try {
            if (month) {
              // Monthly: Use monthly balance endpoint
              const monthKey = `${year}-${String(month).padStart(2, '0')}`;
              const response = await apiClient.get(`/overtime/balance/${user.id}/${monthKey}`);
              if (!response.success) {
                console.warn(`Failed to fetch overtime for user ${user.id}:`, response.error);
                return null;
              }

              const data = response.data as MonthlyBalanceResponse;
              return {
                userId: data.userId,
                year,
                month,
                summary: {
                  targetHours: data.summary.targetHours,
                  actualHours: data.summary.actualHours,
                  overtime: data.summary.overtime,
                },
              };
            } else {
              // Yearly: Use yearly balance endpoint
              const response = await apiClient.get(`/overtime/balance/${user.id}/year/${year}`);
              if (!response.success) {
                console.warn(`Failed to fetch overtime for user ${user.id}:`, response.error);
                return null;
              }

              const data = response.data as YearlyBalanceResponse;
              return {
                userId: data.userId,
                year: data.year,
                summary: {
                  targetHours: data.targetHours,
                  actualHours: data.actualHours,
                  overtime: data.overtime,
                },
              };
            }
          } catch (error) {
            console.warn(`Error fetching overtime for user ${user.id}:`, error);
            return null;
          }
        })
      );

      // Filter out null values (failed requests)
      return reports.filter((report): report is OvertimeReportSummary => report !== null);
    },
    enabled: !!year && isAdmin === true, // CRITICAL: Only fetch if user is admin!
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Auto-refresh every 30 seconds (consistent with other components)
  });
}
