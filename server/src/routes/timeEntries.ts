import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateTimeEntryCreate,
  validateTimeEntryUpdate,
} from '../middleware/validation.js';
import {
  getAllTimeEntries,
  getTimeEntriesByDate,
  getTimeEntryById,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getOvertimeBalance,
} from '../services/timeEntryService.js';
import { logAudit } from '../services/auditService.js';
import {
  notifyTimeEntryEditedByAdmin,
  notifyTimeEntryDeleted
} from '../services/notificationService.js';
import { getUserById } from '../services/userService.js';
import type { ApiResponse, TimeEntry } from '../types/index.js';

const router = Router();

/**
 * GET /api/time-entries
 * Get all time entries (Admin: all, Employee: own entries)
 */
router.get(
  '/',
  requireAuth,
  (req: Request, res: Response<ApiResponse<TimeEntry[]>>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const userId = isAdmin ? undefined : req.session.user!.id;

      // Optional date range filter
      const { startDate, endDate } = req.query;

      let entries: TimeEntry[];

      if (startDate && endDate && userId) {
        entries = getTimeEntriesByDate(
          userId,
          startDate as string,
          endDate as string
        );
      } else {
        entries = getAllTimeEntries(userId);
      }

      res.json({
        success: true,
        data: entries,
      });
    } catch (error) {
      console.error('❌ Error getting time entries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get time entries',
      });
    }
  }
);

/**
 * GET /api/time-entries/:id
 * Get single time entry by ID
 */
router.get(
  '/:id',
  requireAuth,
  (req: Request, res: Response<ApiResponse<TimeEntry>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid time entry ID',
        });
        return;
      }

      const entry = getTimeEntryById(id);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Time entry not found',
        });
        return;
      }

      // Check permission: Admin can see all, Employee can only see own
      const isAdmin = req.session.user!.role === 'admin';
      const isOwner = entry.userId === req.session.user!.id;

      if (!isAdmin && !isOwner) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this time entry',
        });
        return;
      }

      res.json({
        success: true,
        data: entry,
      });
    } catch (error) {
      console.error('❌ Error getting time entry:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get time entry',
      });
    }
  }
);

/**
 * POST /api/time-entries
 * Create new time entry
 */
router.post(
  '/',
  requireAuth,
  validateTimeEntryCreate,
  (req: Request, res: Response<ApiResponse<TimeEntry>>) => {
    try {
      const data = req.body;

      // Determine userId: Admin can create for any user, Employee only for self
      const isAdmin = req.session.user!.role === 'admin';
      const userId = isAdmin && data.userId ? data.userId : req.session.user!.id;

      // Create time entry
      const entry = createTimeEntry({
        userId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes || 0,
        activity: data.activity,
        project: data.project,
        location: data.location,
        notes: data.notes,
      });

      // Log audit
      logAudit(req.session.user!.id, 'create', 'time_entry', entry.id, {
        date: entry.date,
        hours: entry.hours,
        userId: entry.userId,
      });

      res.status(201).json({
        success: true,
        data: entry,
        message: 'Time entry created successfully',
      });
    } catch (error) {
      console.error('❌ Error creating time entry:', error);

      // Handle specific errors
      if (error instanceof Error) {
        if (
          error.message.includes('overlap') ||
          error.message.includes('Invalid') ||
          error.message.includes('Cannot create') ||
          error.message.includes('Arbeitszeitgesetz') || // ArbZG violations
          error.message.includes('An diesem Tag hast du') // Absence conflicts
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
        error: 'Failed to create time entry',
      });
    }
  }
);

/**
 * PUT /api/time-entries/:id
 * Update time entry
 */
