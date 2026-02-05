import db from '../database/connection.js';
import { hashPassword, comparePassword, findUserById as findUserByIdWithPassword } from './authService.js';
import type { User, UserPublic, UserCreateInput, GDPRDataExport, TimeEntry, AbsenceRequest } from '../types/index.js';
import { getVacationBalance } from './absenceService.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
// UNUSED: import { calculateMonthlyTargetHours } from '../utils/workingDays.js';
import logger from '../utils/logger.js';

/**
 * User Service - Business Logic for User Management
 */

/**
 * Get all users (including deleted for archive view)
 */
export function getAllUsers(): UserPublic[] {
  try {
    const stmt = db.prepare(`
      SELECT id, username, email, firstName, lastName, role,
             department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status, privacyConsentAt, createdAt, deletedAt,
             CASE WHEN status = 'active' AND deletedAt IS NULL THEN 1 ELSE 0 END as isActive
      FROM users
      ORDER BY createdAt DESC
    `);

    const users = stmt.all() as any[];
    // Parse workSchedule JSON
    return users.map(user => ({
      ...user,
      workSchedule: user.workSchedule ? JSON.parse(user.workSchedule) : null
    })) as UserPublic[];
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting all users');
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
             department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status, privacyConsentAt, createdAt,
             CASE WHEN status = 'active' THEN 1 ELSE 0 END as isActive
      FROM users
      WHERE id = ? AND deletedAt IS NULL
    `);

    const user = stmt.get(id) as any;
    if (!user) return undefined;

    // Parse workSchedule JSON
    return {
      ...user,
      workSchedule: user.workSchedule ? JSON.parse(user.workSchedule) : null
    } as UserPublic;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error getting user by ID');
    throw error;
  }
}

/**
 * Create new user
 */
export async function createUser(data: UserCreateInput): Promise<UserPublic> {
  try {
    // VALIDATION: Weekly hours must be reasonable
    // Min: 0 hours/week (Aushilfen - all hours = overtime), Max: 80 hours/week (extreme case)
    const weeklyHours = data.weeklyHours !== undefined ? data.weeklyHours : 40;
    if (weeklyHours < 0 || weeklyHours > 80) {
      throw new Error(`Weekly hours must be between 0 and 80, got: ${weeklyHours}`);
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (
        username, email, password, firstName, lastName, role,
        department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.username,
      data.email && data.email.trim() !== '' ? data.email : null, // Convert empty strings to NULL
      hashedPassword,
      data.firstName,
      data.lastName,
      data.role,
      data.department || null,
      data.position || null,
      weeklyHours, // Use validated weeklyHours
      data.workSchedule ? JSON.stringify(data.workSchedule) : null,
      data.vacationDaysPerYear !== undefined ? data.vacationDaysPerYear : 30, // Allow 0 vacation days
      data.hireDate || null,
      data.endDate || null,
      'active'
    );

    const userId = result.lastInsertRowid as number;

    logger.info({ username: data.username, userId }, '✅ User created');

    // Return created user (without password)
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }

    return user;
  } catch (error) {
    logger.error({ err: error, username: data.username }, '❌ Error creating user');
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
    logger.debug('🔥🔥🔥 UPDATE USER - BACKEND DEBUG 🔥🔥🔥');
    logger.debug({ userId: id, data }, 'Update user parameters');

    // Check if user exists
    const existingUser = getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    logger.debug({ hireDate: existingUser.hireDate, endDate: existingUser.endDate }, 'Existing user dates');

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email || null); // Convert empty/falsy values to NULL
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
      values.push(data.department || null); // Convert empty/falsy values to NULL
    }
    if (data.position !== undefined) {
      updates.push('position = ?');
      values.push(data.position || null); // Convert empty/falsy values to NULL
    }
    if (data.weeklyHours !== undefined) {
      // VALIDATION: Weekly hours must be reasonable
      if (data.weeklyHours < 0 || data.weeklyHours > 80) {
        throw new Error(`Weekly hours must be between 0 and 80, got: ${data.weeklyHours}`);
      }
      updates.push('weeklyHours = ?');
      values.push(data.weeklyHours);
    }
    if (data.workSchedule !== undefined) {
      updates.push('workSchedule = ?');
      values.push(data.workSchedule ? JSON.stringify(data.workSchedule) : null);
    }
    if (data.vacationDaysPerYear !== undefined) {
      updates.push('vacationDaysPerYear = ?');
      values.push(data.vacationDaysPerYear);
    }
    if (data.hireDate !== undefined) {
      updates.push('hireDate = ?');
      values.push(data.hireDate);
    }
    if (data.endDate !== undefined) {
      updates.push('endDate = ?');
      values.push(data.endDate || null); // Convert empty/falsy values to NULL
    }
    if (data.isActive !== undefined) {
      // isActive is stored as status field ('active' or 'inactive')
      updates.push('status = ?');
      values.push(data.isActive ? 'active' : 'inactive');
    }
    if (data.password !== undefined) {
      updates.push('password = ?');
      values.push(await hashPassword(data.password));
    }

    if (updates.length === 0) {
      return existingUser; // Nothing to update
    }

    values.push(id); // For WHERE clause

    const sqlQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ? AND deletedAt IS NULL
    `;

    logger.debug({ sqlQuery, values, updates }, '📝 SQL details');

    const stmt = db.prepare(sqlQuery);
    const result = stmt.run(...values);

    logger.info({ userId: id, changes: result.changes }, '✅ User updated');

    // Return updated user
    const updatedUser = getUserById(id);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    logger.debug({ hireDate: updatedUser.hireDate, endDate: updatedUser.endDate }, '📤 Updated user dates');

    // CRITICAL: Handle side effects of changes

    // If hireDate changed, DELETE and recalculate all overtime entries (SAP/Personio Best Practice)
    // This ensures correct calculation from new employment start date
    if (data.hireDate !== undefined && data.hireDate !== existingUser.hireDate) {
      logger.info({ oldHireDate: existingUser.hireDate, newHireDate: data.hireDate }, '🔄 hireDate changed, clearing and recalculating overtime');
      try {
        // Delete overtime_balance entries - they will be recreated on next API call
        // Note: overtime_transactions are kept (immutable audit trail)
        db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(id);
        logger.info('✅ Overtime balance cleared - will recalculate on next access');
      } catch (error) {
        logger.error({ err: error }, '❌ Failed to clear overtime after hireDate change');
        // Don't fail the update, but log the error
      }
    }

    // If weeklyHours changed, recalculate all overtime_balance entries
    if (data.weeklyHours !== undefined && data.weeklyHours !== existingUser.weeklyHours) {
      logger.info({ oldHours: existingUser.weeklyHours, newHours: data.weeklyHours }, '🔄 weeklyHours changed, recalculating overtime');
      try {
        recalculateOvertimeForUser(id);
        logger.info('✅ Overtime recalculated');
      } catch (error) {
        logger.error({ err: error }, '❌ Failed to recalculate overtime');
        // Don't fail the update, but log the error
      }
    }

    // If workSchedule changed, recalculate all overtime_balance entries
    if (data.workSchedule !== undefined) {
      const oldSchedule = existingUser.workSchedule ? JSON.stringify(existingUser.workSchedule) : null;
      const newSchedule = data.workSchedule ? JSON.stringify(data.workSchedule) : null;

      if (oldSchedule !== newSchedule) {
        logger.info({ oldSchedule, newSchedule }, '🔄 workSchedule changed, recalculating overtime');
        try {
          recalculateOvertimeForUser(id);
          logger.info('✅ Overtime recalculated');
        } catch (error) {
          logger.error({ err: error }, '❌ Failed to recalculate overtime');
          // Don't fail the update, but log the error
        }
      }
    }

    // If vacationDaysPerYear changed, update vacation_balance entitlement for all years
    if (data.vacationDaysPerYear !== undefined && data.vacationDaysPerYear !== existingUser.vacationDaysPerYear) {
      logger.info({ oldDays: existingUser.vacationDaysPerYear, newDays: data.vacationDaysPerYear }, '🔄 vacationDaysPerYear changed, updating entitlement');
      try {
        updateVacationEntitlementForUser(id, data.vacationDaysPerYear);
        logger.info('✅ Vacation entitlement updated');
      } catch (error) {
        logger.error({ err: error }, '❌ Failed to update vacation entitlement');
        // Don't fail the update, but log the error
      }
    }

    logger.debug('🔥🔥🔥 END UPDATE USER DEBUG 🔥🔥🔥');

    return updatedUser;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error updating user');
    throw error;
  }
}

