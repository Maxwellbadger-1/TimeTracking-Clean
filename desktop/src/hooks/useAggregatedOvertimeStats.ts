import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Aggregated Overtime Stats Hook
 * Get total sums of overtime data for all users
 * Used for "Alle Mitarbeiter" view in reports
 */

export interface AggregatedOvertimeStats {
  totalTargetHours: number;
  totalActualHours: number;
  totalOvertime: number;
  userCount: number;
}

/**
 * Get aggregated overtime statistics for all users (Admin only)
 */
export function useAggregatedOvertimeStats(year?: number, month?: string) {
  const currentYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['overtime', 'aggregated', currentYear, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('year', currentYear.toString());
      if (month) {
        params.set('month', month);
      }

      const response = await apiClient.get<AggregatedOvertimeStats>(
        `/overtime/aggregated?${params.toString()}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch aggregated overtime data');
      }

      return response.data || {
        totalTargetHours: 0,
        totalActualHours: 0,
        totalOvertime: 0,
        userCount: 0,
      };
    },
    retry: false,
    refetchOnWindowFocus: true, // Auto-refresh when window gets focus
    staleTime: 0, // Always consider data stale (fresh fetch every time)
  });
}