import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { User, WorkSchedule } from '../types';
import { toast } from 'sonner';
import { invalidateUserAffectedQueries } from './invalidationHelpers';

interface CreateUserData {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  weeklyHours?: number;
  workSchedule?: WorkSchedule;
  vacationDaysPerYear?: number;
  department?: string;
  position?: string;
  hireDate?: string;
}

interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'employee';
  weeklyHours?: number;
  workSchedule?: WorkSchedule | null;
  vacationDaysPerYear?: number;
  department?: string;
  position?: string;
  hireDate?: string;
  endDate?: string;
  isActive?: boolean;
}

// Get current logged-in user
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await apiClient.get<{ user: User }>('/auth/me');

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch current user');
      }

      return response.data?.user || null;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get all users (Admin only)
// enabled: Only fetch when user is admin (prevents unnecessary 403 errors for employees)
export function useUsers(enabled: boolean = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/users');

      // If 403 Forbidden (employee trying to access admin endpoint), return empty array silently
      if (!response.success) {
        if (response.error?.includes('Forbidden') || response.error?.includes('Admin')) {
          return []; // Employees don't need user list
        }
        throw new Error(response.error || 'Failed to fetch users');
      }

      return response.data || [];
    },
    enabled, // Control when query runs (prevent unnecessary API calls)
    staleTime: 0, // CRITICAL FIX: Always fetch fresh user list (no caching)
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: false, // Don't retry on 403 errors
  });
}

