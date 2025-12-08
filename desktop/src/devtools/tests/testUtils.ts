/**
 * Test Utilities for JWT Authentication
 *
 * Provides helpers for login and authenticated requests
 */

import { universalFetch } from '../../lib/tauriHttpClient';

const API_URL = 'http://localhost:3000/api';

// Store JWT tokens for different users
const tokens: Map<string, string> = new Map();

/**
 * Login and store JWT token
 */
export async function loginAsUser(username: string, password: string): Promise<string> {
  const response = await universalFetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include', // Keep for backwards compatibility
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error('No JWT token received from login');
  }

  // Store token for this user
  tokens.set(username, data.token);

  return data.token;
}

/**
 * Login as admin
 */
export async function loginAsAdmin(): Promise<string> {
  return loginAsUser('admin', 'admin123');
}

/**
 * Login as employee (test user)
 */
export async function loginAsEmployee(): Promise<string> {
  return loginAsUser('testemployee', 'testemployee123');
}

/**
 * Get stored token for a user
 */
export function getToken(username: string = 'admin'): string | undefined {
  return tokens.get(username);
}

/**
 * Clear all stored tokens
 */
export function clearTokens(): void {
  tokens.clear();
}

/**
 * Make authenticated request with JWT token
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
  username: string = 'admin'
): Promise<Response> {
  const token = tokens.get(username);

  if (!token) {
    throw new Error(`No token found for user: ${username}. Did you call loginAs${username}() first?`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };

  return universalFetch(endpoint, {
    ...options,
    credentials: 'include', // Keep for backwards compatibility
    headers,
  });
}

/**
 * Make authenticated request as admin
 */
export async function adminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return authenticatedFetch(endpoint, options, 'admin');
}

/**
 * Make authenticated request as employee
 */
export async function employeeFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return authenticatedFetch(endpoint, options, 'testemployee');
}

/**
 * Logout and clear token
 */
export async function logout(username: string = 'admin'): Promise<void> {
  const token = tokens.get(username);

  if (token) {
    try {
      await universalFetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      // Ignore logout errors
    }
  }

  tokens.delete(username);
}
