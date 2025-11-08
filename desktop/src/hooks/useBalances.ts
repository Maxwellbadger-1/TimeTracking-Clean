import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { VacationBalance, OvertimeBalance } from '../types';

// Get vacation balance for a specific year
export function useVacationBalance(userId: number, year: number) {
  return useQuery({
    queryKey: ['vacationBalance', userId, year],
    queryFn: async () => {
      const response = await apiClient.get<VacationBalance>(
        `/absences/vacation-balance/${year}?userId=${userId}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch vacation balance');
      }

      return response.data;
    },
    enabled: !!userId && !!year,
    staleTime: 0, // Always consider data stale - refetch when needed
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

// Get current year vacation balance
export function useCurrentVacationBalance(userId: number) {
  const currentYear = new Date().getFullYear();
  return useVacationBalance(userId, currentYear);
}

// Get overtime balance for a specific month
export function useOvertimeBalance(userId: number, month?: string) {
  const targetMonth = month || new Date().toISOString().substring(0, 7);

  return useQuery({
    queryKey: ['overtimeBalance', userId, targetMonth],
    queryFn: async () => {
      const response = await apiClient.get<OvertimeBalance>(
        `/overtime/month/${userId}/${targetMonth}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch overtime balance');
      }

      return response.data || { targetHours: 0, actualHours: 0, overtime: 0 };
    },
    enabled: !!userId,
  });
}

// Calculate total overtime hours for the YEAR (LEGACY - use useCurrentOvertimeStats instead)
export function useTotalOvertime(userId: number) {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['totalOvertime', userId, currentYear],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        `/overtime/balance?userId=${userId}&year=${currentYear}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch total overtime');
      }

      const totalOvertime = response.data?.totalOvertime || 0;

      return {
        totalHours: Math.round(totalOvertime * 100) / 100,
        data: response.data,
      };
    },
    enabled: !!userId,
    select: (data) => ({
      totalHours: data.totalHours,
      data: data.data,
    }),
  });
}

/**
 * NEW: 3-Level Overtime System Hooks
 */

// Get current overtime stats (today, thisWeek, thisMonth, totalYear)
export function useCurrentOvertimeStats(userId?: number) {
  return useQuery({
    queryKey: ['currentOvertimeStats', userId],
    queryFn: async () => {
      const endpoint = userId
        ? `/overtime/current?userId=${userId}`
        : '/overtime/current';

      const response = await apiClient.get<{
        today: number;
        thisWeek: number;
        thisMonth: number;
        totalYear: number;
      }>(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch overtime stats');
      }

      return response.data || {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        totalYear: 0,
      };
    },
    enabled: true,
    refetchOnWindowFocus: false,
    retry: false,
    gcTime: 0, // Disable cache - always fetch fresh data
    staleTime: 0, // Mark as stale immediately
  });
}

// Get daily overtime for a specific date
export function useDailyOvertime(userId: number, date: string) {
  return useQuery({
    queryKey: ['dailyOvertime', userId, date],
    queryFn: async () => {
      const response = await apiClient.get<{
        date: string;
        targetHours: number;
        actualHours: number;
        overtime: number;
      }>(`/overtime/daily/${userId}/${date}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch daily overtime');
      }

      return response.data || { date, targetHours: 0, actualHours: 0, overtime: 0 };
    },
    enabled: !!userId && !!date,
  });
}

// Get weekly overtime for a specific week (ISO format: "2025-W45")
export function useWeeklyOvertime(userId: number, week: string) {
  return useQuery({
    queryKey: ['weeklyOvertime', userId, week],
    queryFn: async () => {
      const response = await apiClient.get<{
        week: string;
        targetHours: number;
        actualHours: number;
        overtime: number;
      }>(`/overtime/weekly/${userId}/${week}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch weekly overtime');
      }

      return response.data || { week, targetHours: 0, actualHours: 0, overtime: 0 };
    },
    enabled: !!userId && !!week,
  });
}

// Get complete overtime summary for a year (all 3 levels)
export function useOvertimeSummary(userId: number, year: number) {
  return useQuery({
    queryKey: ['overtimeSummary', userId, year],
    queryFn: async () => {
      const response = await apiClient.get<{
        daily: Array<{ date: string; targetHours: number; actualHours: number; overtime: number }>;
        weekly: Array<{ week: string; targetHours: number; actualHours: number; overtime: number }>;
        monthly: Array<{ month: string; targetHours: number; actualHours: number; overtime: number }>;
        totalOvertime: number;
      }>(`/overtime/summary/${userId}/${year}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch overtime summary');
      }

      return response.data || { daily: [], weekly: [], monthly: [], totalOvertime: 0 };
    },
    enabled: !!userId && !!year,
  });
}

// Get remaining vacation days (quick access)
export function useRemainingVacationDays(userId: number) {
  const { data: balance, ...rest } = useCurrentVacationBalance(userId);

  return {
    ...rest,
    data: balance,
    remaining: balance?.remaining || 0,
  };
}
