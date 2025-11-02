import { db } from '../database/connection.js';

/**
 * Overtime Service
 * Handles overtime balance calculation and management
 */

interface OvertimeBalance {
  userId: number;
  year: number;
  totalOvertime: number;
  byMonth: MonthlyOvertime[];
}

interface MonthlyOvertime {
  month: string; // Format: "2025-11"
  targetHours: number;
  actualHours: number;
  overtime: number;
}

interface UserOvertimeSummary {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  totalOvertime: number;
  currentMonthOvertime: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Get overtime balance for a specific user and year
 */
export function getOvertimeBalance(userId: number, year: number): OvertimeBalance {
  // Get all overtime records for the year
  const query = `
    SELECT
      month,
      targetHours,
      actualHours,
      overtime
    FROM overtime_balance
    WHERE userId = ?
      AND month LIKE ?
    ORDER BY month ASC
  `;

  const monthlyRecords = db
    .prepare(query)
    .all(userId, `${year}-%`) as MonthlyOvertime[];

  // Calculate total overtime
  const totalOvertime = monthlyRecords.reduce((sum, record) => sum + record.overtime, 0);

  return {
    userId,
    year,
    totalOvertime: Math.round(totalOvertime * 10) / 10, // Round to 1 decimal
    byMonth: monthlyRecords,
  };
}

/**
 * Get overtime for a specific month
 */
export function getOvertimeByMonth(userId: number, month: string): MonthlyOvertime | null {
  const query = `
    SELECT
      month,
      targetHours,
      actualHours,
      overtime
    FROM overtime_balance
    WHERE userId = ? AND month = ?
  `;

  const record = db.prepare(query).get(userId, month) as MonthlyOvertime | undefined;
  return record || null;
}

/**
 * Get overtime for all users (Admin only)
 * Returns summary with trend analysis
 */
export function getAllUsersOvertime(year: number): UserOvertimeSummary[] {
  const query = `
    SELECT
      u.id as userId,
      u.firstName,
      u.lastName,
      u.email,
      COALESCE(SUM(ob.overtime), 0) as totalOvertime,
      COALESCE(
        (SELECT overtime
         FROM overtime_balance
         WHERE userId = u.id
           AND month = strftime('%Y-%m', 'now')
        ), 0
      ) as currentMonthOvertime,
      COALESCE(
        (SELECT overtime
         FROM overtime_balance
         WHERE userId = u.id
           AND month = strftime('%Y-%m', 'now', '-1 month')
        ), 0
      ) as lastMonthOvertime
    FROM users u
    LEFT JOIN overtime_balance ob ON u.id = ob.userId
      AND ob.month LIKE ?
    WHERE u.deletedAt IS NULL
    GROUP BY u.id
    ORDER BY totalOvertime DESC
  `;

  const results = db.prepare(query).all(`${year}-%`) as any[];

  return results.map((row) => {
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (row.currentMonthOvertime > row.lastMonthOvertime) {
      trend = 'up';
    } else if (row.currentMonthOvertime < row.lastMonthOvertime) {
      trend = 'down';
    }

    return {
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      totalOvertime: Math.round(row.totalOvertime * 10) / 10,
      currentMonthOvertime: Math.round(row.currentMonthOvertime * 10) / 10,
      trend,
    };
  });
}

// NOTE: updateOvertimeBalance is defined in timeEntryService.ts
// and automatically called when time entries are created/updated/deleted

/**
 * Deduct overtime hours when overtime compensation absence is approved
 * This is called when admin approves an overtime_comp absence request
 */
export function deductOvertimeForAbsence(
  userId: number,
  hours: number,
  absenceMonth: string
): void {
  // Get current total overtime
  const currentYear = new Date().getFullYear();
  const balance = getOvertimeBalance(userId, currentYear);

  if (balance.totalOvertime < hours) {
    throw new Error(
      `Nicht genug Überstunden! Verfügbar: ${balance.totalOvertime}h, Benötigt: ${hours}h`
    );
  }

  // Deduct from the month where the absence was taken
  const monthRecord = getOvertimeByMonth(userId, absenceMonth);

  if (monthRecord) {
    // Deduct from actual hours (which will decrease overtime)
    const newActualHours = monthRecord.actualHours - hours;

    db.prepare('UPDATE overtime_balance SET actualHours = ? WHERE userId = ? AND month = ?').run(
      newActualHours,
      userId,
      absenceMonth
    );
  } else {
    // Create negative record if month doesn't exist yet
    db.prepare(
      'INSERT INTO overtime_balance (userId, month, targetHours, actualHours) VALUES (?, ?, ?, ?)'
    ).run(userId, absenceMonth, 0, -hours);
  }
}

/**
 * Check if user has enough overtime for compensation request
 */
export function hasEnoughOvertime(userId: number, requestedHours: number): boolean {
  const currentYear = new Date().getFullYear();
  const balance = getOvertimeBalance(userId, currentYear);

  return balance.totalOvertime >= requestedHours;
}

/**
 * Get overtime statistics for dashboard
 */
export function getOvertimeStats(userId: number) {
  const currentYear = new Date().getFullYear();
  const balance = getOvertimeBalance(userId, currentYear);

  const currentMonth = new Date().toISOString().slice(0, 7); // "2025-11"
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
    .toISOString()
    .slice(0, 7);

  const currentMonthData = balance.byMonth.find((m) => m.month === currentMonth);
  const lastMonthData = balance.byMonth.find((m) => m.month === lastMonth);

  return {
    total: balance.totalOvertime,
    currentMonth: currentMonthData?.overtime || 0,
    lastMonth: lastMonthData?.overtime || 0,
    trend:
      (currentMonthData?.overtime || 0) > (lastMonthData?.overtime || 0)
        ? 'up'
        : (currentMonthData?.overtime || 0) < (lastMonthData?.overtime || 0)
        ? 'down'
        : 'stable',
  };
}
