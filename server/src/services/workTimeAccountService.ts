import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import {
  WorkTimeAccount,
  WorkTimeAccountWithUser,
  WorkTimeAccountUpdateInput,
} from '../types/index.js';

/**
 * Work Time Account Service (Arbeitszeitkonto)
 *
 * Professional time account system with:
 * - Running balance across months
 * - Configurable max/min limits
 * - Warning notifications at thresholds
 * - Monthly history tracking
 *
 * Best practices from Personio, DATEV, SAP
 */

/**
 * Get or create work time account for a user
 */
export function getOrCreateWorkTimeAccount(userId: number): WorkTimeAccount {
  try {
    // Try to get existing account
    let account = db.prepare('SELECT * FROM work_time_accounts WHERE userId = ?').get(userId) as WorkTimeAccount | undefined;

    if (!account) {
      // Create new account with default settings
      const stmt = db.prepare(`
        INSERT INTO work_time_accounts (userId, currentBalance, maxPlusHours, maxMinusHours)
        VALUES (?, 0, 50, -20)
      `);

      const result = stmt.run(userId);
      account = db.prepare('SELECT * FROM work_time_accounts WHERE id = ?').get(result.lastInsertRowid) as WorkTimeAccount;

      logger.info({ userId, accountId: account.id }, '✅ Created work time account');
    }

    return account;
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Failed to get/create work time account');
    throw error;
  }
}

/**
 * Get work time account with user details
 */
export function getWorkTimeAccountWithUser(userId: number): WorkTimeAccountWithUser | null {
  try {
    const result = db.prepare(`
      SELECT
        wta.*,
        u.firstName,
        u.lastName,
        u.email,
        u.weeklyHours
      FROM work_time_accounts wta
      JOIN users u ON wta.userId = u.id
      WHERE wta.userId = ? AND u.deletedAt IS NULL
    `).get(userId) as {
      id: number;
      userId: number;
      currentBalance: number;
      maxPlusHours: number;
      maxMinusHours: number;
      lastUpdated: string;
      firstName: string;
      lastName: string;
      email: string;
      weeklyHours: number;
    } | undefined;

    if (!result) return null;

    return {
      id: result.id,
      userId: result.userId,
      currentBalance: result.currentBalance,
      maxPlusHours: result.maxPlusHours,
      maxMinusHours: result.maxMinusHours,
      lastUpdated: result.lastUpdated,
      user: {
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        weeklyHours: result.weeklyHours,
      },
    };
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Failed to get work time account with user');
    throw error;
  }
}

/**
 * Get all work time accounts (admin only)
 */
export function getAllWorkTimeAccounts(): WorkTimeAccountWithUser[] {
  try {
    const results = db.prepare(`
      SELECT
        wta.*,
        u.firstName,
        u.lastName,
        u.email,
        u.weeklyHours
      FROM work_time_accounts wta
      JOIN users u ON wta.userId = u.id
      WHERE u.deletedAt IS NULL
      ORDER BY u.lastName, u.firstName
    `).all() as Array<{
      id: number;
      userId: number;
      currentBalance: number;
      maxPlusHours: number;
      maxMinusHours: number;
      lastUpdated: string;
      firstName: string;
      lastName: string;
      email: string;
      weeklyHours: number;
    }>;

    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      currentBalance: r.currentBalance,
      maxPlusHours: r.maxPlusHours,
      maxMinusHours: r.maxMinusHours,
      lastUpdated: r.lastUpdated,
      user: {
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        weeklyHours: r.weeklyHours,
      },
    }));
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to get all work time accounts');
    throw error;
  }
}

/**
 * Update work time account balance
 * This is called automatically when overtime changes
 */
export function updateWorkTimeAccountBalance(userId: number, newBalance: number): void {
  try {
    const account = getOrCreateWorkTimeAccount(userId);

    const oldBalance = account.currentBalance;

    // Update balance
    db.prepare(`
      UPDATE work_time_accounts
      SET currentBalance = ?, lastUpdated = datetime('now')
      WHERE userId = ?
    `).run(newBalance, userId);

    logger.info({
      userId,
      oldBalance,
      newBalance,
      delta: newBalance - oldBalance,
    }, '✅ Updated work time account balance');

    // Check thresholds and send notifications
    checkAndNotifyThresholds(userId, newBalance, account.maxPlusHours, account.maxMinusHours);
  } catch (error) {
    logger.error({ err: error, userId, newBalance }, '❌ Failed to update work time account balance');
    throw error;
  }
}

/**
 * Update work time account settings (max/min limits)
 */
export function updateWorkTimeAccountSettings(userId: number, input: WorkTimeAccountUpdateInput): WorkTimeAccount {
  try {
    const account = getOrCreateWorkTimeAccount(userId);

    const updates: string[] = [];
    const params: (number | string)[] = [];

    if (input.maxPlusHours !== undefined) {
      updates.push('maxPlusHours = ?');
      params.push(input.maxPlusHours);
    }

    if (input.maxMinusHours !== undefined) {
      updates.push('maxMinusHours = ?');
      params.push(input.maxMinusHours);
    }

    if (updates.length === 0) {
      return account;
    }

    updates.push('lastUpdated = datetime(\'now\')');
    params.push(userId);

    db.prepare(`
      UPDATE work_time_accounts
      SET ${updates.join(', ')}
      WHERE userId = ?
    `).run(...params);

    const updatedAccount = db.prepare('SELECT * FROM work_time_accounts WHERE userId = ?').get(userId) as WorkTimeAccount;

    logger.info({
      userId,
      changes: input,
    }, '✅ Updated work time account settings');

    return updatedAccount;
  } catch (error) {
    logger.error({ err: error, userId, input }, '❌ Failed to update work time account settings');
    throw error;
  }
}

