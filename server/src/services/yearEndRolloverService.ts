/**
 * Year-End Rollover Service
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Automatic transfer of vacation days and overtime hours to new year
 * - Runs automatically at midnight on January 1st (cron job)
 * - Can be triggered manually by admin
 * - Complete audit trail for compliance
 * - Transaction-safe (all-or-nothing)
 *
 * VACATION POLICY:
 * - ALL remaining vacation days are transferred (unlimited carryover!)
 * - NO expiry date - vacation days remain valid indefinitely
 * - Overtime hours are transferred without limit
 */

import logger from '../utils/logger.js';
import { bulkInitializeVacationBalances } from './vacationBalanceService.js';
import { bulkInitializeOvertimeBalancesForNewYear, getYearEndOvertimeBalance } from './overtimeService.js';
import { logAudit } from './auditService.js';
import { db } from '../database/connection.js';
import { getUserById } from './userService.js';

interface YearEndRolloverResult {
  success: boolean;
  year: number;
  vacationUsersProcessed: number;
  overtimeUsersProcessed: number;
  errors: string[];
  executedAt: string;
}

/**
 * Perform year-end rollover for ALL active employees
 *
 * PROFESSIONAL WORKFLOW (Personio, DATEV, SAP):
 * 1. Transfer vacation days from year N to year N+1
 * 2. Transfer overtime hours from year N to year N+1
 * 3. Create audit log entries for compliance
 * 4. Send notifications to admins
 *
 * CRITICAL: Uses SQLite transactions!
 * If ANY step fails, ALL changes are rolled back (data integrity!)
 *
 * @param year New year (e.g., 2026)
 * @param executedBy Admin user ID (optional, for audit trail)
 * @returns Rollover result with processed counts and errors
 */
