/**
 * Migration 011: Buchungstyp 'model_change' für Stundenwechsel (Phase 12, D5)
 *
 * PROBLEM: Ein Stundenwechsel (REQ-26/REQ-29) erzeugt genau eine Journalbuchung, die die
 * Differenz aus einer rückwirkenden Sollstunden-Neuberechnung abbildet (D4). Der heutige
 * CHECK-Constraint auf `overtime_transactions.type` kennt diesen Buchungstyp nicht — ein
 * INSERT mit `type = 'model_change'` würde mit einem CHECK-Fehler abgewiesen. Zusätzlich
 * verlangt D5 einen Bezug auf die auslösende Periode; dafür wird der bereits vorhandene
 * `referenceType`/`referenceId`-Mechanismus genutzt, nicht eine neue Spalte — der
 * `referenceType`-CHECK muss dafür `'work_period'` zulassen.
 *
 * LÖSUNG: Tabellen-Neubau nach dem wortgleichen Muster von Migration 006
 * (`006_add_time_entry_transaction_type.ts`) — SQLite kennt kein
 * `ALTER TABLE ... ADD CONSTRAINT`. Die 18 bereits erlaubten `type`-Werte werden
 * unverändert übernommen und um `'model_change'` ergänzt; der `referenceType`-CHECK wird
 * um `'work_period'` ergänzt.
 *
 * KORREKTUR (Code-Review Phase 12, CR-05): Diese Migration hat das `NULL` aus der IN-Liste
 * von Migration 006 zunächst mitkopiert. `'beliebig' IN ('a', NULL)` ergibt in SQL NULL und
 * nicht FALSE — ein CHECK schlägt aber nur bei FALSE fehl, der Constraint war dadurch
 * wirkungslos. Das `NULL` ist hier entfernt; Bestandsdatenbanken, in denen diese Migration
 * bereits gelaufen ist, korrigiert die Folgemigration 012 durch einen erneuten
 * Tabellen-Neubau.
 *
 * PARITY-PFLICHT: `server/src/database/schema.ts` (CREATE TABLE overtime_transactions)
 * bekommt in diesem Plan dieselben beiden Erweiterungen, damit eine frische Installation
 * und eine migrierte Bestandsdatenbank denselben Constraint tragen.
 *
 * SAFE: Preserves all existing data (Zeilenzahlvergleich vor DROP), fully reversible durch
 * eine künftige Migration mit der alten CHECK-Liste.
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export default {
  up(db: Database.Database): void {
    logger.info("🚀 Migration 011: Adding 'model_change' transaction type and 'work_period' reference type...");

    // Step 1: Zeilenzahl vor dem Neubau merken.
    const countBefore = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    logger.info(`📊 Current transactions: ${countBefore}`);

    // Step 2: Neue Tabelle mit erweiterten CHECK-Constraints anlegen.
    logger.info('📝 Creating new table with model_change type and work_period reference...');
    db.prepare(`
      CREATE TABLE overtime_transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN (
          'worked', 'time_entry', 'vacation_credit', 'sick_credit',
          'overtime_comp_credit', 'special_credit', 'unpaid_deduction',
          'holiday_credit', 'weekend_credit', 'carry_over', 'payout',
          'correction', 'initial_balance', 'year_end_balance',
          'earned', 'compensation', 'carryover', 'unpaid_adjustment',
          'model_change'
        )),
        hours REAL NOT NULL,
        description TEXT,
        referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system', 'work_period')),
        referenceId INTEGER,
        balanceBefore REAL,
        balanceAfter REAL,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();

    // Step 3: Bestehende Daten kopieren — balanceBefore/balanceAfter (Migration 005)
    // gehen beim Tabellen-Neubau sonst verloren.
    logger.info('📦 Copying existing transactions...');
    db.prepare(`
      INSERT INTO overtime_transactions_new
        (id, userId, date, type, hours, description, referenceType, referenceId,
         balanceBefore, balanceAfter, createdAt, createdBy)
      SELECT
        id, userId, date, type, hours, description, referenceType, referenceId,
        balanceBefore, balanceAfter, createdAt, createdBy
      FROM overtime_transactions
    `).run();

    const countAfter = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions_new
    `).get() as { count: number }).count;

    if (countBefore !== countAfter) {
      throw new Error(`❌ Data copy failed: ${countBefore} rows in source, ${countAfter} rows in target`);
    }

    logger.info(`✅ Copied ${countAfter} transactions successfully`);

    // Step 4: Alte Tabelle löschen.
    logger.info('🗑️  Dropping old table...');
    db.prepare(`DROP TABLE overtime_transactions`).run();

    // Step 5: Neue Tabelle umbenennen.
    logger.info('📝 Renaming new table...');
    db.prepare(`ALTER TABLE overtime_transactions_new RENAME TO overtime_transactions`).run();

    // Step 6: Indizes neu anlegen (wortgleich zu Migration 006).
    logger.info('🔍 Recreating indexes...');
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_userId ON overtime_transactions(userId)
    `).run();
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_date ON overtime_transactions(date)
    `).run();
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_type ON overtime_transactions(type)
    `).run();

    // Step 7: Endzustand protokollieren.
    const finalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    logger.info('');
    logger.info('================================================================================');
    logger.info('✅ MIGRATION 011 COMPLETED');
    logger.info('================================================================================');
    logger.info(`Total transactions migrated: ${finalCount}`);
    logger.info("NEW allowed type value: 'model_change' (Stundenwechsel-Differenzbuchung, D4/D5)");
    logger.info("NEW allowed referenceType value: 'work_period' (Bezug auf die auslösende Periode, D5)");
    logger.info('================================================================================');
    logger.info('');
  },
};
