import type { Request, Response, NextFunction } from 'express';
import type { SessionUser } from '../types/index.js';
import logger from '../utils/logger.js';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { getUserById } from '../services/userService.js';

/**
 * Auth Middleware (supports both JWT and session-based auth)
 */

/**
 * Require authentication
 * Checks JWT token first, then falls back to session
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Try JWT authentication first
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      // Valid JWT - get fresh user data and attach to session for compatibility
      const user = getUserById(payload.userId);
      if (user) {
        req.session.user = {
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
        next();
        return;
      }
    }
  }

  // Fallback to session-based auth
  if (!req.session?.user) {
    logger.warn({ url: req.originalUrl }, 'Unauthorized access attempt');
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Please login',
    });
    return;
  }

  next();
}

/**
 * Require admin role
 * Must be used AFTER requireAuth
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.session?.user as SessionUser | undefined;

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Please login',
    });
    return;
  }

  if (user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Forbidden - Admin access required',
    });
    return;
  }

  next();
}

/**
 * Optional auth - attaches user if logged in (JWT or session), but doesn't require it
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Try JWT authentication first
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      // Valid JWT - get fresh user data and attach to session for compatibility
      const user = getUserById(payload.userId);
      if (user) {
        req.session.user = {
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
      }
    }
  }

  // User is already attached to req.session if logged in via session
  next();
}
