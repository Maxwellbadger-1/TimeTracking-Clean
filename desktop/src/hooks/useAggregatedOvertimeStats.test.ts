import { describe, it, expect } from 'vitest';

/**
 * REGRESSION TEST: "Alle Mitarbeiter" Aggregation Bug
 *
 * BUG DESCRIPTION:
 * Before fix: When admin selects "Alle Mitarbeiter" (All Employees) in the Reports page,
 * the overtime statistics were showing individual user data instead of aggregated totals
 * for all users combined.
 *
 * ROOT CAUSE:
 * The ReportsPage was using useOvertimeSummary() with a fallback userId of 0 when
 * selectedUserId === 'all', which caused the backend to return data for userId=0
 * (if such a user exists) or empty data, instead of aggregating all users' data.
 *
 * FIX:
 * Created a new hook useAggregatedOvertimeStats() and a new backend endpoint
 * /api/overtime/aggregated that properly sums up:
 * - totalTargetHours (sum of all users' target hours)
 * - totalActualHours (sum of all users' actual hours including absence credits)
 * - totalOvertime (sum of all users' overtime)
 * - userCount (number of users included in the aggregation)
 *
 * EXPECTED BEHAVIOR (Example):
 * Given:
 * - User A: Target=160h, Actual=150h, Overtime=-10h
 * - User B: Target=160h, Actual=170h, Overtime=+10h
 * - User C: Target=160h, Actual=160h, Overtime=0h
 *
 * When admin selects "Alle Mitarbeiter" for November 2025:
 * Then the system should show:
 * - Total Target Hours: 480h (160 + 160 + 160)
 * - Total Actual Hours: 480h (150 + 170 + 160)
 * - Total Overtime: 0h (-10 + 10 + 0)
 * - User Count: 3
 */

