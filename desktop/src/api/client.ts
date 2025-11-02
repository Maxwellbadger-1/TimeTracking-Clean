// API Client for communicating with backend server
import { universalFetch } from '../lib/tauriHttpClient';
import { debugLog } from '../components/DebugPanel';

// DEVELOPMENT: Use localhost
// PRODUCTION: Use your Oracle Cloud server IP (change after deployment!)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

console.log('🌐 API Base URL:', API_BASE_URL);

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

      console.log('🚀🚀🚀 MAKING FETCH REQUEST 🚀🚀🚀');
      console.log('🌐 URL:', url);
      console.log('🔧 Method:', method);
      console.log('📦 Body:', options?.body);
      console.log('📋 Headers:', options?.headers);
      console.log('🍪 Credentials:', 'include');
      console.log('🌍 Current Origin:', typeof window !== 'undefined' ? window.location.origin : 'server');
      console.log('🎯 Target Origin:', new URL(url).origin);
      console.log('🔀 Cross-Origin?', typeof window !== 'undefined' ? window.location.origin !== new URL(url).origin : false);

      // CRITICAL: Use universalFetch (Tauri HTTP in Tauri, browser fetch in browser)
      // credentials: 'include' is ESSENTIAL for session cookies to work cross-origin
      const response = await universalFetch(url, {
        ...options,
        credentials: 'include', // CRITICAL: Required for cookies on cross-origin (localhost:1420 -> localhost:3000)
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
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
