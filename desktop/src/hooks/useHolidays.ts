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

/**
 * Get holidays for current year + next 2 years (3 years total)
 * Best practice: like Lexware (current year + 2 future years)
 */
export function useMultiYearHolidays() {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['holidays', 'multi-year', currentYear],
    queryFn: async () => {
      const years = [currentYear, currentYear + 1, currentYear + 2];
      const allHolidays: Array<{ id: number; date: string; name: string; federal: number }> = [];

      // Fetch holidays for all 3 years
      for (const year of years) {
        const response = await apiClient.get(`/holidays?year=${year}`);
        const yearHolidays = (response.data || []) as Array<{ id: number; date: string; name: string; federal: number }>;
        allHolidays.push(...yearHolidays);
      }

      return allHolidays;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - holidays don't change often
  });
}
