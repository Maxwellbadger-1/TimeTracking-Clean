import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { db } from '../database/connection.js';
import {
  getAllUsersOvertimeSummary,
  getOvertimeSummary,
  getAggregatedOvertimeStats,
  ensureOvertimeBalanceEntries,
  ensureDailyOvertimeTransactions,
} from '../services/overtimeService.js';
import {
  createOvertimeCorrection,
  getOvertimeCorrectionsForUser,
  getAllOvertimeCorrections,
  deleteOvertimeCorrection,
  getCorrectionStatistics,
} from '../services/overtimeCorrectionsService.js';
import type { ApiResponse, OvertimeCorrectionCreateInput } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();


/**
 * GET /api/overtime/all
 * Get overtime summary for all users (Admin only)
 * Query params:
 *   - year: Year to get data for (default: current year)
 *   - month: Optional month in format "YYYY-MM" for monthly reports
 * Returns: userId, firstName, lastName, email, targetHours, actualHours, totalOvertime
 */
router.get(
  '/all',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();

      const month = req.query.month as string | undefined;

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      if (month && !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      const allOvertime = await getAllUsersOvertimeSummary(year, month);

      res.json({
        success: true,
        data: allOvertime,
      });
    } catch (error) {
      console.error('Error getting all users overtime:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get all users overtime',
      });
    }
  }
);

/**
 * GET /api/overtime/aggregated
 * Get aggregated overtime statistics for all users (Admin only)
 * Query params:
 *   - year: Year to get data for (default: current year)
 *   - month: Optional month in format "YYYY-MM"
 * Returns: totalTargetHours, totalActualHours, totalOvertime, userCount
 */
router.get(
  '/aggregated',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();

      const month = req.query.month as string | undefined;

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      if (month && !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      const aggregatedStats = await getAggregatedOvertimeStats(year, month);

      res.json({
        success: true,
        data: aggregatedStats,
      });
    } catch (error) {
      console.error('Error getting aggregated overtime stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get aggregated overtime statistics',
      });
    }
  }
);


/**
 * POST /api/overtime/corrections
 * Create a new overtime correction (admin only)
 * Body: { userId, hours, date, reason, correctionType }
 */
router.post(
  '/corrections',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const { userId, hours, date, reason, correctionType } = req.body as OvertimeCorrectionCreateInput;
      const createdBy = req.session.user!.id;

      // Validation
      if (!userId || !hours || !date || !reason || !correctionType) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
        return;
      }

      if (reason.trim().length < 10) {
        res.status(400).json({
          success: false,
          error: 'Reason must be at least 10 characters',
        });
        return;
      }

      const correction = createOvertimeCorrection(
        { userId, hours, date, reason, correctionType },
        createdBy
      );

      res.json({
        success: true,
        data: correction,
      });
    } catch (error) {
      console.error('Error creating overtime correction:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create overtime correction',
      });
    }
  }
);

/**
 * GET /api/overtime/corrections
 * Get overtime corrections for current user or all users (admin)
 * Query params:
 *   - userId: User ID (optional, admin can get for specific user)
 *   - year: Year filter (optional, e.g., 2026)
 *   - month: Month filter (optional, 1-12)
 */
router.get(
  '/corrections',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : null;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;

      let corrections;

      if (requestedUserId) {
        // Admin can get corrections for any user, employee can only get their own
        if (!isAdmin && requestedUserId !== req.session.user!.id) {
          res.status(403).json({
            success: false,
            error: 'Forbidden',
          });
          return;
        }
        corrections = getOvertimeCorrectionsForUser(requestedUserId, year, month);
      } else if (isAdmin) {
        // Admin without userId query gets all corrections
        corrections = getAllOvertimeCorrections(year, month);
      } else {
        // Employee gets their own corrections
        corrections = getOvertimeCorrectionsForUser(req.session.user!.id, year, month);
      }

      res.json({
        success: true,
        data: corrections,
      });
    } catch (error) {
      console.error('Error getting overtime corrections:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime corrections',
      });
    }
  }
);

