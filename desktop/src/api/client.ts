// API Client for communicating with backend server
import { universalFetch } from '../lib/tauriHttpClient';
import { debugLog } from '../components/DebugPanel';
import { toast } from 'sonner';

// DEVELOPMENT: Use localhost
// PRODUCTION: Use your Oracle Cloud server IP (change after deployment!)
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Ensure API_BASE_URL always ends with /api
export const API_BASE_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl}/api`;

// Base URL without /api suffix (for direct exports endpoints that include /api in path)
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  token?: string; // JWT token (returned on login)
  /**
   * Phase 13 (DD-31, 13-07-PLAN.md): nur bei `success: false` gesetzt. Der HTTP-Statuscode
   * war bisher fuer den Aufrufer nicht sichtbar — `useWorkPeriods()` braucht ihn, um einen
   * 403 (Zugriffsablehnung) von jedem anderen Fehler zu unterscheiden (T-13-31, Zustand 3
   * „Kein Zugriff" vs. Zustand 2 Ladefehler). Minimale, additive Ergaenzung, kein Cast.
   */
  status?: number;
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

      // Get raw response text FIRST before parsing
      const rawText = await response.clone().text();

      let data: ApiResponse<T>;
      try {
        data = await response.json();
      } catch (jsonError) {
        // DD-44: Nutzdaten des Response-Koerpers werden bewusst NICHT vollstaendig protokolliert,
        // nur eine kurze, auf Fehlersuche zugeschnittene Vorschau plus die Fehlermeldung selbst.
        console.error('JSON Parse Error:', {
          message: jsonError instanceof Error ? jsonError.message : 'Unknown',
          rawTextPreview: rawText.substring(0, 200),
        });
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

        // WR-10 (Code-Review Phase 12): SUPPRESS fuer Endpunkte, die ihre Fehler selbst im
        // Vertragstext darstellen. Der Wechsel-Dialog behandelt genau diese Faelle bereits
        // (Zustand 13/14, jeweils EIN Banner) — der globale Toast zeigte daneben zusaetzlich
        // den internen Fehlercode: "PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell."
        // mit dem Untertitel "Die Anfrage konnte nicht verarbeitet werden.". Ein interner
        // Code in der Oberflaeche einer Personalverwaltung steht in keinem Textbuch, und die
        // doppelte Meldung widerspricht Zustand 13/14.
        // Geprueft: alle Verbraucher von /work-periods stellen ihre Fehler selbst dar —
        // WorkTimeChangeModal (Banner + Feldfehler), WorkTimePeriodList (Fehlerzustand mit
        // "Perioden erneut laden") und AbsenceRequestForm (previewUnavailable).
        const handlesOwnErrors = endpoint.startsWith('/work-periods');
        const shouldShowToast = response.status !== 401 && !is403OnUsers && !handlesOwnErrors;

        if (shouldShowToast) {
          toast.error(data.error || `Server-Fehler: ${response.status}`, {
            description: 'Die Anfrage konnte nicht verarbeitet werden.',
          });
        }

        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
          status: response.status,
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

  async delete<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
