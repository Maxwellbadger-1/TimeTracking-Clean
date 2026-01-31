import { db } from '../database/connection.js';
import logger from '../utils/logger.js';
import {
  OvertimeCorrection,
  OvertimeCorrectionCreateInput,
  OvertimeCorrectionWithUser,
} from '../types/index.js';
import { updateMonthlyOvertime } from './overtimeService.js';
import { recordOvertimeCorrection } from './overtimeTransactionService.js';
import { broadcastEvent } from '../websocket/server.js';

/**
 * Overtime Corrections Service
 *
 * Professional system for manual overtime adjustments
 * Follows best practices from Personio, DATEV, SAP
 */

/**
 * Create a new overtime correction
 * Admin-only operation with mandatory reason (min 10 characters)
 */
export function createOvertimeCorrection(
  input: OvertimeCorrectionCreateInput,
  createdBy: number
): OvertimeCorrection {
  try {
    // Validation
    if (!input.reason || input.reason.trim().length < 10) {
      throw new Error('Reason must be at least 10 characters');
    }

    if (input.hours === 0) {
      throw new Error('Correction hours cannot be zero');
    }

    // Verify user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND deletedAt IS NULL').get(input.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify creator exists
    const creator = db.prepare('SELECT id FROM users WHERE id = ? AND deletedAt IS NULL').get(createdBy);
    if (!creator) {
      throw new Error('Creator not found');
    }

    // Insert correction
    const stmt = db.prepare(`
      INSERT INTO overtime_corrections (
        userId, hours, date, reason, correctionType, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.userId,
      input.hours,
      input.date,
      input.reason.trim(),
      input.correctionType,
      createdBy
    );

    const correction = db
      .prepare('SELECT * FROM overtime_corrections WHERE id = ?')
      .get(result.lastInsertRowid) as OvertimeCorrection;

    logger.info({
      correctionId: correction.id,
      userId: input.userId,
      hours: input.hours,
      type: input.correctionType,
      createdBy,
    }, '✅ Overtime correction created');

    // CRITICAL: Create transaction for audit trail (overtime_transactions table)
    recordOvertimeCorrection(
      correction.userId,
      correction.date,
      correction.hours,
      correction.reason,
      createdBy,
      correction.id  // referenceId to link back to overtime_corrections
    );

    // Create notification for the affected user
    db.prepare(`
      INSERT INTO notifications (userId, type, title, message)
      VALUES (?, 'overtime_correction', ?, ?)
    `).run(
      input.userId,
      'Überstunden-Korrektur',
      `Es wurde eine Korrektur von ${input.hours > 0 ? '+' : ''}${input.hours.toFixed(2)}h vorgenommen. Grund: ${input.reason}`
    );

    // CRITICAL: Recalculate overtime_balance for the affected month
    const correctionMonth = input.date.substring(0, 7); // Extract "YYYY-MM"
    try {
      updateMonthlyOvertime(input.userId, correctionMonth);
      logger.info({ userId: input.userId, month: correctionMonth }, '✅ Overtime recalculated after correction');
    } catch (error) {
      logger.error({ err: error, userId: input.userId, month: correctionMonth }, '❌ Failed to recalculate overtime after correction');
      // Don't fail the correction creation, but log the error
    }

    // Broadcast WebSocket event
    broadcastEvent({
      type: 'correction:created',
      userId: input.userId,
      data: correction,
      timestamp: new Date().toISOString(),
    });

    return correction;
  } catch (error) {
    logger.error({ err: error, input }, '❌ Failed to create overtime correction');
    throw error;
  }
}

/**
 * Get all corrections for a specific user
 * @param userId User ID
 * @param year Optional year filter (e.g., 2026)
 * @param month Optional month filter (1-12)
 */
export function getOvertimeCorrectionsForUser(
  userId: number,
  year?: number,
  month?: number
): OvertimeCorrectionWithUser[] {
  try {
    // Build WHERE clause dynamically
    const whereClauses = ['oc.userId = ?'];
    const params: (number | string)[] = [userId];

    if (year) {
      whereClauses.push("strftime('%Y', oc.date) = ?");
      params.push(year.toString());
    }

    if (month) {
      whereClauses.push("strftime('%m', oc.date) = ?");
      params.push(month.toString().padStart(2, '0')); // Ensure "01", "02", ..., "12"
    }

    const whereClause = whereClauses.join(' AND ');

    const corrections = db.prepare(`
      SELECT
        oc.*,
        u.firstName as user_firstName,
        u.lastName as user_lastName,
        u.email as user_email,
        c.firstName as creator_firstName,
        c.lastName as creator_lastName,
        c.email as creator_email,
        a.firstName as approver_firstName,
        a.lastName as approver_lastName,
        a.email as approver_email
      FROM overtime_corrections oc
      JOIN users u ON oc.userId = u.id
      JOIN users c ON oc.createdBy = c.id
      LEFT JOIN users a ON oc.approvedBy = a.id
      WHERE ${whereClause}
      ORDER BY oc.createdAt DESC
    `).all(...params) as Array<{
      id: number;
      userId: number;
      hours: number;
      date: string;
      reason: string;
      correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual';
      createdBy: number;
      approvedBy: number | null;
      approvedAt: string | null;
      createdAt: string;
      user_firstName: string;
      user_lastName: string;
      user_email: string;
      creator_firstName: string;
      creator_lastName: string;
      creator_email: string;
      approver_firstName?: string;
      approver_lastName?: string;
      approver_email?: string;
    }>;

    return corrections.map(c => ({
      id: c.id,
      userId: c.userId,
      hours: c.hours,
      date: c.date,
      reason: c.reason,
      correctionType: c.correctionType,
      createdBy: c.createdBy,
      approvedBy: c.approvedBy,
      approvedAt: c.approvedAt,
      createdAt: c.createdAt,
      user: {
        firstName: c.user_firstName,
        lastName: c.user_lastName,
        email: c.user_email,
      },
      creator: {
        firstName: c.creator_firstName,
        lastName: c.creator_lastName,
        email: c.creator_email,
      },
      ...(c.approver_firstName && c.approver_lastName && c.approver_email && {
        approver: {
          firstName: c.approver_firstName,
          lastName: c.approver_lastName,
          email: c.approver_email,
        },
      }),
    }));
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Failed to get overtime corrections');
    throw error;
  }
}

/**
 * Get all corrections (admin only)
 * @param year Optional year filter (e.g., 2026)
 * @param month Optional month filter (1-12)
 */
export function getAllOvertimeCorrections(
  year?: number,
  month?: number
): OvertimeCorrectionWithUser[] {
  try {
    // Build WHERE clause dynamically
    const whereClauses: string[] = [];
    const params: (number | string)[] = [];

    if (year) {
      whereClauses.push("strftime('%Y', oc.date) = ?");
      params.push(year.toString());
    }

    if (month) {
      whereClauses.push("strftime('%m', oc.date) = ?");
      params.push(month.toString().padStart(2, '0')); // Ensure "01", "02", ..., "12"
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const corrections = db.prepare(`
      SELECT
        oc.*,
        u.firstName as user_firstName,
        u.lastName as user_lastName,
        u.email as user_email,
        c.firstName as creator_firstName,
        c.lastName as creator_lastName,
        c.email as creator_email,
        a.firstName as approver_firstName,
        a.lastName as approver_lastName,
        a.email as approver_email
      FROM overtime_corrections oc
      JOIN users u ON oc.userId = u.id
      JOIN users c ON oc.createdBy = c.id
      LEFT JOIN users a ON oc.approvedBy = a.id
      ${whereClause}
      ORDER BY oc.createdAt DESC
    `).all(...params) as Array<{
      id: number;
      userId: number;
      hours: number;
      date: string;
      reason: string;
      correctionType: 'system_error' | 'absence_credit' | 'migration' | 'manual';
      createdBy: number;
      approvedBy: number | null;
      approvedAt: string | null;
      createdAt: string;
      user_firstName: string;
      user_lastName: string;
      user_email: string;
      creator_firstName: string;
      creator_lastName: string;
      creator_email: string;
      approver_firstName?: string;
      approver_lastName?: string;
      approver_email?: string;
    }>;

    return corrections.map(c => ({
      id: c.id,
      userId: c.userId,
      hours: c.hours,
      date: c.date,
      reason: c.reason,
      correctionType: c.correctionType,
      createdBy: c.createdBy,
      approvedBy: c.approvedBy,
      approvedAt: c.approvedAt,
      createdAt: c.createdAt,
      user: {
        firstName: c.user_firstName,
        lastName: c.user_lastName,
        email: c.user_email,
      },
      creator: {
        firstName: c.creator_firstName,
        lastName: c.creator_lastName,
        email: c.creator_email,
      },
      ...(c.approver_firstName && c.approver_lastName && c.approver_email && {
        approver: {
          firstName: c.approver_firstName,
          lastName: c.approver_lastName,
          email: c.approver_email,
        },
      }),
    }));
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to get all overtime corrections');
    throw error;
  }
}

/**
 * Calculate total corrections for a user
 * Used in overtime calculation
 */
export function getTotalCorrectionsForUser(userId: number): number {
  try {
    const result = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM overtime_corrections
      WHERE userId = ?
    `).get(userId) as { total: number };

    return result.total;
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Failed to calculate total corrections');
    throw error;
  }
}

