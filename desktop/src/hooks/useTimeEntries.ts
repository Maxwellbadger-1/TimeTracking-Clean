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
  notes?: string | null;
}

// Get all time entries (with optional filters)
export function useTimeEntries(filters?: TimeEntryFilters | number) {
  // Handle legacy number parameter (userId)
  const actualFilters: TimeEntryFilters | undefined =
    typeof filters === 'number' ? { userId: filters } : filters;

  return useQuery({
    queryKey: ['timeEntries', actualFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actualFilters?.userId) params.append('userId', actualFilters.userId.toString());
      if (actualFilters?.startDate) params.append('startDate', actualFilters.startDate);
      if (actualFilters?.endDate) params.append('endDate', actualFilters.endDate);

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
      console.log('🔥 UPDATE MUTATION FUNCTION CALLED! ID:', id);
      console.log('📝 Update data:', data);
      console.log('📡 Calling API put endpoint: /time-entries/' + id);

      const response = await apiClient.put<TimeEntry>(`/time-entries/${id}`, data);

      console.log('📥 API Response received:', response);
      console.log('✅ Response success?', response.success);
      console.log('📦 Response data:', response.data);
      console.log('❌ Response error?', response.error);

      if (!response.success) {
        console.error('💥 UPDATE MUTATION FAILED! Error:', response.error);
        throw new Error(response.error || 'Failed to update time entry');
      }

      console.log('✅ UPDATE MUTATION SUCCESS! Returning data:', response.data);
      return response.data;
    },
    onSuccess: (_data: TimeEntry | undefined, variables: { id: number; data: UpdateTimeEntryData }) => {
      console.log('🎉 UPDATE onSuccess callback triggered! Data:', _data);
      console.log('🔄 Invalidating queries...');
      // Invalidate specific entry and list
      queryClient.invalidateQueries({ queryKey: ['timeEntry', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      console.log('✅ Queries invalidated!');
      toast.success('Zeiteintrag aktualisiert');
    },
    onError: (error: Error) => {
      console.error('💥 UPDATE onError callback triggered!');
      console.error('❌ Error object:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Delete time entry mutation
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      console.log('🔥 MUTATION FUNCTION CALLED! ID:', id);
      console.log('📡 Calling API delete endpoint: /time-entries/' + id);

      const response = await apiClient.delete(`/time-entries/${id}`);

      console.log('📥 API Response received:', response);
      console.log('✅ Response success?', response.success);
      console.log('📦 Response data:', response.data);
      console.log('❌ Response error?', response.error);

      if (!response.success) {
        console.error('💥 MUTATION FAILED! Error:', response.error);
        throw new Error(response.error || 'Failed to delete time entry');
      }

      console.log('✅ MUTATION SUCCESS! Returning data:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('🎉 onSuccess callback triggered! Data:', data);
      console.log('🔄 Invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      console.log('✅ Queries invalidated!');
      toast.success('Zeiteintrag gelöscht');
    },
    onError: (error: Error) => {
      console.error('💥 onError callback triggered!');
      console.error('❌ Error object:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      toast.error(`Fehler: ${error.message}`);
    },
  });
}
