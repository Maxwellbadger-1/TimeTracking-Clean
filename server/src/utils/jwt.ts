import jwt from 'jsonwebtoken';
import type { SessionUser } from '../types/index.js';

/**
 * JWT Utility Functions
 *
 * Replaces session-based auth with JWT tokens for Tauri compatibility
 */

// JWT Secret (from env or default for dev)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRY = '24h'; // Token expires after 24 hours

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  weeklyHours: number;
  vacationDaysPerYear: number;
  hireDate: string;
  privacyConsentAt?: string | null;
}

/**
 * Generate JWT token from user data
 */
export function generateToken(user: SessionUser): string {
  const payload: JWTPayload = {
    userId: user.id,
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

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    // Token invalid or expired
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
