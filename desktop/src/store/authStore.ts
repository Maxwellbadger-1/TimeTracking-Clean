import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { User, ApiResponse } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.post<{ user: User }>('/auth/login', {
        username,
        password,
      });

      console.log('🔐 Login response:', response);

      if (response.success && response.data) {
        console.log('✅ Login successful, setting user:', response.data.user);
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        console.log('✅ Auth state updated, isAuthenticated: true');
        return true;
      } else {
        console.error('❌ Login failed:', response.error);
        set({
          error: response.error || 'Login fehlgeschlagen',
          isLoading: false,
          isAuthenticated: false,
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Netzwerkfehler';
      console.error('❌ Login error:', error);
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false,
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      await apiClient.post('/auth/logout');

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear state anyway
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });

    try {
      const response = await apiClient.get<{ user: User }>('/auth/me');

      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
