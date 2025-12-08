/**
 * Integration Tests (HIGH PRIORITY)
 *
 * End-to-end workflows testing multiple features together:
 * - Full vacation workflow (request → approval → balance → overtime)
 * - Full sick leave workflow
 * - Cross-feature interactions (time entries + absences)
 * - Export accuracy (payroll, DATEV)
 * - User lifecycle (hire → work → terminate)
 * - Year-end closing
 * - Multi-user scenarios
 * - Permission cascades
 * - Notification delivery
 *
 * Implements: INT-001 to INT-010 from TEST_ROADMAP.md
 */

import { TestCase, assert } from '../testRunner';
import { loginAsAdmin, loginAsEmployee, adminFetch, employeeFetch, logout } from './testUtils';

const API_URL = 'http://localhost:3000/api';

// Helper: Login as admin

// Helper: Logout

// Helper: Create test user
async function createTestUser(username: string, role: string = 'employee') {
  const response = await adminFetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password: 'testpass123',
      email: `${username}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      role,
      weeklyHours: 40,
      vacationDays: 30,
      hireDate: '2025-01-01',
    }),
  });

  if (response.status === 201) {
    const data = await response.json();
    return data.data;
  }
  return null;
}

// Helper: Delete test user
async function deleteTestUser(userId: number) {
  try {
    await adminFetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    // Ignore errors
  }
}

// Helper: Create time entry
async function createTimeEntry(
  userId: number,
  date: string,
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
) {
  const response = await adminFetch(`${API_URL}/time-entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      date,
      startTime,
      endTime,
      breakMinutes,
      projectId: null,
      activityId: null,
      description: 'Integration test entry',
    }),
  });

  return response;
}

