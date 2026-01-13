import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserNotifications,
  getUserNotificationsPaginated,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadNotificationCount,
} from '../services/notificationService.js';
import type { ApiResponse } from '../types/index.js';

const router = Router();

/**
 * GET /api/notifications
 * Get paginated notifications for current user
 * Query params:
 *  - unreadOnly: boolean (default: false)
 *  - page: number (default: 1)
 *  - limit: number (default: 20, max: 100)
 */
router.get(
  '/',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const { unreadOnly, page, limit } = req.query;

      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 20;

      // Validate page and limit
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

      const result = getUserNotificationsPaginated(req.session.user!.id, {
        unreadOnly: unreadOnly === 'true',
        page: pageNum,
        limit: limitNum,
      });

      // Transform: read (0|1) → isRead (boolean)
      const transformedRows = result.rows.map((n: any) => ({
        ...n,
        isRead: n.read === 1,
      }));

      res.json({
        success: true,
        data: {
          rows: transformedRows,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error getting notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notifications',
      });
    }
  }
);

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get(
  '/unread-count',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const count = getUnreadNotificationCount(req.session.user!.id);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unread count',
      });
    }
  }
);

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch(
  '/:id/read',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id);
      console.log('🔵 [BACKEND] Mark as READ request for ID:', id);

      if (isNaN(id)) {
        console.log('❌ [BACKEND] Invalid ID');
        res.status(400).json({
          success: false,
          error: 'Invalid notification ID',
        });
        return;
      }

      markNotificationAsRead(id);
      console.log('✅ [BACKEND] Notification marked as read in database');

      // Get updated notification to return
      const notification = getUserNotifications(req.session.user!.id).find((n: any) => n.id === id);
      console.log('📤 [BACKEND] Raw notification from DB:', notification);

      // Transform: read (0|1) → isRead (boolean)
      const transformedNotification = notification ? {
        ...notification,
        isRead: notification.read === 1,
      } : null;
      console.log('📤 [BACKEND] Transformed notification:', transformedNotification);

      res.json({
        success: true,
        data: transformedNotification,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read',
      });
    }
  }
);

/**
 * PATCH /api/notifications/:id/unread
 * Mark notification as unread
 */
router.patch(
  '/:id/unread',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid notification ID',
        });
        return;
      }

      markNotificationAsUnread(id);

      // Get updated notification to return
      const notification = getUserNotifications(req.session.user!.id).find((n: any) => n.id === id);

      // Transform: read (0|1) → isRead (boolean)
      const transformedNotification = notification ? {
        ...notification,
        isRead: notification.read === 1,
      } : null;

      res.json({
        success: true,
        data: transformedNotification,
        message: 'Notification marked as unread',
      });
    } catch (error) {
      console.error('❌ Error marking notification as unread:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as unread',
      });
    }
  }
);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch(
  '/read-all',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      markAllNotificationsAsRead(req.session.user!.id);

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read',
      });
    }
  }
);

/**
 * DELETE /api/notifications/:id
 * Delete notification
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
          error: 'Invalid notification ID',
        });
        return;
      }

      deleteNotification(id);

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification',
      });
    }
  }
);

export default router;
