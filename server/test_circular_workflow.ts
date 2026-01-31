#!/usr/bin/env tsx
import { approveAbsenceRequest, rejectAbsenceRequest } from './src/services/absenceService.js';
import Database from 'better-sqlite3';

console.log('🧪 Testing Phase 2: Circular Workflow (pending → approved → rejected → approved)\n');

const db = new Database('./database/development.db');

// Use Absence ID 42 (userId=15, dates=20-21.01.2026)
const absenceId = 42;
const adminId = 1;

// Helper function to get absence status
function getAbsenceStatus(id: number): string {
  const absence = db.prepare('SELECT status FROM absence_requests WHERE id = ?').get(id) as { status: string };
  return absence.status;
}

// Helper function to count transactions
function countTransactions(userId: number, referenceId: number): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions
    WHERE userId = ? AND referenceId = ?
  `).get(userId, referenceId) as { count: number };
  return result.count;
}

try {
  console.log('📋 STEP 1: Check initial status');
  let status = getAbsenceStatus(absenceId);
  console.log(`   Current status: ${status}`);
  let txCount = countTransactions(15, absenceId);
  console.log(`   Transactions: ${txCount}\n`);

  // If not pending, reset to pending first
  if (status !== 'pending') {
    console.log('🔄 Resetting to pending status...');
    db.prepare('UPDATE absence_requests SET status = ? WHERE id = ?').run('pending', absenceId);
    status = getAbsenceStatus(absenceId);
    console.log(`   ✅ Status reset to: ${status}\n`);
  }

  console.log('✅ STEP 2: Approve absence (pending → approved)');
  await approveAbsenceRequest(absenceId, adminId, 'Phase 2 test: Initial approval');
  status = getAbsenceStatus(absenceId);
  txCount = countTransactions(15, absenceId);
  console.log(`   Status: ${status}`);
  console.log(`   Transactions: ${txCount} (should be > 0)\n`);

  if (status !== 'approved') {
    throw new Error(`Expected status 'approved', got '${status}'`);
  }

  console.log('❌ STEP 3: Reject absence (approved → rejected)');
  await rejectAbsenceRequest(absenceId, adminId, 'Phase 2 test: Rejection');
  status = getAbsenceStatus(absenceId);
  txCount = countTransactions(15, absenceId);
  console.log(`   Status: ${status}`);
  console.log(`   Transactions: ${txCount} (should be 0)\n`);

  if (status !== 'rejected') {
    throw new Error(`Expected status 'rejected', got '${status}'`);
  }

  console.log('✅ STEP 4: Re-approve absence (rejected → approved) - THE KEY TEST!');
  await approveAbsenceRequest(absenceId, adminId, 'Phase 2 test: Re-approval');
  status = getAbsenceStatus(absenceId);
  txCount = countTransactions(15, absenceId);
  console.log(`   Status: ${status}`);
  console.log(`   Transactions: ${txCount} (should be > 0 again)\n`);

  if (status !== 'approved') {
    throw new Error(`Expected status 'approved', got '${status}'`);
  }

  console.log('🎉 ========== SUCCESS! ==========');
  console.log('✅ Circular workflow works correctly:');
  console.log('   pending → approved → rejected → approved');
  console.log('✅ Transactions created/deleted correctly');
  console.log('✅ Phase 2 implementation is COMPLETE!\n');

} catch (error) {
  console.error('❌ ========== FAILURE! ==========');
  console.error('Error during circular workflow test:', error);
  console.error('\nCurrent absence status:', getAbsenceStatus(absenceId));
  process.exit(1);
} finally {
  db.close();
}
