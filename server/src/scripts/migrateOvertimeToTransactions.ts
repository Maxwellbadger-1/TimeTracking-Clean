/**
 * Migration Script: Migrate existing overtime data to transaction system
 *
 * PURPOSE:
 * - Migrates historical time entries to overtime_transactions
 * - Recalculates all daily overtime (Soll/Ist differences)
 * - Creates transaction records for all past dates
 * - Handles holidays, work schedules, and hire dates correctly
 *
 * SAFE TO RUN MULTIPLE TIMES:
 * - Deletes existing 'earned' transactions before recreating
 * - Does NOT touch 'compensation', 'correction', or 'carryover' transactions
 *
 * USAGE:
 *   npm run migrate:overtime
 *
 * PRODUKTIONSSCHUTZ (Plan 11-08, T-11-27): Dieses Skript SCHREIBT Überstundentransaktionen
 * und importierte zuvor `db`, `getDailyTargetHours`, `getUserById` statisch — auf Produktion
 * (`NODE_ENV=production`, kein `DATABASE_PATH` gesetzt) hätte das die Produktionsdatenbank
 * beim `import` bereits geöffnet, vor jeder Prüfung. Muster wie
 * `validateOvertimeDetailed.ts`/`reproduceOvertimeCompDefect.ts`: nur import-sichere Module
 * oben, Guard synchron auf Modulebene, alle DB-berührenden Module per `await import(...)` in
 * `ensureDependencies()`, aufgerufen am Kopf jeder exportierten Funktion.
 */

import path from 'path';
import { getDatabasePath, getProductionDatabasePath } from '../config/database.js';
import type BetterSqlite3 from 'better-sqlite3';
import type { UserPublic } from '../types/index.js';
import type { WorkPeriodContext } from '../services/workPeriodContext.js';

function assertNotProduction(): void {
  const resolvedPath = path.resolve(getDatabasePath());
  const productionPath = path.resolve(getProductionDatabasePath());
  const nodeEnv = process.env.NODE_ENV;

  const looksLikeProduction =
    resolvedPath === productionPath ||
    nodeEnv === 'production' ||
    resolvedPath.toLowerCase().includes('production');

  if (looksLikeProduction) {
    console.error('FEHLER: Produktionsschreibzugriff verweigert (D5, 09-CONTEXT.md; T-11-27, 11-08-PLAN.md).');
    console.error(`  Aufgelöster Datenbankpfad: ${resolvedPath}`);
    console.error(`  NODE_ENV: ${nodeEnv ?? '(nicht gesetzt)'}`);
    console.error('  Setze DATABASE_PATH auf eine lokale Entwicklungskopie, z. B. ./database/development.db');
    process.exit(2);
  }
}

assertNotProduction();

// Dynamisch befüllt über ensureDependencies(), erst nach dem Guard oben (siehe Begründung).
let db: BetterSqlite3.Database;
let logger: typeof import('../utils/logger.js').default;
let getDailyTargetHours: typeof import('../utils/workingDays.js').getDailyTargetHours;
let getUserById: (id: number) => UserPublic | undefined;
let createWorkPeriodContext: () => WorkPeriodContext;
let recordOvertimeEarned: typeof import('../services/overtimeTransactionService.js').recordOvertimeEarned;
let deleteEarnedTransactionsForDate: typeof import('../services/overtimeTransactionService.js').deleteEarnedTransactionsForDate;
// CR-06: Die Fehlerklasse muss hier bekannt sein, damit der Tagesschleifen-catch sie von
// einem gewöhnlichen Fehler unterscheiden kann. Sie kommt aus demselben dynamischen
// Import wie getDailyTargetHours — kein zusätzlicher statischer Import vor dem Guard.
let MissingWorkPeriodError: typeof import('../utils/workingDays.js').MissingWorkPeriodError;
let dependenciesLoaded = false;

async function ensureDependencies(): Promise<void> {
  if (dependenciesLoaded) return;
  const [
    { db: sharedDb },
    { default: sharedLogger },
    { getDailyTargetHours: sharedGetDailyTargetHours, MissingWorkPeriodError: sharedMissingWorkPeriodError },
    { getUserById: sharedGetUserById },
    { createWorkPeriodContext: sharedCreateWorkPeriodContext },
    { recordOvertimeEarned: sharedRecordOvertimeEarned, deleteEarnedTransactionsForDate: sharedDeleteEarnedTransactionsForDate },
  ] = await Promise.all([
    import('../database/connection.js'),
    import('../utils/logger.js'),
    import('../utils/workingDays.js'),
    import('../services/userService.js'),
    import('../services/workPeriodContext.js'),
    import('../services/overtimeTransactionService.js'),
  ]);
  db = sharedDb;
  logger = sharedLogger;
  getDailyTargetHours = sharedGetDailyTargetHours;
  MissingWorkPeriodError = sharedMissingWorkPeriodError;
  getUserById = sharedGetUserById;
  createWorkPeriodContext = sharedCreateWorkPeriodContext;
  recordOvertimeEarned = sharedRecordOvertimeEarned;
  deleteEarnedTransactionsForDate = sharedDeleteEarnedTransactionsForDate;
  dependenciesLoaded = true;
}

