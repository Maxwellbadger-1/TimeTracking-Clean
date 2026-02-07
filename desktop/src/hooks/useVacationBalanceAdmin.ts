import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { VacationBalance } from '../types';
import { toast } from 'sonner';
import { invalidateVacationAffectedQueries } from '../hooks/invalidationHelpers';

/**
 * Vacation Balance Admin Hooks
 * CRUD operations for managing employee vacation balances
 */

export interface VacationBalanceSummary {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  entitlement: number;
  carryover: number;
  taken: number;
  remaining: number;
  hasBalance: boolean;
}

export interface VacationBalanceCreateInput {
  userId: number;
  year: number;
  entitlement: number;
  carryover: number;
}

export interface VacationBalanceUpdateInput {
  entitlement?: number;
  carryover?: number;
  taken?: number;
}

/**
 * Get all vacation balances (with optional filters)
 */
export function useVacationBalances(filters?: { userId?: number; year?: number }) {
  return useQuery({
    queryKey: ['vacation-balances', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', String(filters.userId));
      if (filters?.year) params.append('year', String(filters.year));

      const response = await apiClient.get<VacationBalance[]>(
        `/vacation-balances?${params.toString()}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch vacation balances');
      }

      return response.data || [];
    },
    retry: false,
  });
}

/**
 * Get vacation balance summary for all users
 */
export function useVacationBalanceSummary(year?: number) {
  return useQuery({
    queryKey: ['vacation-balances', 'summary', year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (year) params.append('year', String(year));

      const response = await apiClient.get<VacationBalanceSummary[]>(
        `/vacation-balances/summary?${params.toString()}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch vacation balance summary');
      }

      return response.data || [];
    },
    retry: false,
    staleTime: 0, // Always refetch when data changes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Get vacation balance by ID
 */
export function useVacationBalance(id: number) {
  return useQuery({
    queryKey: ['vacation-balances', id],
    queryFn: async () => {
      const response = await apiClient.get<VacationBalance>(
        `/vacation-balances/${id}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch vacation balance');
      }

      return response.data;
    },
    enabled: !!id && id > 0,
    retry: false,
  });
}

/**
 * Create or update vacation balance
 */
export function useUpsertVacationBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VacationBalanceCreateInput) => {
      const response = await apiClient.post<VacationBalance>(
        '/vacation-balances',
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to create vacation balance');
      }

      return response.data;
    },
    onMutate: async (newBalance) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['vacation-balances'] });

      // Snapshot previous value
      const previousBalances = queryClient.getQueryData<VacationBalance[]>(['vacation-balances']);

      // Optimistically add/update balance
      if (previousBalances) {
        const optimisticBalance: VacationBalance = {
          id: Date.now(), // Temporary ID
          userId: newBalance.userId,
          year: newBalance.year,
          entitlement: newBalance.entitlement,
          carryover: newBalance.carryover,
          taken: 0,
          remaining: newBalance.entitlement + newBalance.carryover,
          createdAt: new Date().toISOString(),
        };

        // Check if balance already exists for this user/year
        const existingIndex = previousBalances.findIndex(
          (b) => b.userId === newBalance.userId && b.year === newBalance.year
        );

        if (existingIndex >= 0) {
          // Update existing
          const updated = [...previousBalances];
          updated[existingIndex] = { ...updated[existingIndex], ...optimisticBalance };
          queryClient.setQueryData<VacationBalance[]>(['vacation-balances'], updated);
        } else {
          // Add new
          queryClient.setQueryData<VacationBalance[]>(['vacation-balances'], [...previousBalances, optimisticBalance]);
        }
      }

      return { previousBalances };
    },
    onSuccess: async () => {
      // Use centralized invalidation - vacation changes affect overtime calculations
      await invalidateVacationAffectedQueries(queryClient);
      toast.success('Urlaubskonto erfolgreich gespeichert');
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousBalances) {
        queryClient.setQueryData(['vacation-balances'], context.previousBalances);
      }
      // Error toast shown by api/client.ts (no duplicate needed)
    },
  });
}

/**
 * Update vacation balance
 */
export function useUpdateVacationBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: VacationBalanceUpdateInput }) => {
      const response = await apiClient.put<VacationBalance>(
        `/vacation-balances/${id}`,
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update vacation balance');
      }

      return response.data;
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['vacation-balances'] });
      await queryClient.cancelQueries({ queryKey: ['vacation-balances', id] });

      // Snapshot previous values
      const previousBalances = queryClient.getQueryData<VacationBalance[]>(['vacation-balances']);
      const previousBalance = queryClient.getQueryData<VacationBalance>(['vacation-balances', id]);

      // Optimistically update list
      if (previousBalances) {
        queryClient.setQueryData<VacationBalance[]>(
          ['vacation-balances'],
          previousBalances.map((balance) => {
            if (balance.id === id) {
              const updated = { ...balance, ...data, updatedAt: new Date().toISOString() };
              // Recalculate remaining if entitlement/carryover/taken changed
              if (data.entitlement !== undefined || data.carryover !== undefined || data.taken !== undefined) {
                const entitlement = data.entitlement ?? balance.entitlement;
                const carryover = data.carryover ?? balance.carryover;
                const taken = data.taken ?? balance.taken;
                updated.remaining = entitlement + carryover - taken;
              }
              return updated;
            }
            return balance;
          })
        );
      }

      // Optimistically update single balance
      if (previousBalance) {
        const updated = { ...previousBalance, ...data, updatedAt: new Date().toISOString() };
        if (data.entitlement !== undefined || data.carryover !== undefined || data.taken !== undefined) {
          const entitlement = data.entitlement ?? previousBalance.entitlement;
          const carryover = data.carryover ?? previousBalance.carryover;
          const taken = data.taken ?? previousBalance.taken;
          updated.remaining = entitlement + carryover - taken;
        }
        queryClient.setQueryData<VacationBalance>(['vacation-balances', id], updated);
      }

      return { previousBalances, previousBalance };
    },
    onSuccess: async () => {
      // Use centralized invalidation - vacation changes affect overtime calculations
      await invalidateVacationAffectedQueries(queryClient);
      toast.success('Urlaubskonto erfolgreich aktualisiert');
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousBalances) {
        queryClient.setQueryData(['vacation-balances'], context.previousBalances);
      }
      if (context?.previousBalance) {
        queryClient.setQueryData(['vacation-balances', variables.id], context.previousBalance);
      }
      // Error toast shown by api/client.ts (no duplicate needed)
    },
  });
}

/**
 * Delete vacation balance
 */
export function useDeleteVacationBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/vacation-balances/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete vacation balance');
      }

      return response.data;
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['vacation-balances'] });

      // Snapshot previous value
      const previousBalances = queryClient.getQueryData<VacationBalance[]>(['vacation-balances']);

      // Optimistically remove from cache
      if (previousBalances) {
        queryClient.setQueryData<VacationBalance[]>(
          ['vacation-balances'],
          previousBalances.filter((balance) => balance.id !== id)
        );
      }

      return { previousBalances };
    },
    onSuccess: async () => {
      // Use centralized invalidation - vacation changes affect overtime calculations
      await invalidateVacationAffectedQueries(queryClient);
      toast.success('Urlaubskonto erfolgreich gelöscht');
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousBalances) {
        queryClient.setQueryData(['vacation-balances'], context.previousBalances);
      }
      // Error toast shown by api/client.ts (no duplicate needed)
    },
  });
}

/**
 * Bulk initialize vacation balances for all users for a given year
 */
export function useBulkInitializeVacationBalances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (year: number) => {
      const response = await apiClient.post<{ year: number; count: number; message: string }>(
        '/vacation-balances/bulk-initialize',
        { year }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to bulk initialize vacation balances');
      }

      return response.data;
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['vacation-balances'] });

      // Snapshot previous value
      const previousBalances = queryClient.getQueryData<VacationBalance[]>(['vacation-balances']);

      // Note: We don't optimistically add data here because we don't know
      // which users will get balances. The invalidation in onSuccess will refetch.

      return { previousBalances };
    },
    onSuccess: async (data) => {
      // Use centralized invalidation - vacation changes affect overtime calculations
      await invalidateVacationAffectedQueries(queryClient);
      toast.success(data?.message || 'Urlaubskonten erfolgreich initialisiert');
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error (restore snapshot)
      if (context?.previousBalances) {
        queryClient.setQueryData(['vacation-balances'], context.previousBalances);
      }
      // Error toast shown by api/client.ts (no duplicate needed)
    },
  });
}
