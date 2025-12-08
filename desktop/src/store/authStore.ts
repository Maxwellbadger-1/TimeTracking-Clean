import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { User } from '../types';

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
      // Backend returns: { success: true, data: User, message: "..." }
      // NOT: { success: true, data: { user: User } }
      const response = await apiClient.post<User>('/auth/login', {
        username,
        password,
      });

      console.log('🔐 Login response:', response);

      if (response.success && response.data) {
        console.log('✅ Login successful, setting user:', response.data);

        // Store JWT token if provided
        if (response.token) {
          console.log('🔑 Storing JWT token');
          apiClient.setToken(response.token);
        }

        set({
          user: response.data, // Direct access, not response.data.user!
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
      // 1. Call logout endpoint to destroy session on server
      await apiClient.post('/auth/logout');

      // 2. Clear JWT token from localStorage
      console.log('🔑 Clearing JWT token');
      apiClient.clearToken();

      // 3. Clear local state IMMEDIATELY
      // This ensures UI updates even if server call fails
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      // 4. Force reload to clear any cached cookies in Tauri HTTP Plugin
      // IMPORTANT: Tauri HTTP Plugin caches cookies, window reload clears them
      // This prevents stale cookie issues on re-login
      if (typeof window !== 'undefined') {
        // Small delay to ensure state is updated before reload
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch (error) {
      console.error('Logout error:', error);

      // Clear JWT token anyway
      apiClient.clearToken();

      // Clear state anyway (network errors shouldn't prevent logout)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      // Force reload even on error to clear cookies
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
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
