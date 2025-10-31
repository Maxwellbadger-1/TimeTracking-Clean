import type { Request, Response, NextFunction } from 'express';
import type { SessionUser } from '../types/index.js';

/**
 * Auth Middleware
 */

/**
 * Require authentication
 * Checks if user is logged in via session
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session?.user) {
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
 * Optional auth - attaches user if logged in, but doesn't require it
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // User is already attached to req.session if logged in
  next();
}
