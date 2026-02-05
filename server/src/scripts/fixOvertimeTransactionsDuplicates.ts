/**
 * Fix Overtime Transactions Duplicates & Add Balance Tracking
 *
 * PROBLEM:
 * - Massive duplicates in overtime_transactions (40 entries instead of ~10)
 * - Missing balanceBefore/balanceAfter columns (no audit trail)
 * - Inconsistent sums: transactions = -24h, overtime_balance = -4h
 *
 * SOLUTION:
 * 1. Backup existing transactions
 * 2. Add balanceBefore/balanceAfter columns
 * 3. Remove duplicates (keep oldest entry per unique key)
 * 4. Calculate and populate balance tracking
 * 5. Add UNIQUE index for future duplicate prevention
 *
 * USAGE:
 *   npx tsx src/scripts/fixOvertimeTransactionsDuplicates.ts
 */

import Database from 'better-sqlite3';

const DB_PATH = './database/development.db';

interface Transaction {
  id: number;
  userId: number;
  date: string;
  type: string;
  hours: number;
  description: string | null;
  referenceType: string | null;
  referenceId: number | null;
  createdAt: string;
  createdBy: number | null;
}

interface DuplicateGroup {
  userId: number;
  date: string;
  type: string;
  referenceType: string | null;
  referenceId: number | null;
  count: number;
  ids: string;
}

function main() {
  console.log('🚀 Starting overtime_transactions fix...\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  try {
    const timestamp = Date.now();

    // STEP 1: BACKUP
    console.log('📦 STEP 1: Creating backup...');

    const backupTableName = `overtime_transactions_backup_${timestamp}`;
    db.prepare(`DROP TABLE IF EXISTS ${backupTableName}`).run();
    db.prepare(`CREATE TABLE ${backupTableName} AS SELECT * FROM overtime_transactions`).run();

    const backupCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name LIKE 'overtime_transactions_backup_%'
    `).get() as { count: number };

    console.log(`✅ Backup created (Total backups: ${backupCount.count})\n`);

    // STEP 2: ADD BALANCE COLUMNS
    console.log('📊 STEP 2: Adding balance tracking columns...');

    try {
      db.prepare(`ALTER TABLE overtime_transactions ADD COLUMN balanceBefore REAL`).run();
      console.log('✅ Added balanceBefore column');
    } catch (e) {
      console.log('⚠️  balanceBefore column already exists');
    }

    try {
      db.prepare(`ALTER TABLE overtime_transactions ADD COLUMN balanceAfter REAL`).run();
      console.log('✅ Added balanceAfter column');
    } catch (e) {
      console.log('⚠️  balanceAfter column already exists');
    }

    console.log('');

    // STEP 3: IDENTIFY DUPLICATES
    console.log('🔍 STEP 3: Identifying duplicates...');

    const duplicateGroups = db.prepare(`
      SELECT
        userId,
        date,
        type,
        referenceType,
        referenceId,
        COUNT(*) as count,
        GROUP_CONCAT(id) as ids
      FROM overtime_transactions
      GROUP BY userId, date, type, COALESCE(referenceType, ''), COALESCE(referenceId, -1)
      HAVING COUNT(*) > 1
      ORDER BY userId, date
    `).all() as DuplicateGroup[];

    console.log(`Found ${duplicateGroups.length} duplicate groups\n`);

    if (duplicateGroups.length > 0) {
      console.log('Duplicate Details:');
      duplicateGroups.forEach(group => {
        console.log(`  User ${group.userId}, ${group.date}, ${group.type}: ${group.count} duplicates (IDs: ${group.ids})`);
      });
      console.log('');
    }

    // STEP 4: REMOVE DUPLICATES
    console.log('🗑️  STEP 4: Removing duplicates...');

    let totalDeleted = 0;

    for (const group of duplicateGroups) {
      const ids = group.ids.split(',').map(id => parseInt(id, 10));
      const keepId = ids[0];
      const deleteIds = ids.slice(1);

      if (deleteIds.length > 0) {
        const placeholders = deleteIds.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM overtime_transactions WHERE id IN (${placeholders})`);
        const result = stmt.run(...deleteIds);
        totalDeleted += result.changes;

        console.log(`  Kept ID ${keepId}, deleted ${deleteIds.length} duplicates: [${deleteIds.join(', ')}]`);
      }
    }

    console.log(`\n✅ Deleted ${totalDeleted} duplicate entries\n`);

    // STEP 5: CALCULATE BALANCE TRACKING
    console.log('💰 STEP 5: Calculating balance tracking...');

    const users = db.prepare(`
      SELECT DISTINCT userId FROM overtime_transactions ORDER BY userId
    `).all() as { userId: number }[];

    console.log(`Processing ${users.length} users...\n`);

    for (const { userId } of users) {
      const transactions = db.prepare(`
        SELECT * FROM overtime_transactions
        WHERE userId = ?
        ORDER BY date ASC, createdAt ASC, id ASC
      `).all(userId) as Transaction[];

      let runningBalance = 0;

      for (const tx of transactions) {
        const balanceBefore = runningBalance;
        const balanceAfter = runningBalance + tx.hours;

        db.prepare(`
          UPDATE overtime_transactions
          SET balanceBefore = ?, balanceAfter = ?
          WHERE id = ?
        `).run(balanceBefore, balanceAfter, tx.id);

        runningBalance = balanceAfter;
      }

      console.log(`  User ${userId}: ${transactions.length} transactions, final balance: ${runningBalance.toFixed(2)}h`);
    }

    console.log('\n✅ Balance tracking calculated for all transactions\n');

    // STEP 6: ADD UNIQUE INDEX
    console.log('🔒 STEP 6: Adding UNIQUE index...');

    try {
      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_transactions_unique
        ON overtime_transactions(userId, date, type, COALESCE(referenceType, ''), COALESCE(referenceId, -1))
      `).run();
      console.log('✅ UNIQUE index created (prevents future duplicates)\n');
    } catch (e) {
      console.log('⚠️  UNIQUE index already exists\n');
    }

    // STEP 7: VERIFICATION
    console.log('✅ STEP 7: Verification...\n');

    const userCounts = db.prepare(`
      SELECT
        userId,
        COUNT(*) as transactionCount,
        ROUND(SUM(hours), 2) as totalHours,
        ROUND(MAX(balanceAfter), 2) as finalBalance
      FROM overtime_transactions
      GROUP BY userId
      ORDER BY userId
    `).all() as Array<{
      userId: number;
      transactionCount: number;
      totalHours: number;
      finalBalance: number;
    }>;

    console.log('Transactions per user:');
    for (const user of userCounts) {
      console.log(`  User ${user.userId}: ${user.transactionCount} transactions, sum: ${user.totalHours}h, final balance: ${user.finalBalance}h`);
    }

    console.log('');

    console.log('Comparison with overtime_balance (Source of Truth):');

    for (const user of userCounts) {
      const overtimeBalance = db.prepare(`
        SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
        FROM overtime_balance
        WHERE userId = ?
      `).get(user.userId) as { balance: number };

      const match = Math.abs(user.finalBalance - overtimeBalance.balance) < 0.01;
      const icon = match ? '✅' : '❌';

      console.log(`  ${icon} User ${user.userId}: transactions=${user.finalBalance}h, overtime_balance=${overtimeBalance.balance.toFixed(2)}h ${match ? '(MATCH!)' : '(MISMATCH!)'}`);
    }

    console.log('\n🎉 Migration complete!\n');

    const schema = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='overtime_transactions'
    `).get() as { sql: string };

    console.log('New Schema:');
    console.log(schema.sql);
    console.log('');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    db.close();
  }
}

main();
