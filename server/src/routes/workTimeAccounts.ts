import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getWorkTimeAccountWithUser,
  getAllWorkTimeAccounts,
  updateWorkTimeAccountSettings,
  getWorkTimeAccountHistory,
  getBalanceStatus,
} from '../services/workTimeAccountService.js';
import type { ApiResponse, WorkTimeAccountUpdateInput } from '../types/index.js';

const router = Router();

/**
 * GET /api/work-time-accounts
 * Get work time account for current user or specific user (admin)
 * Query params:
 *   - userId: User ID (optional, admin only)
 */
router.get(
  '/',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : null;

      if (requestedUserId) {
        // Admin can get any user's account, employee can only get their own
        if (!isAdmin && requestedUserId !== req.session.user!.id) {
          res.status(403).json({
            success: false,
            error: 'Forbidden',
          });
          return;
        }

        const account = getWorkTimeAccountWithUser(requestedUserId);
        res.json({
          success: true,
          data: account,
        });
      } else if (isAdmin && !requestedUserId) {
        // Admin without userId gets all accounts
        const accounts = getAllWorkTimeAccounts();
        res.json({
          success: true,
          data: accounts,
        });
      } else {
        // Employee gets their own account
        const account = getWorkTimeAccountWithUser(req.session.user!.id);
        res.json({
          success: true,
          data: account,
        });
      }
    } catch (error) {
      console.error('Error getting work time account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get work time account',
      });
    }
  }
);

/**
 * GET /api/work-time-accounts/history
 * Get work time account history (monthly development)
 * Query params:
 *   - userId: User ID (optional, defaults to current user)
 *   - months: Number of months (default: 12)
 */
router.get(
  '/history',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : req.session.user!.id;
      const months = req.query.months ? parseInt(req.query.months as string) : 12;

      // Admin can get any user's history, employee can only get their own
      if (!isAdmin && requestedUserId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      if (isNaN(requestedUserId) || isNaN(months) || months < 1 || months > 24) {
        res.status(400).json({
          success: false,
          error: 'Invalid parameters',
        });
        return;
      }

      const history = getWorkTimeAccountHistory(requestedUserId, months);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error getting work time account history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get work time account history',
      });
    }
  }
);

/**
 * GET /api/work-time-accounts/status
 * Get balance status with percentage and warnings
 * Query params:
 *   - userId: User ID (optional, defaults to current user)
 */
router.get(
  '/status',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : req.session.user!.id;

      // Admin can get any user's status, employee can only get their own
      if (!isAdmin && requestedUserId !== req.session.user!.id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      if (isNaN(requestedUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      const status = getBalanceStatus(requestedUserId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting balance status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get balance status',
      });
    }
  }
);

/**
 * PATCH /api/work-time-accounts/:userId
 * Update work time account settings (max/min limits)
 * Admin only
 */
router.patch(
  '/:userId',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = parseInt(req.params.userId);
      const { maxPlusHours, maxMinusHours } = req.body as WorkTimeAccountUpdateInput;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Validation
      if (maxPlusHours !== undefined && (maxPlusHours < 0 || maxPlusHours > 200)) {
        res.status(400).json({
          success: false,
          error: 'maxPlusHours must be between 0 and 200',
        });
        return;
      }

      if (maxMinusHours !== undefined && (maxMinusHours > 0 || maxMinusHours < -100)) {
        res.status(400).json({
          success: false,
          error: 'maxMinusHours must be between -100 and 0',
        });
        return;
      }

      const account = updateWorkTimeAccountSettings(userId, { maxPlusHours, maxMinusHours });

      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      console.error('Error updating work time account settings:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update work time account settings',
      });
    }
  }
);

export default router;
