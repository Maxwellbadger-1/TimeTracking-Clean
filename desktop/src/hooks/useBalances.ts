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
export function useOvertimeBalance(userId: number, month?: string) {
  const targetMonth = month || new Date().toISOString().substring(0, 7);

  return useQuery({
    queryKey: ['overtimeBalance', userId, targetMonth],
    queryFn: async () => {
      console.log('🔥🔥🔥 useOvertimeBalance queryFn CALLED! 🔥🔥🔥');
      console.log('📌 userId:', userId);
      console.log('📌 targetMonth:', targetMonth);
      console.log('🌐 API endpoint:', `/overtime/month/${userId}/${targetMonth}`);

      const response = await apiClient.get<OvertimeBalance>(
        `/overtime/month/${userId}/${targetMonth}`
      );

      console.log('📡 API Response:', response);

      if (!response.success) {
        console.error('❌ API Error:', response.error);
        throw new Error(response.error || 'Failed to fetch overtime balance');
      }

      console.log('✅ Overtime data:', response.data);
      return response.data || { targetHours: 0, actualHours: 0, overtime: 0 };
    },
    enabled: !!userId,
  });
}

// Calculate total overtime hours
export function useTotalOvertime(userId: number, month?: string) {
  console.log('🔥🔥🔥 useTotalOvertime CALLED! 🔥🔥🔥');
  console.log('📌 userId:', userId);
  console.log('📌 month:', month);

  const { data: overtimeBalance, ...rest } = useOvertimeBalance(userId, month);

  console.log('📊 Overtime balance from hook:', overtimeBalance);

  const totalHours = overtimeBalance?.overtime || 0;

  console.log('✅ Total hours calculated:', totalHours);

  return {
    ...rest,
    data: overtimeBalance,
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
