/**
 * TanStack Query Hooks for Holidays
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Get all holidays for a specific year
 * @param year - Year to fetch holidays for (defaults to current year on backend)
 */
export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await apiClient.get(`/holidays${params}`);
      // Ensure we always return an array (never undefined)
      // Note: Backend defaults to current year if no year provided
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
 * Get holidays for past 2 years + current year + next 2 years (5 years total)
 * Best practice: Covers historical data + future planning
 * Example (2026): 2024, 2025, 2026, 2027, 2028
 */
export function useMultiYearHolidays() {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['holidays', 'multi-year', currentYear],
    queryFn: async () => {
      // Load: -2, -1, current, +1, +2 years (5 years total)
      const years = [
        currentYear - 2,
        currentYear - 1,
        currentYear,
        currentYear + 1,
        currentYear + 2
      ];
      const allHolidays: Array<{ id: number; date: string; name: string; federal: number }> = [];

      // Fetch holidays for all 5 years
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
