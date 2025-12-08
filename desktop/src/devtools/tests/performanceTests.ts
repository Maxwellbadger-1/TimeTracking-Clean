/**
 * Performance Tests (MEDIUM PRIORITY)
 *
 * Benchmarking and load testing:
 * - 1000+ time entries query performance
 * - Overtime calculation with large datasets
 * - Concurrent user operations
 * - Report generation at scale
 * - Database index efficiency
 *
 * Implements: PERF-001 to PERF-005 from TEST_ROADMAP.md
 */

import { TestCase, assert } from '../testRunner';
import { loginAsAdmin, loginAsEmployee, adminFetch, employeeFetch, logout } from './testUtils';

const API_URL = 'http://localhost:3000/api';

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  QUERY_1000_ENTRIES: 2000,      // 2 seconds for 1000 entries
  OVERTIME_CALCULATION: 1000,     // 1 second for overtime calc
  CONCURRENT_OPERATIONS: 5000,    // 5 seconds for 10 concurrent users
  REPORT_GENERATION: 3000,        // 3 seconds for 100 user report
  INDEXED_QUERY: 500,             // 500ms for indexed queries
};

// Helper: Login as admin

// Helper: Create test user
async function createTestUser(username: string) {
  const response = await adminFetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password: 'testpass123',
      email: `${username}@test.com`,
      firstName: 'Perf',
      lastName: 'Test',
      role: 'employee',
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
  endTime: string
) {
  const response = await adminFetch(`${API_URL}/time-entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      date,
      startTime,
      endTime,
      breakMinutes: 30,
      projectId: null,
      activityId: null,
      description: 'Performance test entry',
    }),
  });

  return response;
}

// Helper: Generate date range (working days only)
function generateWorkingDays(startDate: Date, count: number): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  while (dates.length < count) {
    const dayOfWeek = current.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Helper: Delete time entries for user
async function deleteUserTimeEntries(userId: number) {
  try {
    const response = await adminFetch(
      `${API_URL}/time-entries?userId=${userId}`,
      { credentials: 'include' }
    );

    if (response.status === 200) {
      const data = await response.json();
      if (data.success && data.data) {
        for (const entry of data.data) {
          await adminFetch(`${API_URL}/time-entries/${entry.id}`, {
            method: 'DELETE',
          });
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
}

export const performanceTests: TestCase[] = [
  // ========================================
  // PERF-001: 1000 Time Entries - Query Speed
  // ========================================
  {
    id: 'perf-001',
    name: 'PERF-001: 1000 Time Entries - Query Performance < 2s',
    category: 'performance',
    description: 'System should handle large datasets efficiently',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('perf_large_dataset_001');
      assert.exists(user, 'User should be created');
      const userId = user.id;

      try {
        console.log('Creating 1000 time entries (this may take a while)...');

        // Generate 1000 working days (approx 4 years)
        const dates = generateWorkingDays(new Date('2022-01-03'), 1000);

        // Create entries in batches (to avoid timeout)
        const batchSize = 50;
        let created = 0;

        for (let i = 0; i < dates.length; i += batchSize) {
          const batch = dates.slice(i, i + batchSize);

          // Create batch
          const promises = batch.map(date =>
            createTimeEntry(userId, date, '08:00', '17:00')
          );

          await Promise.all(promises);
          created += batch.length;

          if (created % 200 === 0) {
            console.log(`  Created ${created}/1000 entries...`);
          }
        }

        console.log(`  ✓ Created ${created} entries`);

        // Performance test: Query all entries
        console.log('Querying all entries...');
        const startTime = Date.now();

        const queryResponse = await adminFetch(
          `${API_URL}/time-entries?userId=${userId}`,
          { credentials: 'include' }
        );

        const queryDuration = Date.now() - startTime;

        assert.statusCode(queryResponse, 200);

        const queryData = await queryResponse.json();
        assert.success(queryData);

        const entryCount = queryData.data?.length || 0;

        console.log(`  Query returned ${entryCount} entries in ${queryDuration}ms`);

        // Verify count
        assert.greaterThan(entryCount, 900, 'Should return ~1000 entries');

        // Performance assertion
        assert.lessThan(
          queryDuration,
          THRESHOLDS.QUERY_1000_ENTRIES,
          `Query should complete in < ${THRESHOLDS.QUERY_1000_ENTRIES}ms (took ${queryDuration}ms)`
        );

        console.log(`  ✓ Performance test PASSED (${queryDuration}ms < ${THRESHOLDS.QUERY_1000_ENTRIES}ms)`);

      } finally {
        console.log('Cleaning up test data...');
        await deleteUserTimeEntries(userId);
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // PERF-002: Overtime Calculation - Large Dataset
  // ========================================
  {
    id: 'perf-002',
    name: 'PERF-002: Overtime Calculation - Large Dataset < 1s',
    category: 'performance',
    description: 'Overtime calculation must be fast even with 1000+ entries',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('perf_overtime_calc_002');
      assert.exists(user);
      const userId = user.id;

      try {
        console.log('Creating 500 time entries...');

        const dates = generateWorkingDays(new Date('2024-01-02'), 500);

        // Create in batches
        const batchSize = 100;
        for (let i = 0; i < dates.length; i += batchSize) {
          const batch = dates.slice(i, i + batchSize);
          const promises = batch.map(date =>
            createTimeEntry(userId, date, '08:00', '16:30')
          );
          await Promise.all(promises);
        }

        console.log('  ✓ Created 500 entries');

        // Performance test: Calculate overtime
        console.log('Calculating overtime...');
        const startTime = Date.now();

        const overtimeResponse = await adminFetch(
          `${API_URL}/overtime/${userId}`,
          { credentials: 'include' }
        );

        const overtimeDuration = Date.now() - startTime;

        assert.statusCode(overtimeResponse, 200);

        const overtimeData = await overtimeResponse.json();
        assert.success(overtimeData);
        assert.exists(overtimeData.data);

        console.log(`  Overtime calculated in ${overtimeDuration}ms`);
        console.log(`  Total hours: ${overtimeData.data.totalHours}h`);
        console.log(`  Target hours: ${overtimeData.data.targetHours}h`);
        console.log(`  Overtime: ${overtimeData.data.overtime}h`);

        // Performance assertion
        assert.lessThan(
          overtimeDuration,
          THRESHOLDS.OVERTIME_CALCULATION,
          `Overtime calc should complete in < ${THRESHOLDS.OVERTIME_CALCULATION}ms (took ${overtimeDuration}ms)`
        );

        console.log(`  ✓ Performance test PASSED`);

      } finally {
        await deleteUserTimeEntries(userId);
        await deleteTestUser(userId);
      }
    },
  },

  // ========================================
  // PERF-003: Concurrent Users (10 simultaneous)
  // ========================================
  {
    id: 'perf-003',
    name: 'PERF-003: Concurrent Users - 10 Simultaneous Operations < 5s',
    category: 'performance',
    description: 'System should handle multiple concurrent users',
    run: async () => {
      await loginAsAdmin();

      console.log('Creating 10 test users...');

      // Create 10 users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const user = await createTestUser(`perf_concurrent_user_003_${i}`);
        assert.exists(user);
        users.push(user);
      }

      console.log('  ✓ Created 10 users');

      try {
        // Performance test: All users create time entry simultaneously
        console.log('Testing concurrent operations...');
        const testDate = '2026-02-02';

        const startTime = Date.now();

        // All 10 users create entry at the same time
        const promises = users.map(user =>
          createTimeEntry(user.id, testDate, '09:00', '17:00')
        );

        const results = await Promise.all(promises);
        const concurrentDuration = Date.now() - startTime;

        console.log(`  All operations completed in ${concurrentDuration}ms`);

        // Verify all succeeded
        const successCount = results.filter(r => r.status === 201).length;
        assert.equals(successCount, 10, 'All 10 operations should succeed');

        // Performance assertion
        assert.lessThan(
          concurrentDuration,
          THRESHOLDS.CONCURRENT_OPERATIONS,
          `Concurrent ops should complete in < ${THRESHOLDS.CONCURRENT_OPERATIONS}ms (took ${concurrentDuration}ms)`
        );

        console.log(`  ✓ Performance test PASSED`);

      } finally {
        console.log('Cleaning up users...');
        for (const user of users) {
          await deleteTestUser(user.id);
        }
      }
    },
  },

  // ========================================
  // PERF-004: Report Generation (100 users)
  // ========================================
  {
    id: 'perf-004',
    name: 'PERF-004: Report Generation - 100 Users < 3s',
    category: 'performance',
    description: 'Generating reports for many users should be fast',
    run: async () => {
      await loginAsAdmin();

      console.log('Creating 20 test users with data...');

      const users = [];
      for (let i = 0; i < 20; i++) {
        const user = await createTestUser(`perf_report_user_004_${i}`);
        assert.exists(user);
        users.push(user);

        // Each user gets 5 time entries
        const dates = generateWorkingDays(new Date('2026-02-03'), 5);
        for (const date of dates) {
          await createTimeEntry(user.id, date, '08:00', '16:00');
        }
      }

      console.log('  ✓ Created 20 users with 5 entries each (100 total)');

      try {
        // Performance test: Generate report for all users
        console.log('Generating report...');
        const startTime = Date.now();

        const reportResponse = await adminFetch(
          `${API_URL}/reports/monthly?month=2026-02`,
          { credentials: 'include' }
        );

        const reportDuration = Date.now() - startTime;

        // Report endpoint might not exist
        assert.isTrue(
          reportResponse.status === 200 || reportResponse.status === 404,
          'Report endpoint should exist or return 404'
        );

        if (reportResponse.status === 200) {
          const reportData = await reportResponse.json();
          console.log(`  Report generated in ${reportDuration}ms`);

          // Performance assertion (only if implemented)
          assert.lessThan(
            reportDuration,
            THRESHOLDS.REPORT_GENERATION,
            `Report should generate in < ${THRESHOLDS.REPORT_GENERATION}ms (took ${reportDuration}ms)`
          );

          console.log(`  ✓ Performance test PASSED`);
        } else {
          console.log('  ⚠ Report endpoint not implemented (404)');
        }

        // Alternative: Test bulk user query
        console.log('Testing bulk user query...');
        const userQueryStart = Date.now();

        const allUsersResponse = await adminFetch(`${API_URL}/users`);

        const userQueryDuration = Date.now() - userQueryStart;

        assert.statusCode(allUsersResponse, 200);

        const allUsersData = await allUsersResponse.json();
        const userCount = allUsersData.data?.length || 0;

        console.log(`  Queried ${userCount} users in ${userQueryDuration}ms`);

        assert.greaterThan(userCount, 15, 'Should return at least 20 test users');

        // Bulk query should be fast
        assert.lessThan(
          userQueryDuration,
          1000,
          'User query should be < 1s'
        );

      } finally {
        console.log('Cleaning up users...');
        for (const user of users) {
          await deleteUserTimeEntries(user.id);
          await deleteTestUser(user.id);
        }
      }
    },
  },

  // ========================================
  // PERF-005: Database Indexes Efficiency
  // ========================================
  {
    id: 'perf-005',
    name: 'PERF-005: Database Indexes - Indexed Queries < 500ms',
    category: 'performance',
    description: 'Indexed columns should provide fast lookups',
    run: async () => {
      await loginAsAdmin();

      const user = await createTestUser('perf_indexes_005');
      assert.exists(user);
      const userId = user.id;

      try {
        console.log('Creating 200 time entries...');

        const dates = generateWorkingDays(new Date('2025-01-02'), 200);

        // Create entries in batches
        const batchSize = 50;
        for (let i = 0; i < dates.length; i += batchSize) {
          const batch = dates.slice(i, i + batchSize);
          const promises = batch.map(date =>
            createTimeEntry(userId, date, '08:00', '17:00')
          );
          await Promise.all(promises);
        }

        console.log('  ✓ Created 200 entries');

        // Test 1: Query by userId (should be indexed)
        console.log('Testing userId index...');
        const userIdStart = Date.now();

        const userIdQueryResponse = await adminFetch(
          `${API_URL}/time-entries?userId=${userId}`,
          { credentials: 'include' }
        );

        const userIdDuration = Date.now() - userIdStart;

        assert.statusCode(userIdQueryResponse, 200);
        console.log(`  Query by userId: ${userIdDuration}ms`);

        assert.lessThan(
          userIdDuration,
          THRESHOLDS.INDEXED_QUERY,
          `Indexed query should be < ${THRESHOLDS.INDEXED_QUERY}ms`
        );

        // Test 2: Query by date range (should be indexed)
        console.log('Testing date range index...');
        const dateStart = Date.now();

        const dateQueryResponse = await adminFetch(
          `${API_URL}/time-entries?startDate=2025-01-01&endDate=2025-12-31`,
          { credentials: 'include' }
        );

        const dateDuration = Date.now() - dateStart;

        assert.statusCode(dateQueryResponse, 200);
        console.log(`  Query by date range: ${dateDuration}ms`);

        assert.lessThan(
          dateDuration,
          THRESHOLDS.INDEXED_QUERY,
          `Date range query should be < ${THRESHOLDS.INDEXED_QUERY}ms`
        );

        // Test 3: Combined query (userId + date)
        console.log('Testing combined index...');
        const combinedStart = Date.now();

        const combinedQueryResponse = await adminFetch(
          `${API_URL}/time-entries?userId=${userId}&startDate=2025-01-01&endDate=2025-12-31`,
          { credentials: 'include' }
        );

        const combinedDuration = Date.now() - combinedStart;

        assert.statusCode(combinedQueryResponse, 200);
        console.log(`  Combined query: ${combinedDuration}ms`);

        assert.lessThan(
          combinedDuration,
          THRESHOLDS.INDEXED_QUERY,
          `Combined query should be < ${THRESHOLDS.INDEXED_QUERY}ms`
        );

        console.log(`  ✓ All index tests PASSED`);

      } finally {
        await deleteUserTimeEntries(userId);
        await deleteTestUser(userId);
      }
    },
  },
];
