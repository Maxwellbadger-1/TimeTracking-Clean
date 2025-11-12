import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Notification } from '../types';
import { toast } from 'sonner';

// Get all notifications for current user
export function useNotifications(userId: number) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const response = await apiClient.get<Notification[]>(
        `/notifications?userId=${userId}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch notifications');
      }

      return response.data || [];
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Get unread notifications
export function useUnreadNotifications(userId: number) {
  const { data: notifications, ...rest } = useNotifications(userId);

  const unreadNotifications = notifications?.filter((n) => !n.isRead) || [];

  return {
    ...rest,
    data: unreadNotifications,
    count: unreadNotifications.length,
  };
}

// Mark notification as read mutation
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.put<Notification>(`/notifications/${id}/read`, {});

      if (!response.success) {
        throw new Error(response.error || 'Failed to mark notification as read');
      }

      return response.data;
    },
    onMutate: async (id: number) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueriesData({ queryKey: ['notifications'] });

      // Optimistically update all notification queries
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;
          return old.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          );
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
      console.error('Failed to mark notification as read:', error);
      toast.error('Fehler beim Markieren als gelesen');
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Mark notification as unread mutation
export function useMarkNotificationUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.put<Notification>(`/notifications/${id}/unread`, {});

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
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;
          return old.map((n) =>
            n.id === id ? { ...n, isRead: false } : n
          );
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
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Mark all notifications as read mutation
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiClient.put('/notifications/read-all', { userId });

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
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;
          return old.map((n) => ({ ...n, isRead: true }));
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
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old;
          return old.filter((n) => n.id !== id);
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
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
