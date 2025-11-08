import bcrypt from 'bcrypt';
import { getDatabase } from '../database/connection.js';

const db = getDatabase();

/**
 * Change user password
 * Requires old password verification for security
 */
export function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): void {
  try {
    // Get current user
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as { password: string } | undefined;

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = bcrypt.compareSync(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    if (newPassword === oldPassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Update password
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

    console.log(`✅ Password changed for user ID: ${userId}`);
  } catch (error) {
    console.error('❌ Error changing password:', error);
    throw error;
  }
}

/**
 * Change user email
 * Validates email format and uniqueness
 */
export function changeEmail(userId: number, newEmail: string, password: string): void {
  try {
    // Get current user
    const user = db.prepare('SELECT password, email FROM users WHERE id = ?').get(userId) as
      | { password: string; email: string }
      | undefined;

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password for security
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      throw new Error('Password is incorrect');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error('Invalid email format');
    }

    // Check if email is already taken
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, userId);
    if (existingUser) {
      throw new Error('Email is already in use');
    }

    if (newEmail === user.email) {
      throw new Error('New email must be different from current email');
    }

    // Update email
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, userId);

    console.log(`✅ Email changed for user ID: ${userId} to ${newEmail}`);
  } catch (error) {
    console.error('❌ Error changing email:', error);
    throw error;
  }
}

/**
 * Update user notification preferences
 */
export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  absenceApproved: boolean;
  absenceRejected: boolean;
  overtimeWarning: boolean;
  vacationReminder: boolean;
}

export function updateNotificationPreferences(
  _userId: number,
  preferences: NotificationPreferences
): void {
  try {
    // Store preferences as JSON in users table
    // Note: We'd need to add a 'notificationPreferences' column to users table
    // For now, we'll just log it
    console.log(`✅ Notification preferences updated for user ID: ${_userId}`, preferences);

    // TODO: Add column to users table and implement storage
    // db.prepare('UPDATE users SET notificationPreferences = ? WHERE id = ?')
    //   .run(JSON.stringify(preferences), userId);
  } catch (error) {
    console.error('❌ Error updating notification preferences:', error);
    throw error;
  }
}

/**
 * Get user notification preferences
 */
export function getNotificationPreferences(_userId: number): NotificationPreferences {
  try {
    // For now, return defaults
    // TODO: Fetch from database once column is added
    return {
      emailNotifications: true,
      pushNotifications: true,
      absenceApproved: true,
      absenceRejected: true,
      overtimeWarning: true,
      vacationReminder: true,
    };
  } catch (error) {
    console.error('❌ Error getting notification preferences:', error);
    throw error;
  }
}