/**
 * Calculate total corrections for a user in a specific month
 */
export function getTotalCorrectionsForUserInMonth(userId: number, month: string): number {
  try {
    const result = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total
      FROM overtime_corrections
      WHERE userId = ?
        AND strftime('%Y-%m', date) = ?
    `).get(userId, month) as { total: number };

    return result.total;
  } catch (error) {
    logger.error({ err: error, userId, month }, '❌ Failed to calculate monthly corrections');
    throw error;
  }
}

/**
 * Delete a correction (admin only, with audit trail)
 */
export function deleteOvertimeCorrection(id: number, deletedBy: number): void {
  try {
    const correction = db.prepare('SELECT * FROM overtime_corrections WHERE id = ?').get(id) as OvertimeCorrection | undefined;

    if (!correction) {
      throw new Error('Correction not found');
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (userId, action, entity, entityId, changes)
      VALUES (?, 'delete', 'overtime_correction', ?, ?)
    `).run(
      deletedBy,
      id,
      JSON.stringify(correction)
    );

    // Delete
    db.prepare('DELETE FROM overtime_corrections WHERE id = ?').run(id);

    // CRITICAL: Delete corresponding transaction from overtime_transactions
    db.prepare(`
      DELETE FROM overtime_transactions
      WHERE type = 'correction' AND referenceType = 'manual' AND referenceId = ?
    `).run(id);

    logger.info({ correctionId: id, deletedBy }, '✅ Overtime correction deleted (including transaction)');

    // Notify user
    db.prepare(`
      INSERT INTO notifications (userId, type, title, message)
      VALUES (?, 'overtime_correction', ?, ?)
    `).run(
      correction.userId,
      'Überstunden-Korrektur gelöscht',
      `Eine Korrektur von ${correction.hours > 0 ? '+' : ''}${correction.hours.toFixed(2)}h wurde entfernt.`
    );

    // CRITICAL: Recalculate overtime_balance for the affected month
    const correctionMonth = correction.date.substring(0, 7); // Extract "YYYY-MM"
    try {
      updateMonthlyOvertime(correction.userId, correctionMonth);
      logger.info({ userId: correction.userId, month: correctionMonth }, '✅ Overtime recalculated after correction deletion');
    } catch (error) {
      logger.error({ err: error, userId: correction.userId, month: correctionMonth }, '❌ Failed to recalculate overtime after correction deletion');
      // Don't fail the deletion, but log the error
    }

    // Broadcast WebSocket event
    broadcastEvent({
      type: 'correction:deleted',
      userId: correction.userId,
      data: { id, date: correction.date },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error, id }, '❌ Failed to delete overtime correction');
    throw error;
  }
}

