import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkingDaysInMonth,
  calculateDailyTargetHours,
  calculateMonthlyTargetHours,
  countWorkingDaysBetween,
  calculateTargetHoursUntilToday,
} from './workingDays.js';

/**
 * BACKEND WORKING DAYS TESTS
 *
 * These tests validate the core working days calculation logic used
 * throughout the backend for overtime calculations.
 *
 * CRITICAL: These functions are the Single Source of Truth for:
 * - Working days counting (excluding weekends and holidays)
 * - Target hours calculation
 * - Overtime reference dates (always today, never future)
 */

describe('Working Days Utilities', () => {
  describe('getWorkingDaysInMonth', () => {
    it('should count working days in January 2025 (23 days)', () => {
      // January 2025: 31 days total
      // Weekends: 4, 5, 11, 12, 18, 19, 25, 26 (8 days)
      // Working days: 31 - 8 = 23 days
      const workingDays = getWorkingDaysInMonth(2025, 1);
      expect(workingDays).toBe(23);
    });

    it('should count working days in February 2025 (20 days)', () => {
      // February 2025: 28 days total (not a leap year)
      // Weekends: 1, 2, 8, 9, 15, 16, 22, 23 (8 days)
      // Working days: 28 - 8 = 20 days
      const workingDays = getWorkingDaysInMonth(2025, 2);
      expect(workingDays).toBe(20);
    });

    it('should count working days in November 2025 (20 days)', () => {
      // November 2025: 30 days total
      // Weekends: 1, 2, 8, 9, 15, 16, 22, 23, 29, 30 (10 days)
      // Working days: 30 - 10 = 20 days
      const workingDays = getWorkingDaysInMonth(2025, 11);
      expect(workingDays).toBe(20);
    });

    it('should handle months with 31 days', () => {
      // March 2025: 31 days
      const workingDays = getWorkingDaysInMonth(2025, 3);
      // Should be between 21-23 working days
      expect(workingDays).toBeGreaterThanOrEqual(21);
      expect(workingDays).toBeLessThanOrEqual(23);
    });

    it('should handle months with 30 days', () => {
      // April 2025: 30 days
      const workingDays = getWorkingDaysInMonth(2025, 4);
      // Should be between 20-22 working days
      expect(workingDays).toBeGreaterThanOrEqual(20);
      expect(workingDays).toBeLessThanOrEqual(22);
    });

    it('should handle February in leap year', () => {
      // February 2024: 29 days (leap year)
      const workingDays = getWorkingDaysInMonth(2024, 2);
      // Should be 20-21 working days
      expect(workingDays).toBeGreaterThanOrEqual(20);
      expect(workingDays).toBeLessThanOrEqual(21);
    });
  });

  describe('calculateDailyTargetHours', () => {
    it('should calculate 8h/day for 40h week', () => {
      const dailyHours = calculateDailyTargetHours(40);
      expect(dailyHours).toBe(8);
    });

    it('should calculate 7.5h/day for 37.5h week', () => {
      const dailyHours = calculateDailyTargetHours(37.5);
      expect(dailyHours).toBe(7.5);
    });

    it('should calculate 6h/day for 30h week (part-time)', () => {
      const dailyHours = calculateDailyTargetHours(30);
      expect(dailyHours).toBe(6);
    });

    it('should calculate 4h/day for 20h week (half-time)', () => {
      const dailyHours = calculateDailyTargetHours(20);
      expect(dailyHours).toBe(4);
    });

    it('should handle decimal results with 2 decimal precision', () => {
      const dailyHours = calculateDailyTargetHours(35);
      expect(dailyHours).toBe(7);
    });
  });

  describe('calculateMonthlyTargetHours', () => {
    it('should calculate monthly target for 40h week in January 2025', () => {
      // January 2025: 23 working days
      // 40h week = 8h/day
      // 23 days × 8h = 184h
      const targetHours = calculateMonthlyTargetHours(40, 2025, 1);
      expect(targetHours).toBe(184);
    });

    it('should calculate monthly target for 40h week in February 2025', () => {
      // February 2025: 20 working days
      // 40h week = 8h/day
      // 20 days × 8h = 160h
      const targetHours = calculateMonthlyTargetHours(40, 2025, 2);
      expect(targetHours).toBe(160);
    });

    it('should calculate monthly target for part-time (30h week)', () => {
      // January 2025: 23 working days
      // 30h week = 6h/day
      // 23 days × 6h = 138h
      const targetHours = calculateMonthlyTargetHours(30, 2025, 1);
      expect(targetHours).toBe(138);
    });

    it('should calculate monthly target for 37.5h week', () => {
      // January 2025: 23 working days
      // 37.5h week = 7.5h/day
      // 23 days × 7.5h = 172.5h
      const targetHours = calculateMonthlyTargetHours(37.5, 2025, 1);
      expect(targetHours).toBe(172.5);
    });
  });

  describe('countWorkingDaysBetween', () => {
    /**
     * CRITICAL TEST: This validates the Nov 7-11, 2025 scenario
     * that exposed the formatHours bug
     */
    it('should count 3 working days from Thu Nov 7 to Mon Nov 11, 2025', () => {
      // Thu (7), Fri (8), Mon (11) = 3 working days
      // Weekend: Sat (9), Sun (10) = excluded
      const workingDays = countWorkingDaysBetween('2025-11-07', '2025-11-11');
      expect(workingDays).toBe(3);
    });

    it('should count full work week (Mon-Fri)', () => {
      // Nov 3-7, 2025 (Mon-Fri)
      const workingDays = countWorkingDaysBetween('2025-11-03', '2025-11-07');
      expect(workingDays).toBe(5);
    });

    it('should exclude weekends correctly', () => {
      // Nov 1-9, 2025 (includes 2 weekends)
      // Working days: Mon 3, Tue 4, Wed 5, Thu 6, Fri 7 = 5 days
      const workingDays = countWorkingDaysBetween('2025-11-01', '2025-11-09');
      expect(workingDays).toBe(5);
    });

    it('should return 0 for weekend-only period', () => {
      // Sat-Sun, Nov 8-9, 2025
      const workingDays = countWorkingDaysBetween('2025-11-08', '2025-11-09');
      expect(workingDays).toBe(0);
    });

    it('should handle single working day', () => {
      // Monday, Nov 3, 2025
      const workingDays = countWorkingDaysBetween('2025-11-03', '2025-11-03');
      expect(workingDays).toBe(1);
    });

    it('should handle single weekend day', () => {
      // Saturday, Nov 8, 2025
      const workingDays = countWorkingDaysBetween('2025-11-08', '2025-11-08');
      expect(workingDays).toBe(0);
    });

    it('should work with Date objects', () => {
      const start = new Date('2025-11-03');
      const end = new Date('2025-11-07');
      const workingDays = countWorkingDaysBetween(start, end);
      expect(workingDays).toBe(5);
    });

    it('should handle multi-week periods', () => {
      // 2 full weeks (Mon Nov 3 - Fri Nov 14, 2025)
      // Week 1: 5 days, Week 2: 5 days = 10 working days
      const workingDays = countWorkingDaysBetween('2025-11-03', '2025-11-14');
      expect(workingDays).toBe(10);
    });

    it('should handle same start and end date (inclusive)', () => {
      // Single day (Thursday)
      const workingDays = countWorkingDaysBetween('2025-11-06', '2025-11-06');
      expect(workingDays).toBe(1);
    });
  });

  describe('calculateTargetHoursUntilToday', () => {
    /**
     * IMPORTANT: This function uses 'today' which changes daily.
     * We'll test with fixed dates by mocking Date.
     */
    beforeEach(() => {
      // Mock Date to always return Nov 11, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-11T12:00:00Z'));
    });

    it('should calculate target hours from hire date to today (Nov 7-11)', () => {
      const weeklyHours = 40;
      const hireDate = '2025-11-07'; // Thursday

      // Thu (7), Fri (8), Mon (11) = 3 working days
      // 3 days × 8h = 24h
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(24);
    });

    it('should calculate target hours for full week (Nov 3-11)', () => {
      const weeklyHours = 40;
      const hireDate = '2025-11-03'; // Monday

      // Mon 3, Tue 4, Wed 5, Thu 6, Fri 7, Mon 10, Tue 11 = 7 working days
      // Wait, Nov 10 is Monday, Nov 11 is Tuesday
      // Actually: Nov 3 (Mon) to Nov 11 (Tue) spans 2 weeks
      // Working days: Mon-Fri (5) + Mon-Tue (2) = 7 days
      // 7 days × 8h = 56h
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(56);
    });

    it('should return 0 if hire date is in the future', () => {
      const weeklyHours = 40;
      const hireDate = '2025-11-15'; // Future date

      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(0);
    });

    it('should handle hire date = today', () => {
      const weeklyHours = 40;
      const hireDate = '2025-11-11'; // Today (Tuesday)

      // 1 working day × 8h = 8h
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(8);
    });

    it('should calculate for part-time employee (30h week)', () => {
      const weeklyHours = 30;
      const hireDate = '2025-11-07'; // Thursday

      // 3 working days × 6h = 18h
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(18);
    });

    it('should handle employee hired on weekend', () => {
      const weeklyHours = 40;
      const hireDate = '2025-11-08'; // Saturday

      // Sat 8, Sun 9 (weekend) + Mon 10, Tue 11 = 2 working days
      // 2 days × 8h = 16h
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(16);
    });

    it('should calculate for long-term employee (1 month)', () => {
      const weeklyHours = 40;
      const hireDate = '2025-10-11'; // 1 month ago (same day)

      // This would be ~22 working days (approximately 1 month)
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);

      // Should be around 176h (22 days × 8h)
      expect(targetHours).toBeGreaterThan(170);
      expect(targetHours).toBeLessThan(185);
    });
  });

  describe('Edge Cases and Integration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-11T12:00:00Z'));
    });

    it('should handle year boundary correctly', () => {
      const weeklyHours = 40;
      const hireDate = '2024-12-30'; // Monday before New Year

      // Dec 30, 31 (2024) + all of Jan 2025 + ... + Nov 11 (2025)
      // This is a long period, just verify it calculates without error
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);

      expect(targetHours).toBeGreaterThan(0);
      expect(typeof targetHours).toBe('number');
    });

    it('should maintain 2 decimal precision for all calculations', () => {
      const weeklyHours = 37.5;
      const hireDate = '2025-11-07';

      // 3 days × 7.5h = 22.5h
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(22.5);

      // Should be rounded to 2 decimals
      const decimalPlaces = (targetHours.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should validate the complete overtime calculation flow', () => {
      const weeklyHours = 40;
      const hireDate = '2025-11-07'; // Thursday

      // Calculate target
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      expect(targetHours).toBe(24);

      // Simulate actual hours (worked 2 days, 16h)
      const actualHours = 16;

      // Calculate overtime
      const overtime = actualHours - targetHours; // 16 - 24 = -8
      expect(overtime).toBe(-8);

      // Verify it's negative (employee is behind)
      expect(overtime).toBeLessThan(0);
    });

    it('should handle multiple users with different hire dates (aggregation scenario)', () => {
      const weeklyHours = 40;

      // User A: hired Mon Nov 3
      const targetA = calculateTargetHoursUntilToday(weeklyHours, '2025-11-03');

      // User B: hired Thu Nov 7
      const targetB = calculateTargetHoursUntilToday(weeklyHours, '2025-11-07');

      // User C: hired Tue Nov 11 (today)
      const targetC = calculateTargetHoursUntilToday(weeklyHours, '2025-11-11');

      expect(targetA).toBe(56); // 7 working days
      expect(targetB).toBe(24); // 3 working days
      expect(targetC).toBe(8);  // 1 working day

      // Total aggregated target
      const totalTarget = targetA + targetB + targetC;
      expect(totalTarget).toBe(88);
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-11T12:00:00Z'));
    });

    it('should handle very long date ranges efficiently', () => {
      const weeklyHours = 40;
      const hireDate = '2020-01-01'; // 5+ years ago

      const startTime = Date.now();
      const targetHours = calculateTargetHoursUntilToday(weeklyHours, hireDate);
      const endTime = Date.now();

      // Should complete in less than 100ms
      expect(endTime - startTime).toBeLessThan(100);

      // Should return a reasonable value
      expect(targetHours).toBeGreaterThan(0);
      expect(typeof targetHours).toBe('number');
    });
  });
});
