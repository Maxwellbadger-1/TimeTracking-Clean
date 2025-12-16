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
  targetHours: number; // Target hours for the selected period (month or year)
  actualHours: number; // Actual hours for the selected period (month or year)
}

/**
 * Get overtime summary for all users (Admin only)
 * @param year - Year to get data for (default: current year)
 * @param month - Optional month in format "YYYY-MM" for monthly reports
 */
export function useAllUsersOvertime(year?: number, month?: string) {
  const currentYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['overtime', 'all', currentYear, month],
    queryFn: async () => {
      let url = `/overtime/all?year=${currentYear}`;
      if (month) {
        url += `&month=${month}`;
      }

      const response = await apiClient.get<OvertimeSummary[]>(url);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch overtime data');
      }

      return response.data || [];
    },
    retry: false,
  });
}
