import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getOvertimeBalance,
  getOvertimeByMonth,
  getAllUsersOvertime,
  getOvertimeStats,
} from '../services/overtimeService.js';
import type { ApiResponse } from '../types/index.js';

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
router.get(
  '/all',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      const allOvertime = getAllUsersOvertime(year);

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
 * GET /api/overtime/stats
 * Get overtime statistics for current user
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

export default router;
