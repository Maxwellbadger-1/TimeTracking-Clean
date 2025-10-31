import db from '../database/connection.js';
import { hashPassword } from './authService.js';
import type { User, UserPublic, UserCreateInput } from '../types/index.js';

/**
 * User Service - Business Logic for User Management
 */

/**
 * Get all users (excluding deleted)
 */
export function getAllUsers(): UserPublic[] {
  try {
    const stmt = db.prepare(`
      SELECT id, username, email, firstName, lastName, role,
             department, weeklyHours, vacationDaysPerYear, status, createdAt,
             CASE WHEN status = 'active' THEN 1 ELSE 0 END as isActive
      FROM users
      WHERE deletedAt IS NULL
      ORDER BY createdAt DESC
    `);

    return stmt.all() as UserPublic[];
  } catch (error) {
    console.error('❌ Error getting all users:', error);
    throw error;
  }
}

/**
 * Get user by ID (public data only)
 */
export function getUserById(id: number): UserPublic | undefined {
  try {
    const stmt = db.prepare(`
      SELECT id, username, email, firstName, lastName, role,
             department, weeklyHours, vacationDaysPerYear, status, createdAt,
             CASE WHEN status = 'active' THEN 1 ELSE 0 END as isActive
      FROM users
      WHERE id = ? AND deletedAt IS NULL
    `);

    return stmt.get(id) as UserPublic | undefined;
  } catch (error) {
    console.error('❌ Error getting user by ID:', error);
    throw error;
  }
}

/**
 * Create new user
 */
export async function createUser(data: UserCreateInput): Promise<UserPublic> {
  try {
    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (
        username, email, password, firstName, lastName, role,
        department, weeklyHours, vacationDaysPerYear, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.username,
      data.email,
      hashedPassword,
      data.firstName,
      data.lastName,
      data.role,
      data.department || null,
      data.weeklyHours || 40,
      data.vacationDaysPerYear || 30,
      'active'
    );

    const userId = result.lastInsertRowid as number;

    console.log('✅ User created:', data.username, '(ID:', userId, ')');

    // Return created user (without password)
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }

    return user;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

/**
 * Update user
 */
export async function updateUser(
  id: number,
  data: Partial<UserCreateInput>
): Promise<UserPublic> {
  try {
    // Check if user exists
    const existingUser = getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.firstName !== undefined) {
      updates.push('firstName = ?');
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push('lastName = ?');
      values.push(data.lastName);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.department !== undefined) {
      updates.push('department = ?');
      values.push(data.department);
    }
    if (data.weeklyHours !== undefined) {
      updates.push('weeklyHours = ?');
      values.push(data.weeklyHours);
    }
    if (data.vacationDaysPerYear !== undefined) {
      updates.push('vacationDaysPerYear = ?');
      values.push(data.vacationDaysPerYear);
    }
    if (data.password !== undefined) {
      updates.push('password = ?');
      values.push(await hashPassword(data.password));
    }

    if (updates.length === 0) {
      return existingUser; // Nothing to update
    }

    values.push(id); // For WHERE clause

    const stmt = db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ? AND deletedAt IS NULL
    `);

    stmt.run(...values);

    console.log('✅ User updated:', id);

    // Return updated user
    const updatedUser = getUserById(id);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    return updatedUser;
  } catch (error) {
    console.error('❌ Error updating user:', error);
    throw error;
  }
}

/**
 * Soft delete user
 */
export function deleteUser(id: number): void {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET deletedAt = datetime('now'), status = 'inactive'
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('User not found or already deleted');
    }

    console.log('✅ User soft-deleted:', id);
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    throw error;
  }
}

/**
 * Update user status (active/inactive)
 */
export function updateUserStatus(
  id: number,
  status: 'active' | 'inactive'
): UserPublic {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET status = ?
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(status, id);

    if (result.changes === 0) {
      throw new Error('User not found');
    }

    console.log('✅ User status updated:', id, '→', status);

    const user = getUserById(id);
    if (!user) {
      throw new Error('Failed to retrieve updated user');
    }

    return user;
  } catch (error) {
    console.error('❌ Error updating user status:', error);
    throw error;
  }
}

/**
 * Check if username exists
 */
export function usernameExists(username: string, excludeId?: number): boolean {
  try {
    let stmt;
    if (excludeId) {
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE username = ? AND id != ? AND deletedAt IS NULL
      `);
      const result = stmt.get(username, excludeId) as { count: number };
      return result.count > 0;
    } else {
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE username = ? AND deletedAt IS NULL
      `);
      const result = stmt.get(username) as { count: number };
      return result.count > 0;
    }
  } catch (error) {
    console.error('❌ Error checking username:', error);
    throw error;
  }
}

/**
 * Check if email exists
 */
export function emailExists(email: string, excludeId?: number): boolean {
  try {
    let stmt;
    if (excludeId) {
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email = ? AND id != ? AND deletedAt IS NULL
      `);
      const result = stmt.get(email, excludeId) as { count: number };
      return result.count > 0;
    } else {
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email = ? AND deletedAt IS NULL
      `);
      const result = stmt.get(email) as { count: number };
      return result.count > 0;
    }
  } catch (error) {
    console.error('❌ Error checking email:', error);
    throw error;
  }
}
