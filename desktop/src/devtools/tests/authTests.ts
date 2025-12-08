/**
 * Authentication & Session Tests (JWT-based)
 *
 * Tests for:
 * - Login/Logout
 * - JWT token management
 * - Security
 */

import { TestCase, assert } from '../testRunner';
import { universalFetch } from '../../lib/tauriHttpClient';
import { loginAsAdmin, logout, adminFetch } from './testUtils';

const API_URL = 'http://localhost:3000/api';

export const authTests: TestCase[] = [
  // ========================================
  // 1. LOGIN TESTS
  // ========================================
  {
    id: 'auth-001',
    name: 'Login with valid credentials + JWT token',
    category: 'auth',
    description: 'Should successfully login and return JWT token',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data, 'Response should contain user data');
      assert.exists(data.token, 'Response should contain JWT token');
      assert.hasProperty(data.data, 'id');
      assert.hasProperty(data.data, 'username');
      assert.hasProperty(data.data, 'role');
      assert.equals(data.data.username, 'admin');
      assert.equals(data.data.role, 'admin');
    },
  },

  {
    id: 'auth-002',
    name: 'Login with invalid password',
    category: 'auth',
    description: 'Should fail with wrong password',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword',
        }),
      });

      const data = await response.json();

      assert.statusCode(response, 401);
      assert.isFalse(data.success);
      assert.exists(data.error);
    },
  },

  {
    id: 'auth-003',
    name: 'Login with invalid username',
    category: 'auth',
    description: 'Should fail with non-existent username',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'password',
        }),
      });

      const data = await response.json();

      assert.statusCode(response, 401);
      assert.isFalse(data.success);
    },
  },

  {
    id: 'auth-004',
    name: 'Login validation - missing username',
    category: 'auth',
    description: 'Should fail when username is missing',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'password',
        }),
      });

      const data = await response.json();

      assert.statusCode(response, 400);
      assert.isFalse(data.success);
      assert.matches(data.error, /username/i);
    },
  },

  {
    id: 'auth-005',
    name: 'Login validation - missing password',
    category: 'auth',
    description: 'Should fail when password is missing',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
        }),
      });

      const data = await response.json();

      assert.statusCode(response, 400);
      assert.isFalse(data.success);
      assert.matches(data.error, /password/i);
    },
  },

  // ========================================
  // 2. SESSION TESTS
  // ========================================
  {
    id: 'auth-006',
    name: 'Check session when logged in (JWT)',
    category: 'auth',
    description: 'Should return user data when authenticated with JWT',
    run: async () => {
      // Login and get JWT token
      await loginAsAdmin();

      // Check session with JWT token
      const response = await adminFetch(`${API_URL}/auth/session`);
      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data);
      assert.hasProperty(data.data, 'username');
    },
  },

  {
    id: 'auth-007',
    name: 'Check session when not logged in',
    category: 'auth',
    description: 'Should return null when no session',
    run: async () => {
      // First logout to ensure clean state
      await universalFetch(`${API_URL}/auth/logout`, {
        method: 'POST',
      });

      // Then check session
      const response = await universalFetch(`${API_URL}/auth/session`);

      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.isNull(data.data);
    },
  },

  {
    id: 'auth-008',
    name: 'Get current user (/me endpoint) with JWT',
    category: 'auth',
    description: 'Should return fresh user data from database',
    run: async () => {
      // Login with JWT
      await loginAsAdmin();

      // Get current user with JWT
      const response = await adminFetch(`${API_URL}/auth/me`);
      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data);
      assert.hasProperty(data.data, 'user');
      assert.exists(data.data.user);
      assert.hasProperty(data.data.user, 'id');
      assert.hasProperty(data.data.user, 'username');
      assert.hasProperty(data.data.user, 'email');
      assert.hasProperty(data.data.user, 'role');
      assert.hasProperty(data.data.user, 'weeklyHours');
      assert.hasProperty(data.data.user, 'vacationDaysPerYear');
    },
  },

  {
    id: 'auth-009',
    name: 'Get /me without authentication',
    category: 'auth',
    description: 'Should return 401 when not logged in',
    run: async () => {
      // Try to get /me without JWT token
      const response = await universalFetch(`${API_URL}/auth/me`);

      assert.statusCode(response, 401);
    },
  },

  // ========================================
  // 3. LOGOUT TESTS
  // ========================================
  {
    id: 'auth-010',
    name: 'Logout successfully (JWT)',
    category: 'auth',
    description: 'Should clear JWT token and destroy session',
    run: async () => {
      // Login with JWT
      await loginAsAdmin();

      // Logout with JWT
      await logout('admin');

      // Verify token is cleared - try to use it without token
      const response = await universalFetch(`${API_URL}/auth/session`);
      const data = await response.json();

      assert.statusCode(response, 200);
      // Without JWT token, should return null
      assert.isTrue(data.data === null);
    },
  },

  // ========================================
  // 4. JWT TOKEN PERSISTENCE TESTS
  // ========================================
  {
    id: 'auth-011',
    name: 'JWT token persists across requests',
    category: 'auth',
    description: 'JWT token should work for multiple requests',
    run: async () => {
      // Ensure clean state - logout first, then login
      await universalFetch(`${API_URL}/auth/logout`, { method: 'POST' });

      // Login and get JWT
      const token = await loginAsAdmin();
      assert.exists(token, 'Login should return a token');

      // Make multiple requests with same JWT - all should succeed
      for (let i = 0; i < 3; i++) {
        const response = await adminFetch(`${API_URL}/auth/session`);
        const data = await response.json();

        assert.statusCode(response, 200);
        assert.exists(data.data, `JWT should work on request ${i + 1}`);
      }
    },
  },

  {
    id: 'auth-012',
    name: 'Invalid JWT token returns 401',
    category: 'auth',
    description: 'Should reject invalid JWT tokens',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/session`, {
        headers: {
          'Authorization': 'Bearer invalid_token_xyz123',
        },
      });

      // Invalid token should be rejected (either 401 or return null data)
      const data = await response.json();
      assert.isTrue(response.status === 401 || data.data === null);
    },
  },

  // ========================================
  // 5. SECURITY TESTS
  // ========================================
  {
    id: 'auth-013',
    name: 'Password is not returned in response',
    category: 'auth',
    description: 'Should never expose password hash',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const data = await response.json();

      assert.success(data);
      assert.exists(data.data);

      // Check that password is NOT in response
      const dataStr = JSON.stringify(data.data);
      assert.isFalse(
        dataStr.includes('password'),
        'Password should not be in response'
      );
    },
  },

  {
    id: 'auth-014',
    name: 'SQL Injection protection',
    category: 'auth',
    description: 'Should prevent SQL injection in login',
    run: async () => {
      const response = await universalFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "admin' OR '1'='1",
          password: "admin' OR '1'='1",
        }),
      });

      // Should fail (not bypass authentication)
      assert.statusCode(response, 401);
    },
  },

  {
    id: 'auth-015',
    name: 'JWT token contains correct user data',
    category: 'auth',
    description: 'JWT payload should match user data',
    run: async () => {
      // Login and get token
      const token = await loginAsAdmin();

      // Decode JWT payload (base64 decode middle part)
      const parts = token.split('.');
      assert.equals(parts.length, 3, 'JWT should have 3 parts');

      const payload = JSON.parse(atob(parts[1]));

      assert.exists(payload.userId);
      assert.equals(payload.username, 'admin');
      assert.equals(payload.role, 'admin');
      assert.exists(payload.exp, 'JWT should have expiration');
      assert.exists(payload.iat, 'JWT should have issued-at time');
    },
  },
];
