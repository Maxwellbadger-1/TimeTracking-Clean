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
 * CRITICAL: Automatically adds JWT token from localStorage to Authorization header.
 * This ensures all requests (including binary downloads) are authenticated.
 */
export async function universalFetch(
  url: string | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const urlString = url.toString();

  // Get JWT token from localStorage and add to headers
  const TOKEN_KEY = 'timetracking_jwt_token';
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Update options with headers including JWT
  const fetchOptions: FetchOptions = {
    ...options,
    headers,
  };

  // Log request
  debugLog({
    type: 'request',
    method: options.method || 'GET',
    url: urlString,
    data: options.body ? JSON.parse(options.body as string) : undefined,
    message: `🌐 Making request (credentials: ${options.credentials}, JWT: ${token ? 'present' : 'none'})`,
  });

  // ========================================
  // 🔥 LAYER 3: NETWORK LAYER VERIFICATION 🔥
  // ========================================
  console.log('');
  console.log('🔥 LAYER 3 DEBUG - Final Fetch Call:');
  console.log('  🌐 URL (toString):', url.toString());
  console.log('  🌐 URL (typeof):', typeof url);
  console.log('  📝 Method:', options.method || 'GET');
  console.log('  🔑 Headers:', Object.fromEntries(headers.entries()));
  console.log('  🍪 Credentials:', options.credentials);
  console.log('  🔐 JWT Token:', token ? `${token.substring(0, 20)}...` : 'NONE');
  console.log('');

  try {
    // Use browser's native fetch which handles cookies correctly
    const response = await fetch(url, fetchOptions);

    // ========================================
    // 🔥 LAYER 3: FETCH RESPONSE DEBUG 🔥
    // ========================================
    console.log('🔥 LAYER 3 DEBUG - Fetch Response:');
    console.log('  ✅ Status:', response.status, response.statusText);
    console.log('  🌐 Response URL (actual):', response.url); // WICHTIG: Zeigt Redirects!
    console.log('  🌐 Response URL differs from request?', response.url !== url.toString());
    console.log('');

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
