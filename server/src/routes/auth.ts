import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateUser } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import type { ApiResponse, SessionUser } from '../types/index.js';

const router = Router();

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req: Request, res: Response<ApiResponse<SessionUser>>) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Username is required',
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        success: false,
        error: 'Password is required',
      });
      return;
    }

    // Authenticate
    const result = await authenticateUser(username.trim(), password);

    if (!result.success || !result.user) {
      res.status(401).json({
        success: false,
        error: result.error || 'Authentication failed',
      });
      return;
    }

    // Set session
    req.session.user = result.user;

    console.log('✅ User logged in:', result.user.username);

    res.json({
      success: true,
      data: {
        user: result.user,
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, (req: Request, res: Response<ApiResponse>) => {
  const username = req.session.user?.username;

  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Logout error:', err);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
      return;
    }

    console.log('✅ User logged out:', username);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  });
});

/**
 * GET /api/auth/session
 * Check current session
 */
router.get('/session', (req: Request, res: Response<ApiResponse<SessionUser | null>>) => {
  if (!req.session?.user) {
    res.json({
      success: true,
      data: null,
      message: 'Not logged in',
    });
    return;
  }

  res.json({
    success: true,
    data: req.session.user,
    message: 'Logged in',
  });
});

/**
 * GET /api/auth/me
 * Get current user (requires auth)
 */
router.get('/me', requireAuth, (req: Request, res: Response<ApiResponse<{ user: SessionUser }>>) => {
  res.json({
    success: true,
    data: {
      user: req.session.user!,
    },
  });
});

export default router;
