// API Client for communicating with backend server
import { universalFetch } from '../lib/tauriHttpClient';
import { debugLog } from '../components/DebugPanel';
import { toast } from 'sonner';

// ========================================
// 🔥 MASSIVE DEBUG MODE - ENVIRONMENT VARIABLES 🔥
// ========================================
console.log('🔥🔥🔥 === VITE ENV DEBUG START === 🔥🔥🔥');
console.log('📦 import.meta.env:', import.meta.env);
console.log('📦 import.meta.env.VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('📦 import.meta.env.VITE_ENV:', import.meta.env.VITE_ENV);
console.log('📦 import.meta.env.MODE:', import.meta.env.MODE);
console.log('📦 import.meta.env.DEV:', import.meta.env.DEV);
console.log('📦 import.meta.env.PROD:', import.meta.env.PROD);
console.log('🔥🔥🔥 === VITE ENV DEBUG END === 🔥🔥🔥');

// DEVELOPMENT: Use localhost
// PRODUCTION: Use your Oracle Cloud server IP (change after deployment!)
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

console.log('🔧 rawApiUrl NACH Zuweisung:', rawApiUrl);
console.log('🔧 Falls undefined → Fallback zu localhost:3000');

// Ensure API_BASE_URL always ends with /api
export const API_BASE_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl}/api`;

// Base URL without /api suffix (for direct exports endpoints that include /api in path)
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

console.log('✅ FINALE Werte:');
console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🌐 Server Base URL:', SERVER_BASE_URL);

// ========================================
// 🔥 LAYER 2: RUNTIME ENVIRONMENT VERIFICATION 🔥
// ========================================
console.log('');
console.log('🔥 LAYER 2 DEBUG - Runtime Environment:');
console.log('🔍 ALLE import.meta.env Keys:', Object.keys(import.meta.env));
console.log('🔍 Window Location:', typeof window !== 'undefined' ? window.location.href : 'N/A (SSR)');
console.log('🔍 Fetch wird gehen zu:', API_BASE_URL);

// Test: Kann der Green Server erreicht werden?
console.log('');
console.log('🧪 Testing Green Server reachability...');
fetch('http://129.159.8.19:3001/api/health', {
  method: 'GET',
  mode: 'cors',
  cache: 'no-cache'
})
  .then(r => r.json())
  .then(d => {
    console.log('✅ Green Server REACHABLE:', d);
    console.log('   → Server Status:', d.status);
    console.log('   → Server Message:', d.message);
  })
  .catch(e => {
    console.error('❌ Green Server UNREACHABLE:', e.message);
    console.error('   → Error Type:', e.name);
  });

console.log('==========================================');

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  token?: string; // JWT token (returned on login)
}

// JWT Token Storage
const TOKEN_KEY = 'timetracking_jwt_token';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Store JWT token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Get JWT token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Remove JWT token from localStorage (logout)
   */
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options?.method || 'GET';

    try {
      debugLog({
        type: 'request',
        method: method,
        url: url,
        data: options?.body ? JSON.parse(options.body as string) : undefined,
        message: `📤 API Request: ${method} ${endpoint}`,
      });

      console.log('🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀');
      console.log('🌐 URL:', url);
      console.log('🔧 Method:', method);
      console.log('📦 Body:', options?.body);
      console.log('📋 Headers:', options?.headers);
      console.log('🍪 Credentials:', 'include');
      console.log('🌍 Current Origin:', typeof window !== 'undefined' ? window.location.origin : 'server');
      console.log('🎯 Target Origin:', new URL(url).origin);
      console.log('🔀 Cross-Origin?', typeof window !== 'undefined' ? window.location.origin !== new URL(url).origin : false);

      // Get JWT token and add Authorization header
      const token = this.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // CRITICAL: Use universalFetch (Tauri HTTP in Tauri, browser fetch in browser)
      // credentials: 'include' is kept for backwards compatibility with session-based auth
      const response = await universalFetch(url, {
        ...options,
        credentials: 'include', // Keep for backwards compatibility
        headers,
      });

      console.log('📥📥📥 RESPONSE RECEIVED 📥📥📥');
      console.log('📊 Status:', response.status);
      console.log('📊 Status Text:', response.statusText);
      console.log('📊 OK?', response.ok);
      console.log('📋 Response Headers:', response.headers);

      // Get raw response text FIRST before parsing
      const rawText = await response.clone().text();
      console.log('📄 RAW RESPONSE TEXT:', rawText);
      console.log('📏 Response length:', rawText.length);

      let data: ApiResponse<T>;
      try {
        data = await response.json();
        console.log('✅ JSON parsed successfully:', data);
      } catch (jsonError) {
        console.error('💥💥💥 JSON PARSE ERROR 💥💥💥');
        console.error('❌ Error:', jsonError);
        console.error('📄 Raw text that failed to parse:', rawText);
        console.error('📄 First 500 chars:', rawText.substring(0, 500));
        console.error('📄 Last 500 chars:', rawText.substring(Math.max(0, rawText.length - 500)));
        throw new Error(`JSON Parse Error: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`);
      }

      debugLog({
        type: 'response',
        method: method,
        url: url,
        status: response.status,
        data: data,
        message: `📥 API Response: ${response.status} ${response.statusText}`,
      });

      if (!response.ok) {
        debugLog({
          type: 'error',
          method: method,
          url: url,
          status: response.status,
          data: data,
          message: `❌ API Error: ${data.error || `HTTP ${response.status}`}`,
        });

        // Show toast notification for errors (except special cases)
        // SUPPRESS: 401 Unauthorized (handled by auth store)
        // SUPPRESS: 403 on /users endpoint (employees calling admin-only endpoint is expected)
        const is403OnUsers = response.status === 403 && endpoint === '/users';
        const shouldShowToast = response.status !== 401 && !is403OnUsers;

        if (shouldShowToast) {
          toast.error(data.error || `Server-Fehler: ${response.status}`, {
            description: 'Die Anfrage konnte nicht verarbeitet werden.',
          });
        }

        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
        };
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);

      debugLog({
        type: 'error',
        method: method,
        url: url,
        message: `💥 Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: error instanceof Error ? error.toString() : 'Unknown error' },
      });

      // NOTE: Toast notifications removed - OfflineBanner already shows connection status
      // No need for redundant toasts on every failed request

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    console.log('🔥🔥🔥 PUT METHOD CALLED! 🔥🔥🔥');
    console.log('📍 Endpoint:', endpoint);
    console.log('📦 Data to send:', data);
    console.log('📄 Stringified body:', data ? JSON.stringify(data) : 'NO BODY');
    console.log('🌐 Full URL:', `${this.baseUrl}${endpoint}`);

    const result = await this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });

    console.log('✅ PUT request completed. Result:', result);
    return result;
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    console.log('🔥🔥🔥 DELETE METHOD CALLED! 🔥🔥🔥');
    console.log('📍 Endpoint:', endpoint);
    console.log('📦 Data:', data);
    console.log('🌐 Full URL:', `${this.baseUrl}${endpoint}`);

    const result = await this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });

    console.log('✅ DELETE request completed. Result:', result);
    return result;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
