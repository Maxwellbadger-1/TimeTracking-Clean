import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { TimeEntry } from '../types';
import { toast } from 'sonner';
import { invalidateTimeEntryAffectedQueries } from './invalidationHelpers';

interface TimeEntryFilters {
  userId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number; // Max entries to fetch (default: 50, max: 10000)
}

interface CreateTimeEntryData {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  location: 'office' | 'homeoffice' | 'field';
  notes?: string;
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
      if (actualFilters?.limit) params.append('limit', actualFilters.limit.toString());

      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiClient.get<{ rows: TimeEntry[]; pagination: any }>(`/time-entries${query}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch time entries');
      }

      // NEW: Backend now returns { rows, pagination } instead of array
      // Extract rows array for backward compatibility with existing code
      return response.data?.rows || [];
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

// Helper: Format Date to YYYY-MM-DD (timezone-safe, no UTC conversion!)
function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Get today's time entries
export function useTodayTimeEntries(userId: number) {
  const today = formatDateLocal(new Date());

  return useTimeEntries({
    userId,
    startDate: today,
    endDate: today,
  });
}

// Get current week's time entries
export function useWeekTimeEntries(userId: number) {
  const now = new Date();

  // Calculate Monday (start of week)
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
  const firstDay = new Date(now);
  firstDay.setDate(now.getDate() + daysToMonday);

  // Calculate Sunday (end of week)
  const lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6);

  const startDate = formatDateLocal(firstDay);
  const endDate = formatDateLocal(lastDay);

  return useTimeEntries({
    userId,
    startDate,
    endDate,
  });
}

// Get current month's time entries (all users or specific user)
export function useMonthTimeEntries(userId?: number) {
  const now = new Date();

  // Calculate first day of month
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calculate last day of month
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDate = formatDateLocal(firstDay);
  const endDate = formatDateLocal(lastDay);

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
    onMutate: async (newEntry) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });

      // Snapshot previous value
      const previousEntries = queryClient.getQueryData<TimeEntry[]>(['timeEntries']);

      // Optimistically update cache with temporary entry
      if (previousEntries) {
        const optimisticEntry: TimeEntry = {
          id: Date.now(), // Temporary ID
          userId: newEntry.userId,
          date: newEntry.date,
          startTime: newEntry.startTime,
          endTime: newEntry.endTime,
          breakMinutes: newEntry.breakMinutes || 0,
          hours: 0, // Will be calculated by backend
          activity: null,
          project: null,
          location: newEntry.location,
          notes: newEntry.notes || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        };

        queryClient.setQueryData<TimeEntry[]>(['timeEntries'], [...previousEntries, optimisticEntry]);
      }

      return { previousEntries };
    },
    onSuccess: async () => {
      // Use centralized invalidation to ensure all affected queries are updated
      // This includes overtime queries and fixes cache delays
      await invalidateTimeEntryAffectedQueries(queryClient);
      toast.success('Zeiteintrag erfolgreich erstellt');
    },
    onError: (_error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousEntries) {
        queryClient.setQueryData(['timeEntries'], context.previousEntries);
      }
      // Error toast shown by api/client.ts (no duplicate needed)
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
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });
      await queryClient.cancelQueries({ queryKey: ['timeEntry', id] });

      // Snapshot previous values
      const previousEntries = queryClient.getQueryData<TimeEntry[]>(['timeEntries']);
      const previousEntry = queryClient.getQueryData<TimeEntry>(['timeEntry', id]);

      // Optimistically update list
      if (previousEntries) {
        queryClient.setQueryData<TimeEntry[]>(
          ['timeEntries'],
          previousEntries.map((entry) =>
            entry.id === id ? { ...entry, ...data, updatedAt: new Date().toISOString() } : entry
          )
        );
      }

      // Optimistically update single entry
      if (previousEntry) {
        queryClient.setQueryData<TimeEntry>(['timeEntry', id], {
          ...previousEntry,
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousEntries, previousEntry };
    },
    onSuccess: async (_data: TimeEntry | undefined, variables: { id: number; data: UpdateTimeEntryData }) => {
      console.log('🎉 UPDATE onSuccess callback triggered! Data:', _data);
      console.log('🔄 Invalidating queries...');
      // Use centralized invalidation to ensure all affected queries are updated
      // This includes overtime queries and fixes cache delays
      await invalidateTimeEntryAffectedQueries(queryClient);
      // Also invalidate the specific entry
      queryClient.invalidateQueries({ queryKey: ['timeEntry', variables.id] });
      console.log('✅ Queries invalidated!');
      toast.success('Zeiteintrag aktualisiert');
    },
    onError: (_error: Error, variables, context) => {
      console.error('💥 UPDATE onError callback triggered!');
      console.error('❌ Error object:', _error);
      console.error('❌ Error message:', _error.message);
      console.error('❌ Error stack:', _error.stack);

      // Rollback on error
      if (context?.previousEntries) {
        queryClient.setQueryData(['timeEntries'], context.previousEntries);
      }
      if (context?.previousEntry) {
        queryClient.setQueryData(['timeEntry', variables.id], context.previousEntry);
      }

      // Error toast shown by api/client.ts (no duplicate needed)
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
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });

      // Snapshot previous value
      const previousEntries = queryClient.getQueryData<TimeEntry[]>(['timeEntries']);

      // Optimistically remove from cache
      if (previousEntries) {
        queryClient.setQueryData<TimeEntry[]>(
          ['timeEntries'],
          previousEntries.filter((entry) => entry.id !== id)
        );
      }

      return { previousEntries };
    },
    onSuccess: async (data) => {
      console.log('🎉 onSuccess callback triggered! Data:', data);
      console.log('🔄 Invalidating queries...');
      // Use centralized invalidation to ensure all affected queries are updated
      // This includes overtime queries and fixes cache delays
      await invalidateTimeEntryAffectedQueries(queryClient);
      console.log('✅ Queries invalidated!');
      toast.success('Zeiteintrag gelöscht');
    },
    onError: (_error: Error, _variables, context) => {
      console.error('💥 onError callback triggered!');
      console.error('❌ Error object:', _error);
      console.error('❌ Error message:', _error.message);
      console.error('❌ Error stack:', _error.stack);

      // Rollback on error
      if (context?.previousEntries) {
        queryClient.setQueryData(['timeEntries'], context.previousEntries);
      }

      // Error toast shown by api/client.ts (no duplicate needed)
    },
  });
}
