import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { recordOvertimeEarned, recordOvertimeCorrection } from './overtimeTransactionService.js';

/**
 * BALANCE TRACKING TESTS (Phase 4)
 *
 * These tests verify that all overtime transactions include proper balance tracking.
 *
 * CRITICAL: Phase 4 adds balanceBefore/balanceAfter columns to improve:
 * - Query performance (no need to SUM all previous transactions)
 * - Data integrity (balance is stored, not calculated)
 * - Audit trail (see exactly what balance was at each point in time)
 */

describe('Phase 4: Balance Tracking', () => {
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
      'testuser_balance',
      'test@balance.com',
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
      'testadmin_balance',
      'admin@balance.com',
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
    db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
  });

  describe('recordOvertimeEarned', () => {
    it('should include balanceBefore and balanceAfter for first transaction', () => {
      // Record first transaction
      recordOvertimeEarned(testUserId, '2026-01-13', 2, 'Test overtime');

      // Verify transaction was created with balance tracking
      const transaction = db.prepare(`
        SELECT balanceBefore, balanceAfter, hours
        FROM overtime_transactions
        WHERE userId = ? AND date = '2026-01-13'
      `).get(testUserId) as { balanceBefore: number; balanceAfter: number; hours: number } | undefined;

      expect(transaction).toBeDefined();
      expect(transaction!.balanceBefore).toBe(0); // First transaction starts at 0
      expect(transaction!.balanceAfter).toBe(2); // 0 + 2 = 2
      expect(transaction!.hours).toBe(2);
    });

    it('should correctly calculate cumulative balance across multiple transactions', () => {
      // Record multiple transactions
      recordOvertimeEarned(testUserId, '2026-01-13', 2, 'Day 1');
      recordOvertimeEarned(testUserId, '2026-01-14', -1, 'Day 2');
      recordOvertimeEarned(testUserId, '2026-01-15', 3, 'Day 3');

      // Get all transactions
      const transactions = db.prepare(`
        SELECT date, hours, balanceBefore, balanceAfter
        FROM overtime_transactions
        WHERE userId = ?
        ORDER BY date ASC
      `).all(testUserId) as Array<{
        date: string;
        hours: number;
        balanceBefore: number;
        balanceAfter: number;
      }>;

      expect(transactions).toHaveLength(3);

      // Day 1: 0 → 2
      expect(transactions[0].balanceBefore).toBe(0);
      expect(transactions[0].balanceAfter).toBe(2);

      // Day 2: 2 → 1 (2 + (-1) = 1)
      expect(transactions[1].balanceBefore).toBe(2);
      expect(transactions[1].balanceAfter).toBe(1);

      // Day 3: 1 → 4 (1 + 3 = 4)
      expect(transactions[2].balanceBefore).toBe(1);
      expect(transactions[2].balanceAfter).toBe(4);
    });

    it('should handle negative overtime correctly', () => {
      // Create positive balance first
      recordOvertimeEarned(testUserId, '2026-01-13', 5, 'Positive');

      // Then negative overtime
      recordOvertimeEarned(testUserId, '2026-01-14', -3, 'Negative');

      const transactions = db.prepare(`
        SELECT date, balanceBefore, balanceAfter, hours
        FROM overtime_transactions
        WHERE userId = ?
        ORDER BY date ASC
      `).all(testUserId) as Array<{
        date: string;
        balanceBefore: number;
        balanceAfter: number;
        hours: number;
      }>;

      expect(transactions[0].balanceAfter).toBe(5);
      expect(transactions[1].balanceBefore).toBe(5);
      expect(transactions[1].balanceAfter).toBe(2); // 5 + (-3) = 2
    });
  });

  describe('recordOvertimeCorrection', () => {
    it('should include balance tracking for correction transactions', () => {
      // Create some earned overtime first
      recordOvertimeEarned(testUserId, '2026-01-13', 2, 'Earned');

      // Record a correction
      recordOvertimeCorrection(
        testUserId,
        '2026-01-14',
        5,
        'Manual correction',
        testAdminId
      );

      // Get correction transaction
      const correction = db.prepare(`
        SELECT balanceBefore, balanceAfter, hours, type
        FROM overtime_transactions
        WHERE userId = ? AND type = 'correction'
      `).get(testUserId) as {
        balanceBefore: number;
        balanceAfter: number;
        hours: number;
        type: string;
      } | undefined;

      expect(correction).toBeDefined();
      expect(correction!.type).toBe('correction');
      expect(correction!.balanceBefore).toBe(2); // From previous earned transaction
      expect(correction!.balanceAfter).toBe(7); // 2 + 5 = 7
      expect(correction!.hours).toBe(5);
    });

    it('should maintain correct balance when corrections are negative', () => {
      // Create positive balance
      recordOvertimeEarned(testUserId, '2026-01-13', 10, 'Earned');

      // Negative correction (reducing balance)
      recordOvertimeCorrection(
        testUserId,
        '2026-01-14',
        -3,
        'Error correction',
        testAdminId
      );

      const correction = db.prepare(`
        SELECT balanceBefore, balanceAfter
        FROM overtime_transactions
        WHERE userId = ? AND type = 'correction'
      `).get(testUserId) as { balanceBefore: number; balanceAfter: number } | undefined;

      expect(correction!.balanceBefore).toBe(10);
      expect(correction!.balanceAfter).toBe(7); // 10 + (-3) = 7
    });
  });

  describe('Integration: Balance Consistency', () => {
    it('should maintain consistent balance across mixed transaction types', () => {
      // Simulate a realistic scenario with multiple transaction types
      recordOvertimeEarned(testUserId, '2026-01-13', 2, 'Monday work');
      recordOvertimeEarned(testUserId, '2026-01-14', 3, 'Tuesday work');
      recordOvertimeCorrection(testUserId, '2026-01-15', -1, 'Error fix', testAdminId);
      recordOvertimeEarned(testUserId, '2026-01-16', 1, 'Wednesday work');

      // Get final balance
      const lastTransaction = db.prepare(`
        SELECT balanceAfter
        FROM overtime_transactions
        WHERE userId = ?
        ORDER BY date DESC, createdAt DESC
        LIMIT 1
      `).get(testUserId) as { balanceAfter: number } | undefined;

      expect(lastTransaction!.balanceAfter).toBe(5); // 2 + 3 - 1 + 1 = 5
    });

    it('should verify all transactions have non-null balance values', () => {
      // Create several transactions
      recordOvertimeEarned(testUserId, '2026-01-13', 2, 'Day 1');
      recordOvertimeEarned(testUserId, '2026-01-14', 3, 'Day 2');
      recordOvertimeCorrection(testUserId, '2026-01-15', 1, 'Correction', testAdminId);

      // Check that ALL transactions have balance values
      const nullBalances = db.prepare(`
        SELECT COUNT(*) as count
        FROM overtime_transactions
        WHERE userId = ? AND (balanceBefore IS NULL OR balanceAfter IS NULL)
      `).get(testUserId) as { count: number };

      expect(nullBalances.count).toBe(0); // ZERO transactions should have NULL balances
    });
  });
});