/**
 * Recalculate all overtime_balance entries for a user
 * Called when weeklyHours, workSchedule, or hireDate changes
 * Best Practice (SAP/Personio): Delete and rebuild from scratch for hireDate changes
 *
 * ✅ NOW: Uses updateMonthlyOvertime() for correct workSchedule support!
 */
async function recalculateOvertimeForUser(userId: number): Promise<void> {
  logger.debug({ userId }, '🔄 Recalculating overtime for user');

  // Get user
  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Get all existing overtime_balance entries
  const entries = db.prepare(`
    SELECT month
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month
  `).all(userId) as Array<{ month: string }>;

  logger.debug({ count: entries.length }, `📊 Found overtime_balance entries to recalculate`);

  // Use updateMonthlyOvertime() from overtimeService (Single Source of Truth!)
  // This handles weeklyHours AND workSchedule correctly
  const { updateMonthlyOvertime } = await import('./overtimeService.js');

  // Recalculate each month
  for (const entry of entries) {
    try {
      updateMonthlyOvertime(userId, entry.month);
      logger.debug({ month: entry.month }, `  ✅ Month recalculated`);
    } catch (error) {
      logger.error({ err: error, userId, month: entry.month }, '❌ Failed to recalculate month');
      // Continue with other months
    }
  }

  logger.info('✅ All overtime_balance entries recalculated');
}

