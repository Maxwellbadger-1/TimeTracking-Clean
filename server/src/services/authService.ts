import bcrypt from 'bcrypt';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import type { User, UserPublic, SessionUser } from '../types/index.js';

const SALT_ROUNDS = 10;

/**
 * Auth Service - Handles user authentication
 */

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Find user by username
 */
export function findUserByUsername(username: string): User | undefined {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND deletedAt IS NULL');
    return stmt.get(username) as User | undefined;
  } catch (error) {
    logger.error({ err: error, username }, '❌ Error finding user by username');
    throw error;
  }
}

/**
 * Find user by email
 */
export function findUserByEmail(email: string): User | undefined {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND deletedAt IS NULL');
    return stmt.get(email) as User | undefined;
  } catch (error) {
    logger.error({ err: error, email }, '❌ Error finding user by email');
    throw error;
  }
}

/**
 * Find user by ID
 */
export function findUserById(id: number): User | undefined {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND deletedAt IS NULL');
    return stmt.get(id) as User | undefined;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error finding user by ID');
    throw error;
  }
}

/**
 * Convert User to UserPublic (remove password)
 */
export function userToPublic(user: User): UserPublic {
  const { password: _, ...publicUser } = user;
  return publicUser as UserPublic;
}

/**
 * Convert User to SessionUser
 */
export function userToSession(user: User): SessionUser {
  // Parse workSchedule from JSON string (DB stores it as TEXT)
  const workSchedule = user.workSchedule
    ? (typeof user.workSchedule === 'string' ? JSON.parse(user.workSchedule) : user.workSchedule)
    : null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    weeklyHours: user.weeklyHours,
    workSchedule, // Parsed WorkSchedule object or null
    vacationDaysPerYear: user.vacationDaysPerYear,
    hireDate: user.hireDate,
    privacyConsentAt: user.privacyConsentAt, // GDPR: Include privacy consent status in session
  };
}

/**
 * Authenticate user with username and password
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ success: boolean; user?: SessionUser; error?: string }> {
  try {
    // Find user
    const user = findUserByUsername(username);

    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Check if user is active
    if (user.status !== 'active') {
      return { success: false, error: 'Account is inactive' };
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Success
    return {
      success: true,
      user: userToSession(user),
    };
  } catch (error) {
    logger.error({ err: error, username }, '❌ Error authenticating user');
    return { success: false, error: 'Authentication failed' };
  }
}