/**
 * DELETE /api/overtime/corrections/:id
 * Delete an overtime correction (admin only)
 */
router.delete(
  '/corrections/:id',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id);
      const deletedBy = req.session.user!.id;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid correction ID',
        });
        return;
      }

      deleteOvertimeCorrection(id, deletedBy);

      res.json({
        success: true,
        message: 'Overtime correction deleted',
      });
    } catch (error) {
      console.error('Error deleting overtime correction:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete overtime correction',
      });
    }
  }
);

/**
 * GET /api/overtime/corrections/statistics
 * Get correction statistics (admin only)
 * Query params:
 *   - userId: User ID (optional, get stats for specific user)
 */
router.get(
  '/corrections/statistics',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

      const stats = getCorrectionStatistics(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting correction statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get correction statistics',
      });
    }
  }
);


/**
 * GET /api/overtime/transactions
 * Get overtime transactions (transaction-based overtime tracking)
 * Query params:
 *   - userId: User ID (admin can specify, employee gets own)
 *   - year: Year filter (optional)
 *   - limit: Number of transactions (default: 50)
 *
 * IMPORTANT: Must be BEFORE /:userId route to avoid catching "transactions" as a userId param!
 */
router.get(
  '/transactions',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';

      // Parse userId with proper handling
      let userId: number;
      if (isAdmin && req.query.userId) {
        const userIdParam = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
        userId = parseInt(userIdParam as string);
      } else {
        userId = req.session.user!.id;
      }

      const year = req.query.year
        ? parseInt(req.query.year as string)
        : undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : 50;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Permission check
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view these transactions',
        });
        return;
      }

      const { getOvertimeHistory, getOvertimeBalance } = await import('../services/overtimeTransactionService.js');

      const transactions = getOvertimeHistory(userId, year, limit);
      const currentBalance = getOvertimeBalance(userId);

      res.json({
        success: true,
        data: {
          transactions,
          currentBalance,
          userId,
        },
      });
    } catch (error) {
      console.error('Error getting overtime transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime transactions',
      });
    }
  }
);

/**
 * GET /api/overtime/transactions
 * Get ALL overtime transactions for a user
 *
 * Query params:
 *   - userId: User ID (required)
 *   - year: Filter by year (optional)
 *   - limit: Limit number of results (default: 50)
 *
 * Returns:
 *   - transactions: Array of all transaction types
 *   - currentBalance: Current overtime balance
 *   - userId: User ID
 *
 * CRITICAL: Must be BEFORE /transactions/monthly-summary route!
 */
router.get(
  '/transactions',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { userId: queryUserId, year, limit } = req.query;

      // Determine which user to query
      let userId: number;
      if (req.session.user!.role === 'admin' && queryUserId) {
        userId = Number(queryUserId);
      } else {
        userId = req.session.user!.id;
      }

      // Validate userId
      if (!userId || isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Import dynamically
      const { getOvertimeHistory, getOvertimeBalance } = await import('../services/overtimeTransactionService.js');

      // Get transactions
      const yearNum = year ? Number(year) : undefined;
      const limitNum = limit ? Number(limit) : 50;

      const transactions = getOvertimeHistory(userId, yearNum, limitNum);
      const currentBalance = getOvertimeBalance(userId);

      res.json({
        success: true,
        data: {
          transactions,
          currentBalance,
          userId,
        },
      });
    } catch (error: any) {
      logger.error({ err: error, query: req.query }, '❌ Failed to get overtime transactions');
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime transactions',
      });
    }
  }
);

/**
 * GET /api/overtime/transactions/live
 * Get LIVE overtime transactions (calculated ON-DEMAND, not from DB)
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Calculates from source data (time_entries + absences + corrections)
 * - Always up-to-date, reflects ALL changes instantly
 * - Shows ALL days from hireDate to today (not just stored transactions)
 * - Includes vacation/sick credits automatically
 *
 * Query params:
 *   - userId: User ID (admin can specify, employee gets own)
 *   - fromDate: Optional start date (YYYY-MM-DD, defaults to hireDate)
 *   - toDate: Optional end date (YYYY-MM-DD, defaults to today)
 *   - limit: Optional limit (default: 50)
 *
 * Returns:
 *   - transactions: Array of live-calculated transactions
 *   - currentBalance: Current overtime balance
 *   - userId: User ID
 *
 * IMPORTANT: Must be BEFORE /transactions/monthly-summary route!
 */
