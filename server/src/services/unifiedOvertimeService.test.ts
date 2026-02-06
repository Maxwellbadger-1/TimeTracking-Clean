import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { unifiedOvertimeService } from './unifiedOvertimeService.js';

/**
 * UNIFIED OVERTIME SERVICE TESTS
 *
 * These tests validate the Single Source of Truth for overtime calculations.
 *
 * CRITICAL: UnifiedOvertimeService is now used by:
 * - reportService.ts (calculateDailyBreakdown)
 * - overtimeService.ts (updateMonthlyOvertime)
 * - overtimeLiveCalculationService.ts (calculateCurrentOvertimeBalance)
 *
 * All overtime calculations MUST go through this service to ensure consistency.
 */

describe('UnifiedOvertimeService', () => {
  // Test user ID (will be created in beforeEach)
  let testUserId: number;

  beforeEach(() => {
    // Create a test user with standard 40h/week schedule
    const result = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_unified',
      'test@unified.com',
      'Test',
      'User',
      'hash',
      'employee',
      40,
      '2026-01-01'
    );
    testUserId = result.lastInsertRowid as number;
  });

  afterEach(() => {
    // Clean up test data
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_corrections WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
  });

  describe('calculateDailyOvertime', () => {
    it('should calculate zero overtime for a day with no entries', () => {
      // Test a working day (Tuesday, Jan 13, 2026) with no time entries
      const result = unifiedOvertimeService.calculateDailyOvertime(testUserId, '2026-01-13');

      expect(result.date).toBe('2026-01-13');
      expect(result.targetHours).toBe(8); // 40h / 5 days = 8h
      expect(result.actualHours).toBe(0); // No entries
      expect(result.overtime).toBe(-8); // 0 - 8 = -8h
      expect(result.breakdown.worked).toBe(0);
      expect(result.breakdown.absenceCredit).toBe(0);
      expect(result.breakdown.corrections).toBe(0);
      expect(result.breakdown.unpaidReduction).toBe(0);
    });

    it('should calculate positive overtime for a day with more than target hours', () => {
      // Add 10 hours of work on Tuesday, Jan 13, 2026
      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(testUserId, '2026-01-13', '08:00', '18:00', 0, 10, 'office');

      const result = unifiedOvertimeService.calculateDailyOvertime(testUserId, '2026-01-13');

      expect(result.targetHours).toBe(8);
      expect(result.actualHours).toBe(10);
      expect(result.overtime).toBe(2); // 10 - 8 = +2h
      expect(result.breakdown.worked).toBe(10);
    });

    it('should calculate zero target for weekends', () => {
      // Test a Saturday (Jan 11, 2026)
      const result = unifiedOvertimeService.calculateDailyOvertime(testUserId, '2026-01-11');

      expect(result.targetHours).toBe(0); // Weekend = no target
      expect(result.overtime).toBe(0); // No work expected
    });
  });

  describe('calculateMonthlyOvertime', () => {
    it('should calculate monthly overtime with no entries', () => {
      const result = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, '2026-01');

      // January 2026: 01.01 is Wednesday (holiday)
      // Working days: 2,3,6,7,8,9,10,13,14,15,16,17,20,21,22,23,24,27,28,29,30,31 = 22 days
      // Target: 22 * 8h = 176h
      expect(result.month).toBe('2026-01');
      expect(result.targetHours).toBeGreaterThan(0);
      expect(result.actualHours).toBe(0); // No entries
      expect(result.overtime).toBeLessThan(0); // Negative (not worked)
      expect(result.breakdown.worked).toBe(0);
    });

    it('should aggregate daily results correctly', () => {
      // Add some time entries (using dates we know are working days)
      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
        VALUES
          (?, '2026-01-13', '08:00', '16:00', 0, 8, 'office'),
          (?, '2026-01-14', '08:00', '18:00', 0, 10, 'homeoffice'),
          (?, '2026-01-15', '08:00', '17:00', 0, 9, 'office')
      `).run(testUserId, testUserId, testUserId);

      const result = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, '2026-01');

      // Worked: 8 + 10 + 9 = 27h
      expect(result.breakdown.worked).toBe(27);
      expect(result.actualHours).toBe(27);

      // Should have daily results for each day
      expect(result.dailyResults.length).toBeGreaterThan(0);

      // Find the days we added entries for
      const day13 = result.dailyResults.find(d => d.date === '2026-01-13');
      const day14 = result.dailyResults.find(d => d.date === '2026-01-14');
      const day15 = result.dailyResults.find(d => d.date === '2026-01-15');

      expect(day13?.overtime).toBe(0); // 8 - 8 = 0
      expect(day14?.overtime).toBe(2); // 10 - 8 = +2
      expect(day15?.overtime).toBe(1); // 9 - 8 = +1
    });
  });

  describe('calculatePeriodOvertime', () => {
    it('should calculate overtime for a custom date range', () => {
      // Add entries for week of January (Mon-Wed)
      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
        VALUES
          (?, '2026-01-13', '08:00', '16:00', 0, 8, 'office'),
          (?, '2026-01-14', '08:00', '17:00', 0, 9, 'homeoffice'),
          (?, '2026-01-15', '08:00', '18:00', 0, 10, 'office')
      `).run(testUserId, testUserId, testUserId);

      const result = unifiedOvertimeService.calculatePeriodOvertime(
        testUserId,
        '2026-01-13',
        '2026-01-15'
      );

      expect(result.startDate).toBe('2026-01-13');
      expect(result.endDate).toBe('2026-01-15');
      expect(result.breakdown.worked).toBe(27); // 8 + 9 + 10 = 27h
      expect(result.targetHours).toBe(24); // 3 days * 8h = 24h
      expect(result.overtime).toBe(3); // 27 - 24 = +3h
    });

    it('should respect hire date boundary', () => {
      // User hired on 2026-01-01, query before hire date
      const result = unifiedOvertimeService.calculatePeriodOvertime(
        testUserId,
        '2025-12-20',
        '2026-01-10'
      );

      // Should start from hire date (2026-01-01), not from requested date
      expect(result.startDate).toBe('2026-01-01');
      expect(result.dailyResults[0].date).toBe('2026-01-01');
    });
  });

  describe('Integration: Consistency across methods', () => {
    it('should return consistent results: period = monthly for same month', () => {
      // Add some test data
      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
        VALUES
          (?, '2026-01-13', '08:00', '16:00', 0, 8, 'office'),
          (?, '2026-01-14', '08:00', '18:00', 0, 10, 'homeoffice')
      `).run(testUserId, testUserId);

      // Calculate using both methods
      const monthlyResult = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, '2026-01');
      const periodResult = unifiedOvertimeService.calculatePeriodOvertime(
        testUserId,
        '2026-01-01',
        '2026-01-31'
      );

      // Results should be identical (or very close, accounting for "today" cutoff)
      expect(monthlyResult.targetHours).toBe(periodResult.targetHours);
      expect(monthlyResult.actualHours).toBe(periodResult.actualHours);
      expect(monthlyResult.overtime).toBe(periodResult.overtime);
      expect(monthlyResult.breakdown.worked).toBe(periodResult.breakdown.worked);
    });
  });

  describe('REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug)', () => {
    it('should include overtime_corrections in daily calculation', () => {
      // Add a correction for a specific day
      db.prepare(`
        INSERT INTO overtime_corrections (userId, date, hours, reason, correctionType, createdBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testUserId, '2026-01-13', 2, 'Test correction', 'manual', testUserId);

      const result = unifiedOvertimeService.calculateDailyOvertime(testUserId, '2026-01-13');

      // Target: 8h, Actual: 0h (no work) + 2h (correction) = 2h
      // Overtime: 2h - 8h = -6h
      expect(result.breakdown.corrections).toBe(2);
      expect(result.actualHours).toBe(2);
      expect(result.overtime).toBe(-6);
    });

    it('should include overtime_corrections in monthly calculation', () => {
      // Add corrections for multiple days
      db.prepare(`
        INSERT INTO overtime_corrections (userId, date, hours, reason, correctionType, createdBy)
        VALUES
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?)
      `).run(
        testUserId, '2026-01-13', 2, 'Correction 1', 'manual', testUserId,
        testUserId, '2026-01-15', 2, 'Correction 2', 'manual', testUserId
      );

      const result = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, '2026-01');

      // Should include total of 4h corrections
      expect(result.breakdown.corrections).toBe(4);
      expect(result.actualHours).toBe(4); // Only corrections, no worked hours
    });

    it('should respect hire date and not include pre-employment months', () => {
      // Create a user hired in February
      const febUserResult = db.prepare(`
        INSERT INTO users (
          username, email, firstName, lastName, password, role,
          weeklyHours, workSchedule, hireDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'febuser',
        'feb@test.com',
        'Feb',
        'User',
        'hash',
        'employee',
        10,
        JSON.stringify({ monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2 }),
        '2026-02-01'
      );
      const febUserId = febUserResult.lastInsertRowid as number;

      try {
        // Calculate January (before hire date)
        const janResult = unifiedOvertimeService.calculateMonthlyOvertime(febUserId, '2026-01');

        // Should return zero values for month before employment
        expect(janResult.targetHours).toBe(0);
        expect(janResult.actualHours).toBe(0);
        expect(janResult.overtime).toBe(0);
        expect(janResult.dailyResults).toHaveLength(0);

        // Calculate February (hire month)
        const febResult = unifiedOvertimeService.calculateMonthlyOvertime(febUserId, '2026-02');

        // Should start from Feb 1 and calculate up to today (Feb 6)
        expect(febResult.dailyResults[0].date).toBe('2026-02-01');
        expect(febResult.targetHours).toBe(10); // Feb 2-6 = 5 working days × 2h/day
      } finally {
        // Clean up
        db.prepare('DELETE FROM users WHERE id = ?').run(febUserId);
      }
    });

    it('REGRESSION: User hired on 1st of month should calculate correctly', () => {
      // Create a user hired on Feb 1st with 10h/week schedule (2h per day)
      const febFirstUserResult = db.prepare(`
        INSERT INTO users (
          username, email, firstName, lastName, password, role,
          weeklyHours, workSchedule, hireDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'febfirst',
        'febfirst@test.com',
        'Feb',
        'First',
        'hash',
        'employee',
        10,
        JSON.stringify({ monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2 }),
        '2026-02-01'
      );
      const febFirstUserId = febFirstUserResult.lastInsertRowid as number;

      try {
        // Add 4h correction for Feb 5th (within calculation period Feb 1-6)
        db.prepare(`
          INSERT INTO overtime_corrections (userId, date, hours, reason, correctionType, createdBy)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(febFirstUserId, '2026-02-05', 4, 'Test correction', 'manual', febFirstUserId);

        // Calculate February (hire month)
        const febResult = unifiedOvertimeService.calculateMonthlyOvertime(febFirstUserId, '2026-02');

        // Debug output
        console.log('Test Debug - User hired on Feb 1st:');
        console.log('  targetHours:', febResult.targetHours);
        console.log('  dailyResults.length:', febResult.dailyResults.length);
        if (febResult.dailyResults.length > 0) {
          console.log('  First day:', febResult.dailyResults[0]);
        }

        // February 1st is Sunday, calculation runs from Feb 1-6 (today)
        // Working days: Mon-Fri (Feb 2-6) = 5 days
        // User works 2h per day = 10h target
        expect(febResult.targetHours).toBe(10); // 5 days × 2h
        expect(febResult.breakdown.corrections).toBe(4);
        expect(febResult.actualHours).toBe(4); // Only corrections
        expect(febResult.overtime).toBe(-6); // 4 - 10 = -6
        expect(febResult.dailyResults.length).toBe(6); // Feb 1-6

        // Calculate January (before hire)
        const janResult = unifiedOvertimeService.calculateMonthlyOvertime(febFirstUserId, '2026-01');

        // Should return zeros for month before employment
        expect(janResult.targetHours).toBe(0);
        expect(janResult.actualHours).toBe(0);
        expect(janResult.overtime).toBe(0);
        expect(janResult.dailyResults).toHaveLength(0);
      } finally {
        // Clean up
        db.prepare('DELETE FROM users WHERE id = ?').run(febFirstUserId);
        db.prepare('DELETE FROM overtime_corrections WHERE userId = ?').run(febFirstUserId);
      }
    });

    it('should handle User 6 scenario: corrections balance negative overtime', () => {
      // Simulate User 6: Work some hours, add corrections to balance
      db.prepare(`
        INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(testUserId, '2026-02-02', '09:00', '11:00', 0, 2, 'office');

      // Add vacation
      db.prepare(`
        INSERT INTO absence_requests (userId, type, startDate, endDate, status, days)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testUserId, 'vacation', '2026-02-04', '2026-02-04', 'approved', 1);

      // Add corrections
      db.prepare(`
        INSERT INTO overtime_corrections (userId, date, hours, reason, correctionType, createdBy)
        VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)
      `).run(
        testUserId, '2026-02-03', 2, 'Testbuchung', 'manual', testUserId,
        testUserId, '2026-02-05', 2, 'Teeeesttttt', 'manual', testUserId
      );

      const result = unifiedOvertimeService.calculateMonthlyOvertime(testUserId, '2026-02');

      // With corrections included, overtime should be closer to zero
      expect(result.breakdown.corrections).toBe(4);
      expect(result.breakdown.worked).toBeGreaterThan(0);
      expect(result.breakdown.absenceCredits).toBeGreaterThan(0);
    });
  });
});
