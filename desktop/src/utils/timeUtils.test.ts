import { describe, it, expect } from 'vitest';
import {
  formatHours,
  formatOvertimeHours,
  calculateHours,
  calculateTotalHours,
  calculateExpectedHours,
} from './timeUtils';

describe('timeUtils', () => {
  describe('formatHours', () => {
    it('should format positive hours correctly', () => {
      expect(formatHours(8)).toBe('8:00h');
      expect(formatHours(8.5)).toBe('8:30h');
      expect(formatHours(8.75)).toBe('8:45h');
      expect(formatHours(0.5)).toBe('0:30h');
      expect(formatHours(0.25)).toBe('0:15h');
    });

    it('should format zero hours correctly', () => {
      expect(formatHours(0)).toBe('0:00h');
    });

    /**
     * REGRESSION TEST: formatHours negative number bug
     *
     * BUG DESCRIPTION:
     * Before fix: formatHours(-23.5) would return "-24:-30h" (WRONG!)
     * After fix: formatHours(-23.5) should return "-23:30h" (CORRECT!)
     *
     * ROOT CAUSE:
     * The old implementation applied Math.floor() and Math.round()
     * to negative numbers incorrectly, causing the sign to be applied
     * twice - once to hours and once to minutes.
     *
     * FIX:
     * Extract sign first, work with absolute value, then apply sign only once at the end.
     *
     * Example from real scenario (Nov 7-11, 2025):
     * - Employee hired Nov 7 (Thursday)
     * - Today: Nov 11 (Monday)
     * - Working days: 3 (Thu, Fri, Mon)
     * - Target: 3 × 8h = 24h
     * - Actual: 0h
     * - Overtime: 0h - 24h = -24h
     * - Display MUST show: "-24:00h" NOT "-24:-0h" or "-25:0h"
     */
    it('should format negative hours correctly (BUG FIX)', () => {
      // The critical test case that was failing
      expect(formatHours(-23.5)).toBe('-23:30h');

      // Additional edge cases
      expect(formatHours(-24)).toBe('-24:00h');
      expect(formatHours(-8.5)).toBe('-8:30h');
      expect(formatHours(-0.5)).toBe('-0:30h');
      expect(formatHours(-1.25)).toBe('-1:15h');
      expect(formatHours(-1.75)).toBe('-1:45h');

      // Very large negative values
      expect(formatHours(-100.5)).toBe('-100:30h');

      // Small negative values
      expect(formatHours(-0.25)).toBe('-0:15h');
    });

    it('should handle decimal rounding correctly', () => {
      // 8.33 hours = 8 hours 20 minutes (rounded from 19.8 minutes)
      expect(formatHours(8.33)).toBe('8:20h');

      // 8.67 hours = 8 hours 40 minutes (rounded from 40.2 minutes)
      expect(formatHours(8.67)).toBe('8:40h');
    });
  });

  describe('formatOvertimeHours', () => {
    it('should format positive overtime with + sign', () => {
      expect(formatOvertimeHours(2.5)).toBe('+2:30h');
      expect(formatOvertimeHours(8)).toBe('+8:00h');
      expect(formatOvertimeHours(0.25)).toBe('+0:15h');
    });

    it('should format negative overtime with - sign', () => {
      expect(formatOvertimeHours(-2.5)).toBe('-2:30h');
      expect(formatOvertimeHours(-8)).toBe('-8:00h');
      expect(formatOvertimeHours(-24)).toBe('-24:00h');
    });

    it('should format zero overtime with + sign', () => {
      expect(formatOvertimeHours(0)).toBe('+0:00h');
    });
  });

  describe('calculateHours', () => {
    it('should calculate hours from start/end time', () => {
      expect(calculateHours('08:00', '17:00', 60)).toBe(8);
      expect(calculateHours('09:00', '17:00', 30)).toBe(7.5);
      expect(calculateHours('08:00', '12:00', 0)).toBe(4);
    });

    it('should handle overnight shifts', () => {
      // 22:00 to 06:00 = 8 hours
      expect(calculateHours('22:00', '06:00', 0)).toBe(8);

      // 23:00 to 07:00 = 8 hours
      expect(calculateHours('23:00', '07:00', 0)).toBe(8);
    });

    it('should subtract break minutes', () => {
      // 9 hours - 1 hour break = 8 hours
      expect(calculateHours('08:00', '17:00', 60)).toBe(8);

      // 8 hours - 30 minute break = 7.5 hours
      expect(calculateHours('08:00', '16:00', 30)).toBe(7.5);
    });
  });

  describe('calculateTotalHours', () => {
    it('should sum hours from time entries', () => {
      const entries = [
        { id: 1, hours: 8, userId: 1, date: '2025-01-01', projectId: 1, activityId: 1, description: '' },
        { id: 2, hours: 7.5, userId: 1, date: '2025-01-02', projectId: 1, activityId: 1, description: '' },
        { id: 3, hours: 8, userId: 1, date: '2025-01-03', projectId: 1, activityId: 1, description: '' },
      ];

      expect(calculateTotalHours(entries)).toBe(23.5);
    });

    it('should handle empty entries', () => {
      expect(calculateTotalHours([])).toBe(0);
    });

    it('should handle entries with undefined hours', () => {
      const entries = [
        { id: 1, hours: 8, userId: 1, date: '2025-01-01', projectId: 1, activityId: 1, description: '' },
        { id: 2, hours: undefined as unknown as number, userId: 1, date: '2025-01-02', projectId: 1, activityId: 1, description: '' },
      ];

      expect(calculateTotalHours(entries)).toBe(8);
    });
  });

  describe('calculateExpectedHours', () => {
    it('should calculate expected hours excluding weekends', () => {
      // Jan 1-5, 2025 (Wed-Sun) = 3 business days × 8h = 24h
      expect(calculateExpectedHours('2025-01-01', '2025-01-05', 8)).toBe(24);
    });

    it('should handle single day', () => {
      // Monday (1 business day)
      expect(calculateExpectedHours('2025-01-06', '2025-01-06', 8)).toBe(8);

      // Saturday (0 business days)
      expect(calculateExpectedHours('2025-01-04', '2025-01-04', 8)).toBe(0);
    });

    it('should handle full work week', () => {
      // Jan 6-10, 2025 (Mon-Fri) = 5 business days × 8h = 40h
      expect(calculateExpectedHours('2025-01-06', '2025-01-10', 8)).toBe(40);
    });

    it('should handle custom daily hours', () => {
      // 5 business days × 7.5h = 37.5h
      expect(calculateExpectedHours('2025-01-06', '2025-01-10', 7.5)).toBe(37.5);
    });
  });
});
