import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { TimeEntry } from '../types';
import { debugLogger } from '../utils/debugLogger';

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
  debugLogger.log('useInfiniteTimeEntries:INIT', {
    filters,
    queryKey: ['timeEntries', 'infinite', filters],
  });

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

      debugLogger.log('useInfiniteTimeEntries:API_REQUEST', {
        url: `/time-entries?${params}`,
        filters,
        pageParam,
        parsedParams: {
          userId: filters?.userId,
          startDate: filters?.startDate,
          endDate: filters?.endDate,
          cursor: pageParam,
          limit: 50,
        },
      });

      const response = await apiClient.get<TimeEntriesResponse>(
        `/time-entries?${params}`
      );

      if (!response.success) {
        debugLogger.log('useInfiniteTimeEntries:API_ERROR', {
          error: response.error,
        });
        throw new Error(response.error || 'Failed to fetch time entries');
      }

      // Handle backward compatibility (array response)
      if (Array.isArray(response.data)) {
        debugLogger.log('useInfiniteTimeEntries:API_RESPONSE_ARRAY', {
          rowCount: response.data.length,
          firstEntry: response.data[0],
          lastEntry: response.data[response.data.length - 1],
        });
        return {
          rows: response.data,
          pagination: {
            cursor: null,
            hasMore: false,
            total: response.data.length,
          },
        };
      }

      const paginatedData = response.data as TimeEntriesResponse;
      debugLogger.log('useInfiniteTimeEntries:API_RESPONSE_PAGINATED', {
        rowCount: paginatedData.rows?.length,
        total: paginatedData.pagination?.total,
        hasMore: paginatedData.pagination?.hasMore,
        cursor: paginatedData.pagination?.cursor,
        firstEntry: paginatedData.rows?.[0],
        lastEntry: paginatedData.rows?.[paginatedData.rows.length - 1],
        allEntryDates: paginatedData.rows?.map(e => e.date),
      });

      return paginatedData;
    },
    getNextPageParam: (lastPage) => {
      const nextCursor = lastPage.pagination.hasMore && lastPage.pagination.cursor
        ? lastPage.pagination.cursor
        : undefined;

      debugLogger.log('useInfiniteTimeEntries:GET_NEXT_PAGE_PARAM', {
        hasMore: lastPage.pagination.hasMore,
        cursor: lastPage.pagination.cursor,
        nextCursor,
        willFetchNext: nextCursor !== undefined,
      });

      return nextCursor;
    },
    initialPageParam: undefined as number | undefined,
  });
}
