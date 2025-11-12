import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { TimeEntry } from '../types';

interface TimeEntryFilters {
  userId?: number;
  startDate?: string;
  endDate?: string;
}

interface TimeEntriesResponse {
  rows: TimeEntry[];
  pagination: {
    cursor: number | null;
    hasMore: boolean;
    total: number;
  };
}

/**
 * Infinite scroll hook for time entries with cursor-based pagination
 * Better performance for large datasets (65,000+ entries)
 */
export function useInfiniteTimeEntries(filters?: TimeEntryFilters) {
  return useInfiniteQuery({
    queryKey: ['timeEntries', 'infinite', filters],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();

      if (filters?.userId) {
        params.append('userId', filters.userId.toString());
      }

      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }

      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }

      if (pageParam) {
        params.append('cursor', pageParam.toString());
      }

      params.append('limit', '50');

      const response = await apiClient.get<TimeEntriesResponse>(
        `/time-entries?${params}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch time entries');
      }

      // Handle backward compatibility (array response)
      if (Array.isArray(response.data)) {
        return {
          rows: response.data,
          pagination: {
            cursor: null,
            hasMore: false,
            total: response.data.length,
          },
        };
      }

      return response.data as TimeEntriesResponse;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore && lastPage.pagination.cursor) {
        return lastPage.pagination.cursor;
      }
      return undefined;
    },
    initialPageParam: undefined as number | undefined,
  });
}
