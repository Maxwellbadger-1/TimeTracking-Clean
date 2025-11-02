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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark notification as read:', error);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Alle Benachrichtigungen als gelesen markiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete notification:', error);
    },
  });
}
