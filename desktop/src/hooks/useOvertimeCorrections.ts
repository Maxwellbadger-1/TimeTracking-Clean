import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// Types
export interface OvertimeCorrection {
  id: number;
  userId: number;
  hours: number;
  date: string;
  reason: string;
  correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual';
  createdBy: number;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  creator?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  approver?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface OvertimeCorrectionCreateInput {
  userId: number;
  hours: number;
  date: string;
  reason: string;
  correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual';
}

export interface CorrectionStatistics {
  totalCorrections: number;
  totalHoursAdded: number;
  totalHoursSubtracted: number;
  netHoursChange: number;
  byType: {
    system_error: number;
    absence_credit: number;
    migration: number;
    manual: number;
  };
}

/**
 * Get overtime corrections for a specific user
 * @param userId User ID (optional)
 * @param year Year filter (optional, e.g., 2026)
 * @param month Month filter (optional, 1-12)
 */
export function useOvertimeCorrections(userId?: number, year?: number, month?: number) {
  return useQuery({
    queryKey: ['overtime', 'corrections', userId, year, month],
    queryFn: async () => {
      // Build query string
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId.toString());
      if (year) params.append('year', year.toString());
      if (month) params.append('month', month.toString());

      const queryString = params.toString();
      const endpoint = queryString ? `/overtime/corrections?${queryString}` : '/overtime/corrections';

      const response = await apiClient.get<OvertimeCorrection[]>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data || [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get all overtime corrections (admin only)
 */
export function useAllOvertimeCorrections() {
  return useQuery({
    queryKey: ['overtime', 'corrections', 'all'],
    queryFn: async () => {
      const response = await apiClient.get<OvertimeCorrection[]>('/overtime/corrections');
      if (!response.success) throw new Error(response.error);
      return response.data || [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get correction statistics
 */
export function useCorrectionStatistics(userId?: number) {
  return useQuery({
    queryKey: ['overtime', 'corrections', 'statistics', userId],
    queryFn: async () => {
      const endpoint = userId
        ? `/overtime/corrections/statistics?userId=${userId}`
        : '/overtime/corrections/statistics';
      const response = await apiClient.get<CorrectionStatistics>(endpoint);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Create overtime correction mutation
 */
export function useCreateOvertimeCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OvertimeCorrectionCreateInput) => {
      const response = await apiClient.post<OvertimeCorrection>('/overtime/corrections', input);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async (newCorrection) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['overtime', 'corrections'] });

      // Snapshot previous value
      const previousCorrections = queryClient.getQueryData<OvertimeCorrection[]>(['overtime', 'corrections']);

      // Optimistically add new correction
      if (previousCorrections) {
        const optimisticCorrection: OvertimeCorrection = {
          id: Date.now(), // Temporary ID
          userId: newCorrection.userId,
          hours: newCorrection.hours,
          date: newCorrection.date,
          reason: newCorrection.reason,
          correctionType: newCorrection.correctionType,
          createdBy: newCorrection.userId, // Temporary
          approvedBy: null,
          approvedAt: null,
          createdAt: new Date().toISOString(),
        };

        queryClient.setQueryData<OvertimeCorrection[]>(
          ['overtime', 'corrections'],
          [...previousCorrections, optimisticCorrection]
        );
      }

      return { previousCorrections };
    },
    onSuccess: () => {
      // Invalidate ALL overtime-related queries for immediate UI update (Berichte Tab + Arbeitszeitkonto)
      queryClient.invalidateQueries({ queryKey: ['overtime'] }); // Matches: ['overtime', 'all', ...], ['overtime', 'aggregated', ...]
      queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] }); // Individual user overtime summary
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousCorrections) {
        queryClient.setQueryData(['overtime', 'corrections'], context.previousCorrections);
      }
    },
  });
}

/**
 * Delete overtime correction mutation
 */
export function useDeleteOvertimeCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/overtime/corrections/${id}`);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['overtime', 'corrections'] });

      // Snapshot previous value
      const previousCorrections = queryClient.getQueryData<OvertimeCorrection[]>(['overtime', 'corrections']);

      // Optimistically remove from cache
      if (previousCorrections) {
        queryClient.setQueryData<OvertimeCorrection[]>(
          ['overtime', 'corrections'],
          previousCorrections.filter((correction) => correction.id !== id)
        );
      }

      return { previousCorrections };
    },
    onSuccess: () => {
      // Invalidate ALL overtime-related queries for immediate UI update (Berichte Tab + Arbeitszeitkonto)
      queryClient.invalidateQueries({ queryKey: ['overtime'] }); // Matches: ['overtime', 'all', ...], ['overtime', 'aggregated', ...]
      queryClient.invalidateQueries({ queryKey: ['overtimeSummary'] }); // Individual user overtime summary
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousCorrections) {
        queryClient.setQueryData(['overtime', 'corrections'], context.previousCorrections);
      }
    },
  });
}
