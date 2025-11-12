import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Notification } from '../types';

interface NotificationPageResponse {
  rows: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Hook for infinite scrolling notifications
 * Uses TanStack Query's useInfiniteQuery for automatic pagination
 */
export function useInfiniteNotifications(userId: number, unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: ['notifications', 'infinite', userId, { unreadOnly }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '20',
      });

      if (unreadOnly) {
        params.append('unreadOnly', 'true');
      }

      const response = await apiClient.get<NotificationPageResponse>(
        `/notifications?${params}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch notifications');
      }

      // Handle legacy array response
      if (Array.isArray(response.data)) {
        return {
          rows: response.data,
          pagination: {
            page: 1,
            limit: response.data.length,
            total: response.data.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      }

      return response.data || {
        rows: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      };
    },
    getNextPageParam: (lastPage) => {
      // Return next page number if there are more pages
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined; // No more pages
    },
    initialPageParam: 1,
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