/**
 * Update vacation_balance entitlement for all years for a user
 * Called when vacationDaysPerYear changes
 */
function updateVacationEntitlementForUser(userId: number, newEntitlement: number): void {
  logger.debug({ userId, newEntitlement }, '🔄 Updating vacation entitlement for user');

  // Get all existing vacation_balance entries
  const entries = db.prepare(`
    SELECT year, entitlement, carryover, taken
    FROM vacation_balance
    WHERE userId = ?
  `).all(userId) as Array<{ year: number; entitlement: number; carryover: number; taken: number }>;

  logger.debug({ count: entries.length }, `📊 Found vacation_balance entries to update`);

  // Update entitlement for each year
  for (const entry of entries) {
    db.prepare(`
      UPDATE vacation_balance
      SET entitlement = ?
      WHERE userId = ? AND year = ?
    `).run(newEntitlement, userId, entry.year);

    const newRemaining = newEntitlement + entry.carryover - entry.taken;
    logger.debug({ year: entry.year, oldEntitlement: entry.entitlement, newEntitlement, newRemaining }, `  ✅ Updated entitlement`);
  }

  logger.info('✅ All vacation_balance entries updated');
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

    logger.info({ userId: id }, '✅ User soft-deleted');
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error deleting user');
    throw error;
  }
}

/**
 * Reactivate deleted user (undo soft delete)
 * Only possible if user was soft-deleted (deletedAt IS NOT NULL)
 */
export function reactivateUser(id: number): UserPublic {
  try {
    // Check if user exists and is deleted
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND deletedAt IS NOT NULL').get(id) as User | undefined;

    if (!user) {
      throw new Error('User not found or not deleted');
    }

    // Reactivate user
    const stmt = db.prepare(`
      UPDATE users
      SET deletedAt = NULL, status = 'active'
      WHERE id = ?
    `);

    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('Failed to reactivate user');
    }

    logger.info({ userId: id, username: user.username, email: user.email }, '🔄 User reactivated');

    // Return updated user
    const reactivatedUser = getUserById(id);
    if (!reactivatedUser) {
      throw new Error('Failed to fetch reactivated user');
    }

    return reactivatedUser;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error reactivating user');
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

    logger.info({ userId: id, status }, '✅ User status updated');

    const user = getUserById(id);
    if (!user) {
      throw new Error('Failed to retrieve updated user');
    }

    return user;
  } catch (error) {
    logger.error({ err: error, userId: id, status }, '❌ Error updating user status');
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
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE username = ? AND id != ?
      `);
      const result = stmt.get(username, excludeId) as { count: number };
      return result.count > 0;
    } else {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE username = ?
      `);
      const result = stmt.get(username) as { count: number };
      return result.count > 0;
    }
  } catch (error) {
    logger.error({ err: error, username }, '❌ Error checking username');
    throw error;
  }
}

/**
 * Check if email exists
 */
export function emailExists(email: string, excludeId?: number): boolean {
  try {
    // Empty or null emails should not be checked (email is optional)
    if (!email || email.trim() === '') {
      return false;
    }

    let stmt;
    if (excludeId) {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email = ? AND id != ?
      `);
      const result = stmt.get(email, excludeId) as { count: number };
      return result.count > 0;
    } else {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email = ?
      `);
      const result = stmt.get(email) as { count: number };
      return result.count > 0;
    }
  } catch (error) {
    logger.error({ err: error, email }, '❌ Error checking email');
    throw error;
  }
}

/**
 * Update Privacy Consent (DSGVO)
 * Set privacy consent timestamp for user
 */
export function updatePrivacyConsent(userId: number): UserPublic {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET privacyConsentAt = datetime('now')
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(userId);

    if (result.changes === 0) {
      throw new Error('User not found');
    }

    logger.info({ userId }, '✅ Privacy consent updated for user');

    const user = getUserById(userId);
    if (!user) {
      throw new Error('Failed to retrieve updated user');
    }

    return user;
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Error updating privacy consent');
    throw error;
  }
}

/**
 * GDPR Data Export (DSGVO Art. 15)
 * Export all user data for GDPR compliance
 */
