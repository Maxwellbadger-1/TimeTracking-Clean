import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  validateAbsenceCreate,
  validateAbsenceUpdate,
} from '../middleware/validation.js';
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
import { logAudit } from '../services/auditService.js';
import type { ApiResponse, AbsenceRequest } from '../types/index.js';

const router = Router();

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
      const { page, limit, year, status, type } = req.query;

      // Validate parameters
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 30;
      const yearNum = year ? parseInt(year as string, 10) : undefined;

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

      // Use paginated function
      const result = getAbsenceRequestsPaginated({
        userId: isAdmin ? undefined : req.session.user!.id,
        status: status as string,
        type: type as string,
        year: yearNum,
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
  validateAbsenceCreate,
  (req: Request, res: Response<ApiResponse<AbsenceRequest>>) => {
    try {
      const data = req.body;

      // Determine userId: Admin can create for any user, Employee only for self
      const isAdmin = req.session.user!.role === 'admin';
      const userId = isAdmin && data.userId ? data.userId : req.session.user!.id;

      // Create absence request
      const request = createAbsenceRequest({
        userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      });

      // Notify admins about new absence request (only if employee created it)
      if (!isAdmin || (isAdmin && data.userId && data.userId !== req.session.user!.id)) {
        const employeeName = `${req.session.user!.firstName} ${req.session.user!.lastName}`;
        notifyAbsenceRequested(
          employeeName,
          request.type,
          request.startDate,
          request.endDate,
          request.days
        );
      }

      // Log audit
      logAudit(req.session.user!.id, 'create', 'absence_request', request.id, {
        type: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.days,
      });

      res.status(201).json({
        success: true,
        data: request,
        message: 'Absence request created successfully',
      });
    } catch (error) {
      // Handle specific errors
      if (error instanceof Error) {
        if (
          error.message.includes('Insufficient') ||
          error.message.includes('must span') ||
          error.message.includes('Invalid') ||
          error.message.includes('Überschneidung') ||
          error.message.includes('existieren bereits Zeiterfassungen')
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

      const { adminNote } = req.body;

      // Approve request
      const request = approveAbsenceRequest(
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

      const { adminNote } = req.body;

      // Reject request
      const request = rejectAbsenceRequest(
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

      res.status(500).json({
        success: false,
        error: 'Failed to delete absence request',
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
