import bcrypt from 'bcrypt';
import db from '../database/connection.js';
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
    console.error('❌ Error finding user by username:', error);
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
    console.error('❌ Error finding user by email:', error);
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
    console.error('❌ Error finding user by ID:', error);
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
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
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
    console.error('❌ Error authenticating user:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