/**
 * Get correction statistics
 */
export interface CorrectionStatistics {
  totalCorrections: number;
  totalHoursAdded: number;
  totalHoursSubtracted: number;
  netHoursChange: number;
  byType: {
    system_error: number;
    absence_credit: number;
    migration: number;
    manual: number;
  };
}

export function getCorrectionStatistics(userId?: number): CorrectionStatistics {
  try {
    const whereClause = userId ? 'WHERE userId = ?' : '';
    const params = userId ? [userId] : [];

    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN hours > 0 THEN hours ELSE 0 END), 0) as added,
        COALESCE(SUM(CASE WHEN hours < 0 THEN hours ELSE 0 END), 0) as subtracted,
        COALESCE(SUM(hours), 0) as net
      FROM overtime_corrections
      ${whereClause}
    `).get(...params) as {
      count: number;
      added: number;
      subtracted: number;
      net: number;
    };

    const byType = db.prepare(`
      SELECT
        correctionType,
        COUNT(*) as count
      FROM overtime_corrections
      ${whereClause}
      GROUP BY correctionType
    `).all(...params) as Array<{ correctionType: string; count: number }>;

    const typeStats = {
      system_error: 0,
      absence_credit: 0,
      migration: 0,
      manual: 0,
    };

    byType.forEach(t => {
      typeStats[t.correctionType as keyof typeof typeStats] = t.count;
    });

    return {
      totalCorrections: totalStats.count,
      totalHoursAdded: totalStats.added,
      totalHoursSubtracted: totalStats.subtracted,
      netHoursChange: totalStats.net,
      byType: typeStats,
    };
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Failed to get correction statistics');
    throw error;
  }
}
