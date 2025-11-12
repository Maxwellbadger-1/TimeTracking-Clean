/**
 * Performance Monitoring Routes (Admin only)
 *
 * Endpoints:
 * - GET /api/performance/stats - Get performance statistics
 * - POST /api/performance/clear - Clear performance history
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getPerformanceStats, clearPerformanceHistory } from '../middleware/performanceMonitor.js';
import type { ApiResponse } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/performance/stats
 * Get performance statistics (Admin only)
 *
 * Returns:
 * - slowRequests: List of slow requests (last 100)
 * - averageDuration: Average duration of slow requests
 * - slowestRequest: Slowest request recorded
 * - totalSlowRequests: Total number of slow requests in history
 */
router.get(
  '/stats',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<ReturnType<typeof getPerformanceStats>>>) => {
    try {
      const stats = getPerformanceStats();

      logger.info({ statsCount: stats.totalSlowRequests }, '📊 Performance stats requested');

      res.json({
        success: true,
        data: stats,
        message: 'Performance statistics retrieved successfully',
      });
    } catch (error) {
      logger.error({ err: error }, '❌ Error retrieving performance stats');
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance statistics',
      });
    }
  }
);

/**
 * POST /api/performance/clear
 * Clear performance history (Admin only)
 *
 * Useful for:
 * - Resetting metrics after optimization
 * - Testing
 * - Fresh start
 */
router.post(
  '/clear',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<void>>) => {
    try {
      clearPerformanceHistory();

      logger.info({ userId: req.session.user!.id }, '🗑️ Performance history cleared by admin');

      res.json({
        success: true,
        message: 'Performance history cleared successfully',
      });
    } catch (error) {
      logger.error({ err: error }, '❌ Error clearing performance history');
      res.status(500).json({
        success: false,
        error: 'Failed to clear performance history',
      });
    }
  }
);

export default router;
