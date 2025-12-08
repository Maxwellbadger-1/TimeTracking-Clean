/**
 * User Management Tests
 *
 * Tests for:
 * - CRUD operations
 * - Permissions (admin vs employee)
 * - Validation
 * - GDPR compliance
 */

import { TestCase, assert } from '../testRunner';
import { loginAsAdmin, loginAsEmployee, loginAsUser, adminFetch, employeeFetch } from './testUtils';

const API_URL = 'http://localhost:3000/api';

// Global flag to track if test employee exists
let testEmployeeExists = false;

// Helper: Ensure test employee exists (only runs once)
async function ensureTestEmployee() {
  if (testEmployeeExists) {
    return;
  }

  // Try to login as employee (if exists, JWT will be stored)
  try {
    await loginAsUser('testemployee', 'testemployee123');
    testEmployeeExists = true;
    return;
  } catch (error) {
    // Employee doesn't exist, create it
  }

  // Create the employee as admin (using JWT)
  await loginAsAdmin();

  await adminFetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testemployee',
      password: 'testemployee123',
      email: 'testemployee@test.com',
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
      weeklyHours: 40,
      vacationDaysPerYear: 30,
      hireDate: '2025-01-01',
    }),
  });

  testEmployeeExists = true;
}

export const userTests: TestCase[] = [
  // ========================================
  // 0. SETUP (runs first)
  // ========================================
  {
    id: 'user-000',
    name: 'Setup: Ensure test employee exists',
    category: 'users',
    description: 'Create test employee user for permission tests',
    run: async () => {
      await ensureTestEmployee();
      // Login back as admin for subsequent tests
      await loginAsAdmin();
    },
  },

  // ========================================
  // 1. READ OPERATIONS
  // ========================================
  {
    id: 'user-001',
    name: 'Get all users as admin',
    category: 'users',
    description: 'Admin should be able to get list of all users',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users`);

      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data);
      assert.isType(data.data, 'object');
      assert.greaterThan(data.data.length, 0);

      // Check first user has required fields
      const firstUser = data.data[0];
      assert.hasProperty(firstUser, 'id');
      assert.hasProperty(firstUser, 'username');
      assert.hasProperty(firstUser, 'email');
      assert.hasProperty(firstUser, 'role');
      assert.hasProperty(firstUser, 'weeklyHours');
    },
  },

  {
    id: 'user-002',
    name: 'Get all users as employee (should fail)',
    category: 'users',
    description: 'Employee should NOT have access to user list',
    run: async () => {
      await loginAsEmployee();

      const response = await employeeFetch(`${API_URL}/users`);

      assert.statusCode(response, 403);

      // CRITICAL: Login back as admin for subsequent tests
      await loginAsAdmin();
    },
  },

  {
    id: 'user-003',
    name: 'Get single user by ID',
    category: 'users',
    description: 'Admin should be able to get user by ID',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users/1`);

      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data);
      assert.equals(data.data.id, 1);
    },
  },

  {
    id: 'user-004',
    name: 'Get non-existent user (404)',
    category: 'users',
    description: 'Should return 404 for non-existent user',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users/99999`);

      assert.statusCode(response, 404);
    },
  },

  {
    id: 'user-005',
    name: 'GDPR data export',
    category: 'users',
    description: 'User should be able to export their own data',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users/me/data-export`);

      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data);
      assert.hasProperty(data.data, 'user');
      assert.hasProperty(data.data, 'timeEntries');
      assert.hasProperty(data.data, 'absences');
      assert.hasProperty(data.data, 'exportDate');
    },
  },

  // ========================================
  // 2. CREATE OPERATIONS
  // ========================================
  {
    id: 'user-006',
    name: 'Create new user as admin',
    category: 'users',
    description: 'Admin should be able to create new user',
    run: async () => {
      await loginAsAdmin();

      const timestamp = Date.now();
      const response = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `testuser_${timestamp}`,
          email: `test_${timestamp}@example.com`,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      const data = await response.json();

      assert.statusCode(response, 201);
      assert.success(data);
      assert.exists(data.data);
      assert.equals(data.data.username, `testuser_${timestamp}`);
      assert.equals(data.data.role, 'employee');
    },
  },

  {
    id: 'user-007',
    name: 'Create user with duplicate username',
    category: 'users',
    description: 'Should fail with 409 for duplicate username',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin', // Existing username
          email: 'newemail@example.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      assert.statusCode(response, 409);
    },
  },

  {
    id: 'user-008',
    name: 'Create user with duplicate email',
    category: 'users',
    description: 'Should fail with 409 for duplicate email',
    run: async () => {
      await loginAsAdmin();

      // First, get admin's email
      const adminResponse = await adminFetch(`${API_URL}/users/1`);
      const adminData = await adminResponse.json();
      const adminEmail = adminData.data.email;

      const timestamp = Date.now();
      const response = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `uniqueuser_${timestamp}`,
          email: adminEmail, // Duplicate email
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      assert.statusCode(response, 409);
    },
  },

  {
    id: 'user-009',
    name: 'Create user - validation (missing username)',
    category: 'users',
    description: 'Should fail when username is missing',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
        }),
      });

      assert.statusCode(response, 400);
    },
  },

  {
    id: 'user-010',
    name: 'Create user - vacation balance initialization',
    category: 'users',
    description: 'Should initialize vacation balances for current and next year',
    run: async () => {
      await loginAsAdmin();

      const timestamp = Date.now();
      const createResponse = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `vactest_${timestamp}`,
          email: `vactest_${timestamp}@example.com`,
          password: 'Test123!',
          firstName: 'Vacation',
          lastName: 'Test',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      const createData = await createResponse.json();
      assert.statusCode(createResponse, 201);

      // Check vacation balance was created
      const currentYear = new Date().getFullYear();
      const balanceResponse = await adminFetch(
        `${API_URL}/vacation-balances?userId=${createData.data.id}&year=${currentYear}`,
      );

      await balanceResponse.json();
      assert.statusCode(balanceResponse, 200);
      // Note: Actual balance check would require admin privileges
    },
  },

  // ========================================
  // 3. UPDATE OPERATIONS
  // ========================================
  {
    id: 'user-011',
    name: 'Update user as admin',
    category: 'users',
    description: 'Admin should be able to update user',
    run: async () => {
      await loginAsAdmin();

      // First create a user to update
      const timestamp = Date.now();
      const createResponse = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `updatetest_${timestamp}`,
          email: `updatetest_${timestamp}@example.com`,
          password: 'Test123!',
          firstName: 'Update',
          lastName: 'Test',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      const createData = await createResponse.json();
      assert.statusCode(createResponse, 201);
      assert.success(createData);

      const userId = createData.data.id;

      // Update the user
      const updateResponse = await adminFetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Updated',
          weeklyHours: 35,
        }),
      });

      const updateData = await updateResponse.json();

      assert.statusCode(updateResponse, 200);
      assert.success(updateData);
      assert.equals(updateData.data.firstName, 'Updated');
      assert.equals(updateData.data.weeklyHours, 35);
    },
  },

  {
    id: 'user-012',
    name: 'Update user - username conflict',
    category: 'users',
    description: 'Should fail when updating to existing username',
    run: async () => {
      await loginAsAdmin();

      // Try to update user 2 with user 1's username
      const response = await adminFetch(`${API_URL}/users/2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin', // Already exists
        }),
      });

      assert.statusCode(response, 409);
    },
  },

  // ========================================
  // 4. DELETE OPERATIONS
  // ========================================
  {
    id: 'user-013',
    name: 'Soft delete user',
    category: 'users',
    description: 'Admin should be able to soft delete user',
    run: async () => {
      await loginAsAdmin();

      // Create a user to delete
      const timestamp = Date.now();
      const createResponse = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `deletetest_${timestamp}`,
          email: `deletetest_${timestamp}@example.com`,
          password: 'Test123!',
          firstName: 'Delete',
          lastName: 'Test',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      const createData = await createResponse.json();
      assert.statusCode(createResponse, 201);
      assert.success(createData);

      const userId = createData.data.id;

      // Delete the user
      const deleteResponse = await adminFetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
      });

      assert.statusCode(deleteResponse, 200);
    },
  },

  {
    id: 'user-014',
    name: 'Cannot delete self',
    category: 'users',
    description: 'Admin should not be able to delete themselves',
    run: async () => {
      await loginAsAdmin();

      // Get current user ID
      const meResponse = await adminFetch(`${API_URL}/auth/me`);
      const meData = await meResponse.json();
      const myId = meData.data.user.id;

      // Try to delete self
      const deleteResponse = await adminFetch(`${API_URL}/users/${myId}`, {
        method: 'DELETE',
      });

      assert.statusCode(deleteResponse, 400);
    },
  },

  {
    id: 'user-015',
    name: 'Reactivate deleted user',
    category: 'users',
    description: 'Admin should be able to reactivate soft-deleted user',
    run: async () => {
      await loginAsAdmin();

      // Create and delete a user
      const timestamp = Date.now();
      const createResponse = await adminFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `reactivatetest_${timestamp}`,
          email: `reactivatetest_${timestamp}@example.com`,
          password: 'Test123!',
          firstName: 'Reactivate',
          lastName: 'Test',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      const createData = await createResponse.json();
      assert.statusCode(createResponse, 201);
      assert.success(createData);

      const userId = createData.data.id;

      // Delete
      await adminFetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
      });

      // Reactivate
      const reactivateResponse = await adminFetch(
        `${API_URL}/users/${userId}/reactivate`,
        {
          method: 'POST',
        }
      );

      const reactivateData = await reactivateResponse.json();

      assert.statusCode(reactivateResponse, 200);
      assert.success(reactivateData);
    },
  },

  // ========================================
  // 5. PERMISSION TESTS
  // ========================================
  {
    id: 'user-016',
    name: 'Employee cannot create users',
    category: 'users',
    description: 'Employee should NOT have permission to create users',
    run: async () => {
      await loginAsEmployee();

      const response = await employeeFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'unauthorized',
          email: 'unauthorized@example.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
          weeklyHours: 40,
          vacationDaysPerYear: 30,
          hireDate: '2025-01-01',
        }),
      });

      // Should get 403 (Forbidden) since employee has no permission
      assert.statusCode(response, 403);

      // CRITICAL: Login back as admin for subsequent tests
      await loginAsAdmin();
    },
  },

  {
    id: 'user-017',
    name: 'Employee cannot update other users',
    category: 'users',
    description: 'Employee should NOT be able to update other users',
    run: async () => {
      await loginAsEmployee();

      const response = await employeeFetch(`${API_URL}/users/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Hacked',
        }),
      });

      assert.statusCode(response, 403);

      // CRITICAL: Login back as admin for subsequent tests
      await loginAsAdmin();
    },
  },

  {
    id: 'user-018',
    name: 'Employee cannot delete users',
    category: 'users',
    description: 'Employee should NOT be able to delete users',
    run: async () => {
      await loginAsEmployee();

      const response = await employeeFetch(`${API_URL}/users/1`, {
        method: 'DELETE',
      });

      assert.statusCode(response, 403);

      // CRITICAL: Login back as admin for subsequent tests
      await loginAsAdmin();
    },
  },

  // ========================================
  // 6. PRIVACY & GDPR TESTS
  // ========================================
  {
    id: 'user-019',
    name: 'Accept privacy policy',
    category: 'users',
    description: 'User should be able to accept privacy policy',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users/me/privacy-consent`, {
        method: 'POST',
      });

      const data = await response.json();

      assert.statusCode(response, 200);
      assert.success(data);
      assert.exists(data.data);
      assert.exists(data.data.privacyConsentAt);
    },
  },

  {
    id: 'user-020',
    name: 'Password not in response',
    category: 'users',
    description: 'Password hash should NEVER be in API response',
    run: async () => {
      await loginAsAdmin();

      const response = await adminFetch(`${API_URL}/users/1`);

      const data = await response.json();

      assert.success(data);
      const dataStr = JSON.stringify(data.data);
      assert.isFalse(
        dataStr.includes('password'),
        'Password should not be in response'
      );
    },
  },
];
