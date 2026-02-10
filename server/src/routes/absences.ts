import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  validateAbsenceCreate,
  validateAbsenceUpdate,
} from '../middleware/validation.js';
import { absenceCreationLimiter } from '../middleware/rateLimits.js';
import {
  getAbsenceRequestsPaginated,
  getAbsenceRequestById,
  createAbsenceRequest,
  updateAbsenceRequest,
  approveAbsenceRequest,
  rejectAbsenceRequest,
  deleteAbsenceRequest,
  getVacationBalance,
  initializeVacationBalance,
} from '../services/absenceService.js';
import {
  notifyAbsenceApproved,
  notifyAbsenceRejected,
  notifyAbsenceCancelled,
  notifyAbsenceRequested,
} from '../services/notificationService.js';
import { getUserById } from '../services/userService.js';
import { logAudit } from '../services/auditService.js';
import logger from '../utils/logger.js';
import type { ApiResponse, AbsenceRequest } from '../types/index.js';

const router = Router();

/**
 * GET /api/absences/team
 * Get all approved absences for team calendar (All authenticated users)
 * Returns only approved absences for privacy (employees don't see pending requests of colleagues)
 * No pagination - returns all approved absences for current + next year
 */
router.get(
  '/team',
  requireAuth,
  (_req: Request, res: Response<ApiResponse<AbsenceRequest[]>>) => {
    try {
      const currentYear = new Date().getFullYear();

      // Get all approved absences for current and next year (no userId filter!)
      const currentYearAbsences = getAbsenceRequestsPaginated({
        userId: undefined, // ALL users!
        status: 'approved', // Only approved (privacy!)
        year: currentYear,
        page: 1,
        limit: 1000, // High limit to get all
      });

      const nextYearAbsences = getAbsenceRequestsPaginated({
        userId: undefined,
        status: 'approved',
        year: currentYear + 1,
        page: 1,
        limit: 1000,
      });

      // Combine results
      const allAbsences = [...currentYearAbsences.rows, ...nextYearAbsences.rows];

      res.json({
        success: true,
        data: allAbsences,
      });
    } catch (error) {
      console.error('❌ Error fetching team absences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch team absences',
      });
    }
  }
);

/**
 * GET /api/absences
 * Get paginated absence requests (Admin: all, Employee: own)
 * Query params:
 *  - page: number (optional, default: 1)
 *  - limit: number (optional, default: 30, max: 100)
 *  - year: number (optional, default: current year for admin)
 *  - status: string (optional, 'pending' | 'approved' | 'rejected')
 *  - type: string (optional, 'vacation' | 'sick' | 'unpaid' | 'overtime_comp')
 */
router.get(
  '/',
  requireAuth,
  (req: Request, res: Response<ApiResponse<AbsenceRequest[]>>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';

      // Get pagination and filter parameters
      const { page, limit, year, month, status, type, userId } = req.query;

      // Validate parameters
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 30;
      const yearNum = year ? parseInt(year as string, 10) : undefined;
      const monthNum = month ? parseInt(month as string, 10) : undefined;
      const userIdNum = userId ? parseInt(userId as string, 10) : undefined;

      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({
          success: false,
          error: 'Invalid page number',
        });
        return;
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit (must be 1-100)',
        });
        return;
      }

      if (year && isNaN(yearNum!)) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      if (month && (isNaN(monthNum!) || monthNum! < 1 || monthNum! > 12)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month (must be 1-12)',
        });
        return;
      }

      if (userId && isNaN(userIdNum!)) {
        res.status(400).json({
          success: false,
          error: 'Invalid userId',
        });
        return;
      }

      // Use paginated function
      // If admin, allow filtering by userId query param, otherwise use current user's ID
      const result = getAbsenceRequestsPaginated({
        userId: isAdmin ? userIdNum : req.session.user!.id,
        status: status as string,
        type: type as string,
        year: yearNum,
        month: monthNum,
        page: pageNum,
        limit: limitNum,
      });

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      console.error('❌ Error getting absence requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get absence requests',
      });
    }
  }
);

/**
 * GET /api/absences/:id
 * Get single absence request by ID
 */
router.get(
  '/:id',
  requireAuth,
  (req: Request, res: Response<ApiResponse<AbsenceRequest>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid absence request ID',
        });
        return;
      }

      const request = getAbsenceRequestById(id);

      if (!request) {
        res.status(404).json({
          success: false,
          error: 'Absence request not found',
        });
        return;
      }

      // Check permission: Admin can see all, Employee can only see own
      const isAdmin = req.session.user!.role === 'admin';
      const isOwner = request.userId === req.session.user!.id;

      if (!isAdmin && !isOwner) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this absence request',
        });
        return;
      }

      res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get absence request',
      });
    }
  }
);

/**
 * POST /api/absences
 * Create new absence request
 */
