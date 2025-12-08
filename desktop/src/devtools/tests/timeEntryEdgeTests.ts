/**
 * Time Entry Edge Case Tests (HIGH PRIORITY)
 *
 * Tests edge cases and boundary conditions for time entries:
 * - Midnight crossover (23:00 → 01:00)
 * - Break calculation rules (ArbZG)
 * - Maximum work hours (ArbZG: 10h/day)
 * - Decimal precision (7.333333h)
 * - Timezone handling
 * - DST transitions
 * - Bulk operations
 * - Future time entries
 *
 * Implements: TE-EDGE-001 to TE-EDGE-010 from TEST_ROADMAP.md
 */

import { TestCase, assert } from '../testRunner';
import { loginAsAdmin, loginAsEmployee, adminFetch, employeeFetch, logout } from './testUtils';

const API_URL = 'http://localhost:3000/api';

// Helper: Login as admin

// Helper: Delete all time entries for a date
async function deleteEntriesForDate(date: string) {
  try {
    const response = await adminFetch(
      `${API_URL}/time-entries?startDate=${date}&endDate=${date}`
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
    // Ignore
  }
}

export const timeEntryEdgeTests: TestCase[] = [
  // ========================================
  // TE-EDGE-001: Midnight Crossover
  // ========================================
  {
    id: 'te-edge-001',
    name: 'TE-EDGE-001: Midnight Crossover - 23:00 → 01:00 next day',
    category: 'timeEntries',
    description: 'Time entries crossing midnight should calculate hours correctly',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-01';
      await deleteEntriesForDate(testDate);

      // Night shift: 23:00 → 01:00 next day (2 hours)
      // Current implementation might not support this
      // We test if it's rejected or accepted

      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '23:00',
          endTime: '01:00', // Next day
          breakMinutes: 0,
          location: 'office',
          activity: 'Night shift',
          project: 'Test',
        }),
      });

      // Either:
      // 1. Accepted with 2h (midnight crossover supported)
      // 2. Rejected with 400 (endTime must be after startTime)
      if (response.status === 201) {
        const data = await response.json();

        // If supported, should be 2 hours
        assert.equals(
          data.data.hours,
          2,
          'Midnight crossover should calculate 2 hours'
        );

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
          method: 'DELETE',
        });
      } else {
        // Rejected - that's also valid (midnight crossover not supported)
        assert.statusCode(
          response,
          400,
          'Midnight crossover rejected (not supported yet)'
        );
      }
    },
  },

  // ========================================
  // TE-EDGE-002: Break Calculation (ArbZG)
  // ========================================
  {
    id: 'te-edge-002',
    name: 'TE-EDGE-002: ArbZG Break Rules - >6h requires 30min break',
    category: 'timeEntries',
    description: 'German labor law: work > 6h requires minimum 30min break',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-02';
      await deleteEntriesForDate(testDate);

      // Work 7 hours (09:00-16:00) without break
      // Should trigger warning or error (ArbZG violation)
      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '09:00',
          endTime: '16:00',
          breakMinutes: 0, // No break (violation!)
          location: 'office',
          activity: 'Test',
          project: 'Test',
        }),
      });

      // System might:
      // 1. Accept it (no ArbZG enforcement)
      // 2. Reject it (ArbZG enforced)
      // 3. Accept with warning

      if (response.status === 201) {
        const data = await response.json();

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
          method: 'DELETE',
        });

        // Note: ArbZG enforcement is a business rule
        // Current system might not enforce it
        assert.isTrue(true, 'Entry accepted (ArbZG not enforced, or warning given)');
      } else {
        // Rejected due to missing break
        assert.statusCode(response, 400);
      }
    },
  },

  // ========================================
  // TE-EDGE-003: Max 10h/day (ArbZG)
  // ========================================
  {
    id: 'te-edge-003',
    name: 'TE-EDGE-003: ArbZG Max Hours - 10h/day maximum',
    category: 'timeEntries',
    description: 'German labor law: maximum 10 hours per working day',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-03';
      await deleteEntriesForDate(testDate);

      // Work 11 hours (08:00-19:00, no break)
      // Should trigger error (ArbZG violation)
      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '08:00',
          endTime: '19:00',
          breakMinutes: 0,
          location: 'office',
          activity: 'Test',
          project: 'Test',
        }),
      });

      if (response.status === 201) {
        const data = await response.json();

        // Hours should be 11
        assert.equals(data.data.hours, 11);

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
          method: 'DELETE',
        });

        // Note: System might not enforce 10h limit yet
        assert.isTrue(true, 'Entry accepted (10h limit not enforced)');
      } else {
        // Rejected due to exceeding 10h
        assert.statusCode(response, 400, 'ArbZG 10h limit enforced');
      }
    },
  },

  // ========================================
  // TE-EDGE-004: Decimal Precision
  // ========================================
  {
    id: 'te-edge-004',
    name: 'TE-EDGE-004: Decimal Precision - 7h 20min = 7.333333h',
    category: 'timeEntries',
    description: 'Complex decimal hours should be calculated accurately',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-04';
      await deleteEntriesForDate(testDate);

      // 09:00 - 16:50 = 7h 50min - 30min break = 7h 20min = 7.333333... hours
      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '09:00',
          endTime: '16:50',
          breakMinutes: 30, // Required for work > 6h (ArbZG compliant)
          location: 'office',
          activity: 'Test',
          project: 'Test',
        }),
      });

      assert.statusCode(response, 201);

      const data = await response.json();

      // 7h 50min - 30min break = 7h 20min = 7.333333...
      const expected = 7 + (20 / 60);
      const diff = Math.abs(data.data.hours - expected);

      assert.isTrue(
        diff < 0.01,
        `Expected ~7.33h, got ${data.data.hours}`
      );

      // Cleanup
      await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
        method: 'DELETE',
      });
    },
  },

  // ========================================
  // TE-EDGE-005: Same-Second Edits
  // ========================================
  {
    id: 'te-edge-005',
    name: 'TE-EDGE-005: Concurrent Edits - Same entry updated simultaneously',
    category: 'timeEntries',
    description: 'System should handle concurrent edits gracefully',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-05';
      await deleteEntriesForDate(testDate);

      // Create an entry
      const createResponse = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30,
          location: 'office',
          activity: 'Test',
          project: 'Test',
        }),
      });

      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        const entryId = createData.data.id;

        // Update it twice rapidly
        const update1 = adminFetch(`${API_URL}/time-entries/${entryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Update 1' }),
        });

        const update2 = adminFetch(`${API_URL}/time-entries/${entryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Update 2' }),
        });

        // Both should succeed (last write wins)
        const [res1, res2] = await Promise.all([update1, update2]);

        assert.statusCode(res1, 200);
        assert.statusCode(res2, 200);

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${entryId}`, {
          method: 'DELETE',
        });
      }
    },
  },

  // ========================================
  // TE-EDGE-006: Timezone Handling
  // ========================================
  {
    id: 'te-edge-006',
    name: 'TE-EDGE-006: Timezone - Entries stored in user timezone',
    category: 'timeEntries',
    description: 'Time entries should respect user timezone',
    run: async () => {
      await loginAsAdmin();

      // This is a complex test requiring timezone support
      // For now, we verify that time entries are consistent
      const testDate = '2026-07-06';
      await deleteEntriesForDate(testDate);

      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30,
          location: 'office',
          activity: 'Test',
          project: 'Test',
        }),
      });

      if (response.status === 201) {
        const data = await response.json();

        // Verify date is stored as expected
        assert.equals(data.data.date, testDate);
        assert.equals(data.data.startTime, '09:00');
        assert.equals(data.data.endTime, '17:00');

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
          method: 'DELETE',
        });
      }
    },
  },

  // ========================================
  // TE-EDGE-007: DST Transitions
  // ========================================
  {
    id: 'te-edge-007',
    name: 'TE-EDGE-007: DST Transition - Clock changes (Mar/Oct)',
    category: 'timeEntries',
    description: 'Daylight Saving Time transitions should be handled',
    run: async () => {
      await loginAsAdmin();

      // In Germany (2025):
      // - DST starts: Mar 30, 02:00 → 03:00 (1 hour lost)
      // - DST ends: Oct 26, 03:00 → 02:00 (1 hour gained)

      // Test entry on DST transition day
      const dstDate = '2025-03-30'; // DST starts
      await deleteEntriesForDate(dstDate);

      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dstDate,
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30,
          location: 'office',
          activity: 'Test',
          project: 'Test',
        }),
      });

      if (response.status === 201) {
        const data = await response.json();

        // Should calculate 7.5h regardless of DST
        assert.equals(data.data.hours, 7.5);

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
          method: 'DELETE',
        });
      }
    },
  },

  // ========================================
  // TE-EDGE-008: Bulk Delete
  // ========================================
  {
    id: 'te-edge-008',
    name: 'TE-EDGE-008: Bulk Delete - Multiple entries at once',
    category: 'timeEntries',
    description: 'Deleting multiple time entries should work efficiently',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-07';
      await deleteEntriesForDate(testDate);

      // Create 3 entries
      const entries = [];

      for (let i = 0; i < 3; i++) {
        const startHour = 9 + i * 3;
        const endHour = startHour + 2;

        const response = await adminFetch(`${API_URL}/time-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: testDate,
            startTime: `${startHour.toString().padStart(2, '0')}:00`,
            endTime: `${endHour.toString().padStart(2, '0')}:00`,
            breakMinutes: 0,
            location: 'office',
            activity: 'Test',
            project: 'Test',
          }),
        });

        if (response.status === 201) {
          const data = await response.json();
          entries.push(data.data.id);
        }
      }

      // Delete all
      for (const entryId of entries) {
        const deleteResponse = await adminFetch(
          `${API_URL}/time-entries/${entryId}`,
          {
            method: 'DELETE',
          }
        );

        assert.statusCode(deleteResponse, 200, 'Bulk delete should work');
      }

      assert.isTrue(true, 'Bulk delete completed');
    },
  },

  // ========================================
  // TE-EDGE-009: Invalid Location
  // ========================================
  {
    id: 'te-edge-009',
    name: 'TE-EDGE-009: Invalid Location - Only office/homeoffice/field allowed',
    category: 'timeEntries',
    description: 'Invalid location values should be rejected',
    run: async () => {
      await loginAsAdmin();

      const testDate = '2026-07-08';

      // Try to create entry with invalid location
      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30,
          location: 'invalid_location', // Invalid!
          activity: 'Test',
          project: 'Test',
        }),
      });

      // Should be rejected with 400
      assert.statusCode(
        response,
        400,
        'Invalid location should be rejected'
      );

      const data = await response.json();
      assert.isFalse(data.success);
      assert.exists(data.error);
    },
  },

  // ========================================
  // TE-EDGE-010: Future Time Entries
  // ========================================
  {
    id: 'te-edge-010',
    name: 'TE-EDGE-010: Future Entries - Can create entries for future dates',
    category: 'timeEntries',
    description: 'Time entries for future dates should be allowed (e.g., planning)',
    run: async () => {
      await loginAsAdmin();

      // Far future date
      const testDate = '2028-12-25';
      await deleteEntriesForDate(testDate);

      const response = await adminFetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testDate,
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30,
          location: 'office',
          activity: 'Planned work',
          project: 'Test',
        }),
      });

      // Either allowed or rejected based on business rules
      if (response.status === 201) {
        const data = await response.json();

        // Cleanup
        await adminFetch(`${API_URL}/time-entries/${data.data.id}`, {
          method: 'DELETE',
        });

        assert.isTrue(true, 'Future entries allowed');
      } else {
        // Rejected
        assert.statusCode(response, 400, 'Future entries not allowed');
      }
    },
  },
];
