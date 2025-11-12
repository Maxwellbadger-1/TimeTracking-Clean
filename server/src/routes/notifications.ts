import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserNotifications,
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
 * Get all notifications for current user
 */
router.get(
  '/',
  requireAuth,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const { unreadOnly } = req.query;
      const notifications = getUserNotifications(
        req.session.user!.id,
        unreadOnly === 'true'
      );

      res.json({
        success: true,
        data: notifications,
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

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid notification ID',
        });
        return;
      }

      markNotificationAsRead(id);

      res.json({
        success: true,
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

      res.json({
        success: true,
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
