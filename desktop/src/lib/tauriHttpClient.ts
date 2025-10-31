import { fetch as tauriFetch, Response as TauriResponse } from '@tauri-apps/plugin-http';
import { debugLog } from '../components/DebugPanel';

/**
 * Tauri HTTP Client Wrapper
 *
 * This wrapper uses Tauri's HTTP plugin instead of browser fetch
 * to properly handle HttpOnly cookies and session management.
 *
 * Why? Browser fetch in Tauri doesn't persist HttpOnly cookies,
 * causing authentication to fail. Tauri's HTTP plugin handles this correctly.
 */

interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials;
}

async function tauriHttpFetch(
  url: string | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const urlString = url.toString();

  // Log request
  debugLog({
    type: 'request',
    method: options.method || 'GET',
    url: urlString,
    data: options.body ? JSON.parse(options.body as string) : undefined,
    message: `🌐 Making request via Tauri HTTP Plugin (cookies will be handled correctly)`,
  });

  try {
    // Use Tauri's HTTP plugin for all HTTP(S) requests
    const response = await tauriFetch(urlString, {
      method: options.method || 'GET',
      headers: options.headers as Record<string, string>,
      body: options.body instanceof FormData ? options.body : (options.body as any),
    });

    // Read response body
    const text = await response.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    // Log response
    debugLog({
      type: 'response',
      method: options.method || 'GET',
      url: urlString,
      status: response.status,
      data: data,
      message: `✅ Response received (Status: ${response.status} ${response.statusText})`,
    });

    // Check if response is OK
    if (!response.ok) {
      debugLog({
        type: 'error',
        method: options.method || 'GET',
        url: urlString,
        status: response.status,
        data: data,
        message: `❌ HTTP Error: ${response.status} ${response.statusText}`,
      });
    }

    // Create a Response-like object that matches browser fetch API
    const browserResponse = new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    });

    return browserResponse;
  } catch (error: any) {
    debugLog({
      type: 'error',
      method: options.method || 'GET',
      url: urlString,
      message: `💥 Network Error: ${error.message}`,
      data: { error: error.toString() },
    });

    throw error;
  }
}

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  if (typeof window === 'undefined') return false;

  // Check multiple Tauri indicators
  return (
    '__TAURI__' in window ||
    '__TAURI_INTERNALS__' in window ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost'
  );
}

/**
 * Universal fetch that works in both Tauri and browser
 */
export async function universalFetch(
  url: string | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const urlString = url.toString();
  const isTauriEnv = isTauri();

  // Debug: Log environment info
  if (typeof window !== 'undefined') {
    const envInfo = {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      hasTauri: '__TAURI__' in window,
      hasTauriInternals: '__TAURI_INTERNALS__' in window,
    };

    debugLog({
      type: 'info',
      message: `🔍 Environment Check: ${JSON.stringify(envInfo)} | isTauri=${isTauriEnv}`,
    });
  }

  // Only use Tauri HTTP for http(s) URLs in Tauri environment
  if (isTauriEnv && (urlString.startsWith('http://') || urlString.startsWith('https://'))) {
    debugLog({
      type: 'info',
      message: `🔧 Tauri environment detected - Using Tauri HTTP Plugin for: ${urlString}`,
    });
    return tauriHttpFetch(url, options);
  }

  // Fallback to browser fetch (for dev in browser)
  debugLog({
    type: 'info',
    message: `🌐 Browser environment - Using standard fetch for: ${urlString}`,
  });

  return fetch(url, options);
}

// Export as default
export default universalFetch;
