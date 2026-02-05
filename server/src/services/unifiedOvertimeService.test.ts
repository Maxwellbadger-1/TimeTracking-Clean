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
});