router.post(
  '/',
  requireAuth,
  absenceCreationLimiter, // Rate limiting: 30 per hour (DoS protection)
  validateAbsenceCreate,
  (req: Request, res: Response<ApiResponse<AbsenceRequest>>) => {
    try {
      // ============================================================================
      // 🔥 DEBUG POINT 1: Request received with full body
      // ============================================================================
      logger.info('🚀🚀🚀 POST /api/absences - REQUEST RECEIVED 🚀🚀🚀');
      logger.info({
        body: req.body,
        sessionUser: req.session.user ? {
          id: req.session.user.id,
          username: req.session.user.username,
          role: req.session.user.role,
        } : null,
      }, '📥 Full request context');

      const data = req.body;

      // ============================================================================
      // 🔥 DEBUG POINT 2: User ID determination
      // ============================================================================
      const isAdmin = req.session.user!.role === 'admin';
      const userId = isAdmin && data.userId ? data.userId : req.session.user!.id;
      logger.info({
        isAdmin,
        requestedUserId: data.userId,
        finalUserId: userId,
      }, '📌 User ID determination');

      // ============================================================================
      // 🔥 DEBUG POINT 3: Before createAbsenceRequest call
      // ============================================================================
      logger.info({
        userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      }, '🔄 Calling createAbsenceRequest() with params');

      // Create absence request
      const request = createAbsenceRequest({
        userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      });

      // ============================================================================
      // 🔥 DEBUG POINT 4: After createAbsenceRequest success
      // ============================================================================
      logger.info({
        requestId: request.id,
        userId: request.userId,
        type: request.type,
        status: request.status,
        days: request.days,
      }, '✅ createAbsenceRequest() returned successfully');

      // ============================================================================
      // 🔥 DEBUG POINT 5: Notification steps
      // ============================================================================
      // Notify admins about new absence request (only if employee created it)
      if (!isAdmin || (isAdmin && data.userId && data.userId !== req.session.user!.id)) {
        logger.info({ userId, requestId: request.id }, '📧 Preparing notification...');
        // CRITICAL FIX: Get ACTUAL employee's name (not admin's name!)
        const employee = getUserById(userId);
        if (!employee) {
          logger.error({ userId }, '❌ Employee not found for notification');
          throw new Error('Employee not found for notification');
        }
        const employeeName = `${employee.firstName} ${employee.lastName}`;
        logger.info({ employeeName, type: request.type }, '📧 Sending notification to admins...');
        notifyAbsenceRequested(
          employeeName,
          request.type,
          request.startDate,
          request.endDate,
          request.days
        );
        logger.info('✅ Notification sent');
      } else {
        logger.info('⏭️  Skipping notification (admin created for self)');
      }

      // ============================================================================
      // 🔥 DEBUG POINT 6: Audit logging
      // ============================================================================
      logger.info({ requestId: request.id, userId: req.session.user!.id }, '📝 Logging audit entry...');
      logAudit(req.session.user!.id, 'create', 'absence_request', request.id, {
        type: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.days,
      });
      logger.info('✅ Audit logged');

      logger.info('🎉 POST /api/absences - SUCCESS 🎉');
      res.status(201).json({
        success: true,
        data: request,
        message: 'Absence request created successfully',
      });
    } catch (error) {
      // ============================================================================
      // 🔥 DEBUG POINT 7: Enhanced catch block with full error details
      // ============================================================================
      logger.error('❌❌❌ POST /api/absences - ERROR CAUGHT ❌❌❌');
      logger.error({
        err: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        sessionUserId: req.session.user?.id,
      }, '❌ Full error context');

      // Handle specific errors
      if (error instanceof Error) {
        if (
          error.message.includes('Insufficient') ||
          error.message.includes('must span') ||
          error.message.includes('Invalid') ||
          error.message.includes('Überschneidung') ||
          error.message.includes('existieren bereits Zeiterfassungen')
        ) {
          logger.warn({ errorMessage: error.message }, '⚠️ Business logic validation error (400)');
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      logger.error('❌ Unexpected error - returning 500');
      res.status(500).json({
        success: false,
        error: 'Failed to create absence request',
      });
    }
  }
);

/**
 * PUT /api/absences/:id
 * Update absence request (only pending requests)
 */
router.put(
  '/:id',
  requireAuth,
  validateAbsenceUpdate,
  (req: Request, res: Response<ApiResponse<AbsenceRequest>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid absence request ID',
        });
        return;
      }

      // Get existing request
      const existing = getAbsenceRequestById(id);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Absence request not found',
        });
        return;
      }

      // Check permission: Admin can edit all, Employee can only edit own
      const isAdmin = req.session.user!.role === 'admin';
      const isOwner = existing.userId === req.session.user!.id;

      if (!isAdmin && !isOwner) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to update this absence request',
        });
        return;
      }

      // Update absence request
      const request = updateAbsenceRequest(id, req.body);

      // Log audit
      logAudit(req.session.user!.id, 'update', 'absence_request', id, req.body);

      res.json({
        success: true,
        data: request,
        message: 'Absence request updated successfully',
      });
    } catch (error) {
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message === 'Absence request not found') {
          res.status(404).json({
            success: false,
            error: 'Absence request not found',
          });
          return;
        }

        if (
          error.message.includes('Cannot modify') ||
          error.message.includes('Invalid')
        ) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update absence request',
      });
    }
  }
);