router.get(
  '/transactions/live',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { userId: queryUserId, fromDate, toDate, limit } = req.query;

      // Determine which user to query
      let userId: number;
      if (req.session.user!.role === 'admin' && queryUserId) {
        userId = Number(queryUserId);
      } else {
        userId = req.session.user!.id;
      }

      // Validate userId
      if (!userId || isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Permission check (employee can only see own data)
      if (req.session.user!.role !== 'admin' && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view these transactions',
        });
        return;
      }

      // Import live calculation service
      const { calculateLiveOvertimeTransactions, calculateCurrentOvertimeBalance } = await import(
        '../services/overtimeLiveCalculationService.js'
      );

      // Calculate live transactions
      const fromDateStr = fromDate ? String(fromDate) : undefined;
      const toDateStr = toDate ? String(toDate) : undefined;
      const limitNum = limit ? Number(limit) : 50;

      let transactions = calculateLiveOvertimeTransactions(userId, fromDateStr, toDateStr);

      // Apply limit
      if (limitNum && transactions.length > limitNum) {
        transactions = transactions.slice(0, limitNum);
      }

      // Calculate current balance
      const currentBalance = calculateCurrentOvertimeBalance(userId, fromDateStr, toDateStr);

      res.json({
        success: true,
        data: {
          transactions,
          currentBalance,
          userId,
        },
      });
    } catch (error: any) {
      logger.error({ err: error, query: req.query }, '❌ Failed to calculate live overtime transactions');
      res.status(500).json({
        success: false,
        error: 'Failed to calculate live overtime transactions',
      });
    }
  }
);

/**
 * GET /api/overtime/transactions/monthly-summary
 * Get monthly transaction summary for overtime history
 *
 * NEW ENDPOINT (2026-01-24): Single Source of Truth for Monatliche Entwicklung
 * REPLACES: /api/reports/overtime/history (which used overtime_balance - wrong!)
 *
 * Query params:
 *   - userId: User ID (admin can specify, employee gets own)
 *   - months: Number of months (default: 12, max: 36)
 *
 * Returns:
 *   - Array of monthly summaries with earned/compensation/correction breakdown
 *   - Cumulative balance calculation (like bank account)
 *
 * PROFESSIONAL STANDARD: Like SAP SuccessFactors, Personio, DATEV
 *
 * IMPORTANT: Must be AFTER /transactions route!
 */
router.get(
  '/transactions/monthly-summary',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';

      // Parse userId with proper handling
      let userId: number;
      if (isAdmin && req.query.userId) {
        const userIdParam = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
        userId = parseInt(userIdParam as string);
      } else {
        userId = req.session.user!.id;
      }

      const months = req.query.months
        ? parseInt(req.query.months as string)
        : 12;

      // Validation
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      if (isNaN(months) || months < 1 || months > 36) {
        res.status(400).json({
          success: false,
          error: 'Invalid months (must be 1-36)',
        });
        return;
      }

      // Permission check
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this data',
        });
        return;
      }

      // ✅ CRITICAL: Ensure ALL daily transactions exist (ON-DEMAND, like ensureOvertimeBalanceEntries)
      // Calculate month range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Ensure transactions exist for all days (including days without time_entries!)
      await ensureDailyOvertimeTransactions(userId, startMonth, endMonth);

      const { getMonthlyTransactionSummary, getOvertimeBalance } = await import('../services/overtimeTransactionService.js');

      const summary = getMonthlyTransactionSummary(userId, months);
      const currentBalance = getOvertimeBalance(userId);

      res.json({
        success: true,
        data: {
          summary,
          currentBalance,
          userId,
        },
      });
    } catch (error) {
      console.error('Error getting monthly transaction summary:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get monthly summary',
      });
    }
  }
);

