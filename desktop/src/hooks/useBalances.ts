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
  });
}

// Get current year vacation balance
export function useCurrentVacationBalance(userId: number) {
  const currentYear = new Date().getFullYear();
  return useVacationBalance(userId, currentYear);
}

// Get overtime balance
export function useOvertimeBalance(userId: number) {
  return useQuery({
    queryKey: ['overtimeBalance', userId],
    queryFn: async () => {
      const response = await apiClient.get<OvertimeBalance[]>(
        `/time-entries/stats/overtime?userId=${userId}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch overtime balance');
      }

      return response.data || [];
    },
    enabled: !!userId,
  });
}

// Calculate total overtime hours
export function useTotalOvertime(userId: number) {
  const { data: overtimeBalances, ...rest } = useOvertimeBalance(userId);

  const totalHours = overtimeBalances?.reduce(
    (sum, balance) => sum + (balance.balance || 0),
    0
  ) || 0;

  return {
    ...rest,
    data: overtimeBalances,
    totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
  };
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
