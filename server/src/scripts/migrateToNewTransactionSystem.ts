/**
 * ONE-TIME MIGRATION SCRIPT: Migrate to New Transaction System
 *
 * WHAT IT DOES:
 * - Rebuilds ALL overtime_transactions from scratch using new rebuild service
 * - Ensures balance tracking (balanceBefore/balanceAfter) is correct
 * - Verifies consistency between overtime_transactions and overtime_balance
 *
 * SAFETY:
 * - Dry-run mode available (--dry-run flag)
 * - Creates backup before migration
 * - Validates all users after migration
 * - Rollback instructions provided
 *
 * USAGE:
 *   npm run migrate:new-transaction-system           # Run migration
 *   npm run migrate:new-transaction-system --dry-run # Test without changes
 *   npm run migrate:new-transaction-system --user=5  # Migrate single user
 */

import Database from 'better-sqlite3';
import { db } from '../database/connection.js';
import { rebuildOvertimeTransactionsForMonth } from '../services/overtimeTransactionRebuildService.js';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  endDate: string | null;
}

interface MigrationResult {
  userId: number;
  email: string;
  monthsMigrated: number;
  transactionsBefore: number;
  transactionsAfter: number;
  balanceTransactions: number;
  balanceOvertimeBalance: number;
  consistent: boolean;
  error: string | null;
}

function parseArgs(): { dryRun: boolean; userId: number | null } {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const userArg = args.find(arg => arg.startsWith('--user='));
  const userId = userArg ? parseInt(userArg.split('=')[1], 10) : null;

  return { dryRun, userId };
}