/**
 * Check thresholds and send notifications
 */
function checkAndNotifyThresholds(userId: number, balance: number, maxPlus: number, maxMinus: number): void {
  try {
    const plusThreshold80 = maxPlus * 0.8;
    const plusThreshold100 = maxPlus;
    const minusThreshold80 = maxMinus * 0.8;
    const minusThreshold100 = maxMinus;

    // Check if notification already sent recently (last 7 days)
    const recentNotification = db.prepare(`
      SELECT id FROM notifications
      WHERE userId = ?
        AND type = 'work_time_account'
        AND createdAt > datetime('now', '-7 days')
      LIMIT 1
    `).get(userId);

    if (recentNotification) {
      // Don't spam notifications
      return;
    }

    let title = '';
    let message = '';
    let shouldNotify = false;

    // Positive balance warnings
    if (balance >= plusThreshold100) {
      title = 'Arbeitszeitkonto: Maximum erreicht!';
      message = `Ihr Arbeitszeitkonto hat das Maximum von +${maxPlus}h erreicht (aktuell: +${balance.toFixed(1)}h). Bitte bauen Sie Überstunden ab.`;
      shouldNotify = true;
    } else if (balance >= plusThreshold80) {
      title = 'Arbeitszeitkonto: Warnung';
      message = `Ihr Arbeitszeitkonto nähert sich dem Maximum (aktuell: +${balance.toFixed(1)}h von +${maxPlus}h). Bitte planen Sie Überstundenabbau.`;
      shouldNotify = true;
    }

    // Negative balance warnings
    if (balance <= minusThreshold100) {
      title = 'Arbeitszeitkonto: Minimum erreicht!';
      message = `Ihr Arbeitszeitkonto hat das Minimum von ${maxMinus}h erreicht (aktuell: ${balance.toFixed(1)}h). Bitte gleichen Sie Minusstunden aus.`;
      shouldNotify = true;
    } else if (balance <= minusThreshold80) {
      title = 'Arbeitszeitkonto: Warnung';
      message = `Ihr Arbeitszeitkonto nähert sich dem Minimum (aktuell: ${balance.toFixed(1)}h von ${maxMinus}h). Bitte gleichen Sie Minusstunden aus.`;
      shouldNotify = true;
    }

    if (shouldNotify) {
      db.prepare(`
        INSERT INTO notifications (userId, type, title, message)
        VALUES (?, 'work_time_account', ?, ?)
      `).run(userId, title, message);

      logger.info({ userId, balance, title }, '✅ Sent work time account threshold notification');
    }
  } catch (error) {
    logger.error({ err: error, userId, balance }, '❌ Failed to check thresholds');
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Get work time account history (monthly development)
 */
export interface MonthlyBalanceHistory {
  month: string; // YYYY-MM
  balance: number;
  delta: number; // Change from previous month
  overtime: number; // Overtime for that month
}

export function getWorkTimeAccountHistory(userId: number, months: number = 12): MonthlyBalanceHistory[] {
  try {
    // Get monthly overtime data
    const overtimeData = db.prepare(`
      SELECT
        month,
        overtime
      FROM overtime_balance
      WHERE userId = ?
      ORDER BY month DESC
      LIMIT ?
    `).all(userId, months) as Array<{ month: string; overtime: number }>;

    // Calculate running balance
    const history: MonthlyBalanceHistory[] = [];
    let runningBalance = 0;

    // Reverse to calculate from oldest to newest
    overtimeData.reverse().forEach((data) => {
      runningBalance += data.overtime;

      history.push({
        month: data.month,
        balance: runningBalance,
        delta: data.overtime,
        overtime: data.overtime,
      });
    });

    // Reverse back to show newest first
    return history.reverse();
  } catch (error) {
    logger.error({ err: error, userId, months }, '❌ Failed to get work time account history');
    throw error;
  }
}

/**
 * Calculate balance percentage (for UI visualization)
 */
export interface BalanceStatus {
  percentage: number; // -100 to +100
  status: 'critical_low' | 'warning_low' | 'normal' | 'warning_high' | 'critical_high';
  canTakeTimeOff: boolean; // Can take overtime compensation days
  shouldReduceOvertime: boolean; // Should work less hours
}

export function getBalanceStatus(userId: number): BalanceStatus {
  try {
    const account = getOrCreateWorkTimeAccount(userId);

    const { currentBalance, maxPlusHours, maxMinusHours } = account;

    // Calculate percentage
    let percentage = 0;
    if (currentBalance > 0) {
      percentage = (currentBalance / maxPlusHours) * 100;
    } else if (currentBalance < 0) {
      percentage = (currentBalance / Math.abs(maxMinusHours)) * 100;
    }

    // Determine status
    let status: BalanceStatus['status'] = 'normal';
    if (percentage >= 100) status = 'critical_high';
    else if (percentage >= 80) status = 'warning_high';
    else if (percentage <= -100) status = 'critical_low';
    else if (percentage <= -80) status = 'warning_low';

    // Can take time off if balance is positive and > 8 hours
    const canTakeTimeOff = currentBalance >= 8;

    // Should reduce overtime if approaching max
    const shouldReduceOvertime = percentage >= 80;

    return {
      percentage,
      status,
      canTakeTimeOff,
      shouldReduceOvertime,
    };
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Failed to get balance status');
    throw error;
  }
}

/**
 * Reset all work time accounts (admin only, for testing/migration)
 */
export function resetAllWorkTimeAccounts(): void {
  try {
    db.prepare('DELETE FROM work_time_accounts').run();
    logger.warn('⚠️ All work time accounts reset');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to reset work time accounts');
    throw error;
  }
}
