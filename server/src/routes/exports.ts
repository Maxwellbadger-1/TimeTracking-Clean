/**
 * Export Routes - DATEV, Historical Data, GoBD-compliant exports
 *
 * Endpoints:
 * - GET /api/exports/datev - DATEV CSV Export (Steuerberater)
 * - GET /api/exports/historical - Historical Data Export (Finanzamt/Betriebsprüfung)
 * - GET /api/exports/historical/csv - Historical Data as CSV
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  generateDATEVExport,
  generateHistoricalExport,
  historicalExportToCSV,
  type HistoricalExportData
} from '../services/exportService.js';
import { logAudit } from '../services/auditService.js';
import type { ApiResponse } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Validate date range for exports
 * Returns error message if validation fails, null otherwise
 */
function validateDateRange(startDate: string, endDate: string): string | null {
  // Validate date format
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
    return 'Invalid date format (must be YYYY-MM-DD)';
  }

  // Validate date order
  if (startDateObj > endDateObj) {
    return 'startDate must be before or equal to endDate';
  }

  // Validate maximum date range (1 year = 365 days)
  const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
  const MAX_DAYS = 365;

  if (daysDiff > MAX_DAYS) {
    return `Date range too large (${daysDiff} days). Maximum allowed: ${MAX_DAYS} days (1 year)`;
  }

  return null;
}

/**
 * GET /api/exports/datev
 * Generate DATEV CSV Export (Admin only)
 *
 * Query params:
 * - startDate: YYYY-MM-DD (required)
 * - endDate: YYYY-MM-DD (required)
 *
 * Validation:
 * - Maximum date range: 1 year (365 days)
 *
 * Returns: CSV file (text/csv)
 */
router.get(
  '/datev',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      // Validate date range
      const validationError = validateDateRange(startDate as string, endDate as string);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError
        });
        return;
      }

      logger.info({ startDate, endDate, userId: req.session.user!.id }, '📊 DATEV export requested');

      const csv = generateDATEVExport(startDate as string, endDate as string);

      // Log audit
      logAudit(req.session.user!.id, 'create', 'export', 0, {
        type: 'datev',
        startDate,
        endDate,
      });

      // Set headers for file download
      const filename = `DATEV_Export_${startDate}_${endDate}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.send(csv);
    } catch (error) {
      logger.error({ err: error }, '❌ Error generating DATEV export');
      res.status(500).json({
        success: false,
        error: 'Failed to generate DATEV export'
      });
    }
  }
);

/**
 * GET /api/exports/historical
 * Generate Historical Data Export (Admin only)
 *
 * Query params:
 * - startDate: YYYY-MM-DD (required)
 * - endDate: YYYY-MM-DD (required)
 * - userId: number (optional, if omitted: all users)
 *
 * Validation:
 * - Maximum date range: 1 year (365 days)
 *
 * Returns: JSON with complete historical data
 */
router.get(
  '/historical',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<HistoricalExportData>>) => {
    try {
      const { startDate, endDate, userId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      // Validate date range
      const validationError = validateDateRange(startDate as string, endDate as string);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError
        });
        return;
      }

      logger.info({ startDate, endDate, userId, requestedBy: req.session.user!.id }, '📊 Historical export requested');

      const data = generateHistoricalExport(
        startDate as string,
        endDate as string,
        userId ? parseInt(userId as string) : undefined
      );

      // Log audit
      logAudit(req.session.user!.id, 'create', 'export', 0, {
        type: 'historical',
        startDate,
        endDate,
        userId: userId || 'all'
      });

      res.json({
        success: true,
        data,
        message: 'Historical export generated successfully'
      });
    } catch (error) {
      logger.error({ err: error }, '❌ Error generating historical export');
      res.status(500).json({
        success: false,
        error: 'Failed to generate historical export'
      });
    }
  }
);

/**
 * GET /api/exports/historical/csv
 * Generate Historical Data Export as CSV (Admin only)
 *
 * Query params:
 * - startDate: YYYY-MM-DD (required)
 * - endDate: YYYY-MM-DD (required)
 * - userId: number (optional)
 *
 * Validation:
 * - Maximum date range: 1 year (365 days)
 *
 * Returns: CSV file (text/csv)
 */
router.get(
  '/historical/csv',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { startDate, endDate, userId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      // Validate date range
      const validationError = validateDateRange(startDate as string, endDate as string);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError
        });
        return;
      }

      logger.info({ startDate, endDate, userId, requestedBy: req.session.user!.id }, '📊 Historical CSV export requested');

      const data = generateHistoricalExport(
        startDate as string,
        endDate as string,
        userId ? parseInt(userId as string) : undefined
      );

      const csv = historicalExportToCSV(data);

      // Log audit
      logAudit(req.session.user!.id, 'create', 'export', 0, {
        type: 'historical_csv',
        startDate,
        endDate,
        userId: userId || 'all'
      });

      // Set headers for file download
      const userPart = userId ? `_User${userId}` : '_All';
      const filename = `Historical_Export${userPart}_${startDate}_${endDate}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.send(csv);
    } catch (error) {
      logger.error({ err: error }, '❌ Error generating historical CSV export');
      res.status(500).json({
        success: false,
        error: 'Failed to generate historical CSV export'
      });
    }
  }
);

export default router;
