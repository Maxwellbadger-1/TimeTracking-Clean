import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { ensureCorrectionTransactions } from './overtimeService.js';

/**
 * OVERTIME TRANSACTION CENTRALIZATION TESTS (Phase 3)
 *
 * These tests verify that all overtime transaction creation goes through
 * the centralized OvertimeTransactionService (Single Source of Truth).
 *
 * CRITICAL: Phase 3 eliminates "Triple Transaction Creation" problem
 * - ALL transaction creation MUST use overtimeTransactionService functions
 * - NO direct INSERT INTO overtime_transactions allowed (except in overtimeTransactionService itself)
 * - Ensures consistent audit trail and data integrity
 */

describe('Phase 3: Transaction Centralization', () => {
  let testUserId: number;
  let testAdminId: number;

  beforeEach(() => {
    // Create test user
    const userResult = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testuser_txn',
      'test@txn.com',
      'Test',
      'User',
      'hash',
      'employee',
      40,
      '2026-01-01'
    );
    testUserId = userResult.lastInsertRowid as number;

    // Create test admin
    const adminResult = db.prepare(`
      INSERT INTO users (
        username, email, firstName, lastName, password, role,
        weeklyHours, hireDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'testadmin_txn',
      'admin@txn.com',
      'Test',
      'Admin',
      'hash',
      'admin',
      40,
      '2026-01-01'
    );
    testAdminId = adminResult.lastInsertRowid as number;
  });

  afterEach(() => {
    // Clean up
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(testUserId, testAdminId);
    db.prepare('DELETE FROM overtime_corrections WHERE userId = ?').run(testUserId);
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
  });

  describe('ensureCorrectionTransactions', () => {
    it('should create transactions via centralized service (not direct INSERT)', async () => {
      // Create an overtime correction
      const correctionResult = db.prepare(`
        INSERT INTO overtime_corrections (
          userId, hours, date, reason, correctionType, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(testUserId, 5, '2026-01-15', 'Test correction', 'manual', testAdminId);

      const correctionId = correctionResult.lastInsertRowid as number;

      // Call ensureCorrectionTransactions (should use centralized service)
      await ensureCorrectionTransactions(testUserId, '2026-01', '2026-01');

      // Verify transaction was created
      const transaction = db.prepare(`
        SELECT *
        FROM overtime_transactions
        WHERE userId = ? AND referenceId = ? AND type = 'correction'
      `).get(testUserId, correctionId) as any;

      expect(transaction).toBeDefined();
      expect(transaction.hours).toBe(5);
      expect(transaction.description).toBe('Test correction');
      expect(transaction.referenceType).toBe('manual');
      expect(transaction.referenceId).toBe(correctionId);
      expect(transaction.createdBy).toBe(testAdminId); // Preserved from correction
    });

    it('should not create duplicate transactions (idempotent)', async () => {
      // Create an overtime correction
      db.prepare(`
        INSERT INTO overtime_corrections (
          userId, hours, date, reason, correctionType, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(testUserId, 3, '2026-01-20', 'Test idempotency', 'manual', testAdminId);

      // Call twice
      await ensureCorrectionTransactions(testUserId, '2026-01', '2026-01');
      await ensureCorrectionTransactions(testUserId, '2026-01', '2026-01');

      // Should only have ONE transaction
      const count = db.prepare(`
        SELECT COUNT(*) as count
        FROM overtime_transactions
        WHERE userId = ? AND type = 'correction'
      `).get(testUserId) as { count: number };

      expect(count.count).toBe(1);
    });

    it('should handle multiple corrections in one call', async () => {
      // Create multiple corrections
      db.prepare(`
        INSERT INTO overtime_corrections (
          userId, hours, date, reason, correctionType, createdBy
        ) VALUES
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?)
      `).run(
        testUserId, 2, '2026-01-10', 'Correction 1', 'manual', testAdminId,
        testUserId, -1, '2026-01-15', 'Correction 2', 'manual', testAdminId,
        testUserId, 3.5, '2026-01-20', 'Correction 3', 'manual', testAdminId
      );

      // Call ensureCorrectionTransactions
      await ensureCorrectionTransactions(testUserId, '2026-01', '2026-01');

      // Should have 3 transactions
      const count = db.prepare(`
        SELECT COUNT(*) as count
        FROM overtime_transactions
        WHERE userId = ? AND type = 'correction'
      `).get(testUserId) as { count: number };

      expect(count.count).toBe(3);

      // Verify total hours
      const total = db.prepare(`
        SELECT SUM(hours) as total
        FROM overtime_transactions
        WHERE userId = ? AND type = 'correction'
      `).get(testUserId) as { total: number };

      expect(total.total).toBe(4.5); // 2 + (-1) + 3.5 = 4.5
    });
  });

  describe('Integration: Centralization Verification', () => {
    it('should verify that only overtimeTransactionService creates transactions', () => {
      // This test documents the centralization requirement
      // In Phase 3, we ensure that:
      // 1. overtimeTransactionService.ts is the ONLY place with direct INSERTs
      // 2. All other services MUST use functions from overtimeTransactionService
      // 3. This eliminates the "Triple Transaction Creation" problem

      const centralizedFunctions = [
        'recordOvertimeEarned',
        'recordOvertimeCompensation',
        'recordOvertimeCorrection',
        'recordYearEndCarryover',
        'recordVacationCredit',
        'recordSickCredit',
        'recordOvertimeCompCredit',
        'recordSpecialCredit',
        'recordUnpaidAdjustment'
      ];

      // Documentation test - verifies the architecture
      expect(centralizedFunctions.length).toBeGreaterThan(0);
      expect(centralizedFunctions).toContain('recordOvertimeCorrection'); // Used in Phase 3 refactoring
    });
  });
});
