import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Overtime Admin Hooks
 * View overtime data for all employees
 */

export interface OvertimeSummary {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  totalOvertime: number;
}

/**
 * Get overtime summary for all users (Admin only)
 */
export function useAllUsersOvertime(year?: number) {
  const currentYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['overtime', 'all', currentYear],
    queryFn: async () => {
      const response = await apiClient.get<OvertimeSummary[]>(
        `/overtime/all?year=${currentYear}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch overtime data');
      }

      return response.data || [];
    },
    retry: false,
  });
}