export function exportUserData(userId: number): GDPRDataExport {
  try {
    logger.info({ userId }, '📊 Exporting user data for GDPR compliance');

    // 1. Get user data
    const user = getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 2. Get all time entries
    const timeEntriesStmt = db.prepare(`
      SELECT id, userId, date, startTime, endTime, breakMinutes, hours,
             activity, project, location, notes, createdAt, updatedAt
      FROM time_entries
      WHERE userId = ?
      ORDER BY date DESC
    `);
    const timeEntries = timeEntriesStmt.all(userId) as TimeEntry[];

    // 3. Get all absence requests
    const absencesStmt = db.prepare(`
      SELECT id, userId, type, startDate, endDate, days, status,
             reason, adminNote, approvedBy, approvedAt, createdAt
      FROM absence_requests
      WHERE userId = ?
      ORDER BY startDate DESC
    `);
    const absenceRequests = absencesStmt.all(userId) as AbsenceRequest[];

    // 4. Get overtime balance (current - from SSOT)
    const overtimeBalance = getOvertimeBalance(userId);

    // 5. Get vacation balance (current year)
    const currentYear = new Date().getFullYear();
    const vacationBalance = getVacationBalance(userId, currentYear);

    // 6. Build export data
    const exportData: GDPRDataExport = {
      exportDate: new Date().toISOString(),
      user,
      timeEntries,
      absenceRequests,
      absences: absenceRequests, // Alias for backward compatibility
      overtimeBalance: {
        totalHours: overtimeBalance || 0,
        lastUpdated: new Date().toISOString(),
      },
      vacationBalance: {
        availableDays: vacationBalance?.remaining || 0,
        usedDays: vacationBalance?.taken || 0,
        totalDays: vacationBalance?.entitlement || 0,
        lastUpdated: new Date().toISOString(),
      },
    } as any; // Use 'as any' to allow additional property

    logger.info({
      timeEntriesCount: timeEntries.length,
      absenceRequestsCount: absenceRequests.length,
      overtimeHours: overtimeBalance || 0,
      vacationRemaining: vacationBalance?.remaining || 0,
      vacationTotal: vacationBalance?.entitlement || 0
    }, '✅ User data exported successfully');

    return exportData;
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Error exporting user data');
    throw error;
  }
}

/**
 * PASSWORD MANAGEMENT
 */

/**
 * Log password change to audit table
 */
function logPasswordChange(
  userId: number,
  changedBy: number,
  changeType: 'self-service' | 'admin-reset',
  ipAddress?: string
): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO password_change_log (userId, changedBy, changeType, ipAddress)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(userId, changedBy, changeType, ipAddress || null);

    logger.info({ userId, changedBy, changeType }, '✅ Password change logged');
  } catch (error) {
    logger.error({ err: error, userId, changedBy, changeType }, '❌ Error logging password change');
    // Don't throw - logging failure shouldn't block password change
  }
}

/**
 * Change own password (Self-Service)
 * Requires current password for verification
 */
export async function changeOwnPassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info({ userId }, '🔐 Self-service password change requested');

    // Validation: New password length
    if (!newPassword || newPassword.length < 10) {
      return { success: false, error: 'New password must be at least 10 characters long' };
    }

    // Get user with password hash
    const user = findUserByIdWithPassword(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      logger.warn({ userId }, '⚠️ Invalid current password provided');
      return { success: false, error: 'Current password is incorrect' };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    const stmt = db.prepare(`
      UPDATE users
      SET password = ?, forcePasswordChange = 0
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(hashedPassword, userId);

    if (result.changes === 0) {
      return { success: false, error: 'Failed to update password' };
    }

    // Log password change
    logPasswordChange(userId, userId, 'self-service', ipAddress);

    logger.info({ userId }, '✅ Password changed successfully (self-service)');

    return { success: true };
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Error changing own password');
    return { success: false, error: 'Failed to change password' };
  }
}

/**
 * Reset user password (Admin only)
 * Can force user to change password on next login
 */
export async function resetUserPassword(
  adminId: number,
  targetUserId: number,
  newPassword: string,
  forceChange: boolean = true,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info({ adminId, targetUserId, forceChange }, '🔐 Admin password reset requested');

    // Validation: New password length
    if (!newPassword || newPassword.length < 10) {
      return { success: false, error: 'New password must be at least 10 characters long' };
    }

    // Check if target user exists
    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and forcePasswordChange flag
    const stmt = db.prepare(`
      UPDATE users
      SET password = ?, forcePasswordChange = ?
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(hashedPassword, forceChange ? 1 : 0, targetUserId);

    if (result.changes === 0) {
      return { success: false, error: 'Failed to update password' };
    }

    // Log password change
    logPasswordChange(targetUserId, adminId, 'admin-reset', ipAddress);

    logger.info({ adminId, targetUserId, forceChange }, '✅ Password reset successfully (admin)');

    return { success: true };
  } catch (error) {
    logger.error({ err: error, adminId, targetUserId }, '❌ Error resetting user password');
    return { success: false, error: 'Failed to reset password' };
  }
}
