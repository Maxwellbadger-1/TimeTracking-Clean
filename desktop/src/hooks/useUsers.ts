import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { User } from '../types';
import { toast } from 'sonner';

interface CreateUserData {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  weeklyHours?: number;
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
  vacationDaysPerYear?: number;
  department?: string;
  position?: string;
  hireDate?: string;
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
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/users');

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch users');
      }

      return response.data || [];
    },
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

// Get active employees only
export function useActiveEmployees() {
  const { data: users, ...rest } = useUsers();

  const activeEmployees = users?.filter(
    (user) => user.isActive && user.role === 'employee'
  ) || [];

  return {
    ...rest,
    data: activeEmployees,
  };
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
      toast.success('Benutzer erfolgreich erstellt');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
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

      toast.error(`Fehler: ${error.message}`);
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
          queryClient.refetchQueries({ queryKey: ['overtime'], type: 'active' })
        ]);
        console.log('✅ Overtime refetch completed');
      }

      // General invalidation (for queries not actively mounted)
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] });
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      queryClient.invalidateQueries({ queryKey: ['vacationBalance'] }); // For useVacationBalance
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] }); // For useVacationBalanceSummary (ADMIN PAGE!)
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      console.log('✅ All relevant caches invalidated');
      console.log('🔥🔥🔥 END USER UPDATE SUCCESS DEBUG 🔥🔥🔥');
      toast.success('Benutzer aktualisiert');
    },
    onSettled: () => {
      console.log('✅ Mutation settled');
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

      toast.error(`Fehler: ${error.message}`);
    },
    onSuccess: async (data, variables) => {
      console.log('✅ User deleted successfully, invalidating related queries');

      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['user', variables] });
      queryClient.invalidateQueries({ queryKey: ['users'] });

      // Invalidate overtime queries (user shouldn't appear in overtime dashboard anymore)
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] });
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      queryClient.invalidateQueries({ queryKey: ['allUsersOvertimeSummary'] });

      // Invalidate vacation queries
      queryClient.invalidateQueries({ queryKey: ['vacationBalance'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });

      // Invalidate time entries
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      toast.success('Benutzer gelöscht');
      console.log('✅ All queries invalidated, UI updated');
    },
  });
}