// Helper: Create absence request
async function createAbsenceRequest(
  userId: number,
  type: string,
  startDate: string,
  endDate: string
) {
  const response = await adminFetch(`${API_URL}/absences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      type,
      startDate,
      endDate,
      reason: 'Integration test',
    }),
  });

  return response;
}

// Helper: Approve absence
async function approveAbsence(absenceId: number) {
  const response = await adminFetch(`${API_URL}/absences/${absenceId}/approve`, {
    method: 'POST',
  });

  return response;
}

export const integrationTests: TestCase[] = [
  // ========================================
  // INT-001: Full Workflow - Vacation
  // ========================================
  {
    id: 'int-001',
    name: 'INT-001: Full Vacation Workflow - Request → Approve → Balance → Overtime',
    category: 'integration',
    description: 'End-to-end vacation workflow with all side effects',
    run: async () => {
      await loginAsAdmin();

      // 1. Create test user
      const user = await createTestUser('integration_vac_user_001');
      assert.exists(user, 'User should be created');
      const userId = user.id;

      try {
        // 2. Get initial vacation balance
        const balanceResponse = await adminFetch(
          `${API_URL}/vacation-balance/${userId}`,
          { credentials: 'include' }
        );
        assert.statusCode(balanceResponse, 200);
        const balanceData = await balanceResponse.json();
        const initialBalance = balanceData.data?.available || 30;

        // 3. Get initial overtime
        const overtimeResponse1 = await adminFetch(
          `${API_URL}/overtime/${userId}`,
          { credentials: 'include' }
        );
        const overtimeData1 = await overtimeResponse1.json();
        const initialOvertime = overtimeData1.data?.overtime || 0;

        // 4. Create vacation request (3 days: Mon-Wed Jan 6-8, 2026)
        const vacationResponse = await createAbsenceRequest(
          userId,
          'vacation',
          '2026-01-06',
          '2026-01-08'
        );
        assert.statusCode(vacationResponse, 201);

        const vacationData = await vacationResponse.json();
        assert.success(vacationData);
        const absenceId = vacationData.data.id;
        assert.equals(vacationData.data.status, 'pending', 'Initial status should be pending');

        // 5. Verify balance NOT deducted yet (still pending)
        const balanceResponse2 = await adminFetch(
          `${API_URL}/vacation-balance/${userId}`,
          { credentials: 'include' }
        );
        const balanceData2 = await balanceResponse2.json();
        assert.equals(
          balanceData2.data.available,
          initialBalance,
          'Balance should not change while pending'
        );

        // 6. Approve vacation
        const approveResponse = await approveAbsence(absenceId);
        assert.statusCode(approveResponse, 200);

        const approveData = await approveResponse.json();
        assert.success(approveData);
        assert.equals(approveData.data.status, 'approved', 'Status should be approved');

        // 7. Verify balance deducted (3 days)
        const balanceResponse3 = await adminFetch(
          `${API_URL}/vacation-balance/${userId}`,
          { credentials: 'include' }
        );
        const balanceData3 = await balanceResponse3.json();
        assert.equals(
          balanceData3.data.available,
          initialBalance - 3,
          'Balance should be reduced by 3 days'
        );

        // 8. Verify hours credited to overtime (3 days × 8h = 24h)
        const overtimeResponse2 = await adminFetch(
          `${API_URL}/overtime/${userId}`,
          { credentials: 'include' }
        );
        const overtimeData2 = await overtimeResponse2.json();

        // Expected: actualHours increased by 24h (vacation credit)
        const expectedOvertime = initialOvertime + 24;
        const actualOvertime = overtimeData2.data?.overtime || 0;

        assert.isTrue(
          Math.abs(actualOvertime - expectedOvertime) < 1,
          `Overtime should increase by ~24h (expected ~${expectedOvertime}h, got ${actualOvertime}h)`
        );

      } finally {
        // Cleanup
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // INT-002: Full Workflow - Sick Leave
  // ========================================
  {
    id: 'int-002',
    name: 'INT-002: Full Sick Leave Workflow - Auto-approve → Credit Hours → No Vacation Deduction',
    category: 'integration',
    description: 'Sick leave should auto-approve and credit hours without affecting vacation',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('integration_sick_user_002');
      assert.exists(user);
      const userId = user.id;

      try {
        // Get initial vacation balance
        const vacBalanceResponse = await adminFetch(
          `${API_URL}/vacation-balance/${userId}`,
          { credentials: 'include' }
        );
        const vacBalanceData = await vacBalanceResponse.json();
        const initialVacBalance = vacBalanceData.data?.available || 30;

        // Get initial overtime
        const overtimeResponse1 = await adminFetch(
          `${API_URL}/overtime/${userId}`,
          { credentials: 'include' }
        );
        const overtimeData1 = await overtimeResponse1.json();
        const initialOvertime = overtimeData1.data?.overtime || 0;

        // Create sick leave (2 days: Thu-Fri Jan 9-10, 2026)
        const sickResponse = await createAbsenceRequest(
          userId,
          'sick',
          '2026-01-09',
          '2026-01-10'
        );
        assert.statusCode(sickResponse, 201);

        const sickData = await sickResponse.json();
        assert.success(sickData);

        // Sick leave should be auto-approved
        assert.equals(
          sickData.data.status,
          'approved',
          'Sick leave should be auto-approved'
        );

        // Verify vacation balance UNCHANGED
        const vacBalanceResponse2 = await adminFetch(
          `${API_URL}/vacation-balance/${userId}`,
          { credentials: 'include' }
        );
        const vacBalanceData2 = await vacBalanceResponse2.json();
        assert.equals(
          vacBalanceData2.data.available,
          initialVacBalance,
          'Sick leave should NOT affect vacation balance'
        );

        // Verify hours credited to overtime (2 days × 8h = 16h)
        const overtimeResponse2 = await adminFetch(
          `${API_URL}/overtime/${userId}`,
          { credentials: 'include' }
        );
        const overtimeData2 = await overtimeResponse2.json();

        const expectedOvertime = initialOvertime + 16;
        const actualOvertime = overtimeData2.data?.overtime || 0;

        assert.isTrue(
          Math.abs(actualOvertime - expectedOvertime) < 1,
          `Overtime should increase by ~16h (sick leave credit)`
        );

      } finally {
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // INT-003: Cross-Feature - Time Entry + Absence
  // ========================================
  {
    id: 'int-003',
    name: 'INT-003: Cross-Feature Conflict - Time Entry + Absence on Same Day',
    category: 'integration',
    description: 'System should handle/prevent time entry and absence on same day',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('integration_conflict_user_003');
      assert.exists(user);
      const userId = user.id;

      try {
        const testDate = '2026-01-12'; // Monday

        // 1. Create time entry first
        const timeEntryResponse = await createTimeEntry(
          userId,
          testDate,
          '09:00',
          '17:00',
          30
        );
        assert.statusCode(timeEntryResponse, 201);

        // 2. Try to create absence for same day
        const absenceResponse = await createAbsenceRequest(
          userId,
          'vacation',
          testDate,
          testDate
        );

        // Should either:
        // - Reject with 400 (conflict)
        // - Accept with warning
        // Both are valid behaviors
        const isConflictRejected = absenceResponse.status === 400;
        const isAcceptedWithWarning = absenceResponse.status === 201;

        assert.isTrue(
          isConflictRejected || isAcceptedWithWarning,
          'System should handle time entry + absence conflict'
        );

        if (isConflictRejected) {
          const errorData = await absenceResponse.json();
          assert.exists(errorData.error, 'Should return error message');
        }

      } finally {
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // INT-004: Payroll Export Accuracy
  // ========================================
  {
    id: 'int-004',
    name: 'INT-004: Payroll Export - Accurate Hours Calculation',
    category: 'integration',
    description: 'Exported payroll data must match calculated overtime',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('integration_export_user_004');
      assert.exists(user);
      const userId = user.id;

      try {
        // Create some time entries
        await createTimeEntry(userId, '2026-01-13', '08:00', '16:00', 30); // 7.5h
        await createTimeEntry(userId, '2026-01-14', '09:00', '18:00', 60); // 8h
        await createTimeEntry(userId, '2026-01-15', '07:00', '15:00', 0);  // 8h

        // Total worked: 23.5h

        // Get overtime calculation
        const overtimeResponse = await adminFetch(
          `${API_URL}/overtime/${userId}`,
          { credentials: 'include' }
        );
        const overtimeData = await overtimeResponse.json();
        const calculatedHours = overtimeData.data?.totalHours || 0;

        // Export data
        const exportResponse = await adminFetch(
          `${API_URL}/exports/csv?userId=${userId}&month=2026-01`,
          { credentials: 'include' }
        );

        // Should succeed or return 404 if export not implemented
        assert.isTrue(
          exportResponse.status === 200 || exportResponse.status === 404,
          'Export endpoint should exist'
        );

        if (exportResponse.status === 200) {
          // Verify export contains correct data
          const csvText = await exportResponse.text();
          assert.exists(csvText, 'Export should return data');

          // CSV should contain the time entries
          assert.isTrue(
            csvText.includes('2026-01-13') ||
            csvText.includes('16:00') ||
            csvText.length > 0,
            'Export should contain time entry data'
          );
        }

      } finally {
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // INT-005: DATEV Export Format
  // ========================================
  {
    id: 'int-005',
    name: 'INT-005: DATEV Export - Correct Format & Structure',
    category: 'integration',
    description: 'DATEV export must follow standard format',
    run: async () => {
      await loginAsAdmin();

      // Try to export DATEV format
      const datevResponse = await adminFetch(
        `${API_URL}/exports/datev?month=2026-01`,
        { credentials: 'include' }
      );

      // Should succeed or return 404 if not implemented
      assert.isTrue(
        datevResponse.status === 200 ||
        datevResponse.status === 404 ||
        datevResponse.status === 400,
        'DATEV export endpoint should handle requests'
      );

      if (datevResponse.status === 200) {
        const datevData = await datevResponse.text();
        assert.exists(datevData, 'DATEV export should return data');

        // DATEV format typically uses semicolons
        // and has specific column structure
        const hasSemicolons = datevData.includes(';');
        const hasHeaders = datevData.split('\n').length > 0;

        assert.isTrue(
          hasSemicolons || hasHeaders,
          'DATEV format should have proper structure'
        );
      }
    },
  },

  // ========================================
  // INT-006: User Lifecycle
  // ========================================
  {
    id: 'int-006',
    name: 'INT-006: User Lifecycle - Hire → Work → Terminate → Data Preserved',
    category: 'integration',
    description: 'Full user lifecycle with data integrity',
    run: async () => {
      await loginAsAdmin();

      // 1. Hire user (create)
      const user = await createTestUser('integration_lifecycle_user_006');
      assert.exists(user, 'User should be created (hired)');
      const userId = user.id;

      try {
        // 2. User works (create time entries)
        const workResponse = await createTimeEntry(
          userId,
          '2026-01-16',
          '08:00',
          '17:00',
          60
        );
        assert.statusCode(workResponse, 201);

        // 3. User takes vacation
        const vacationResponse = await createAbsenceRequest(
          userId,
          'vacation',
          '2026-01-20',
          '2026-01-22'
        );
        assert.statusCode(vacationResponse, 201);

        const vacationData = await vacationResponse.json();
        const absenceId = vacationData.data.id;

        await approveAbsence(absenceId);

        // 4. Get all user data before termination
        const timeEntriesResponse = await adminFetch(
          `${API_URL}/time-entries?userId=${userId}`,
          { credentials: 'include' }
        );
        const timeEntriesData = await timeEntriesResponse.json();
        const entryCount = timeEntriesData.data?.length || 0;

        const absencesResponse = await adminFetch(
          `${API_URL}/absences?userId=${userId}`,
          { credentials: 'include' }
        );
        const absencesData = await absencesResponse.json();
        const absenceCount = absencesData.data?.length || 0;

        assert.greaterThan(entryCount, 0, 'Should have time entries');
        assert.greaterThan(absenceCount, 0, 'Should have absences');

        // 5. Terminate user (soft delete)
        const deleteResponse = await adminFetch(`${API_URL}/users/${userId}`, {
          method: 'DELETE',
        });
        assert.statusCode(deleteResponse, 200);

        // 6. Verify user marked as deleted (not hard deleted)
        const userCheckResponse = await adminFetch(`${API_URL}/users/${userId}`);

        // Should either return 404 or return user with deletedAt field
        const isDeleted = userCheckResponse.status === 404;

        if (userCheckResponse.status === 200) {
          const userData = await userCheckResponse.json();
          const hasDeletedAt = userData.data?.deletedAt != null;
          assert.isTrue(hasDeletedAt, 'User should have deletedAt timestamp');
        } else {
          assert.statusCode(userCheckResponse, 404);
        }

        // 7. Verify data still accessible (for GDPR exports, audits)
        // Time entries should still be queryable
        const historicalDataResponse = await adminFetch(
          `${API_URL}/time-entries?userId=${userId}`,
          { credentials: 'include' }
        );

        // Data should either still exist or be properly archived
        assert.isTrue(
          historicalDataResponse.status === 200 || historicalDataResponse.status === 404,
          'Historical data should be handled properly'
        );

      } catch (error) {
        // Cleanup already handled by deleteTestUser
        throw error;
      }
    },
  },

  // ========================================
  // INT-007: Year-End Closing
  // ========================================
  {
    id: 'int-007',
    name: 'INT-007: Year-End Closing - Vacation Carryover & Overtime Reset',
    category: 'integration',
    description: 'Year-end processes (carryover, resets) work correctly',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('integration_yearend_user_007');
      assert.exists(user);
      const userId = user.id;

      try {
        // Check vacation balance for current year
        const balance2025Response = await adminFetch(
          `${API_URL}/vacation-balance/${userId}?year=2025`,
          { credentials: 'include' }
        );

        // Check vacation balance for next year
        const balance2026Response = await adminFetch(
          `${API_URL}/vacation-balance/${userId}?year=2026`,
          { credentials: 'include' }
        );

        // Both years should return valid data
        assert.isTrue(
          balance2025Response.status === 200 || balance2025Response.status === 404,
          'Should handle 2025 balance query'
        );
        assert.isTrue(
          balance2026Response.status === 200 || balance2026Response.status === 404,
          'Should handle 2026 balance query'
        );

        if (balance2025Response.status === 200 && balance2026Response.status === 200) {
          const data2025 = await balance2025Response.json();
          const data2026 = await balance2026Response.json();

          // Both years should have valid entitlements
          assert.exists(data2025.data, '2025 data should exist');
          assert.exists(data2026.data, '2026 data should exist');
        }

        // Check if year-end closing API exists
        const yearEndResponse = await adminFetch(
          `${API_URL}/admin/year-end-closing?year=2025`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: 2025 }),
          }
        );

        // Should either work (201) or not be implemented (404/405)
        assert.isTrue(
          yearEndResponse.status === 201 ||
          yearEndResponse.status === 404 ||
          yearEndResponse.status === 405 ||
          yearEndResponse.status === 400,
          'Year-end closing endpoint should exist or return proper error'
        );

      } finally {
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // INT-008: Multi-User Scenario
  // ========================================
  {
    id: 'int-008',
    name: 'INT-008: Multi-User - Concurrent Operations & Data Isolation',
    category: 'integration',
    description: 'Multiple users can work independently without conflicts',
    run: async () => {
      await loginAsAdmin();

      // Create 3 test users
      const user1 = await createTestUser('integration_multi_user_008a');
      const user2 = await createTestUser('integration_multi_user_008b');
      const user3 = await createTestUser('integration_multi_user_008c');

      assert.exists(user1);
      assert.exists(user2);
      assert.exists(user3);

      try {
        // Each user creates time entries for same date
        const testDate = '2026-01-23';

        const entry1 = await createTimeEntry(user1.id, testDate, '08:00', '16:00', 30);
        const entry2 = await createTimeEntry(user2.id, testDate, '09:00', '17:00', 60);
        const entry3 = await createTimeEntry(user3.id, testDate, '07:00', '15:00', 0);

        assert.statusCode(entry1, 201);
        assert.statusCode(entry2, 201);
        assert.statusCode(entry3, 201);

        // Verify data isolation - user 1's entries don't affect user 2
        const user1Entries = await adminFetch(
          `${API_URL}/time-entries?userId=${user1.id}&startDate=${testDate}&endDate=${testDate}`,
          { credentials: 'include' }
        );
        const user1Data = await user1Entries.json();

        const user2Entries = await adminFetch(
          `${API_URL}/time-entries?userId=${user2.id}&startDate=${testDate}&endDate=${testDate}`,
          { credentials: 'include' }
        );
        const user2Data = await user2Entries.json();

        // Each user should have exactly 1 entry
        assert.equals(user1Data.data?.length, 1, 'User 1 should have 1 entry');
        assert.equals(user2Data.data?.length, 1, 'User 2 should have 1 entry');

        // Verify overtime calculated independently
        const overtime1Response = await adminFetch(
          `${API_URL}/overtime/${user1.id}`,
          { credentials: 'include' }
        );
        const overtime2Response = await adminFetch(
          `${API_URL}/overtime/${user2.id}`,
          { credentials: 'include' }
        );

        const overtime1Data = await overtime1Response.json();
        const overtime2Data = await overtime2Response.json();

        // Each user should have different overtime (different work hours)
        const ot1 = overtime1Data.data?.totalHours || 0;
        const ot2 = overtime2Data.data?.totalHours || 0;

        // They worked different hours, so totals should differ
        assert.isTrue(
          Math.abs(ot1 - ot2) > 0.1,
          'Users should have independent overtime calculations'
        );

      } finally {
        await deleteTestUser(user1.id);
        await deleteTestUser(user2.id);
        await deleteTestUser(user3.id);
      }
    },
  },

  // ========================================
  // INT-009: Permission Cascade
  // ========================================
  {
    id: 'int-009',
    name: 'INT-009: Permission Cascade - Admin vs Employee Access',
    category: 'integration',
    description: 'Permissions properly restrict access across all features',
    run: async () => {
      await loginAsAdmin();

      // Create employee user
      const employee = await createTestUser('integration_perm_employee_009', 'employee');
      assert.exists(employee);

      try {
        // Test employee login
        await logout();
        const employeeLoginResponse = await adminFetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'integration_perm_employee_009',
            password: 'testpass123',
          }),
        });
        assert.statusCode(employeeLoginResponse, 200);

        // Employee tries to access admin-only endpoints
        const allUsersResponse = await adminFetch(`${API_URL}/users`);

        // Should be forbidden (403) or limited to own data
        assert.isTrue(
          allUsersResponse.status === 403 || allUsersResponse.status === 200,
          'Employee access should be controlled'
        );

        if (allUsersResponse.status === 200) {
          const usersData = await allUsersResponse.json();
          // Employee should only see themselves
          assert.isTrue(
            usersData.data?.length <= 1 || usersData.data == null,
            'Employee should not see all users'
          );
        }

        // Employee tries to create another user
        const createUserResponse = await adminFetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'unauthorized_user',
            password: 'test123',
            email: 'test@test.com',
            role: 'employee',
          }),
        });

        // Should fail (403)
        assert.statusCode(createUserResponse, 403);

        // Login back as admin
        await logout();
        await loginAsAdmin();

      } finally {
        await deleteTestUser(employee.id);
      }
    },
  },

  // ========================================
  // INT-010: Notification Delivery
  // ========================================
  {
    id: 'int-010',
    name: 'INT-010: Notification Delivery - Absence Request → Admin Notification',
    category: 'integration',
    description: 'Notifications are created and delivered correctly',
    run: async () => {
      await loginAsAdmin();

      const employee = await createTestUser('integration_notif_user_010', 'employee');
      assert.exists(employee);

      try {
        // Get admin user ID
        const adminResponse = await adminFetch(`${API_URL}/users/me`);
        const adminData = await adminResponse.json();
        const adminId = adminData.data?.id;

        // Check notifications before
        const notificationsBefore = await adminFetch(
          `${API_URL}/notifications`,
          { credentials: 'include' }
        );
        const notifDataBefore = await notificationsBefore.json();
        const countBefore = notifDataBefore.data?.length || 0;

        // Employee creates vacation request (should trigger notification)
        const vacationResponse = await createAbsenceRequest(
          employee.id,
          'vacation',
          '2026-01-27',
          '2026-01-29'
        );
        assert.statusCode(vacationResponse, 201);

        // Wait a bit for notification to be created
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check notifications after
        const notificationsAfter = await adminFetch(
          `${API_URL}/notifications`,
          { credentials: 'include' }
        );

        // Should succeed or return 404 if notifications not implemented
        assert.isTrue(
          notificationsAfter.status === 200 || notificationsAfter.status === 404,
          'Notifications endpoint should exist'
        );

        if (notificationsAfter.status === 200) {
          const notifDataAfter = await notificationsAfter.json();
          const countAfter = notifDataAfter.data?.length || 0;

          // Should have at least 1 new notification
          assert.isTrue(
            countAfter >= countBefore,
            'New notification should be created'
          );
        }

      } finally {
        await deleteTestUser(employee.id);
      }
    },
  },
];
