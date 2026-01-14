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
    // Refetch more often since this is live data
    staleTime: 30000, // 30 seconds
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
 * Get overtime transactions (transaction-based tracking)
 *
 * PROFESSIONAL STANDARD: Immutable audit trail of all overtime changes
 * Like SAP SuccessFactors, Personio, DATEV
 */
export function useOvertimeTransactions(userId?: number, year?: number, limit?: number) {
  return useQuery({
    queryKey: ['overtime-transactions', userId, year, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId.toString());
      if (year) params.append('year', year.toString());
      if (limit) params.append('limit', limit.toString());

      const endpoint = `/overtime/transactions${params.toString() ? '?' + params.toString() : ''}`;
      const response = await apiClient.get<{
        transactions: Array<{
          id: number;
          userId: number;
          date: string;
          type: 'earned' | 'compensation' | 'correction' | 'carryover';
          hours: number;
          description: string | null;
          referenceType: string | null;
          referenceId: number | null;
          createdAt: string;
          createdBy: number | null;
        }>;
        currentBalance: number;
        userId: number;
      }>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