// Get single user
export function useUser(id: number) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const response = await apiClient.get<User>(`/users/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user');
      }

      return response.data;
    },
    enabled: !!id,
  });
}

// Get active employees only (for team calendar)
// Uses /users/active API (available for all authenticated users)
export function useActiveEmployees() {
  return useQuery({
    queryKey: ['users', 'active'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/users/active');

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch active users');
      }

      return response.data || [];
    },
    staleTime: 0, // Always fetch fresh
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// Create user mutation (Admin only)
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await apiClient.post<User>('/users', data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create user');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // NEW: Invalidate overtime reports (contains user list)
      toast.success('Benutzer erfolgreich erstellt');
    },
    onError: (error: Error) => {
      // Error toast shown by api/client.ts (no duplicate needed)
      console.error('Create user failed:', error);
    },
  });
}

// Update user mutation (Admin only)
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateUserData }) => {
      const response = await apiClient.put<User>(`/users/${id}`, data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update user');
      }

      return response.data;
    },
    onMutate: async ({ id, data }) => {
      console.log('🚀 Optimistic update starting for user:', id);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user', id] });
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot previous values
      const previousUser = queryClient.getQueryData<User>(['user', id]);
      const previousUsers = queryClient.getQueryData<User[]>(['users']);

      // Optimistically update user
      if (previousUser) {
        const optimisticUser = { ...previousUser, ...data };
        queryClient.setQueryData(['user', id], optimisticUser);
        console.log('✨ Optimistically updated user:', optimisticUser);
      }

      // Optimistically update users list
      if (previousUsers) {
        const optimisticUsers = previousUsers.map(u =>
          u.id === id ? { ...u, ...data } : u
        );
        queryClient.setQueryData(['users'], optimisticUsers);
        console.log('✨ Optimistically updated users list');
      }

      // Return context for rollback
      return { previousUser, previousUsers, data };
    },
    onError: (error: Error, variables, context) => {
      console.error('❌ Update failed, rolling back optimistic update');

      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(['user', variables.id], context.previousUser);
      }
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }

      // Error toast shown by api/client.ts (no duplicate needed)
    },
    onSuccess: async (_, variables, context) => {
      console.log('🔥🔥🔥 USER UPDATE SUCCESS - DEBUG 🔥🔥🔥');
      console.log('📌 User ID:', variables.id);
      console.log('📌 Data changed:', context?.data);

      // Get all active queries to debug
      const allQueries = queryClient.getQueryCache().getAll();
      console.log('📊 All active queries:', allQueries.map(q => ({
        queryKey: q.queryKey,
        state: q.state.status,
        dataUpdatedAt: q.state.dataUpdatedAt
      })));

      // Invalidate user queries (to get fresh data from server)
      console.log('🔄 Invalidating user queries...');
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });

      // Check if vacation/overtime related fields were changed
      const dataChanged = context?.data;
      const needsVacationRefetch = dataChanged?.vacationDaysPerYear !== undefined || dataChanged?.hireDate !== undefined;
      const needsOvertimeRefetch = dataChanged?.weeklyHours !== undefined || dataChanged?.hireDate !== undefined;

      console.log('🔍 needsVacationRefetch:', needsVacationRefetch);
      console.log('🔍 needsOvertimeRefetch:', needsOvertimeRefetch);

      if (needsVacationRefetch) {
        console.log('🔄🔄🔄 VACATION REFETCH TRIGGERED 🔄🔄🔄');
        console.log('📌 Invalidating ALL vacation balance queries (not just active ones)');

        // Check which vacation balance queries exist
        const vacationQueries = queryClient.getQueryCache().findAll({
          predicate: (query) => query.queryKey[0] === 'vacationBalance'
        });
        console.log('📊 Found vacation balance queries:', vacationQueries.map(q => ({
          queryKey: q.queryKey,
          state: q.state.status
        })));

        // Invalidate ALL vacation balance queries (not just active)
        // This marks them as stale, so they will refetch when next accessed/mounted
        await queryClient.invalidateQueries({
          queryKey: ['vacationBalance'],
          refetchType: 'all' // Refetch both active and inactive queries
        });

        console.log('✅ Vacation queries invalidated and refetched');

        // Check state after invalidation
        const vacationQueriesAfter = queryClient.getQueryCache().findAll({
          predicate: (query) => query.queryKey[0] === 'vacationBalance'
        });
        console.log('📊 Vacation queries AFTER invalidation:', vacationQueriesAfter.map(q => ({
          queryKey: q.queryKey,
          state: q.state.status,
          dataUpdatedAt: q.state.dataUpdatedAt
        })));
      }

      if (needsOvertimeRefetch) {
        console.log('🔄 Overtime-related fields changed, forcing refetch...');
        // Force immediate refetch of overtime queries (backend has already updated the data)
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['overtimeBalance', variables.id], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['overtimeSummary', variables.id], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['currentOvertimeStats', variables.id], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['totalOvertime', variables.id], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['overtime'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['overtime', 'aggregated'], type: 'active' }) // Aggregated stats for "Alle Mitarbeiter"
        ]);
        console.log('✅ Overtime refetch completed');
      }

      // Use centralized invalidation for general cache updates
      // This ensures ALL affected queries are properly invalidated (includes overtime-history!)
      await invalidateUserAffectedQueries(queryClient);

      // Also invalidate the specific queries not covered by the helper
      queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // User data changed (name, weeklyHours, etc.)

      console.log('✅ All relevant caches invalidated');
      console.log('🔥🔥🔥 END USER UPDATE SUCCESS DEBUG 🔥🔥🔥');
      toast.success('Benutzer aktualisiert');
    },
    onSettled: () => {
      console.log('✅ Mutation settled');
    },
  });
}

// Reactivate user mutation (Admin only - undo soft delete)
export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post<User>(`/users/${id}/reactivate`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to reactivate user');
      }

      return response.data;
    },
    onMutate: async (id: number) => {
      console.log('🔄 Optimistic reactivation starting for user:', id);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user', id] });
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot previous values
      const previousUser = queryClient.getQueryData<User>(['user', id]);
      const previousUsers = queryClient.getQueryData<User[]>(['users']);

      // Optimistically mark user as active
      if (previousUser) {
        const optimisticUser = { ...previousUser, isActive: true, deletedAt: null };
        queryClient.setQueryData(['user', id], optimisticUser);
        console.log('✨ Optimistically reactivated user:', optimisticUser);
      }

      // Optimistically update users list
      if (previousUsers) {
        const optimisticUsers = previousUsers.map(u =>
          u.id === id ? { ...u, isActive: true, deletedAt: null } : u
        );
        queryClient.setQueryData(['users'], optimisticUsers);
        console.log('✨ Optimistically updated users list');
      }

      // Return context for rollback
      return { previousUser, previousUsers };
    },
    onError: (error: Error, variables, context) => {
      console.error('❌ Reactivation failed, rolling back optimistic update');

      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(['user', variables], context.previousUser);
      }
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }

      // Error toast shown by api/client.ts (no duplicate needed)
    },
    onSuccess: async (_data, variables) => {
      console.log('✅ User reactivated successfully, invalidating related queries');

      // Use centralized invalidation to ensure all affected queries are updated
      // This includes overtime-history and other critical queries
      await invalidateUserAffectedQueries(queryClient);

      // Also invalidate specific user query and overtime reports
      queryClient.invalidateQueries({ queryKey: ['user', variables] });
      queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // Reactivated user should appear again

      toast.success('Benutzer reaktiviert');
      console.log('✅ All queries invalidated, UI updated');
    },
  });
}

// Delete user mutation (Admin only - soft delete)
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/users/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete user');
      }

      return response.data;
    },
    onMutate: async (id: number) => {
      console.log('🗑️ Optimistic delete starting for user:', id);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user', id] });
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot previous values
      const previousUser = queryClient.getQueryData<User>(['user', id]);
      const previousUsers = queryClient.getQueryData<User[]>(['users']);

      // Optimistically mark user as deleted (soft delete)
      if (previousUser) {
        const optimisticUser = { ...previousUser, isActive: false, deletedAt: new Date().toISOString() };
        queryClient.setQueryData(['user', id], optimisticUser);
        console.log('✨ Optimistically deleted user:', optimisticUser);
      }

      // Optimistically remove user from list (or mark as inactive)
      if (previousUsers) {
        const optimisticUsers = previousUsers.map(u =>
          u.id === id ? { ...u, isActive: false, deletedAt: new Date().toISOString() } : u
        );
        queryClient.setQueryData(['users'], optimisticUsers);
        console.log('✨ Optimistically updated users list');
      }

      // Return context for rollback
      return { previousUser, previousUsers };
    },
    onError: (error: Error, variables, context) => {
      console.error('❌ Delete failed, rolling back optimistic update');

      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(['user', variables], context.previousUser);
      }
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }

      // Error toast shown by api/client.ts (no duplicate needed)
    },
    onSuccess: async (_data, variables) => {
      console.log('✅ User deleted successfully, invalidating related queries');

      // Use centralized invalidation to ensure all affected queries are updated
      // This includes overtime-history and other critical queries
      await invalidateUserAffectedQueries(queryClient);

      // Also invalidate specific queries
      queryClient.invalidateQueries({ queryKey: ['user', variables] });
      queryClient.invalidateQueries({ queryKey: ['allUsersOvertimeSummary'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['all-users-overtime-reports'] }); // Deleted user should disappear

      toast.success('Benutzer gelöscht');
      console.log('✅ All queries invalidated, UI updated');
    },
  });
}
