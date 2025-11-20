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
 */
export function useOvertimeCorrections(userId?: number) {
  return useQuery({
    queryKey: ['overtime', 'corrections', userId],
    queryFn: async () => {
      const endpoint = userId ? `/overtime/corrections?userId=${userId}` : '/overtime/corrections';
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
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['overtime', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] });
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
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['overtime', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      queryClient.invalidateQueries({ queryKey: ['work-time-accounts'] });
    },
  });
}
