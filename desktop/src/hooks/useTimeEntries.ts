import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { TimeEntry } from '../types';
import { toast } from 'sonner';

interface TimeEntryFilters {
  userId?: number;
  startDate?: string;
  endDate?: string;
}

interface CreateTimeEntryData {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  location: 'office' | 'homeoffice' | 'field';
  description?: string;
}

interface UpdateTimeEntryData {
  date?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  location?: 'office' | 'homeoffice' | 'field';
  description?: string;
}

// Get all time entries (with optional filters)
export function useTimeEntries(filters?: TimeEntryFilters) {
  return useQuery({
    queryKey: ['timeEntries', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId.toString());
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiClient.get<TimeEntry[]>(`/time-entries${query}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch time entries');
      }

      return response.data || [];
    },
  });
}

// Get single time entry
export function useTimeEntry(id: number) {
  return useQuery({
    queryKey: ['timeEntry', id],
    queryFn: async () => {
      const response = await apiClient.get<TimeEntry>(`/time-entries/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch time entry');
      }

      return response.data;
    },
    enabled: !!id,
  });
}

// Get today's time entries
export function useTodayTimeEntries(userId: number) {
  const today = new Date().toISOString().split('T')[0];

  return useTimeEntries({
    userId,
    startDate: today,
    endDate: today,
  });
}

// Get current week's time entries
export function useWeekTimeEntries(userId: number) {
  const now = new Date();
  const firstDay = new Date(now.setDate(now.getDate() - now.getDay() + 1)); // Monday
  const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 7)); // Sunday

  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = lastDay.toISOString().split('T')[0];

  return useTimeEntries({
    userId,
    startDate,
    endDate,
  });
}

// Create time entry mutation
export function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTimeEntryData) => {
      const response = await apiClient.post<TimeEntry>('/time-entries', data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create time entry');
      }

      return response.data;
    },
    onSuccess: () => {
      // Invalidate all time entry queries
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      toast.success('Zeiteintrag erfolgreich erstellt');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Update time entry mutation
export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTimeEntryData }) => {
      const response = await apiClient.put<TimeEntry>(`/time-entries/${id}`, data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update time entry');
      }

      return response.data;
    },
    onSuccess: (_data: TimeEntry | undefined, variables: { id: number; data: UpdateTimeEntryData }) => {
      // Invalidate specific entry and list
      queryClient.invalidateQueries({ queryKey: ['timeEntry', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      toast.success('Zeiteintrag aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Delete time entry mutation
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/time-entries/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete time entry');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      toast.success('Zeiteintrag gelöscht');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}
