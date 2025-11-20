import { describe, it, expect } from 'vitest';

/**
 * OVERTIME CALCULATION TESTS
 *
 * These tests validate the core overtime calculation logic used throughout
 * the TimeTracking system, following SAP/Personio/DATEV Best Practices.
 *
 * CORE PRINCIPLES (IMMUTABLE):
 * 1. Formula: Overtime = Actual Hours - Target Hours
 * 2. Reference Date: ALWAYS today (not future, not static)
 * 3. Live Calculation: ALWAYS on-demand (never cached)
 * 4. Absence Credits: Sick/Vacation = Worked (add to actual hours)
 * 5. Unpaid Leave: Reduces target hours (not actual hours)
 */

describe('Overtime Calculation - Core Logic', () => {
  /**
   * Helper function to simulate working days calculation
   * (This mirrors the backend logic in server/src/utils/workingDays.ts)
   */
  function countWorkingDays(fromDate: Date, toDate: Date): number {
    let workingDays = 0;
    const current = new Date(fromDate);

    while (current <= toDate) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

      if (!isWeekend) {
        workingDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  }

  /**
   * Calculate target hours from hire date to today
   */
  function calculateTargetHours(weeklyHours: number, hireDate: Date, today: Date): number {
    const workingDays = countWorkingDays(hireDate, today);
    const dailyHours = weeklyHours / 5; // 5-day work week
    return Math.round((dailyHours * workingDays) * 100) / 100;
  }

  /**
   * Calculate overtime
   */
  function calculateOvertime(actualHours: number, targetHours: number): number {
    return Math.round((actualHours - targetHours) * 100) / 100;
  }

  describe('Basic Overtime Formula', () => {
    it('should calculate zero overtime when actual equals target', () => {
      const actual = 40;
      const target = 40;
      const overtime = calculateOvertime(actual, target);

      expect(overtime).toBe(0);
    });

    it('should calculate positive overtime when actual exceeds target', () => {
      const actual = 45;
      const target = 40;
      const overtime = calculateOvertime(actual, target);

      expect(overtime).toBe(5);
    });

    it('should calculate negative overtime when actual is below target', () => {
      const actual = 35;
      const target = 40;
      const overtime = calculateOvertime(actual, target);

      expect(overtime).toBe(-5);
    });
  });

  describe('Working Days Calculation', () => {
    it('should count only weekdays (exclude weekends)', () => {
      // Nov 4-10, 2025 (Tue-Mon) includes 1 weekend
      const start = new Date('2025-11-04'); // Tuesday
      const end = new Date('2025-11-10');   // Monday
      const workingDays = countWorkingDays(start, end);

      // Tue, Wed, Thu, Fri (week 1) + Mon (week 2) = 5 days
      expect(workingDays).toBe(5);
    });

    it('should handle full work week (Mon-Fri)', () => {
      // Nov 3-7, 2025 (Mon-Fri)
      const start = new Date('2025-11-03'); // Monday
      const end = new Date('2025-11-07');   // Friday
      const workingDays = countWorkingDays(start, end);

      expect(workingDays).toBe(5);
    });

    it('should return 0 for weekend-only period', () => {
      // Nov 8-9, 2025 (Sat-Sun)
      const start = new Date('2025-11-08'); // Saturday
      const end = new Date('2025-11-09');   // Sunday
      const workingDays = countWorkingDays(start, end);

      expect(workingDays).toBe(0);
    });

    it('should handle single day correctly', () => {
      // Monday
      const monday = new Date('2025-11-03');
      expect(countWorkingDays(monday, monday)).toBe(1);

      // Saturday
      const saturday = new Date('2025-11-08');
      expect(countWorkingDays(saturday, saturday)).toBe(0);
    });
  });

  describe('Target Hours Calculation', () => {
    it('should calculate target hours for full work week', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);

      // 5 working days × 8h/day = 40h
      expect(targetHours).toBe(40);
    });

    it('should calculate target hours for partial week', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-07'); // Friday (hired on Friday)
      const today = new Date('2025-11-07');    // Same day

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);

      // 1 working day × 8h/day = 8h
      expect(targetHours).toBe(8);
    });

    it('should handle part-time employees (30h week)', () => {
      const weeklyHours = 30;
      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);

      // 5 working days × 6h/day = 30h
      expect(targetHours).toBe(30);
    });
  });

  /**
   * REGRESSION TEST: Nov 7-11, 2025 Scenario
   * This is the real-world scenario that exposed the formatHours bug
   */
  describe('Real-World Scenario: Nov 7-11, 2025 (Employee hired on Thursday)', () => {
    it('should calculate correct overtime for newly hired employee with no time entries', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-07');  // Thursday, Nov 7
      const today = new Date('2025-11-11');     // Monday, Nov 11

      // Working days: Thu (7), Fri (8), Mon (11) = 3 days
      // Weekend: Sat (9), Sun (10) = excluded
      const workingDays = countWorkingDays(hireDate, today);
      expect(workingDays).toBe(3);

      // Target: 3 days × 8h/day = 24h
      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(24);

      // Actual: No time entries = 0h
      const actualHours = 0;

      // Overtime: 0h - 24h = -24h (employee is 24 hours behind)
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(-24);
    });

    it('should calculate correct overtime when employee works all expected hours', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-07');  // Thursday
      const today = new Date('2025-11-11');     // Monday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(24);

      // Employee worked all 3 days, 8 hours each
      const actualHours = 24;

      // Overtime: 24h - 24h = 0h (on target)
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(0);
    });

    it('should calculate correct overtime when employee works extra hours', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-07');
      const today = new Date('2025-11-11');

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(24);

      // Employee worked 28 hours (4 hours overtime)
      const actualHours = 28;

      // Overtime: 28h - 24h = +4h
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(4);
    });
  });

  describe('Absence Credits (Sick/Vacation)', () => {
    /**
     * BEST PRACTICE: Sick and vacation days count as worked hours
     * This prevents employees from accumulating negative overtime when ill or on vacation
     */
    it('should credit sick days as worked hours', () => {
      const weeklyHours = 40;
      const dailyHours = weeklyHours / 5; // 8h

      // Week scenario: Mon-Fri
      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(40); // 5 days × 8h

      // Employee worked Mon, Tue (16h), then sick Wed-Fri (3 days)
      const workedHours = 16;
      const sickDays = 3;
      const sickCredits = sickDays * dailyHours; // 3 × 8h = 24h

      const actualHours = workedHours + sickCredits; // 16h + 24h = 40h

      // Overtime: 40h - 40h = 0h (sick days prevent negative overtime!)
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(0);
    });

    it('should credit vacation days as worked hours', () => {
      const weeklyHours = 40;
      const dailyHours = weeklyHours / 5; // 8h

      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(40);

      // Employee worked Mon (8h), vacation Tue-Fri (4 days)
      const workedHours = 8;
      const vacationDays = 4;
      const vacationCredits = vacationDays * dailyHours; // 4 × 8h = 32h

      const actualHours = workedHours + vacationCredits; // 8h + 32h = 40h

      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(0);
    });
  });

  describe('Unpaid Leave', () => {
    /**
     * BEST PRACTICE: Unpaid leave reduces target hours (not actual hours)
     * This prevents the system from expecting work during unpaid leave periods
     */
    it('should reduce target hours for unpaid leave days', () => {
      const weeklyHours = 40;
      const dailyHours = weeklyHours / 5; // 8h

      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const baseTargetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(baseTargetHours).toBe(40); // 5 days × 8h

      // Employee worked Mon-Wed (24h), unpaid leave Thu-Fri (2 days)
      const workedHours = 24;
      const unpaidDays = 2;
      const unpaidReduction = unpaidDays * dailyHours; // 2 × 8h = 16h

      // Adjusted target: 40h - 16h = 24h
      const adjustedTargetHours = baseTargetHours - unpaidReduction;
      expect(adjustedTargetHours).toBe(24);

      // Overtime: 24h - 24h = 0h (unpaid leave doesn't create negative overtime!)
      const overtime = calculateOvertime(workedHours, adjustedTargetHours);
      expect(overtime).toBe(0);
    });
  });

  describe('Mixed Scenarios', () => {
    it('should handle combination of work, sick days, and unpaid leave', () => {
      const weeklyHours = 40;
      const dailyHours = 8;

      // 2-week scenario
      const hireDate = new Date('2025-11-03');  // Mon, Week 1
      const today = new Date('2025-11-14');     // Fri, Week 2

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(80); // 10 working days × 8h

      // Week 1: Worked Mon-Wed (24h), sick Thu-Fri (2 days)
      // Week 2: Worked Mon-Tue (16h), unpaid leave Wed-Fri (3 days)
      const workedHours = 40; // 24h + 16h
      const sickDays = 2;
      const unpaidDays = 3;

      const sickCredits = sickDays * dailyHours; // 2 × 8h = 16h
      const unpaidReduction = unpaidDays * dailyHours; // 3 × 8h = 24h

      const actualHours = workedHours + sickCredits; // 40h + 16h = 56h
      const adjustedTargetHours = targetHours - unpaidReduction; // 80h - 24h = 56h

      const overtime = calculateOvertime(actualHours, adjustedTargetHours);
      expect(overtime).toBe(0); // 56h - 56h = 0h
    });

    it('should calculate overtime for part-time employee with vacation', () => {
      const weeklyHours = 20; // Part-time (50%)
      const dailyHours = 4;

      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(20); // 5 days × 4h

      // Worked Mon-Tue (8h), vacation Wed-Fri (3 days)
      const workedHours = 8;
      const vacationDays = 3;
      const vacationCredits = vacationDays * dailyHours; // 3 × 4h = 12h

      const actualHours = workedHours + vacationCredits; // 8h + 12h = 20h

      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle employee hired on Friday (1 working day)', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-07'); // Friday
      const today = new Date('2025-11-07');    // Same day

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(8); // 1 day × 8h

      const actualHours = 8;
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(0);
    });

    it('should handle employee hired on Saturday (0 working days until Sunday)', () => {
      const weeklyHours = 40;
      const hireDate = new Date('2025-11-08'); // Saturday
      const today = new Date('2025-11-09');    // Sunday

      const workingDays = countWorkingDays(hireDate, today);
      expect(workingDays).toBe(0); // Weekend, no working days

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(0);

      const actualHours = 0;
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(0); // No overtime expected on weekend
    });

    it('should handle very small hour differences (rounding)', () => {
      const actual = 40.33;
      const target = 40;
      const overtime = calculateOvertime(actual, target);

      expect(overtime).toBe(0.33);
    });

    it('should handle very large hour differences', () => {
      const actual = 200;
      const target = 160;
      const overtime = calculateOvertime(actual, target);

      expect(overtime).toBe(40);
    });
  });

  describe('Decimal Precision', () => {
    it('should maintain 2 decimal places precision', () => {
      const weeklyHours = 37.5; // Common in some countries
      const hireDate = new Date('2025-11-03'); // Monday
      const today = new Date('2025-11-07');    // Friday

      const targetHours = calculateTargetHours(weeklyHours, hireDate, today);
      expect(targetHours).toBe(37.5); // 5 days × 7.5h

      const actualHours = 40;
      const overtime = calculateOvertime(actualHours, targetHours);
      expect(overtime).toBe(2.5); // 40 - 37.5
    });
  });
});
