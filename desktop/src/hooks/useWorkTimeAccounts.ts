import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// Types
export interface WorkTimeAccount {
  id: number;
  userId: number;
  currentBalance: number;
  maxPlusHours: number;
  maxMinusHours: number;
  lastUpdated: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    weeklyHours: number;
  };
}

export interface MonthlyBalanceHistory {
  month: string; // YYYY-MM
  balance: number;
  delta: number;
  overtime: number;
}

export interface BalanceStatus {
  percentage: number; // -100 to +100
  status: 'critical_low' | 'warning_low' | 'normal' | 'warning_high' | 'critical_high';
  canTakeTimeOff: boolean;
  shouldReduceOvertime: boolean;
}

export interface WorkTimeAccountUpdateInput {
  maxPlusHours?: number;
  maxMinusHours?: number;
}

/**
 * Get work time account for a specific user or current user
 */
export function useWorkTimeAccount(userId?: number) {
  return useQuery({
    queryKey: ['work-time-accounts', userId],
    queryFn: async () => {
      const endpoint = userId ? `/work-time-accounts?userId=${userId}` : '/work-time-accounts';
      const response = await apiClient.get<WorkTimeAccount>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get work time account with LIVE balance calculation (no cache)
 *
 * Best Practice: Use this in Reports page to always show current data
 * - Calculates currentBalance on-demand from overtime_balance table
 * - Always up-to-date, no stale cache
 * - No "lastUpdated" timestamp displayed (always "now")
 *
 * @param userId - User ID to get account for (admin can specify, employee gets own)
 */
export function useWorkTimeAccountLive(userId?: number) {
  return useQuery({
    queryKey: ['work-time-accounts', 'live', userId],
    queryFn: async () => {
      const endpoint = userId ? `/work-time-accounts/live?userId=${userId}` : '/work-time-accounts/live';
      const response = await apiClient.get<WorkTimeAccount>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
    // Mark as stale immediately → WebSocket invalidation works instantly!
    staleTime: 0, // CRITICAL FIX: Allow WebSocket real-time updates
  });
}

/**
 * Get all work time accounts (admin only)
 */
export function useAllWorkTimeAccounts() {
  return useQuery({
    queryKey: ['work-time-accounts', 'all'],
    queryFn: async () => {
      const response = await apiClient.get<WorkTimeAccount[]>('/work-time-accounts');
      if (!response.success) throw new Error(response.error);
      return response.data || [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get work time account history
 */
export function useWorkTimeAccountHistory(userId?: number, months: number = 12) {
  return useQuery({
    queryKey: ['work-time-accounts', 'history', userId, months],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId.toString());
      params.set('months', months.toString());

      const response = await apiClient.get<MonthlyBalanceHistory[]>(
        `/work-time-accounts/history?${params.toString()}`
      );
      if (!response.success) throw new Error(response.error);
      return response.data || [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get balance status with warnings
 */
export function useBalanceStatus(userId?: number) {
  return useQuery({
    queryKey: ['work-time-accounts', 'status', userId],
    queryFn: async () => {
      const endpoint = userId
        ? `/work-time-accounts/status?userId=${userId}`
        : '/work-time-accounts/status';
      const response = await apiClient.get<BalanceStatus>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Update work time account settings mutation (admin only)
 */
export function useUpdateWorkTimeAccountSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, settings }: { userId: number; settings: WorkTimeAccountUpdateInput }) => {
      const response = await apiClient.patch<WorkTimeAccount>(
        `/work-time-accounts/${userId}`,
        settings
      );
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async ({ userId, settings }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['work-time-accounts', userId] });
      await queryClient.cancelQueries({ queryKey: ['work-time-accounts', 'all'] });

      // Snapshot previous values
      const previousAccount = queryClient.getQueryData<WorkTimeAccount>(['work-time-accounts', userId]);
      const previousAccounts = queryClient.getQueryData<WorkTimeAccount[]>(['work-time-accounts', 'all']);

      // Optimistically update single account
      if (previousAccount) {
        queryClient.setQueryData<WorkTimeAccount>(['work-time-accounts', userId], {
          ...previousAccount,
          ...settings,
          lastUpdated: new Date().toISOString(),
        });
      }

      // Optimistically update all accounts list
      if (previousAccounts) {
        queryClient.setQueryData<WorkTimeAccount[]>(
          ['work-time-accounts', 'all'],
          previousAccounts.map((account) =>
            account.userId === userId
              ? { ...account, ...settings, lastUpdated: new Date().toISOString() }
              : account
          )
        );
      }

      return { previousAccount, previousAccounts };
    },
    onSuccess: (_data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts', 'status'] });
    },
    onError: (_error, variables, context) => {
      // Rollback on error
      if (context?.previousAccount) {
        queryClient.setQueryData(['work-time-accounts', variables.userId], context.previousAccount);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['work-time-accounts', 'all'], context.previousAccounts);
      }
    },
  });
}

/**
 * Get overtime transactions (LIVE calculation from source data)
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - ON-DEMAND calculation from time_entries + absences + corrections
 * - Always up-to-date, no stale data
 * - Shows ALL working days (including days without time entries)
 * - Includes vacation/sick credits automatically
 * - Respects year/month filters from Reports Page
 *
 * @param userId User ID (admin can specify, employee gets own)
 * @param year Optional year filter (converted to fromDate/toDate)
 * @param month Optional month filter (1-12, requires year)
 * @param limit Optional limit (default: 50)
 */
export function useOvertimeTransactions(userId?: number, year?: number, month?: number, limit?: number) {
  return useQuery({
    queryKey: ['overtime-transactions', 'live', userId, year, month, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId.toString());
      if (limit) params.append('limit', limit.toString());

      // Convert year/month to fromDate/toDate for API
      if (year) {
        const fromDate = month
          ? `${year}-${String(month).padStart(2, '0')}-01`
          : `${year}-01-01`;

        // Calculate end date (last day of month or year)
        let toDate: string;
        if (month) {
          const lastDay = new Date(year, month, 0).getDate(); // Last day of month
          toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else {
          toDate = `${year}-12-31`;
        }

        // Ensure toDate is not in the future (max = today)
        const today = new Date().toISOString().split('T')[0];
        if (toDate > today) {
          toDate = today;
        }

        params.append('fromDate', fromDate);
        params.append('toDate', toDate);
      }
      // If no year/month: Backend uses hireDate to today (default)

      // NEW: Use /live endpoint for real-time calculation
      const endpoint = `/overtime/transactions/live${params.toString() ? '?' + params.toString() : ''}`;
      const response = await apiClient.get<{
        transactions: Array<{
          date: string;
          type: 'earned' | 'feiertag' | 'compensation' | 'correction' | 'carryover' | 'vacation_credit' | 'sick_credit' | 'overtime_comp_credit' | 'special_credit' | 'unpaid_adjustment';
          hours: number;
          description: string;
          source: 'time_entries' | 'absence_requests' | 'overtime_corrections' | 'holidays';
          referenceId?: number;
        }>;
        currentBalance: number;
        userId: number;
      }>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!userId, // CRITICAL: Only fetch if valid userId provided!
    staleTime: 0, // Always fetch fresh (live calculation)
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
