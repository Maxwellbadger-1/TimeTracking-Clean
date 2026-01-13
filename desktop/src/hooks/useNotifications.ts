import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Notification } from '../types';
import { toast } from 'sonner';

interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

interface NotificationResponse {
  rows: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Get paginated notifications for current user
export function useNotifications(userId: number, options: UseNotificationsOptions = {}) {
  const { page = 1, limit = 20, unreadOnly = false } = options;

  return useQuery({
    queryKey: ['notifications', userId, { page, limit, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (unreadOnly) {
        params.append('unreadOnly', 'true');
      }

      const response = await apiClient.get<Notification[] | NotificationResponse>(
        `/notifications?${params}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch notifications');
      }

      // Handle both paginated and non-paginated responses for backward compatibility
      if (Array.isArray(response.data)) {
        // Old non-paginated response
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
    enabled: !!userId,
    refetchInterval: 5000, // Refetch every 5 seconds (real-time for pending absence requests)
  });
}

// Get unread notifications (uses unreadOnly filter)
export function useUnreadNotifications(userId: number) {
  const { data, ...rest } = useNotifications(userId, { unreadOnly: true });

  return {
    ...rest,
    data: data?.rows || [],
    count: data?.pagination.total || 0,
  };
}

// Get infinite notifications with pagination
export function useInfiniteNotifications(userId: number, unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: ['notifications', userId, { unreadOnly, infinite: true }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '20',
      });

      if (unreadOnly) {
        params.append('unreadOnly', 'true');
      }

      const response = await apiClient.get<NotificationResponse>(
        `/notifications?${params}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch notifications');
      }

      return response.data || {
        rows: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!userId,
    refetchInterval: 5000, // Real-time updates
  });
}

// Mark notification as read mutation
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      console.log('🔵 [READ] Mutation started for ID:', id);
      const response = await apiClient.patch<Notification>(`/notifications/${id}/read`, {});
      console.log('🔵 [READ] Server response:', response);

      if (!response.success) {
        throw new Error(response.error || 'Failed to mark notification as read');
      }

      return response.data;
    },
    onMutate: async (id: number) => {
      console.log('🟢 [READ] onMutate: Starting optimistic update for ID:', id);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      console.log('🟢 [READ] onMutate: Cancelled ongoing queries');

      // Snapshot previous value
      const previousNotifications = queryClient.getQueriesData({ queryKey: ['notifications'] });
      console.log('🟢 [READ] onMutate: Previous data snapshot taken:', previousNotifications.length, 'queries');

      // Optimistically update all notification queries
      queryClient.setQueriesData<NotificationResponse>(
        { queryKey: ['notifications'] },
        (old) => {
          console.log('🟢 [READ] onMutate: Old data:', old);
          if (!old) return old;

          // Handle both array (legacy) and paginated response
          if (Array.isArray(old)) {
            const updated = old.map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            );
            console.log('🟢 [READ] onMutate: Updated data (optimistic, legacy):', updated);
            return updated as any;
          }

          // Check if old has rows property (paginated response)
          if (!old.rows || !Array.isArray(old.rows)) {
            console.warn('🟡 [READ] onMutate: old.rows is not an array, skipping update');
            return old;
          }

          const updated = {
            ...old,
            rows: old.rows.map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
          };
          console.log('🟢 [READ] onMutate: Updated data (optimistic):', updated);
          return updated;
        }
      );

      return { previousNotifications };
    },
    onError: (error: Error, _id, context) => {
      console.log('🔴 [READ] onError: Mutation failed, rolling back');
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error('Failed to mark notification as read:', error);
      toast.error('Fehler beim Markieren als gelesen');
    },
    onSuccess: (data) => {
      console.log('🟢 [READ] onSuccess: Mutation succeeded, server data:', data);
    },
    onSettled: () => {
      console.log('🟡 [READ] onSettled: Invalidating queries for refetch');
      // CRITICAL FIX: Immediately refetch all notification queries
      queryClient.invalidateQueries({
        queryKey: ['notifications'],
        exact: false,
        refetchType: 'all'
      });
    },
  });
}

