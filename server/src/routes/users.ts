import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateUserCreate, validateUserUpdate } from '../middleware/validation.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  reactivateUser,
  updateUserStatus,
  usernameExists,
  emailExists,
  exportUserData,
  updatePrivacyConsent,
  changeOwnPassword,
  resetUserPassword,
} from '../services/userService.js';
import { upsertVacationBalance, calculateProRataVacationDays } from '../services/vacationBalanceService.js';
import { logAudit } from '../services/auditService.js';
import {
  notifyVacationDaysAdjusted,
  notifyUserDeactivated,
  notifyUserCreated,
  notifyTargetHoursChanged
} from '../services/notificationService.js';
import type { ApiResponse, UserPublic, UserCreateInput } from '../types/index.js';

const router = Router();

/**
 * GET /api/users/active
 * Get all active users (All authenticated users)
 * For team calendar - employees can see active colleagues
 * Returns minimal user info (name, department) - no sensitive data
 */
router.get(
  '/active',
  requireAuth,
  (_req: Request, res: Response<ApiResponse<UserPublic[]>>) => {
    try {
      const users = getAllUsers();

      // Filter only active users
      const activeUsers = users.filter((u: UserPublic) => u.isActive);

      res.json({
        success: true,
        data: activeUsers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get active users',
      });
    }
  }
);

/**
 * GET /api/users
 * Get all users (Admin only)
 */
router.get(
  '/',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<UserPublic[]>>) => {
    try {
      const users = getAllUsers();

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get users',
      });
    }
  }
);

/**
 * GET /api/users/me/data-export
 * GDPR Data Export (DSGVO Art. 15)
 * Export all user data for GDPR compliance
 * IMPORTANT: Must be BEFORE /:id route to avoid route collision
 */
router.get(
  '/me/data-export',
  requireAuth,
  (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;

      console.log('📊 GDPR Data Export requested by user:', userId);

      // Export all user data
      const exportData = exportUserData(userId);

      // Note: We don't log this in audit table because 'export' is not in the CHECK constraint
      // and it's not critical for GDPR compliance to audit data exports
      console.log('✅ GDPR Data Export completed for user:', userId);

      res.json({
        success: true,
        data: exportData,
        message: 'User data exported successfully',
      });
    } catch (error) {
      console.error('❌ Error exporting user data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export user data',
      });
    }
  }
);

/**
 * POST /api/users/me/privacy-consent
 * Accept Privacy Policy (DSGVO)
 * Update privacy consent timestamp
 * IMPORTANT: Must be BEFORE /:id route to avoid route collision
 */
router.post(
  '/me/privacy-consent',
  requireAuth,
  (req: Request, res: Response<ApiResponse<UserPublic>>) => {
    try {
      const userId = req.session.user!.id;

      console.log('📝 Privacy consent accepted by user:', userId);

      // Update privacy consent
      const user = updatePrivacyConsent(userId);

      // CRITICAL: Update session with new privacyConsentAt timestamp
      // This ensures the privacy modal doesn't show again after acceptance
      if (req.session.user) {
        req.session.user.privacyConsentAt = user.privacyConsentAt;
        console.log('✅ Session updated with privacyConsentAt:', user.privacyConsentAt);
      }

      // Log audit
      logAudit(userId, 'update', 'user', userId, {
        privacyConsentAt: user.privacyConsentAt,
      });

      res.json({
        success: true,
        data: user,
        message: 'Privacy consent updated successfully',
      });
    } catch (error) {
      console.error('❌ Error updating privacy consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update privacy consent',
      });
    }
  }
);

/**
 * PATCH /api/users/me/password
 * Change own password (Self-Service)
 * Requires current password for verification
 * IMPORTANT: Must be BEFORE /:id route to avoid route collision
 */
router.patch(
  '/me/password',
  requireAuth,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const userId = req.session.user!.id;
      const { currentPassword, newPassword } = req.body;

      // Validation
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
        return;
      }

      // Get IP address for audit log
      const ipAddress = req.ip || req.socket.remoteAddress;

      // Change password
      const result = await changeOwnPassword(userId, currentPassword, newPassword, ipAddress);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to change password',
        });
        return;
      }

      // Log audit
      logAudit(userId, 'update', 'user', userId, {
        action: 'password_changed_self_service',
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('❌ Error changing password:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password',
      });
    }
  }
);

/**
 * GET /api/users/:id
 * Get single user by ID (Admin only)
 */
router.get(
  '/:id',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<UserPublic>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      const user = getUserById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get user',
      });
    }
  }
);

