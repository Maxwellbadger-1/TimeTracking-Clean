import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  changePassword,
  changeEmail,
  updateNotificationPreferences,
  getNotificationPreferences,
} from '../services/settingsService.js';

const router = express.Router();

/**
 * POST /api/settings/password
 * Change user password
 */
router.post('/password', requireAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.user!.id;

    if (!oldPassword?.trim() || !newPassword?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Old password and new password are required',
      });
    }

    changePassword(userId, oldPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('❌ Password change error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to change password',
    });
  }
});

/**
 * POST /api/settings/email
 * Change user email
 */
router.post('/email', requireAuth, (req, res) => {
  try {
    const { newEmail, password } = req.body;
    const userId = req.session.user!.id;

    if (!newEmail?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'New email and password are required',
      });
    }

    changeEmail(userId, newEmail, password);

    res.json({
      success: true,
      message: 'Email changed successfully',
    });
  } catch (error: any) {
    console.error('❌ Email change error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to change email',
    });
  }
});

/**
 * GET /api/settings/notifications
 * Get notification preferences
 */
router.get('/notifications', requireAuth, (req, res) => {
  try {
    const userId = req.session.user!.id;
    const preferences = getNotificationPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('❌ Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification preferences',
    });
  }
});

/**
 * PUT /api/settings/notifications
 * Update notification preferences
 */
router.put('/notifications', requireAuth, (req, res) => {
  try {
    const userId = req.session.user!.id;
    const preferences = req.body;

    updateNotificationPreferences(userId, preferences);

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Update notification preferences error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update notification preferences',
    });
  }
});

export default router;