// Mark notification as unread mutation
export function useMarkNotificationUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.patch<Notification>(`/notifications/${id}/unread`, {});

      if (!response.success) {
        throw new Error(response.error || 'Failed to mark notification as unread');
      }

      return response.data;
    },
    onMutate: async (id: number) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueriesData({ queryKey: ['notifications'] });

      // Optimistically update all notification queries
      queryClient.setQueriesData<NotificationResponse>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;

          // Handle both array (legacy) and paginated response
          if (Array.isArray(old)) {
            return old.map((n) =>
              n.id === id ? { ...n, isRead: false } : n
            ) as any;
          }

          // Check if old has rows property (paginated response)
          if (!old.rows || !Array.isArray(old.rows)) {
            return old;
          }

          return {
            ...old,
            rows: old.rows.map((n) =>
              n.id === id ? { ...n, isRead: false } : n
            ),
          };
        }
      );

      return { previousNotifications };
    },
    onError: (error: Error, _id, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error('Failed to mark notification as unread:', error);
      toast.error('Fehler beim Markieren als ungelesen');
    },
    onSettled: () => {
      // CRITICAL FIX: Immediately refetch all notification queries
      queryClient.invalidateQueries({
        queryKey: ['notifications'],
        exact: false,
        refetchType: 'all'
      });
    },
  });
}

// Mark all notifications as read mutation
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiClient.patch('/notifications/read-all', { userId });

      if (!response.success) {
        throw new Error(response.error || 'Failed to mark all notifications as read');
      }

      return response.data;
    },
    onMutate: async (_userId: number) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueriesData({ queryKey: ['notifications'] });

      // Optimistically update all notification queries
      queryClient.setQueriesData<NotificationResponse>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;

          // Handle both array (legacy) and paginated response
          if (Array.isArray(old)) {
            return old.map((n) => ({ ...n, isRead: true })) as any;
          }

          // Check if old has rows property (paginated response)
          if (!old.rows || !Array.isArray(old.rows)) {
            return old;
          }

          return {
            ...old,
            rows: old.rows.map((n) => ({ ...n, isRead: true })),
          };
        }
      );

      return { previousNotifications };
    },
    onError: (error: Error, _userId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(`Fehler: ${error.message}`);
    },
    onSuccess: () => {
      toast.success('Alle Benachrichtigungen als gelesen markiert');
    },
    onSettled: () => {
      // CRITICAL FIX: Immediately refetch all notification queries
      queryClient.invalidateQueries({
        queryKey: ['notifications'],
        exact: false,
        refetchType: 'all'
      });
    },
  });
}

// Delete notification mutation
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/notifications/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete notification');
      }

      return response.data;
    },
    onMutate: async (id: number) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueriesData({ queryKey: ['notifications'] });

      // Optimistically remove notification from all queries
      queryClient.setQueriesData<NotificationResponse>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;

          // Handle both array (legacy) and paginated response
          if (Array.isArray(old)) {
            return old.filter((n) => n.id !== id) as any;
          }

          // Check if old has rows property (paginated response)
          if (!old.rows || !Array.isArray(old.rows)) {
            return old;
          }

          return {
            ...old,
            rows: old.rows.filter((n) => n.id !== id),
            pagination: {
              ...old.pagination,
              total: old.pagination.total - 1,
            },
          };
        }
      );

      return { previousNotifications };
    },
    onError: (error: Error, _id, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error('Failed to delete notification:', error);
      toast.error('Fehler beim Löschen der Benachrichtigung');
    },
    onSettled: () => {
      // CRITICAL FIX: Immediately refetch all notification queries
      queryClient.invalidateQueries({
        queryKey: ['notifications'],
        exact: false,
        refetchType: 'all'
      });
    },
  });
}
