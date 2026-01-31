/**
 * Holidays API Routes
 *
 * Endpoints for managing public holidays
 */

import express from 'express';
import { db } from '../database/connection.js';
import {
  loadHolidaysForYear,
  autoUpdateHolidays,
  getEarliestHireYear,
  getMaxHolidayYear
} from '../services/holidayService.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

  /**
   * GET /api/holidays
   * Get all holidays for a specific year
   * Query params:
   *  - year: number (optional, defaults to current year)
   */
  router.get('/', (req, res) => {
    try {
      const { year } = req.query;

      // Default to current year if not specified (prevents unbounded queries)
      const targetYear = year ? String(year) : String(new Date().getFullYear());

      // Validate year format
      const yearNum = parseInt(targetYear, 10);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid year (must be between 2000 and 2100)',
        });
      }

      const query = "SELECT * FROM holidays WHERE strftime('%Y', date) = ? ORDER BY date ASC";
      const holidays = db.prepare(query).all(targetYear);

      res.json({
        success: true,
        data: holidays,
      });
    } catch (error) {
      console.error('❌ Error fetching holidays:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch holidays',
      });
    }
  });

  /**
   * POST /api/holidays (Admin only)
   * Create a new holiday
   */
  router.post('/', (req, res) => {
    try {
      const { date, name, federal = 1 } = req.body;

      // Validation
      if (!date || !name) {
        return res.status(400).json({
          success: false,
          error: 'Date and name are required',
        });
      }

      const stmt = db.prepare(`
        INSERT INTO holidays (date, name, federal)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(date, name, federal);

      const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({
        success: true,
        data: holiday,
      });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({
          success: false,
          error: 'Holiday for this date already exists',
        });
      }

      console.error('❌ Error creating holiday:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create holiday',
      });
    }
  });

  /**
   * DELETE /api/holidays/:id (Admin only)
   * Delete a holiday
   */
  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;

      const stmt = db.prepare('DELETE FROM holidays WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Holiday not found',
        });
      }

      res.json({
        success: true,
        message: 'Holiday deleted',
      });
    } catch (error) {
      console.error('❌ Error deleting holiday:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete holiday',
      });
    }
  });

  /**
   * GET /api/holidays/coverage (Admin only)
   * Get holiday coverage information (which years are loaded)
   */
  router.get('/coverage', requireAdmin, (_req, res) => {
    try {
      const earliestHireYear = getEarliestHireYear();
      const maxYear = getMaxHolidayYear();
      const minYearResult = db
        .prepare('SELECT MIN(SUBSTR(date, 1, 4)) as minYear FROM holidays')
        .get() as { minYear: string | null };
      const minYear = minYearResult?.minYear ? parseInt(minYearResult.minYear, 10) : null;

      const totalHolidays = db.prepare('SELECT COUNT(*) as count FROM holidays').get() as { count: number };

      res.json({
        success: true,
        data: {
          earliestHireYear,
          minYearInDB: minYear,
          maxYearInDB: maxYear,
          totalHolidays: totalHolidays.count,
          coverage: minYear && maxYear ? `${minYear}-${maxYear}` : 'No data',
          yearsLoaded: minYear && maxYear ? maxYear - minYear + 1 : 0,
        },
      });
    } catch (error) {
      console.error('❌ Error getting holiday coverage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get holiday coverage',
      });
    }
  });

  /**
   * POST /api/holidays/sync/:year (Admin only)
   * Manually load holidays for a specific year from API
   */
  router.post('/sync/:year', requireAdmin, async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);

      if (isNaN(year) || year < 2000 || year > 2100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid year (must be between 2000 and 2100)',
        });
      }

      await loadHolidaysForYear(year);

      res.json({
        success: true,
        message: `Holidays for ${year} loaded successfully`,
      });
    } catch (error) {
      console.error('❌ Error loading holidays:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load holidays from API',
      });
    }
  });

  /**
   * POST /api/holidays/sync (Admin only)
   * Trigger auto-update (checks and loads missing years)
   */
  router.post('/sync', requireAdmin, async (_req, res) => {
    try {
      await autoUpdateHolidays();

      res.json({
        success: true,
        message: 'Holiday auto-update completed successfully',
      });
    } catch (error) {
      console.error('❌ Error in auto-update:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to auto-update holidays',
      });
    }
  });

export default router;
