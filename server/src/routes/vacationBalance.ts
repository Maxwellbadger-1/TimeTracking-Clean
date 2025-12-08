import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getAllVacationBalances,
  upsertVacationBalance,
  updateVacationBalance,
  deleteVacationBalance,
  bulkInitializeVacationBalances,
  getVacationBalanceSummary,
} from '../services/vacationBalanceService.js';

const router = Router();

/**
 * GET /api/vacation-balances
 * Get all vacation balances (with optional filters)
 * Admin only
 */
router.get('/', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const balances = getAllVacationBalances({ userId, year });

    res.json({
      success: true,
      data: balances,
    });
  } catch (error: unknown) {
    console.error('❌ Error fetching vacation balances:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vacation-balances/summary
 * Get vacation balance summary for all users (current year)
 * Admin only
 */
router.get('/summary', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const summary = getVacationBalanceSummary(year);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    console.error('❌ Error fetching vacation balance summary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vacation-balance/:userId
 * Get vacation balance for a specific user (current year by default)
 * Allows users to query with userId directly
 */
router.get('/:userId', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID',
      });
    }

    // Get balance for this user and year
    const balances = getAllVacationBalances({ userId, year });

    if (!balances || balances.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vacation balance not found for this user',
      });
    }

    // Return first balance (should be only one per user per year)
    const balance = balances[0];

    // Calculate available days (entitlement + carryover - taken)
    // Ensure all values are numbers (SQLite sometimes returns strings)
    const entitlement = Number(balance.entitlement) || 0;
    const carryover = Number(balance.carryover) || 0;
    const taken = Number(balance.taken) || 0;
    const available = entitlement + carryover - taken;

    const responseData = {
      ...balance,
      entitlement,
      carryover,
      taken,
      available,
    };

    // DEBUG: Log types being sent
    console.log('🔍 SERVER sending vacation balance types:', {
      entitlement: typeof responseData.entitlement,
      carryover: typeof responseData.carryover,
      taken: typeof responseData.taken,
      available: typeof responseData.available,
      rawValues: {
        entitlement: responseData.entitlement,
        carryover: responseData.carryover,
        taken: responseData.taken,
      }
    });

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error: unknown) {
    console.error('❌ Error fetching vacation balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vacation-balances
 * Create or update vacation balance
 * Admin only
 */
router.post('/', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { userId, year, entitlement, carryover } = req.body;

    // Validation
    if (!userId || !year) {
      return res.status(400).json({
        success: false,
        error: 'userId and year are required',
      });
    }

    if (entitlement === undefined) {
      return res.status(400).json({
        success: false,
        error: 'entitlement is required',
      });
    }

    const balance = upsertVacationBalance({
      userId: Number(userId),
      year: Number(year),
      entitlement: Number(entitlement),
      carryover: Number(carryover) || 0,
    });

    res.status(201).json({
      success: true,
      data: balance,
    });
  } catch (error: unknown) {
    console.error('❌ Error creating vacation balance:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * PUT /api/vacation-balances/:id
 * Update vacation balance
 * Admin only
 */
router.put('/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid balance ID',
      });
    }

    const { entitlement, carryover, taken } = req.body;

    const balance = updateVacationBalance(id, {
      entitlement: entitlement !== undefined ? Number(entitlement) : undefined,
      carryover: carryover !== undefined ? Number(carryover) : undefined,
      taken: taken !== undefined ? Number(taken) : undefined,
    });

    res.json({
      success: true,
      data: balance,
    });
  } catch (error: unknown) {
    console.error('❌ Error updating vacation balance:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /api/vacation-balances/:id
 * Delete vacation balance
 * Admin only
 */
router.delete('/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid balance ID',
      });
    }

    deleteVacationBalance(id);

    res.json({
      success: true,
      data: { id },
    });
  } catch (error: unknown) {
    console.error('❌ Error deleting vacation balance:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vacation-balances/bulk-initialize
 * Bulk initialize vacation balances for all users for a given year
 * Admin only
 */
router.post('/bulk-initialize', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { year } = req.body;

    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'year is required',
      });
    }

    const count = bulkInitializeVacationBalances(Number(year));

    res.json({
      success: true,
      data: {
        year: Number(year),
        count,
        message: `Initialized ${count} vacation balances for year ${year}`,
      },
    });
  } catch (error: unknown) {
    console.error('❌ Error bulk initializing vacation balances:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