function main() {
  console.log('🚀 Starting Migration to New Transaction System\n');

  const { dryRun, userId: singleUserId } = parseArgs();

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // STEP 1: Create backup
    if (!dryRun) {
      console.log('📦 STEP 1: Creating backup...');
      const timestamp = Date.now();
      const backupTableName = `overtime_transactions_migration_backup_${timestamp}`;

      db.prepare(`DROP TABLE IF EXISTS ${backupTableName}`).run();
      db.prepare(`CREATE TABLE ${backupTableName} AS SELECT * FROM overtime_transactions`).run();

      console.log(`✅ Backup created: ${backupTableName}\n`);
    } else {
      console.log('📦 STEP 1: Skipping backup (dry-run mode)\n');
    }

    // STEP 2: Get users to migrate
    console.log('👥 STEP 2: Loading users...');

    const users = singleUserId
      ? db.prepare(`SELECT id, email, firstName, lastName, hireDate, endDate FROM users WHERE id = ?`).all(singleUserId) as User[]
      : db.prepare(`SELECT id, email, firstName, lastName, hireDate, endDate FROM users WHERE id > 1 ORDER BY id`).all() as User[];

    console.log(`Found ${users.length} user(s) to migrate\n`);

    if (users.length === 0) {
      console.log('❌ No users found!');
      return;
    }

    // STEP 3: Migrate each user
    console.log('🔄 STEP 3: Migrating users...\n');

    const results: MigrationResult[] = [];

    for (const user of users) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`👤 User ${user.id}: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        const result = migrateUser(db, user, dryRun);
        results.push(result);

        // Print result
        console.log(`\n📊 Migration Result:`);
        console.log(`  Months migrated: ${result.monthsMigrated}`);
        console.log(`  Transactions before: ${result.transactionsBefore}`);
        console.log(`  Transactions after: ${result.transactionsAfter}`);
        console.log(`  Balance (transactions): ${result.balanceTransactions}h`);
        console.log(`  Balance (overtime_balance): ${result.balanceOvertimeBalance}h`);
        console.log(`  Consistent: ${result.consistent ? '✅ YES' : '❌ NO'}`);

        if (!result.consistent) {
          console.log(`  ⚠️  WARNING: Inconsistency detected!`);
        }
      } catch (error: any) {
        console.error(`❌ Error migrating user ${user.id}:`, error.message);
        results.push({
          userId: user.id,
          email: user.email,
          monthsMigrated: 0,
          transactionsBefore: 0,
          transactionsAfter: 0,
          balanceTransactions: 0,
          balanceOvertimeBalance: 0,
          consistent: false,
          error: error.message
        });
      }
    }

    // STEP 4: Summary
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📊 MIGRATION SUMMARY');
    console.log(`${'='.repeat(60)}\n`);

    console.log(`Total users: ${results.length}`);
    console.log(`Successful: ${results.filter(r => !r.error).length}`);
    console.log(`Failed: ${results.filter(r => r.error).length}`);
    console.log(`Consistent: ${results.filter(r => r.consistent).length}`);
    console.log(`Inconsistent: ${results.filter(r => !r.consistent && !r.error).length}\n`);

    // Print detailed table
    console.log('Detailed Results:');
    console.log('-'.repeat(120));
    console.log('User | Email                    | Months | Tx Before | Tx After | Bal (Tx) | Bal (OB) | Match');
    console.log('-'.repeat(120));

    for (const result of results) {
      const match = result.consistent ? '✅' : '❌';
      console.log(
        `${String(result.userId).padEnd(4)} | ` +
        `${(result.email || 'N/A').padEnd(24)} | ` +
        `${String(result.monthsMigrated).padEnd(6)} | ` +
        `${String(result.transactionsBefore).padEnd(9)} | ` +
        `${String(result.transactionsAfter).padEnd(8)} | ` +
        `${String(result.balanceTransactions).padEnd(8)} | ` +
        `${String(result.balanceOvertimeBalance).padEnd(8)} | ` +
        `${match}`
      );
    }

    console.log('-'.repeat(120));

    // Final verdict
    const allConsistent = results.every(r => r.consistent);

    if (allConsistent) {
      console.log('\n✅ Migration successful! All users are consistent.\n');
    } else {
      console.log('\n⚠️  Migration completed with warnings. Please review inconsistencies.\n');
    }

    if (dryRun) {
      console.log('ℹ️  This was a dry run. No changes were made to the database.');
      console.log('To run the actual migration, remove the --dry-run flag.\n');
    } else {
      console.log('🎉 Migration complete! New transaction system is now active.\n');
      console.log('Rollback instructions:');
      console.log('  1. Find backup table: overtime_transactions_migration_backup_*');
      console.log('  2. Restore: DROP TABLE overtime_transactions; ALTER TABLE overtime_transactions_migration_backup_* RENAME TO overtime_transactions;');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

// IMPORTANT: Don't close global db connection - it's shared!

function migrateUser(db: Database.Database, user: User, dryRun: boolean): MigrationResult {
  // Count transactions before
  const transactionsBefore = db.prepare(`
    SELECT COUNT(*) as count FROM overtime_transactions WHERE userId = ?
  `).get(user.id) as { count: number };

  // Get all months since hire date
  const months = getMonthsSinceHireDate(user.hireDate);

  console.log(`  Migrating ${months.length} month(s): ${months.join(', ')}`);

  if (!dryRun) {
    // Rebuild transactions for each month
    for (const month of months) {
      rebuildOvertimeTransactionsForMonth(user.id, month);
      console.log(`    ✅ ${month}`);
    }
  } else {
    console.log(`    ℹ️  Dry-run: Would rebuild ${months.length} months`);
  }

  // Count transactions after
  const transactionsAfter = dryRun
    ? transactionsBefore.count
    : (db.prepare(`SELECT COUNT(*) as count FROM overtime_transactions WHERE userId = ?`).get(user.id) as { count: number }).count;

  // Get balance from transactions (LATEST balance, not MAX!)
  const balanceFromTransactions = dryRun
    ? 0
    : (db.prepare(`
        SELECT COALESCE(balanceAfter, 0) as balance
        FROM overtime_transactions
        WHERE userId = ?
        ORDER BY date DESC, id DESC
        LIMIT 1
      `).get(user.id) as { balance: number }).balance;

  // Get balance from overtime_balance
  const balanceFromOvertimeBalance = (db.prepare(`
    SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
    FROM overtime_balance
    WHERE userId = ?
  `).get(user.id) as { balance: number }).balance;

  // Check consistency
  const consistent = dryRun || Math.abs(balanceFromTransactions - balanceFromOvertimeBalance) < 0.01;

  return {
    userId: user.id,
    email: user.email,
    monthsMigrated: months.length,
    transactionsBefore: transactionsBefore.count,
    transactionsAfter: transactionsAfter,
    balanceTransactions: Math.round(balanceFromTransactions * 100) / 100,
    balanceOvertimeBalance: Math.round(balanceFromOvertimeBalance * 100) / 100,
    consistent,
    error: null
  };
}

function getMonthsSinceHireDate(hireDate: string): string[] {
  const months: string[] = [];

  const start = new Date(hireDate);
  const today = new Date();

  // Generate all months from hire date to today
  for (let d = new Date(start); d <= today; d.setMonth(d.getMonth() + 1)) {
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(month);
  }

  return months;
}

// Run if called directly
main();
