import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateUser } from '../services/authService.js';
import { getUserById } from '../services/userService.js';
import { requireAuth } from '../middleware/auth.js';
import type { ApiResponse, SessionUser } from '../types/index.js';
import { generateToken, verifyToken, extractTokenFromHeader } from '../utils/jwt.js';

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

    // SECURITY: Regenerate session ID to prevent session fixation attacks (OWASP A07:2021)
    // This creates a new session ID, making any pre-login session ID useless to attackers
    req.session.regenerate((err) => {
      if (err) {
        logger.error({ err }, '❌ Session regeneration failed');
        res.status(500).json({
          success: false,
          error: 'Login failed',
        });
        return;
      }

      // Generate JWT token
      const token = generateToken(result.user);

      // Set session with new session ID
      req.session.user = result.user;

      res.json({
        success: true,
        data: result.user,
        token, // Return JWT token to client
        message: 'Login successful',
      });
    });
  } catch (error) {
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
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Logout successful',
    });
  });
});

/**
 * GET /api/auth/session
 * Check current session (supports both JWT and session-based auth)
 */
router.get('/session', (req: Request, res: Response<ApiResponse<SessionUser | null>>) => {
  // Try JWT first
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      // Valid JWT token - get fresh user data
      const user = getUserById(payload.userId);
      if (user) {
        const sessionUser: SessionUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          weeklyHours: user.weeklyHours,
          vacationDaysPerYear: user.vacationDaysPerYear,
          hireDate: user.hireDate,
          privacyConsentAt: user.privacyConsentAt,
        };

        res.json({
          success: true,
          data: sessionUser,
          message: 'Logged in',
        });
        return;
      }
    }
  }

  // Fallback to session-based auth (for backwards compatibility)
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
 * IMPORTANT: Returns FRESH data from database, not cached session data!
 */
router.get('/me', requireAuth, (req: Request, res: Response<ApiResponse<{ user: SessionUser }>>) => {
  try {
    const userId = req.session.user!.id;

    // Get fresh user data from database
    const freshUser = getUserById(userId);

    if (!freshUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Update session with fresh data to keep it in sync
    req.session.user = {
      id: freshUser.id,
      username: freshUser.username,
      email: freshUser.email,
      firstName: freshUser.firstName,
      lastName: freshUser.lastName,
      role: freshUser.role,
      weeklyHours: freshUser.weeklyHours,
      vacationDaysPerYear: freshUser.vacationDaysPerYear,
      hireDate: freshUser.hireDate,
      privacyConsentAt: freshUser.privacyConsentAt,
    };

    res.json({
      success: true,
      data: {
        user: req.session.user,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching current user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
    });
  }
});

export default router;
