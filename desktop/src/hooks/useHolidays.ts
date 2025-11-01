/**
 * TanStack Query Hooks for Holidays
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Get all holidays for a specific year
 */
export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await apiClient.get(`/holidays${params}`);
      // Ensure we always return an array (never undefined)
      return (response.data || []) as Array<{ id: number; date: string; name: string; federal: number }>;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get holidays for current year
 */
export function useCurrentYearHolidays() {
  const currentYear = new Date().getFullYear();
  return useHolidays(currentYear);
}