/**
 * GET /api/overtime/:userId
 * Get detailed overtime data for a specific user
 * Returns: { totalHours, targetHours, overtime, user: { weeklyHours, hireDate } }
 * IMPORTANT: This route MUST be after /current, /transactions, and other specific routes
 */
router.get(
  '/:userId',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const isAdmin = req.session.user!.role === 'admin';

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Permission check: Admin can see all, Employee only own
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this overtime data',
        });
        return;
      }

      // Get user data
      const user = db
        .prepare('SELECT weeklyHours, hireDate FROM users WHERE id = ?')
        .get(userId) as { weeklyHours: number; hireDate: string } | undefined;

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Get overtime summary for current year
      const currentYear = new Date().getFullYear();
      const summary = await getOvertimeSummary(userId, currentYear);

      // Calculate total hours and target hours from monthly data
      const totalHours = summary.monthly.reduce(
        (sum, month) => sum + month.actualHours,
        0
      );
      const targetHours = summary.monthly.reduce(
        (sum, month) => sum + month.targetHours,
        0
      );

      res.json({
        success: true,
        data: {
          totalHours,
          targetHours,
          overtime: summary.totalOvertime,
          user: {
            weeklyHours: user.weeklyHours,
            hireDate: user.hireDate,
          },
        },
      });
    } catch (error) {
      console.error('Error getting overtime data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime data',
      });
    }
  }
);


/**
 * GET /api/overtime/summary/:userId/:year
 * Get complete overtime summary for a user and year
 * Returns: { daily: [], weekly: [], monthly: [], totalOvertime: 48.57 }
 * Params:
 *   - userId: User ID
 *   - year: Year (e.g., 2025)
 */
router.get(
  '/summary/:userId/:year',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const year = parseInt(req.params.year);
      const isAdmin = req.session.user!.role === 'admin';

      if (isNaN(userId) || isNaN(year)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID or year',
        });
        return;
      }

      if (year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      // Permission check
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this overtime data',
        });
        return;
      }

      const summary = await getOvertimeSummary(userId, year);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error getting overtime summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime summary',
      });
    }
  }
);

/**
 * POST /api/overtime/recalculate-all
 * Recalculate overtime for all users (Admin only)
 * This ensures all months from hire date to current month have overtime_balance entries
 * CRITICAL: Use this if users show incorrect overtime (missing months)
 */
router.post(
  '/recalculate-all',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response<ApiResponse>) => {
    try {
      const today = new Date();
      const currentMonth = today.toISOString().substring(0, 7); // YYYY-MM

      // Get all active users
      const users = db
        .prepare('SELECT id, firstName, lastName, hireDate FROM users WHERE deletedAt IS NULL')
        .all() as Array<{ id: number; firstName: string; lastName: string; hireDate: string }>;

      let totalProcessed = 0;
      let totalEntriesCreated = 0;

      console.log(`🔄 Recalculating overtime for ${users.length} users...`);

      for (const user of users) {
        // Get count before
        const beforeCount = db
          .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
          .get(user.id) as { count: number };

        // Ensure all months from hire date to current month
        await ensureOvertimeBalanceEntries(user.id, currentMonth);

        // Get count after
        const afterCount = db
          .prepare('SELECT COUNT(*) as count FROM overtime_balance WHERE userId = ?')
          .get(user.id) as { count: number };

        const created = afterCount.count - beforeCount.count;
        totalEntriesCreated += created;

        if (created > 0) {
          console.log(
            `✅ ${user.firstName} ${user.lastName}: Created ${created} missing months`
          );
        }

        totalProcessed++;
      }

      console.log(`✅ Recalculation complete!`);
      console.log(`   - Users processed: ${totalProcessed}`);
      console.log(`   - Entries created: ${totalEntriesCreated}`);

      res.json({
        success: true,
        data: {
          usersProcessed: totalProcessed,
          entriesCreated: totalEntriesCreated,
          message: `Successfully recalculated overtime for ${totalProcessed} users. Created ${totalEntriesCreated} missing month entries.`,
        },
      });
    } catch (error) {
      console.error('Error recalculating overtime:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to recalculate overtime',
      });
    }
  }
);

