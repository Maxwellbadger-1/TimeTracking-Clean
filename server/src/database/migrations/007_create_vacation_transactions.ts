/**
 * Migration 007: Create vacation_transactions (Urlaubs-Journal)
 *
 * PROBLEM: `vacation_balance.taken` ist ein handgepflegter Zähler ohne Historie. Jede
 * vergessene Gegenbuchung erzeugt eine stille Differenz, die niemand sehen kann.
 *
 * Konkret passiert am 18.08.2026: Das Ablehnen eines bereits genehmigten Urlaubsantrags
 * buchte die Tage nie zurück. 16 Urlaubstage gingen bei zwei Mitarbeitern verloren, drei
 * Monate lang unbemerkt — der Fehler fiel nur auf, weil ein Saldo zufällig negativ wurde.
 * Bei einem zweiten Mitarbeiter war er doppelt so groß, blieb positiv und damit unsichtbar.
 *
 * LÖSUNG: Ein Journal nach dem Vorbild von `overtime_transactions`. Jede Bewegung wird zu
 * einer Buchungszeile, der Saldo ist deren Summe. Eine Abweichung kann damit strukturell
 * nicht mehr entstehen — eine vergessene Gegenbuchung ist keine stille Differenz mehr,
 * sondern eine fehlende Zeile.
 *
 * VORZEICHEN: positive `days` = Gutschrift auf den verfügbaren Urlaub,
 *             negative `days` = Verbrauch.
 * Jahresanspruch bucht positiv, genehmigter Urlaub negativ, ein Storno wieder positiv.
 *
 * SCOPE: Diese Migration legt nur die Tabelle an. Es wird noch nichts gebucht und kein
 * bestehendes Verhalten geändert — das passiert in Phase 6.
 *
 * SAFE: Reines CREATE TABLE IF NOT EXISTS, keine bestehende Tabelle wird angefasst.
 *
 * Analyse: .planning/debug/urlaubstage-bei-ablehnung-verloren.md
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

/** Spalten, die nach dieser Migration existieren müssen (Selbstverifikation unten). */
const EXPECTED_COLUMNS = [
  'id',
  'userId',
  'year',
  'date',
  'type',
  'days',
  'description',
  'referenceType',
  'referenceId',
  'balanceBefore',
  'balanceAfter',
  'createdAt',
  'createdBy',
];

export default {
  async up(db: Database.Database) {
    logger.info('🚀 Migration 007: Creating vacation_transactions (Urlaubs-Journal)...');

    // Step 1: Journal-Tabelle anlegen
    //
    // Buchungstypen:
    //   entitlement       Jahresanspruch (positiv)
    //   carryover         Übertrag aus dem Vorjahr (positiv)
    //   vacation_taken    genehmigter Urlaub (negativ)
    //   vacation_reverted Storno einer Genehmigung (positiv)
    //   correction        manuelle Admin-Korrektur (beide Richtungen)
    //   expiry            Verfall nicht genommener Tage (negativ)
    //
    // vacation_taken und vacation_reverted sind bewusst getrennt statt ein Typ mit
    // Vorzeichen: Genau das Fehlen der Gegenbuchung war die Ursache, und im Journal
    // soll ein Storno als eigener Vorgang sichtbar sein, nicht als Vorzeichenwechsel.
    logger.info('📝 Creating table vacation_transactions...');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS vacation_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        year INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN (
          'entitlement',
          'carryover',
          'vacation_taken',
          'vacation_reverted',
          'correction',
          'expiry'
        )),
        days REAL NOT NULL,
        description TEXT,
        referenceType TEXT CHECK(referenceType IN ('absence', 'manual', 'system', NULL)),
        referenceId INTEGER,
        balanceBefore REAL,
        balanceAfter REAL,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();

    // Step 2: Spalten verifizieren — VOR dem Anlegen der Indizes
    //
    // Lehre aus Migration 003: Die steht in der Produktionsdatenbank als angewendet, ihre
    // Spalte `pending` existiert dort aber nicht. Eine als erledigt markierte Migration
    // läuft nie wieder an — der Fehler war damit dauerhaft. Diese Migration prüft ihr
    // eigenes Ergebnis und wirft, damit der migrationRunner sie nicht als erledigt bucht.
    //
    // Die Prüfung steht bewusst vor der Index-Erstellung: Existiert bereits eine
    // unvollständige Tabelle, greift `CREATE TABLE IF NOT EXISTS` nicht. Dann würde der
    // Index-Aufbau zwar ebenfalls scheitern, aber nur mit "no such column: year" — diese
    // Prüfung nennt stattdessen alle fehlenden Spalten beim Namen.
    const columns = db
      .prepare(`PRAGMA table_info(vacation_transactions)`)
      .all() as Array<{ name: string }>;

    if (columns.length === 0) {
      throw new Error(
        'Migration 007 fehlgeschlagen: Tabelle vacation_transactions existiert nach dem ' +
        'CREATE nicht. Migration wird NICHT als angewendet markiert.'
      );
    }

    const missing = EXPECTED_COLUMNS.filter(
      (expected) => !columns.some((c) => c.name === expected)
    );

    if (missing.length > 0) {
      throw new Error(
        `Migration 007 unvollständig: fehlende Spalten in vacation_transactions: ` +
        `${missing.join(', ')}. Vermutlich existierte bereits eine abweichende Tabelle. ` +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    // Step 3: Indizes für die tatsächlichen Lesepfade
    //   - Kontoauszug eines Mitarbeiters für ein Jahr
    //   - alle Buchungen zu einem Abwesenheitsantrag (Konsistenzprüfer, Verlinkung)
    logger.info('📝 Creating indexes...');
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_vacation_tx_user_year
      ON vacation_transactions(userId, year)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_vacation_tx_reference
      ON vacation_transactions(referenceType, referenceId)
    `).run();

    // Step 4: Indizes verifizieren
    const indexes = db
      .prepare(`PRAGMA index_list(vacation_transactions)`)
      .all() as Array<{ name: string }>;

    const missingIndexes = ['idx_vacation_tx_user_year', 'idx_vacation_tx_reference'].filter(
      (expected) => !indexes.some((i) => i.name === expected)
    );

    if (missingIndexes.length > 0) {
      throw new Error(
        `Migration 007 unvollständig: fehlende Indizes: ${missingIndexes.join(', ')}. ` +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    const rowCount = (db
      .prepare(`SELECT COUNT(*) as count FROM vacation_transactions`)
      .get() as { count: number }).count;

    logger.info(
      { columns: columns.length, indexes: indexes.length, rows: rowCount },
      '✅ Migration 007 verified: vacation_transactions ready'
    );
  },
};