interface MigrationStats {
  totalUsers: number;
  totalDates: number;
  totalTransactions: number;
  errors: string[];
}

/**
 * Main migration function
 */
export async function migrateOvertimeToTransactions(): Promise<MigrationStats> {
  await ensureDependencies();
  logger.info('🚀🚀🚀 STARTING OVERTIME MIGRATION 🚀🚀🚀');

  const stats: MigrationStats = {
    totalUsers: 0,
    totalDates: 0,
    totalTransactions: 0,
    errors: [],
  };

  try {
    // Get all active users
    const users = db.prepare(`
      SELECT id, hireDate
      FROM users
      WHERE deletedAt IS NULL
      ORDER BY id
    `).all() as Array<{ id: number; hireDate: string }>;

    logger.info({ count: users.length }, `📋 Found ${users.length} active users`);
    stats.totalUsers = users.length;

    // Process each user
    for (const user of users) {
      try {
        logger.info({ userId: user.id }, `👤 Processing user ${user.id}...`);

        const userStats = await migrateUserOvertimeTransactions(user.id, user.hireDate);

        stats.totalDates += userStats.totalDates;
        stats.totalTransactions += userStats.totalTransactions;

        logger.info(
          {
            userId: user.id,
            dates: userStats.totalDates,
            transactions: userStats.totalTransactions,
          },
          `✅ User ${user.id}: ${userStats.totalTransactions} transactions from ${userStats.totalDates} dates`
        );
      } catch (error) {
        // CR-06: Der Datendefekt aus der Tagesschleife darf hier nicht erneut zu einer
        // Zeile in stats.errors werden — sonst liefe die Migration über die restlichen
        // Nutzer weiter und meldete am Ende trotzdem einen Abschluss.
        if (error instanceof MissingWorkPeriodError) {
          throw error;
        }
        const errorMsg = `User ${user.id}: ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(errorMsg);
        logger.error({ error, userId: user.id }, `❌ Failed to migrate user ${user.id}`);
      }
    }

    logger.info(
      {
        users: stats.totalUsers,
        dates: stats.totalDates,
        transactions: stats.totalTransactions,
        errors: stats.errors.length,
      },
      '🎉🎉🎉 MIGRATION COMPLETED 🎉🎉🎉'
    );
  } catch (error) {
    logger.error({ error }, '❌❌❌ MIGRATION FAILED ❌❌❌');
    throw error;
  }

  return stats;
}

/**
 * Migrate overtime transactions for a single user
 */
async function migrateUserOvertimeTransactions(
  userId: number,
  hireDate: string
): Promise<{ totalDates: number; totalTransactions: number }> {
  // Get full user object with workSchedule
  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // REQ-25 (Plan 11-08): EIN Kontext je Nutzer-Migrationslauf, nicht je Tag (s.
  // 11-08-PLAN.md, Task 2) — die Tagesschleife unten benutzt denselben Kontext für jeden
  // Tag dieses Nutzers.
  const periods = createWorkPeriodContext();

  // Get all unique dates with time entries
  const dates = db.prepare(`
    SELECT DISTINCT date
    FROM time_entries
    WHERE userId = ?
      AND date >= ?
    ORDER BY date ASC
  `).all(userId, hireDate) as Array<{ date: string }>;

  logger.debug({ userId, datesCount: dates.length }, `Found ${dates.length} dates with time entries`);

  let transactionsCreated = 0;

  // Process each date
  for (const { date } of dates) {
    try {
      // CR-06: ERST RECHNEN, DANN LÖSCHEN.
      //
      // Vorher stand `deleteEarnedTransactionsForDate()` VOR `getDailyTargetHours()`. Seit D4
      // kann die Sollstundenberechnung `MissingWorkPeriodError` werfen; der catch unten
      // schluckte den Fehler und machte mit dem nächsten Datum weiter — die Löschung war da
      // aber schon geschehen und wurde nicht zurückgenommen. Das Skript hinterließ für jeden
      // betroffenen Tag KEINE `earned`-Buchung, wo vorher eine stand, und meldete trotzdem
      // "MIGRATION COMPLETED".
      //
      // Jetzt: alle Werte ermitteln, bevor irgendetwas gelöscht wird. Wirft die Berechnung,
      // ist noch nichts angefasst.
      const targetHours = getDailyTargetHours(user, date, periods);

      // Calculate actual hours
      const actualHours = db.prepare(`
        SELECT COALESCE(SUM(hours), 0) as total
        FROM time_entries
        WHERE userId = ? AND date = ?
      `).get(userId, date) as { total: number };

      // Calculate overtime
      const overtime = actualHours.total - targetHours;

      // Löschen und Neuschreiben in EINER Transaktion: entweder beides oder keins. Ohne die
      // Klammer könnte ein Fehler beim Schreiben eine leere Stelle hinterlassen.
      const applyDate = db.transaction(() => {
        // Delete existing earned transactions for this date (safe to re-run)
        deleteEarnedTransactionsForDate(userId, date);

        // Record transaction (if not 0)
        if (overtime !== 0) {
          recordOvertimeEarned(userId, date, overtime, `Migration: Differenz Soll/Ist ${date}`);
          return true;
        }
        return false;
      });

      if (applyDate()) {
        transactionsCreated++;
      }

      logger.debug({
        userId,
        date,
        targetHours,
        actualHours: actualHours.total,
        overtime,
      }, `Processed date ${date}: ${overtime > 0 ? '+' : ''}${overtime}h`);
    } catch (error) {
      // CR-06: Ein `MissingWorkPeriodError` ist per D4 ausdrücklich ein DATENDEFEKT und kein
      // Zustand, über den man hinweggehen darf. Ihn zu einer Warnzeile zu degradieren wäre
      // genau der stille Rückfall, den D4 verbietet — der Lauf bricht ab.
      if (error instanceof MissingWorkPeriodError) {
        logger.error(
          { error, userId, date },
          `❌ Datendefekt: keine Arbeitszeitperiode für Nutzer ${userId} am ${date} — Migration abgebrochen (D4)`
        );
        throw error;
      }
      logger.warn({ error, userId, date }, `⚠️ Failed to process date ${date}`);
      // Continue with next date
    }
  }

  return {
    totalDates: dates.length,
    totalTransactions: transactionsCreated,
  };
}

/**
 * Verify migration results
 */
export async function verifyMigration(): Promise<{
  success: boolean;
  issues: string[];
}> {
  await ensureDependencies();
  logger.info('🔍 VERIFYING MIGRATION...');

  const issues: string[] = [];

  try {
    // Check: All users have transactions
    const usersWithoutTransactions = db.prepare(`
      SELECT u.id, u.firstName, u.lastName
      FROM users u
      WHERE u.deletedAt IS NULL
        AND u.id NOT IN (
          SELECT DISTINCT userId FROM overtime_transactions
        )
        AND EXISTS (
          SELECT 1 FROM time_entries WHERE userId = u.id
        )
    `).all() as Array<{ id: number; firstName: string; lastName: string }>;

    if (usersWithoutTransactions.length > 0) {
      issues.push(
        `${usersWithoutTransactions.length} users with time entries but no transactions: ` +
        usersWithoutTransactions.map(u => `${u.firstName} ${u.lastName} (ID: ${u.id})`).join(', ')
      );
    }

    // Check: Transaction counts match time entry counts
    const mismatchedCounts = db.prepare(`
      SELECT
        u.id,
        u.firstName,
        u.lastName,
        COUNT(DISTINCT te.date) as timeEntryDates,
        COUNT(DISTINCT ot.date) as transactionDates
      FROM users u
      INNER JOIN time_entries te ON u.id = te.userId
      LEFT JOIN overtime_transactions ot ON u.id = ot.userId AND ot.type = 'earned'
      WHERE u.deletedAt IS NULL
      GROUP BY u.id
      HAVING timeEntryDates != transactionDates
    `).all() as Array<{
      id: number;
      firstName: string;
      lastName: string;
      timeEntryDates: number;
      transactionDates: number;
    }>;

    if (mismatchedCounts.length > 0) {
      issues.push(
        `${mismatchedCounts.length} users with mismatched counts: ` +
        mismatchedCounts.map(u =>
          `${u.firstName} ${u.lastName}: ${u.timeEntryDates} time entries vs ${u.transactionDates} transactions`
        ).join(', ')
      );
    }

    if (issues.length === 0) {
      logger.info('✅ Migration verification PASSED');
      return { success: true, issues: [] };
    } else {
      logger.warn({ issues }, '⚠️ Migration verification found issues');
      return { success: false, issues };
    }
  } catch (error) {
    logger.error({ error }, '❌ Migration verification FAILED');
    return {
      success: false,
      issues: [`Verification error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateOvertimeToTransactions()
    .then(async (stats) => {
      console.log('\n📊 MIGRATION STATS:');
      console.log(`  Users: ${stats.totalUsers}`);
      console.log(`  Dates: ${stats.totalDates}`);
      console.log(`  Transactions: ${stats.totalTransactions}`);
      console.log(`  Errors: ${stats.errors.length}`);

      if (stats.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        stats.errors.forEach(err => console.log(`  - ${err}`));
      }

      // Verify
      console.log('\n🔍 Running verification...');
      const verification = await verifyMigration();

      if (verification.success) {
        console.log('\n✅✅✅ MIGRATION SUCCESSFUL ✅✅✅');
        process.exit(0);
      } else {
        console.log('\n⚠️⚠️⚠️ MIGRATION COMPLETED WITH ISSUES ⚠️⚠️⚠️');
        verification.issues.forEach(issue => console.log(`  - ${issue}`));
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌❌❌ MIGRATION FAILED ❌❌❌');
      console.error(error);
      process.exit(1);
    });
}