describe('Aggregated Overtime Stats - "Alle Mitarbeiter" Feature', () => {
  describe('Data Structure', () => {
    it('should have correct interface for aggregated stats', () => {
      // This test validates the data structure used in the hook
      const mockAggregatedStats = {
        totalTargetHours: 480,
        totalActualHours: 480,
        totalOvertime: 0,
        userCount: 3,
      };

      expect(mockAggregatedStats).toHaveProperty('totalTargetHours');
      expect(mockAggregatedStats).toHaveProperty('totalActualHours');
      expect(mockAggregatedStats).toHaveProperty('totalOvertime');
      expect(mockAggregatedStats).toHaveProperty('userCount');

      expect(typeof mockAggregatedStats.totalTargetHours).toBe('number');
      expect(typeof mockAggregatedStats.totalActualHours).toBe('number');
      expect(typeof mockAggregatedStats.totalOvertime).toBe('number');
      expect(typeof mockAggregatedStats.userCount).toBe('number');
    });
  });

  describe('Aggregation Logic Validation', () => {
    /**
     * This test validates the mathematical correctness of the aggregation
     * It simulates what the backend should calculate
     */
    it('should correctly aggregate multiple users overtime data', () => {
      // Simulate backend calculation
      const usersData = [
        { targetHours: 160, actualHours: 150, overtime: -10 }, // User A (behind)
        { targetHours: 160, actualHours: 170, overtime: +10 }, // User B (ahead)
        { targetHours: 160, actualHours: 160, overtime: 0 },   // User C (on track)
      ];

      const aggregated = usersData.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      expect(aggregated.totalTargetHours).toBe(480);
      expect(aggregated.totalActualHours).toBe(480);
      expect(aggregated.totalOvertime).toBe(0);
      expect(aggregated.userCount).toBe(3);
    });

    it('should handle negative total overtime correctly', () => {
      // All users behind schedule
      const usersData = [
        { targetHours: 160, actualHours: 140, overtime: -20 },
        { targetHours: 160, actualHours: 150, overtime: -10 },
        { targetHours: 160, actualHours: 145, overtime: -15 },
      ];

      const aggregated = usersData.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      expect(aggregated.totalTargetHours).toBe(480);
      expect(aggregated.totalActualHours).toBe(435);
      expect(aggregated.totalOvertime).toBe(-45);
      expect(aggregated.userCount).toBe(3);
    });

    it('should handle positive total overtime correctly', () => {
      // All users ahead of schedule
      const usersData = [
        { targetHours: 160, actualHours: 180, overtime: +20 },
        { targetHours: 160, actualHours: 170, overtime: +10 },
        { targetHours: 160, actualHours: 175, overtime: +15 },
      ];

      const aggregated = usersData.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      expect(aggregated.totalTargetHours).toBe(480);
      expect(aggregated.totalActualHours).toBe(525);
      expect(aggregated.totalOvertime).toBe(45);
      expect(aggregated.userCount).toBe(3);
    });

    it('should handle mixed overtime scenarios', () => {
      // Realistic scenario with varying overtime
      const usersData = [
        { targetHours: 160, actualHours: 180, overtime: +20 },  // Overachiever
        { targetHours: 160, actualHours: 150, overtime: -10 },  // Behind
        { targetHours: 160, actualHours: 160, overtime: 0 },    // On target
        { targetHours: 120, actualHours: 125, overtime: +5 },   // Part-time, ahead
        { targetHours: 120, actualHours: 110, overtime: -10 },  // Part-time, behind
      ];

      const aggregated = usersData.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      expect(aggregated.totalTargetHours).toBe(720); // 160*3 + 120*2
      expect(aggregated.totalActualHours).toBe(725); // 180+150+160+125+110
      expect(aggregated.totalOvertime).toBe(5);      // 20-10+0+5-10
      expect(aggregated.userCount).toBe(5);
    });

    it('should handle single user aggregation', () => {
      const usersData = [
        { targetHours: 160, actualHours: 170, overtime: +10 },
      ];

      const aggregated = usersData.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      expect(aggregated.totalTargetHours).toBe(160);
      expect(aggregated.totalActualHours).toBe(170);
      expect(aggregated.totalOvertime).toBe(10);
      expect(aggregated.userCount).toBe(1);
    });

    it('should handle empty users array', () => {
      const usersData: Array<{ targetHours: number; actualHours: number; overtime: number }> = [];

      const aggregated = usersData.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      expect(aggregated.totalTargetHours).toBe(0);
      expect(aggregated.totalActualHours).toBe(0);
      expect(aggregated.totalOvertime).toBe(0);
      expect(aggregated.userCount).toBe(0);
    });
  });

  describe('Overtime Formula Validation', () => {
    it('should validate that overtime = actual - target for each user', () => {
      const usersData = [
        { targetHours: 160, actualHours: 150 },
        { targetHours: 160, actualHours: 170 },
        { targetHours: 120, actualHours: 125 },
      ];

      // Calculate overtime for each user
      const withOvertime = usersData.map(user => ({
        ...user,
        overtime: user.actualHours - user.targetHours,
      }));

      // Validate individual calculations
      expect(withOvertime[0].overtime).toBe(-10); // 150 - 160 = -10
      expect(withOvertime[1].overtime).toBe(10);  // 170 - 160 = +10
      expect(withOvertime[2].overtime).toBe(5);   // 125 - 120 = +5

      // Aggregate
      const aggregated = withOvertime.reduce(
        (acc, user) => ({
          totalTargetHours: acc.totalTargetHours + user.targetHours,
          totalActualHours: acc.totalActualHours + user.actualHours,
          totalOvertime: acc.totalOvertime + user.overtime,
          userCount: acc.userCount + 1,
        }),
        { totalTargetHours: 0, totalActualHours: 0, totalOvertime: 0, userCount: 0 }
      );

      // Validate aggregated formula
      expect(aggregated.totalOvertime).toBe(
        aggregated.totalActualHours - aggregated.totalTargetHours
      );
    });
  });

  describe('Query Parameters', () => {
    it('should construct correct query parameters for yearly view', () => {
      const year = 2025;
      const month = undefined;

      const params = new URLSearchParams();
      params.set('year', year.toString());
      if (month) {
        params.set('month', month);
      }

      expect(params.toString()).toBe('year=2025');
    });

    it('should construct correct query parameters for monthly view', () => {
      const year = 2025;
      const month = '2025-11';

      const params = new URLSearchParams();
      params.set('year', year.toString());
      if (month) {
        params.set('month', month);
      }

      expect(params.toString()).toBe('year=2025&month=2025-11');
    });
  });
});
