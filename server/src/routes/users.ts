import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateUserCreate, validateUserUpdate } from '../middleware/validation.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  usernameExists,
  emailExists,
} from '../services/userService.js';
import { logAudit } from '../services/auditService.js';
import type { ApiResponse, UserPublic, UserCreateInput } from '../types/index.js';

const router = Router();

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

      // Check if email exists
      if (emailExists(data.email)) {
        res.status(409).json({
          success: false,
          error: 'Email already exists',
        });
        return;
      }

      // Create user
      const user = await createUser(data);

      // Log audit
      logAudit(req.session.user!.id, 'create', 'user', user.id, {
        username: user.username,
        email: user.email,
        role: user.role,
      });

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

export default router;
