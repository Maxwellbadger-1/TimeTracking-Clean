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
  isActive?: boolean;
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Benutzer aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Delete user mutation (Admin only - soft delete)
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      console.log('🔥🔥🔥 DELETE USER MUTATION TRIGGERED 🔥🔥🔥');
      console.log('📍 User ID to delete:', id);
      console.log('🌐 Calling API endpoint: DELETE /users/' + id);

      const response = await apiClient.delete(`/users/${id}`);

      console.log('📥 DELETE USER RESPONSE:', response);
      console.log('✅ Success?', response.success);
      console.log('📦 Data:', response.data);
      console.log('❌ Error?', response.error);

      if (!response.success) {
        console.error('💥💥💥 DELETE FAILED 💥💥💥');
        console.error('Error message:', response.error);
        throw new Error(response.error || 'Failed to delete user');
      }

      console.log('✅✅✅ DELETE SUCCESSFUL ✅✅✅');
      return response.data;
    },
    onSuccess: (data, variables) => {
      console.log('🎉 DELETE SUCCESS CALLBACK TRIGGERED');
      console.log('📦 Deleted user ID:', variables);
      console.log('📊 Response data:', data);
      console.log('🔄 Invalidating users query...');

      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Benutzer gelöscht');

      console.log('✅ Query invalidated, UI should refresh');
    },
    onError: (error: Error, variables) => {
      console.error('💥💥💥 DELETE ERROR CALLBACK TRIGGERED 💥💥💥');
      console.error('❌ Error:', error);
      console.error('❌ User ID that failed:', variables);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);

      toast.error(`Fehler: ${error.message}`);
    },
  });
}
