/**
 * Migration 012: Den wirkungslosen `referenceType`-CHECK aus 006/011 reparieren
 * (Code-Review Phase 12, CR-05)
 *
 * PROBLEM (SQL-Dreiwertlogik):
 * Migration 006 und Migration 011 haben den Constraint in dieser Form angelegt:
 *
 *   referenceType TEXT CHECK(referenceType IN ('time_entry','absence','manual','system','work_period', NULL))
 *
 * `'beliebig' IN ('a', NULL)` ergibt in SQL **NULL**, nicht FALSE. Ein CHECK-Constraint
 * schlaegt aber ausschliesslich bei FALSE fehl. Das `NULL` in der IN-Liste hebt die Pruefung
 * damit vollstaendig auf: jede migrierte Bestandsdatenbank (also die Produktion) akzeptiert
 * JEDEN beliebigen `referenceType`-Wert. Das `NULL` ist dort zusaetzlich funktional
 * ueberfluessig — ein NULL-Wert besteht den CHECK ohnehin (SQLite wertet den Constraint dann
 * zu NULL aus und laesst die Zeile durch), wie die Fassung in `schema.ts` seit jeher zeigt.
 *
 * FOLGE: Eine frische Installation (schema.ts, ohne `NULL` in der Liste) und eine migrierte
 * Bestandsdatenbank verhielten sich unterschiedlich — genau die Divergenz, die der
 * Kopfkommentar von Migration 011 unter "PARITY-PFLICHT" zu verhindern versprach. Ein
 * Schreibfehler im Referenztyp faellt lokal auf und in Produktion nicht.
 *
 * LOESUNG: Tabellen-Neubau nach dem wortgleichen Muster von Migration 006/011 — SQLite kennt
 * kein `ALTER TABLE ... DROP/ADD CONSTRAINT`. Die `type`-Liste bleibt unveraendert (inklusive
 * `'model_change'` aus Migration 011); nur die `referenceType`-Liste verliert ihr `NULL`.
 * Damit tragen `schema.ts` und der Migrationspfad danach denselben Constraint. Migration 006
 * wird dadurch mitgezogen — eine Datenbank, die nur bis 006 migriert war, bekommt hier
 * ebenfalls den korrekten Constraint (die `type`-Liste dieser Migration ist eine echte
 * Obermenge der Liste aus 006).
 *
 * BESTANDSDATEN: Weil der alte Constraint wirkungslos war, KANN eine Bestandsdatenbank
 * Zeilen mit einem unzulaessigen `referenceType` enthalten. Solche Zeilen wuerden den
 * Kopiervorgang mit einem CHECK-Fehler abbrechen und damit den Serverstart verhindern.
 * Schritt 2 erhebt sie deshalb vorab, protokolliert sie vollstaendig (Wert + Anzahl) und
 * setzt sie auf NULL — der Referenzbezug war ohnehin nicht auswertbar, die Buchungszeile
 * selbst bleibt unveraendert erhalten. Im Regelfall ist diese Menge leer.
 *
 * SAFE: Preserves all existing data (Zeilenzahlvergleich vor DROP), reversibel durch eine
 * kuenftige Migration mit der alten CHECK-Liste.
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

/** Die einzigen zulaessigen Referenztypen — wortgleich zu `schema.ts`. */
const ALLOWED_REFERENCE_TYPES = ['time_entry', 'absence', 'manual', 'system', 'work_period'];

export default {
  up(db: Database.Database): void {
    logger.info('Migration 012: Repariert den wirkungslosen referenceType-CHECK (CR-05)');

    // Step 1: Zeilenzahl vor dem Neubau merken.
    const countBefore = (db.prepare(`
      SELECT COUNT(*) as count FROM overtime_transactions
    `).get() as { count: number }).count;

    logger.info(`Migration 012: ${countBefore} Buchungszeilen vorhanden`);

    // Step 2: Zeilen mit unzulaessigem referenceType erheben und neutralisieren.
    const placeholders = ALLOWED_REFERENCE_TYPES.map(() => '?').join(', ');
    const offenders = db.prepare(`
      SELECT referenceType, COUNT(*) as count
      FROM overtime_transactions
      WHERE referenceType IS NOT NULL
        AND referenceType NOT IN (${placeholders})
      GROUP BY referenceType
    `).all(...ALLOWED_REFERENCE_TYPES) as Array<{ referenceType: string; count: number }>;

    if (offenders.length > 0) {
      logger.warn(
        { offenders },
        'Migration 012: unzulaessige referenceType-Werte gefunden (der alte CHECK war ' +
        'wirkungslos) — sie werden auf NULL gesetzt, die Buchungszeilen selbst bleiben erhalten'
      );
      db.prepare(`
        UPDATE overtime_transactions
        SET referenceType = NULL
        WHERE referenceType IS NOT NULL
          AND referenceType NOT IN (${placeholders})
      `).run(...ALLOWED_REFERENCE_TYPES);
    }

    // Step 3: Neue Tabelle mit dem korrekten Constraint anlegen (kein NULL in der IN-Liste).
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

    // Step 4: Bestehende Daten kopieren.
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
      throw new Error(
        `Migration 012: Datenkopie fehlgeschlagen — ${countBefore} Zeilen in der Quelle, ` +
        `${countAfter} Zeilen im Ziel`
      );
    }

    // Step 5: Alte Tabelle ersetzen.
    db.prepare(`DROP TABLE overtime_transactions`).run();
    db.prepare(`ALTER TABLE overtime_transactions_new RENAME TO overtime_transactions`).run();

    // Step 6: Indizes neu anlegen (wortgleich zu Migration 011).
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_userId ON overtime_transactions(userId)
    `).run();
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_date ON overtime_transactions(date)
    `).run();
    db.prepare(`
      CREATE INDEX idx_overtime_transactions_type ON overtime_transactions(type)
    `).run();

    logger.info(
      { migratedRows: countAfter, normalizedReferenceTypes: offenders.length },
      'Migration 012 abgeschlossen: referenceType-CHECK ist jetzt wirksam und identisch zu schema.ts'
    );
  },
};
