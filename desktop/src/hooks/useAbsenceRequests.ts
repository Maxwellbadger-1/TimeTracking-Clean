import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { AbsenceRequest } from '../types';
import { toast } from 'sonner';

export interface AbsenceRequestFilters {
  userId?: number;
  status?: 'pending' | 'approved' | 'rejected';
  type?: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  year?: number;
  page?: number;
  limit?: number;
  forTeamCalendar?: boolean; // Use /absences/team endpoint (all approved absences)
}

interface CreateAbsenceRequestData {
  userId: number;
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  startDate: string;
  endDate: string;
  reason?: string;
}

interface ApproveAbsenceData {
  approvedBy: number;
}

interface RejectAbsenceData {
  rejectedBy: number;
  reason: string;
}

interface AbsenceRequestsResponse {
  rows: AbsenceRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Get all absence requests (with optional filters and pagination)
// Returns array for backward compatibility
export function useAbsenceRequests(filters?: AbsenceRequestFilters) {
  return useQuery({
    queryKey: ['absenceRequests', filters],
    queryFn: async () => {
      // For team calendar: Use special endpoint that returns all approved absences
      if (filters?.forTeamCalendar) {
        const response = await apiClient.get<AbsenceRequest[]>('/absences/team');

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch team absences');
        }

        return response.data || [];
      }

      // Regular absence requests with filters
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId.toString());
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.year) params.append('year', filters.year.toString());
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiClient.get<AbsenceRequest[] | AbsenceRequestsResponse>(`/absences${query}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch absence requests');
      }

      // Backward compatibility: Always return array
      if (Array.isArray(response.data)) {
        return response.data;
      }

      return response.data?.rows || [];
    },
  });
}

// Get single absence request
export function useAbsenceRequest(id: number) {
  return useQuery({
    queryKey: ['absenceRequest', id],
    queryFn: async () => {
      const response = await apiClient.get<AbsenceRequest>(`/absences/${id}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch absence request');
      }

      return response.data;
    },
    enabled: !!id,
  });
}

// Get pending absence requests (for admin)
export function usePendingAbsenceRequests() {
  return useAbsenceRequests({ status: 'pending' });
}

