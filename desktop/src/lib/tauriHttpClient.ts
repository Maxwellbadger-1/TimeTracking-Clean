import { debugLog } from '../components/DebugPanel';

/**
 * Tauri HTTP Client Wrapper
 *
 * CRITICAL FIX: In development mode, we use browser's native fetch()
 * because it automatically handles cookies correctly.
 *
 * The Tauri HTTP plugin doesn't have built-in cookie persistence,
 * so for now we rely on the browser's cookie management which works
 * perfectly in dev mode (http://localhost:1420).
 */

interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials;
}

/**
 * Universal fetch that works in both Tauri and browser
 *
 * CRITICAL: We use browser's native fetch() because it handles
 * cookies automatically. This works in both dev mode and production
 * Tauri builds.
 */
export async function universalFetch(
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
    message: `🌐 Making request (credentials: ${options.credentials})`,
  });

  try {
    // Use browser's native fetch which handles cookies correctly
    const response = await fetch(url, options);

    // Read response
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
      message: `✅ Response received (Status: ${response.status})`,
    });

    // DEBUG: Check types in vacation balance responses
    if (urlString.includes('vacation-balance') && data.data) {
      console.log('🔍 DEBUG vacation-balance response types:', {
        entitlement: typeof data.data.entitlement,
        carryover: typeof data.data.carryover,
        taken: typeof data.data.taken,
        remaining: typeof data.data.remaining,
        available: typeof data.data.available,
        rawValues: {
          entitlement: data.data.entitlement,
          carryover: data.data.carryover,
          taken: data.data.taken,
        }
      });
    }

    // Check if response is OK
    if (!response.ok) {
      debugLog({
        type: 'error',
        method: options.method || 'GET',
        url: urlString,
        status: response.status,
        data: data,
        message: `❌ HTTP Error: ${response.status}`,
      });
    }

    // Return response with text already consumed, re-create it
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
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

// Export as default
export default universalFetch;
