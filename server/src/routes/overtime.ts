import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { db } from '../database/connection.js';
import {
  getOvertimeBalance,
  getOvertimeByMonth,
  getAllUsersOvertimeSummary,
  getOvertimeStats,
  getDailyOvertime,
  getWeeklyOvertime,
  getCurrentOvertimeStats,
  getOvertimeSummary,
  getAggregatedOvertimeStats,
  ensureOvertimeBalanceEntries,
} from '../services/overtimeService.js';
import {
  createOvertimeCorrection,
  getOvertimeCorrectionsForUser,
  getAllOvertimeCorrections,
  deleteOvertimeCorrection,
  getCorrectionStatistics,
} from '../services/overtimeCorrectionsService.js';
import type { ApiResponse, OvertimeCorrectionCreateInput } from '../types/index.js';

const router = Router();

/**
 * GET /api/overtime/balance
 * Get overtime balance for current user or specific user (admin)
 * Query params:
 *   - year: Year to get balance for (default: current year)
 *   - userId: User ID (admin only, default: current user)
 */
router.get(
  '/balance',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();
      const userId = isAdmin && req.query.userId
        ? parseInt(req.query.userId as string)
        : req.session.user!.id;

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

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
          error: 'You do not have permission to view this overtime balance',
        });
        return;
      }

      const balance = getOvertimeBalance(userId, year);

      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      console.error('Error getting overtime balance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime balance',
      });
    }
  }
);

/**
 * GET /api/overtime/month/:userId/:month
 * Get overtime for a specific month
 * Params:
 *   - userId: User ID
 *   - month: Month in format "YYYY-MM"
 */
router.get(
  '/month/:userId/:month',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const month = req.params.month;
      const isAdmin = req.session.user!.role === 'admin';

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month format. Use YYYY-MM',
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

      const overtimeData = getOvertimeByMonth(userId, month);

      if (!overtimeData) {
        res.json({
          success: true,
          data: {
            month,
            targetHours: 0,
            actualHours: 0,
            overtime: 0,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: overtimeData,
      });
    } catch (error) {
      console.error('Error getting month overtime:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get month overtime',
      });
    }
  }
);

/**
 * GET /api/overtime/all
 * Get overtime for all users (Admin only)
 * Query params:
 *   - year: Year to get data for (default: current year)
 */
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
  (req: Request, res: Response<ApiResponse>) => {
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

      const allOvertime = getAllUsersOvertimeSummary(year, month);

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
  (req: Request, res: Response<ApiResponse>) => {
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

      const aggregatedStats = getAggregatedOvertimeStats(year, month);

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
 * GET /api/overtime/stats
 * Get overtime statistics for current user (LEGACY - use /current)
 * Returns: total, currentMonth, lastMonth, trend
 */
router.get(
  '/stats',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = req.session.user!.id;
      const stats = getOvertimeStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting overtime stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime stats',
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
 */
router.get(
  '/corrections',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : null;

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
        corrections = getOvertimeCorrectionsForUser(requestedUserId);
      } else if (isAdmin) {
        // Admin without userId query gets all corrections
        corrections = getAllOvertimeCorrections();
      } else {
        // Employee gets their own corrections
        corrections = getOvertimeCorrectionsForUser(req.session.user!.id);
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
 * GET /api/overtime/current
 * Get current overtime stats for all 4 levels (today, thisWeek, thisMonth, totalYear)
 * Returns: { today: 2.5, thisWeek: 5.0, thisMonth: 8.57, totalYear: 48.57 }
 * IMPORTANT: This route MUST be before /:userId to avoid "current" being matched as a userId param
 */
router.get(
  '/current',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const userId = req.query.userId
        ? parseInt(req.query.userId as string)
        : req.session.user!.id;

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

      const stats = getCurrentOvertimeStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting current overtime stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current overtime stats',
      });
    }
  }
);

/**
 * GET /api/overtime/:userId
 * Get detailed overtime data for a specific user
 * Returns: { totalHours, targetHours, overtime, user: { weeklyHours, hireDate } }
 * IMPORTANT: This route MUST be after /current and other specific routes
 */
router.get(
  '/:userId',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
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
      const summary = getOvertimeSummary(userId, currentYear);

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
 * GET /api/overtime/daily/:userId/:date
 * Get daily overtime for a specific date
 * Params:
 *   - userId: User ID
 *   - date: Date in format "YYYY-MM-DD"
 */
router.get(
  '/daily/:userId/:date',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const date = req.params.date;
      const isAdmin = req.session.user!.role === 'admin';

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
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

      const overtimeData = getDailyOvertime(userId, date);

      if (!overtimeData) {
        res.json({
          success: true,
          data: {
            date,
            targetHours: 0,
            actualHours: 0,
            overtime: 0,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: overtimeData,
      });
    } catch (error) {
      console.error('Error getting daily overtime:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get daily overtime',
      });
    }
  }
);

/**
 * GET /api/overtime/weekly/:userId/:week
 * Get weekly overtime for a specific week
 * Params:
 *   - userId: User ID
 *   - week: Week in ISO format "YYYY-WXX" (e.g., "2025-W45")
 */
router.get(
  '/weekly/:userId/:week',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const week = req.params.week;
      const isAdmin = req.session.user!.role === 'admin';

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Validate week format (YYYY-WXX)
      if (!/^\d{4}-W\d{2}$/.test(week)) {
        res.status(400).json({
          success: false,
          error: 'Invalid week format. Use YYYY-WXX',
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

      const overtimeData = getWeeklyOvertime(userId, week);

      if (!overtimeData) {
        res.json({
          success: true,
          data: {
            week,
            targetHours: 0,
            actualHours: 0,
            overtime: 0,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: overtimeData,
      });
    } catch (error) {
      console.error('Error getting weekly overtime:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get weekly overtime',
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
  (req: Request, res: Response<ApiResponse>) => {
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

      const summary = getOvertimeSummary(userId, year);

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
  (_req: Request, res: Response<ApiResponse>) => {
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
        ensureOvertimeBalanceEntries(user.id, currentMonth);

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

export default router;