// Create absence request mutation
export function useCreateAbsenceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAbsenceRequestData) => {
      const response = await apiClient.post<AbsenceRequest>('/absences', data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create absence request');
      }

      return response.data;
    },
    onMutate: async (newRequest) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['absenceRequests'] });

      // Snapshot previous value
      const previousRequests = queryClient.getQueryData<AbsenceRequest[]>(['absenceRequests']);

      // Optimistically add new request
      if (previousRequests) {
        const optimisticRequest: AbsenceRequest = {
          id: Date.now(), // Temporary ID
          userId: newRequest.userId,
          type: newRequest.type,
          startDate: newRequest.startDate,
          endDate: newRequest.endDate,
          days: 1, // Will be calculated by backend
          daysRequired: 1, // Legacy alias
          reason: newRequest.reason || null,
          adminNote: null,
          status: newRequest.type === 'sick' ? 'approved' : 'pending',
          approvedBy: newRequest.type === 'sick' ? newRequest.userId : null,
          approvedAt: newRequest.type === 'sick' ? new Date().toISOString() : null,
          rejectedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<AbsenceRequest[]>(['absenceRequests'], [...previousRequests, optimisticRequest]);
      }

      return { previousRequests };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['absenceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['vacationBalance'] });

      // Different message based on type
      if (data?.type === 'sick') {
        toast.success('Krankmeldung wurde automatisch genehmigt');
      } else {
        toast.success('Abwesenheitsantrag wurde eingereicht');
      }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(['absenceRequests'], context.previousRequests);
      }
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Approve absence request mutation (Admin only)
export function useApproveAbsenceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ApproveAbsenceData }) => {
      const response = await apiClient.post<AbsenceRequest>(
        `/absences/${id}/approve`,
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to approve absence request');
      }

      return response.data;
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['absenceRequests'] });
      await queryClient.cancelQueries({ queryKey: ['absenceRequest', id] });

      // Snapshot previous values
      const previousRequests = queryClient.getQueryData<AbsenceRequest[]>(['absenceRequests']);
      const previousRequest = queryClient.getQueryData<AbsenceRequest>(['absenceRequest', id]);

      // Optimistically update list
      if (previousRequests) {
        queryClient.setQueryData<AbsenceRequest[]>(
          ['absenceRequests'],
          previousRequests.map((request) =>
            request.id === id
              ? {
                  ...request,
                  status: 'approved' as const,
                  approvedBy: data.approvedBy,
                  approvedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : request
          )
        );
      }

      // Optimistically update single request
      if (previousRequest) {
        queryClient.setQueryData<AbsenceRequest>(['absenceRequest', id], {
          ...previousRequest,
          status: 'approved',
          approvedBy: data.approvedBy,
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousRequests, previousRequest };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['absenceRequest', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['absenceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['vacationBalance'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeBalance'] });
      toast.success('Abwesenheitsantrag genehmigt');
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(['absenceRequests'], context.previousRequests);
      }
      if (context?.previousRequest) {
        queryClient.setQueryData(['absenceRequest', variables.id], context.previousRequest);
      }
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Reject absence request mutation (Admin only)
export function useRejectAbsenceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RejectAbsenceData }) => {
      const response = await apiClient.post<AbsenceRequest>(
        `/absences/${id}/reject`,
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to reject absence request');
      }

      return response.data;
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['absenceRequests'] });
      await queryClient.cancelQueries({ queryKey: ['absenceRequest', id] });

      // Snapshot previous values
      const previousRequests = queryClient.getQueryData<AbsenceRequest[]>(['absenceRequests']);
      const previousRequest = queryClient.getQueryData<AbsenceRequest>(['absenceRequest', id]);

      // Optimistically update list
      if (previousRequests) {
        queryClient.setQueryData<AbsenceRequest[]>(
          ['absenceRequests'],
          previousRequests.map((request) =>
            request.id === id
              ? {
                  ...request,
                  status: 'rejected' as const,
                  rejectedBy: data.rejectedBy,
                  rejectedAt: new Date().toISOString(),
                  rejectionReason: data.reason,
                  updatedAt: new Date().toISOString(),
                }
              : request
          )
        );
      }

      // Optimistically update single request
      if (previousRequest) {
        queryClient.setQueryData<AbsenceRequest>(['absenceRequest', id], {
          ...previousRequest,
          status: 'rejected',
          rejectedBy: data.rejectedBy,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousRequests, previousRequest };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['absenceRequest', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['absenceRequests'] });
      toast.success('Abwesenheitsantrag abgelehnt');
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(['absenceRequests'], context.previousRequests);
      }
      if (context?.previousRequest) {
        queryClient.setQueryData(['absenceRequest', variables.id], context.previousRequest);
      }
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Delete absence request mutation
export function useDeleteAbsenceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: number | { id: number; data?: { reason?: string } }) => {
      console.log('🔥🔥🔥 useDeleteAbsenceRequest mutationFn CALLED! 🔥🔥🔥');
      console.log('📦 Received params:', params);
      console.log('📦 Params type:', typeof params);

      const id = typeof params === 'number' ? params : params.id;
      const data = typeof params === 'object' ? params.data : undefined;

      console.log('✅ Extracted id:', id);
      console.log('✅ Extracted data:', data);
      console.log('🌐 About to call apiClient.delete with:', { endpoint: `/absences/${id}`, data });

      const response = await apiClient.delete(`/absences/${id}`, data);

      console.log('📡 API Response:', response);

      if (!response.success) {
        console.error('❌ API returned error:', response.error);
        throw new Error(response.error || 'Failed to delete absence request');
      }

      console.log('✅ Delete successful, returning data:', response.data);
      return response.data;
    },
    onMutate: async (params) => {
      const id = typeof params === 'number' ? params : params.id;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['absenceRequests'] });

      // Snapshot previous value
      const previousRequests = queryClient.getQueryData<AbsenceRequest[]>(['absenceRequests']);

      // Optimistically remove from cache
      if (previousRequests) {
        queryClient.setQueryData<AbsenceRequest[]>(
          ['absenceRequests'],
          previousRequests.filter((request) => request.id !== id)
        );
      }

      return { previousRequests };
    },
    onSuccess: () => {
      console.log('✅✅✅ useDeleteAbsenceRequest onSuccess called!');
      queryClient.invalidateQueries({ queryKey: ['absenceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['vacationBalance'] });
      toast.success('Abwesenheitsantrag gelöscht');
    },
    onError: (error: Error, _variables, context) => {
      console.error('💥💥💥 useDeleteAbsenceRequest onError called!', error);

      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(['absenceRequests'], context.previousRequests);
      }

      toast.error(`Fehler: ${error.message}`);
    },
  });
}
