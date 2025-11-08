import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { VacationBalance } from '../types';
import { toast } from 'sonner';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
      toast.success('Urlaubskonto erfolgreich gespeichert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
      toast.success('Urlaubskonto erfolgreich aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
      toast.success('Urlaubskonto erfolgreich gelöscht');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
      toast.success(data?.message || 'Urlaubskonten erfolgreich initialisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}
