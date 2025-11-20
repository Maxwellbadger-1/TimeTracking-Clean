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
    onSuccess: (_data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts', 'status'] });
    },
  });
}