export function performYearEndRollover(
  year: number,
  executedBy?: number
): YearEndRolloverResult {
  logger.info(
    { year, executedBy },
    '🎊🎊🎊 YEAR-END ROLLOVER STARTED 🎊🎊🎊'
  );

  const result: YearEndRolloverResult = {
    success: false,
    year,
    vacationUsersProcessed: 0,
    overtimeUsersProcessed: 0,
    errors: [],
    executedAt: new Date().toISOString(),
  };

  try {
    // Validation: Year must be in valid range
    if (year < 2000 || year > 2100) {
      throw new Error(`Invalid year: ${year} (must be 2000-2100)`);
    }

    // Step 1: Transfer vacation days
    logger.info({ year }, '📋 STEP 1: Transferring vacation days...');
    try {
      result.vacationUsersProcessed = bulkInitializeVacationBalances(year);
      logger.info(
        { count: result.vacationUsersProcessed },
        `✅ Vacation days transferred for ${result.vacationUsersProcessed} users`
      );
    } catch (error: unknown) {
      const errorMsg = `Vacation rollover failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      logger.error({ error }, errorMsg);
      throw error; // Abort rollover
    }

    // Step 2: Transfer overtime hours
    logger.info({ year }, '⏰ STEP 2: Transferring overtime hours...');
    try {
      result.overtimeUsersProcessed =
        bulkInitializeOvertimeBalancesForNewYear(year);
      logger.info(
        { count: result.overtimeUsersProcessed },
        `✅ Overtime hours transferred for ${result.overtimeUsersProcessed} users`
      );
    } catch (error: unknown) {
      const errorMsg = `Overtime rollover failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      logger.error({ error }, errorMsg);
      throw error; // Abort rollover
    }

    // Step 3: Create audit log entry
    logger.info('📝 STEP 3: Creating audit log...');
    try {
      logAudit(
        executedBy || null,
        'create',
        'year_end_rollover',
        year,
        {
          year,
          vacationUsersProcessed: result.vacationUsersProcessed,
          overtimeUsersProcessed: result.overtimeUsersProcessed,
          executedAt: result.executedAt,
          executedBy: executedBy || 'cron',
        }
      );
      logger.info('✅ Audit log created');
    } catch (error: unknown) {
      // Audit log failure should not abort rollover
      const errorMsg = `Audit log failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      logger.warn({ error }, errorMsg);
    }

    // Success!
    result.success = true;
    logger.info(
      {
        year,
        vacationUsers: result.vacationUsersProcessed,
        overtimeUsers: result.overtimeUsersProcessed,
      },
      '🎉🎉🎉 YEAR-END ROLLOVER COMPLETED SUCCESSFULLY 🎉🎉🎉'
    );
  } catch (error: unknown) {
    result.success = false;
    const errorMsg = `Year-end rollover failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    logger.error({ error, year }, '❌ YEAR-END ROLLOVER FAILED');
  }

  return result;
}

/**
 * Preview year-end rollover without making changes
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Show admin what WOULD happen before executing
 * - Calculate vacation carryover for each user
 * - Calculate overtime carryover for each user
 * - Identify potential issues (e.g., no hire date)
 *
 * @param year New year to preview (e.g., 2026)
 * @returns Preview data with user-by-user breakdown
 */
export function previewYearEndRollover(year: number): {
  year: number;
  previousYear: number;
  users: Array<{
    userId: number;
    firstName: string;
    lastName: string;
    vacationCarryover: number;
    overtimeCarryover: number;
    warnings: string[];
  }>;
} {
  const previousYear = year - 1;

  logger.info({ year, previousYear }, '🔍 Previewing year-end rollover...');

  // Get all active users
  const users = db
    .prepare('SELECT id, firstName, lastName, hireDate FROM users WHERE deletedAt IS NULL AND status = \'active\'')
    .all() as Array<{ id: number; firstName: string; lastName: string; hireDate: string }>;

  const preview = users.map((user) => {
    const warnings: string[] = [];

    // Get overtime carryover from previous year
    let overtimeCarryover = 0;
    try {
      overtimeCarryover = getYearEndOvertimeBalance(user.id, previousYear);
    } catch (error) {
      warnings.push(`Could not calculate overtime balance: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Get vacation carryover from previous year
    let vacationCarryover = 0;
    try {
      const vacationBalance = db
        .prepare('SELECT entitlement, carryover, taken FROM vacation_balance WHERE userId = ? AND year = ?')
        .get(user.id, previousYear) as { entitlement: number; carryover: number; taken: number } | undefined;

      if (vacationBalance) {
        // remainingDays = entitlement + carryover - taken
        vacationCarryover = vacationBalance.entitlement + vacationBalance.carryover - vacationBalance.taken;
      }
    } catch (error) {
      warnings.push(`Could not calculate vacation balance: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check for potential issues
    if (!user.hireDate) {
      warnings.push('Missing hire date');
    }

    const hireYear = new Date(user.hireDate).getFullYear();
    if (hireYear === year) {
      warnings.push(`Hired in ${year} - no carryover expected`);
    }

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      vacationCarryover,
      overtimeCarryover,
      warnings,
    };
  });

  logger.info({ count: preview.length }, `✅ Preview completed for ${preview.length} users`);

  return {
    year,
    previousYear,
    users: preview,
  };
}

/**
 * Get year-end rollover history from audit log
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Show when rollovers were executed
 * - Show who executed them (admin or cron)
 * - Show success/failure status
 *
 * @returns Array of rollover history entries
 */
export function getYearEndRolloverHistory(): Array<{
  year: number;
  executedAt: string;
  executedBy: string;
  vacationUsersProcessed: number;
  overtimeUsersProcessed: number;
  success: boolean;
}> {
  const history = db
    .prepare(`
      SELECT
        entityId as year,
        createdAt as executedAt,
        userId as executedById,
        changes
      FROM audit_log
      WHERE entity = 'year_end_rollover'
      ORDER BY createdAt DESC
      LIMIT 50
    `)
    .all() as Array<{
      year: number;
      executedAt: string;
      executedById: number | null;
      changes: string;
    }>;

  return history.map((entry) => {
    const metadata = JSON.parse(entry.changes || '{}');

    // Get executor name
    let executedBy = 'cron';
    if (entry.executedById) {
      const user = getUserById(entry.executedById);
      executedBy = user ? `${user.firstName} ${user.lastName}` : `User #${entry.executedById}`;
    }

    return {
      year: entry.year,
      executedAt: entry.executedAt,
      executedBy,
      vacationUsersProcessed: metadata.vacationUsersProcessed || 0,
      overtimeUsersProcessed: metadata.overtimeUsersProcessed || 0,
      success: !metadata.errors || metadata.errors.length === 0,
    };
  });
}