/**
 * POST /api/absences/:id/approve
 * Approve absence request (Admin only)
 */
router.post(
  '/:id/approve',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response<ApiResponse<AbsenceRequest>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid absence request ID',
        });
        return;
      }

      const { adminNote } = req.body;

      // Approve request (async - may auto-delete conflicting time entries)
      const request = await approveAbsenceRequest(
        id,
        req.session.user!.id,
        adminNote
      );

      // Send notification
      notifyAbsenceApproved(
        request.userId,
        request.type,
        request.startDate,
        request.endDate
      );

      // Log audit
      logAudit(req.session.user!.id, 'update', 'absence_request', id, {
        action: 'approve',
        adminNote,
      });

      res.json({
        success: true,
        data: request,
        message: 'Absence request approved successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === 'Absence request not found' ||
          error.message.includes('Only pending')
        ) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to approve absence request',
      });
    }
  }
);

/**
 * POST /api/absences/:id/reject
 * Reject absence request (Admin only)
 */
router.post(
  '/:id/reject',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response<ApiResponse<AbsenceRequest>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid absence request ID',
        });
        return;
      }

      const { adminNote } = req.body;

      // Reject request (now async - recalculates overtime if was approved)
      const request = await rejectAbsenceRequest(
        id,
        req.session.user!.id,
        adminNote
      );

      // Send notification
      notifyAbsenceRejected(
        request.userId,
        request.type,
        request.startDate,
        request.endDate,
        adminNote
      );

      // Log audit
      logAudit(req.session.user!.id, 'update', 'absence_request', id, {
        action: 'reject',
        adminNote,
      });

      res.json({
        success: true,
        data: request,
        message: 'Absence request rejected successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === 'Absence request not found' ||
          error.message.includes('Only pending') ||
          error.message.includes('Only pending or approved')
        ) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to reject absence request',
      });
    }
  }
);

/**
 * DELETE /api/absences/:id
 * Delete absence request
 * - Admin: Can delete ANY absence (pending/approved/rejected)
 * - Employee: Can only delete OWN pending absences
 */
router.delete(
  '/:id',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid absence request ID',
        });
        return;
      }

      // Get existing request
      const existing = getAbsenceRequestById(id);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Absence request not found',
        });
        return;
      }

      const isAdmin = req.session.user!.role === 'admin';
      const isOwner = existing.userId === req.session.user!.id;

      // Permission check
      if (!isAdmin && !isOwner) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this absence request',
        });
        return;
      }

      // Employee can only delete pending requests
      if (!isAdmin && existing.status !== 'pending') {
        res.status(403).json({
          success: false,
          error: 'You can only delete pending absence requests',
        });
        return;
      }

      // Admin can delete approved absences - notify user
      if (isAdmin && existing.status === 'approved') {
        const { reason } = req.body;

        // Send notification to user
        notifyAbsenceCancelled(
          existing.userId,
          existing.type,
          existing.startDate,
          existing.endDate,
          reason || 'No reason provided'
        );
      }

      // Delete request
      deleteAbsenceRequest(id);

      // Enhanced audit log for admin deletions
      logAudit(req.session.user!.id, 'delete', 'absence_request', id, {
        status: existing.status,
        type: existing.type,
        startDate: existing.startDate,
        endDate: existing.endDate,
        days: existing.days,
        deletedByAdmin: isAdmin,
        reason: req.body.reason || null,
      });

      res.json({
        success: true,
        message: 'Absence request deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Absence request not found') {
        res.status(404).json({
          success: false,
          error: 'Absence request not found',
        });
        return;
      }

      // Enhanced error logging for debugging
      logger.error({
        err: error,
        absenceId: req.params.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
      }, '❌ Failed to delete absence request');

      res.status(500).json({
        success: false,
        error: `Failed to delete absence request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
);

/**
 * GET /api/absences/vacation-balance/:year
 * Get vacation balance for a specific year
 */
router.get(
  '/vacation-balance/:year',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const year = parseInt(req.params.year);

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Invalid year',
        });
        return;
      }

      // Determine target user
      const isAdmin = req.session.user!.role === 'admin';
      const { userId } = req.query;
      const targetUserId =
        isAdmin && userId ? parseInt(userId as string) : req.session.user!.id;

      if (isNaN(targetUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Get or initialize vacation balance
      let balance = getVacationBalance(targetUserId, year);

      if (!balance) {
        balance = initializeVacationBalance(targetUserId, year);
      }

      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get vacation balance',
      });
    }
  }
);

export default router;
