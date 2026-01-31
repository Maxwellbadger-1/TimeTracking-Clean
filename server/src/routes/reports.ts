import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getUserOvertimeReport,
  getOvertimeHistory,
  getOvertimeYearBreakdown,
} from '../services/reportService.js';
import type { ApiResponse } from '../types/index.js';

const router = Router();

/**
 * GET /api/reports/overtime/user/:userId
 * Get comprehensive overtime report for a user
 *
 * ⚠️  DEPRECATED: This endpoint is being phased out.
 * 🔄 MIGRATE TO: /api/overtime/balance/:userId/:month OR /api/overtime/balance/:userId/year/:year
 *
 * New endpoints provide:
 * - Direct database reads (no recalculation)
 * - 10-100x faster performance
 * - Guaranteed consistency (Single Source of Truth)
 *
 * This endpoint still works but uses a hybrid approach (DB read with fallback).
 * Frontend has been migrated to new endpoints as of 2026-01-24.
 *
 * Query params:
 *   - year: Year (required)
 *   - month: Month 1-12 (optional, for single month report)
 */
router.get(
  '/overtime/user/:userId',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const year = parseInt(req.query.year as string);
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const isAdmin = req.session.user!.role === 'admin';

      // Validation
      if (isNaN(userId) || isNaN(year)) {
        res.status(400).json({
          success: false,
          error: 'Invalid userId or year',
        });
        return;
      }

      if (month && (isNaN(month) || month < 1 || month > 12)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month (must be 1-12)',
        });
        return;
      }

      // Permission check: Admin can see all, Employee only own
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this report',
        });
        return;
      }

      const report = await getUserOvertimeReport(userId, year, month);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error generating overtime report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate report',
      });
    }
  }
);

/**
 * GET /api/reports/overtime/history/:userId
 * Get overtime history with transaction breakdown
 *
 * PROFESSIONAL STANDARD: Clear field meanings (earned, compensation, correction, balance)
 * Replaces: /api/work-time-accounts/history
 *
 * Query params:
 *   - months: Number of months (default: 12)
 */
router.get(
  '/overtime/history/:userId',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const months = req.query.months ? parseInt(req.query.months as string) : 12;
      const isAdmin = req.session.user!.role === 'admin';

      // Validation
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid userId',
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
          error: 'You do not have permission to view this history',
        });
        return;
      }

      const history = getOvertimeHistory(userId, months);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error getting overtime history:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get history',
      });
    }
  }
);

/**
 * GET /api/reports/overtime/year-breakdown/:userId
 * Get overtime balance breakdown by year (carryover + current year)
 *
 * NEW: For Balance Summary Widget
 */
router.get(
  '/overtime/year-breakdown/:userId',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const isAdmin = req.session.user!.role === 'admin';

      // Validation
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid userId',
        });
        return;
      }

      // Permission check
      if (!isAdmin && userId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this breakdown',
        });
        return;
      }

      const breakdown = getOvertimeYearBreakdown(userId);

      res.json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      console.error('Error getting overtime year breakdown:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get year breakdown',
      });
    }
  }
);

export default router;
