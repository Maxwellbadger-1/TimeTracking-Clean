import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  performYearEndRollover,
  previewYearEndRollover,
  getYearEndRolloverHistory,
} from '../services/yearEndRolloverService.js';
import type { ApiResponse } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/year-end-rollover/preview/:year
 * Preview year-end rollover for a specific year (without executing)
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Shows admin what WOULD happen before executing
 * - Calculates vacation + overtime carryover for each user
 * - Identifies potential issues (warnings)
 *
 * @param year - Target year (e.g., 2026)
 * @returns Preview with user-by-user breakdown
 */
router.get(
  '/preview/:year',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<any>>) => {
    try {
      const year = parseInt(req.params.year, 10);

      if (isNaN(year) || year < 2000 || year > 2100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid year parameter (must be 2000-2100)',
        });
      }

      logger.info({ year, userId: req.session?.user?.id }, 'Year-end rollover preview requested');

      const preview = previewYearEndRollover(year);

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to preview year-end rollover');
      res.status(500).json({
        success: false,
        error: 'Failed to preview year-end rollover',
      });
    }
  }
);

/**
 * POST /api/year-end-rollover/execute/:year
 * Execute year-end rollover for a specific year (MANUAL TRIGGER)
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Transfers vacation days + overtime hours to new year
 * - Creates audit trail with executor info
 * - Transaction-safe (all-or-nothing)
 *
 * CRITICAL: This is a MANUAL trigger for emergency rollover or corrections!
 * Normal rollover happens automatically via cron job (January 1st, 00:05 AM)
 *
 * @param year - Target year (e.g., 2026)
 * @returns Rollover result with processed counts and errors
 */
router.post(
  '/execute/:year',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<any>>) => {
    try {
      const year = parseInt(req.params.year, 10);
      const executedBy = req.session?.user?.id;

      if (isNaN(year) || year < 2000 || year > 2100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid year parameter (must be 2000-2100)',
        });
      }

      if (!executedBy) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      logger.warn(
        { year, executedBy },
        '⚠️  MANUAL YEAR-END ROLLOVER TRIGGERED'
      );

      const result = performYearEndRollover(year, executedBy);

      if (result.success) {
        logger.info(
          {
            year,
            executedBy,
            vacationUsers: result.vacationUsersProcessed,
            overtimeUsers: result.overtimeUsersProcessed,
          },
          '✅ Manual year-end rollover completed successfully'
        );

        res.json({
          success: true,
          data: result,
        });
      } else {
        logger.error(
          { year, executedBy, errors: result.errors },
          '❌ Manual year-end rollover failed'
        );

        res.status(500).json({
          success: false,
          error: 'Year-end rollover failed',
        });
      }
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to execute year-end rollover');
      res.status(500).json({
        success: false,
        error: 'Failed to execute year-end rollover',
      });
    }
  }
);

/**
 * GET /api/year-end-rollover/history
 * Get history of all year-end rollovers (from audit log)
 *
 * PROFESSIONAL STANDARD (Personio, DATEV, SAP):
 * - Shows when rollovers were executed
 * - Shows who executed them (admin or cron)
 * - Shows success/failure status
 *
 * @returns Array of historical rollover executions
 */
router.get(
  '/history',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<any[]>>) => {
    try {
      const history = getYearEndRolloverHistory();

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to fetch year-end rollover history');
      res.status(500).json({
        success: false,
        error: 'Failed to fetch year-end rollover history',
      });
    }
  }
);

export default router;