/**
 * NEW PROFESSIONAL ENDPOINTS - Single Source of Truth (Phase 2)
 * These endpoints read directly from overtime_balance table
 * Replaces recalculation-based endpoints from reportService
 */

/**
 * GET /api/overtime/balance/:userId/:month
 * Get monthly overtime balance from database (Single Source of Truth)
 *
 * PROFESSIONAL STANDARD: SAP, Personio, DATEV
 * - Reads from pre-calculated overtime_balance table
 * - Much faster than recalculating on every request
 * - Ensures consistency across all frontend components
 *
 * Example: GET /api/overtime/balance/155/2025-12
 */
router.get(
  '/balance/:userId/:month',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const month = req.params.month; // Format: "YYYY-MM"
      const isAdmin = req.session.user!.role === 'admin';

      // Validation
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid userId',
        });
        return;
      }

      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month format (expected: YYYY-MM)',
        });
        return;
      }

      // Permission check
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this balance',
        });
        return;
      }

      // Read from overtime_balance table (Single Source of Truth)
      const balance = db.prepare(`
        SELECT
          userId,
          month,
          targetHours,
          actualHours,
          overtime,
          carryoverFromPreviousYear
        FROM overtime_balance
        WHERE userId = ? AND month = ?
      `).get(userId, month) as {
        userId: number;
        month: string;
        targetHours: number;
        actualHours: number;
        overtime: number;
        carryoverFromPreviousYear: number;
      } | undefined;

      if (!balance) {
        res.status(404).json({
          success: false,
          error: `No overtime balance found for user ${userId} in month ${month}`,
        });
        return;
      }

      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      console.error('Error getting overtime balance:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balance',
      });
    }
  }
);

/**
 * GET /api/overtime/balance/:userId/year/:year
 * Get yearly overtime balance (aggregated from monthly entries)
 *
 * PROFESSIONAL STANDARD: Aggregates from overtime_balance table
 * - Only aggregates up to current month (no future months!)
 * - Includes carryover from previous year (if any)
 *
 * Example: GET /api/overtime/balance/155/year/2026
 */
router.get(
  '/balance/:userId/year/:year',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const year = parseInt(req.params.year);
      const isAdmin = req.session.user!.role === 'admin';

      // Validation
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid userId',
        });
        return;
      }

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      // Permission check
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this balance',
        });
        return;
      }

      // Get current month (don't aggregate future months!)
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7); // "2026-01"

      // Aggregate monthly entries up to current month
      const monthlyEntries = db.prepare(`
        SELECT month, targetHours, actualHours, overtime
        FROM overtime_balance
        WHERE userId = ? AND month LIKE ? AND month <= ?
        ORDER BY month ASC
      `).all(userId, `${year}-%`, currentMonth) as Array<{
        month: string;
        targetHours: number;
        actualHours: number;
        overtime: number;
      }>;

      // Get carryover from January (if exists)
      const januaryBalance = db.prepare(`
        SELECT carryoverFromPreviousYear
        FROM overtime_balance
        WHERE userId = ? AND month = ?
      `).get(userId, `${year}-01`) as { carryoverFromPreviousYear: number } | undefined;

      const carryover = januaryBalance?.carryoverFromPreviousYear || 0;

      // Calculate totals
      const totalTarget = monthlyEntries.reduce((sum, m) => sum + m.targetHours, 0);
      const totalActual = monthlyEntries.reduce((sum, m) => sum + m.actualHours, 0);
      const totalOvertime = monthlyEntries.reduce((sum, m) => sum + m.overtime, 0);

      res.json({
        success: true,
        data: {
          userId,
          year,
          monthsIncluded: monthlyEntries.length,
          targetHours: totalTarget,
          actualHours: totalActual,
          overtime: totalOvertime + carryover, // Include carryover
          carryoverFromPreviousYear: carryover,
        },
      });
    } catch (error) {
      console.error('Error getting yearly overtime balance:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get yearly balance',
      });
    }
  }
);

export default router;
