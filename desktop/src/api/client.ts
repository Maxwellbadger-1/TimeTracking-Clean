// API Client for communicating with backend server
import { universalFetch } from '../lib/tauriHttpClient';
import { debugLog } from '../components/DebugPanel';

const API_BASE_URL = 'http://localhost:3000/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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

      // Use universalFetch (Tauri HTTP in Tauri, browser fetch in browser)
      const response = await universalFetch(url, {
        ...options,
        credentials: 'include', // Important for session cookies
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data: ApiResponse<T> = await response.json();

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
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