/**
 * POST /api/users
 * Create new user (Admin only)
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  validateUserCreate,
  async (req: Request, res: Response<ApiResponse<UserPublic>>) => {
    try {
      const data = req.body as UserCreateInput;

      // Check if username exists
      if (usernameExists(data.username)) {
        res.status(409).json({
          success: false,
          error: 'Username already exists',
        });
        return;
      }

      // Check if email exists (only if email is provided)
      if (data.email && emailExists(data.email)) {
        res.status(409).json({
          success: false,
          error: 'Email already exists',
        });
        return;
      }

      // Create user
      const user = await createUser(data);

      // Initialize vacation balance for current and next year
      const currentYear = new Date().getFullYear();
      try {
        // Use hire date or default to today if not provided
        const hireDate = data.hireDate || formatDate(getCurrentDate(), 'yyyy-MM-dd');

        // Calculate pro-rata entitlement for current year based on hire date
        const currentYearEntitlement = calculateProRataVacationDays(
          hireDate,
          data.vacationDaysPerYear || 30,
          currentYear
        );

        // Current year (pro-rata for mid-year hires)
        upsertVacationBalance({
          userId: user.id,
          year: currentYear,
          entitlement: currentYearEntitlement,
          carryover: 0,
        });

        // Next year (full entitlement for planning)
        upsertVacationBalance({
          userId: user.id,
          year: currentYear + 1,
          entitlement: data.vacationDaysPerYear || 30,
          carryover: 0,
        });

        console.log(`✅ Initialized vacation balances for user ${user.id}:`);
        console.log(`   ${currentYear}: ${currentYearEntitlement} days (pro-rata)`);
        console.log(`   ${currentYear + 1}: ${data.vacationDaysPerYear || 30} days (full year)`);
      } catch (error) {
        console.error('⚠️ Failed to initialize vacation balances:', error);
        // Don't fail user creation if vacation balance initialization fails
      }

      // Log audit
      logAudit(req.session.user!.id, 'create', 'user', user.id, {
        username: user.username,
        email: user.email,
        role: user.role,
      });

      // Send welcome notification to new user
      notifyUserCreated(user.id, user.firstName);

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
      });
    }
  }
);

/**
 * PUT /api/users/:id
 * Update user (Admin only)
 */
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validateUserUpdate,
  async (req: Request, res: Response<ApiResponse<UserPublic>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      const data = req.body as Partial<UserCreateInput>;

      // Get existing user for comparison (before update)
      const oldUser = getUserById(id);
      if (!oldUser) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Check if username exists (for other users)
      if (data.username && usernameExists(data.username, id)) {
        res.status(409).json({
          success: false,
          error: 'Username already exists',
        });
        return;
      }

      // Check if email exists (for other users)
      if (data.email && emailExists(data.email, id)) {
        res.status(409).json({
          success: false,
          error: 'Email already exists',
        });
        return;
      }

      // Update user
      const user = await updateUser(id, data);

      // Log audit
      logAudit(req.session.user!.id, 'update', 'user', id, data);

      // Check if vacation days changed - notify employee
      if (data.vacationDaysPerYear !== undefined && oldUser.vacationDaysPerYear !== data.vacationDaysPerYear) {
        notifyVacationDaysAdjusted(
          id,
          oldUser.vacationDaysPerYear,
          data.vacationDaysPerYear
        );
      }

      // Check if weekly hours changed - notify employee
      if (data.weeklyHours !== undefined && oldUser.weeklyHours !== data.weeklyHours) {
        notifyTargetHoursChanged(
          id,
          oldUser.weeklyHours,
          data.weeklyHours
        );
      }

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update user',
      });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Soft delete user (Admin only)
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Prevent deleting yourself
      if (id === req.session.user!.id) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete your own account',
        });
        return;
      }

      deleteUser(id);

      // Log audit
      logAudit(req.session.user!.id, 'delete', 'user', id);

      // Notify user that their account was deactivated
      notifyUserDeactivated(id);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete user',
      });
    }
  }
);

/**
 * POST /api/users/:id/reactivate
 * Reactivate soft-deleted user (Admin only)
 */
router.post(
  '/:id/reactivate',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<UserPublic>>) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      const user = reactivateUser(id);

      // Log audit
      logAudit(req.session.user!.id, 'update', 'user', id, {
        action: 'reactivated',
        username: user.username,
        email: user.email,
      });

      res.json({
        success: true,
        data: user,
        message: 'User reactivated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'User not found or not deleted',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to reactivate user',
      });
    }
  }
);

/**
 * PATCH /api/users/:id/status
 * Update user status (Admin only)
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<UserPublic>>) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      if (!status || !['active', 'inactive'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Status must be "active" or "inactive"',
        });
        return;
      }

      const user = updateUserStatus(id, status);

      // Log audit
      logAudit(req.session.user!.id, 'update', 'user', id, { status });

      // Notify user if they were deactivated
      if (status === 'inactive') {
        notifyUserDeactivated(id);
      }

      res.json({
        success: true,
        data: user,
        message: 'User status updated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update user status',
      });
    }
  }
);

/**
 * PATCH /api/users/:id/password
 * Reset user password (Admin only)
 * Can force user to change password on next login
 */
router.patch(
  '/:id/password',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id);
      const { newPassword, forceChange } = req.body;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      // Validation
      if (!newPassword) {
        res.status(400).json({
          success: false,
          error: 'New password is required',
        });
        return;
      }

      const adminId = req.session.user!.id;

      // Get IP address for audit log
      const ipAddress = req.ip || req.socket.remoteAddress;

      // Reset password
      const result = await resetUserPassword(
        adminId,
        id,
        newPassword,
        forceChange !== false, // Default to true if not specified
        ipAddress
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to reset password',
        });
        return;
      }

      // Log audit
      logAudit(adminId, 'update', 'user', id, {
        action: 'password_reset_by_admin',
        forceChange: forceChange !== false,
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('❌ Error resetting password:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password',
      });
    }
  }
);

export default router;