router.put(
  '/:id',
  requireAuth,
  validateTimeEntryUpdate,
  (req: Request, res: Response<ApiResponse<TimeEntry>>) => {
    try {
      console.log('🔄 PUT /api/time-entries/:id CALLED');
      console.log('📝 Request params:', req.params);
      console.log('📝 Request body:', req.body);
      console.log('👤 User:', req.session.user);

      const id = parseInt(req.params.id);

      console.log('🔢 Parsed ID:', id);

      if (isNaN(id)) {
        console.log('❌ Invalid ID - isNaN');
        res.status(400).json({
          success: false,
          error: 'Invalid time entry ID',
        });
        return;
      }

      // Get existing entry
      console.log('🔍 Fetching existing entry with ID:', id);
      const existing = getTimeEntryById(id);

      console.log('📦 Existing entry:', existing);

      if (!existing) {
        console.log('❌ Time entry not found!');
        res.status(404).json({
          success: false,
          error: 'Time entry not found',
        });
        return;
      }

      // Check permission: Admin can edit all, Employee can only edit own
      const isAdmin = req.session.user!.role === 'admin';
      const isOwner = existing.userId === req.session.user!.id;

      console.log('🔐 Permission check:', { isAdmin, isOwner, existingUserId: existing.userId, currentUserId: req.session.user!.id });

      if (!isAdmin && !isOwner) {
        console.log('❌ Permission denied!');
        res.status(403).json({
          success: false,
          error: 'You do not have permission to update this time entry',
        });
        return;
      }

      // Update time entry
      console.log('💾 Calling updateTimeEntry...');
      const entry = updateTimeEntry(id, req.body);

      console.log('✅ Time entry updated successfully:', entry);

      // Log audit
      logAudit(req.session.user!.id, 'update', 'time_entry', id, req.body);

      // Notify employee if admin edited their time entry
      if (isAdmin && !isOwner) {
        const admin = getUserById(req.session.user!.id);
        if (admin) {
          notifyTimeEntryEditedByAdmin(
            existing.userId,
            existing.date,
            `${admin.firstName} ${admin.lastName}`
          );
        }
      }

      res.json({
        success: true,
        data: entry,
        message: 'Time entry updated successfully',
      });
    } catch (error) {
      console.error('❌ Error updating time entry:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message === 'Time entry not found') {
          res.status(404).json({
            success: false,
            error: 'Time entry not found',
          });
          return;
        }

        if (
          error.message.includes('overlap') ||
          error.message.includes('Invalid') ||
          error.message.includes('Cannot') ||
          error.message.includes('Arbeitszeitgesetz') || // ArbZG violations
          error.message.includes('An diesem Tag hast du') // Absence conflicts
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
        error: 'Failed to update time entry',
      });
    }
  }
);

/**
 * DELETE /api/time-entries/:id
 * Delete time entry
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
          error: 'Invalid time entry ID',
        });
        return;
      }

      // Get existing entry
      const existing = getTimeEntryById(id);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Time entry not found',
        });
        return;
      }

      // Check permission: Admin can delete all, Employee can only delete own
      const isAdmin = req.session.user!.role === 'admin';
      const isOwner = existing.userId === req.session.user!.id;

      if (!isAdmin && !isOwner) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this time entry',
        });
        return;
      }

      // Delete time entry
      deleteTimeEntry(id);

      // Log audit
      logAudit(req.session.user!.id, 'delete', 'time_entry', id);

      // Notify employee if admin deleted their time entry
      if (isAdmin && !isOwner) {
        const admin = getUserById(req.session.user!.id);
        if (admin) {
          notifyTimeEntryDeleted(
            existing.userId,
            existing.date,
            `${admin.firstName} ${admin.lastName}`
          );
        }
      }

      res.json({
        success: true,
        message: 'Time entry deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting time entry:', error);

      if (error instanceof Error && error.message === 'Time entry not found') {
        res.status(404).json({
          success: false,
          error: 'Time entry not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete time entry',
      });
    }
  }
);

/**
 * GET /api/time-entries/stats/overtime
 * Get overtime balance for current user (or specified user for admin)
 */
router.get(
  '/stats/overtime',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const { userId, month } = req.query;

      // Determine target user
      const isAdmin = req.session.user!.role === 'admin';
      const targetUserId =
        isAdmin && userId ? parseInt(userId as string) : req.session.user!.id;

      if (isNaN(targetUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Default to current month if not specified
      const targetMonth =
        (month as string) || new Date().toISOString().substring(0, 7);

      const balance = getOvertimeBalance(targetUserId, targetMonth);

      if (!balance) {
        res.json({
          success: true,
          data: {
            targetHours: 0,
            actualHours: 0,
            overtime: 0,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      console.error('❌ Error getting overtime stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overtime stats',
      });
    }
  }
);

export default router;
