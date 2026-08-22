/**
 * Migration 013: Soft-Delete-Fundament auf user_work_periods (D2/D3, 13-CONTEXT.md;
 * 13-01-PLAN.md, Task 1)
 *
 * PROBLEM: `user_work_periods` hat keine `deletedAt`-Spalte. D2 verlangt aber genau das
 * Gegenteil eines echten `DELETE`: Eine Periode muss per Soft-Delete weggenommen werden
 * koennen (Projektregel, CLAUDE.md "Soft Delete"), ohne dass die Trigger aus Migration 008
 * die weggenommene Periode weiter mitzaehlen (D3) und ohne dass sie fuer immer das erneute
 * Anlegen einer Periode mit demselben `validFrom` blockiert (der Regelfall dieser Phase:
 * falsche Umstellung loeschen, richtige neu eintragen).
 *
 * LOESUNG (DD-1): Tabellen-Neubau nach der wortgleichen Technik aus Migration 012
 * (Zeilenzahlvergleich vor dem Kopieren, DROP/RENAME, Indizes neu anlegen — SQLite kennt
 * kein DROP CONSTRAINT, das erzwingt den Neubau fuer Punkt 2 unten). Vier Aenderungen:
 *   1. neue Spalten `deletedAt TEXT` und `deletedBy INTEGER`
 *   2. die Tabellenbedingung `UNIQUE(userId, validFrom)` entfaellt ersatzlos und wird durch
 *      einen partiellen UNIQUE-Index `WHERE deletedAt IS NULL` ersetzt
 *   3. `idx_user_work_periods_one_open` wird zusaetzlich auf `deletedAt IS NULL` eingeschraenkt
 *   4. alle drei Trigger ignorieren weggenommene Perioden (`p.deletedAt IS NULL` in jeder
 *      Unterabfrage)
 *
 * DD-2 (aussetzbarer Kettenriegel): Das Verschieben von `validFrom` einer Periode braucht
 * zwei UPDATEs (Vorperiode waechst/schrumpft, korrigierte Periode verschiebt ihren Beginn).
 * Zwischen beiden Anweisungen ist die Kette zwangslaeufig kurzzeitig inkonsistent, und der
 * `trg_user_work_periods_update_guard` prueft nach JEDER Anweisung. Deshalb bekommt die
 * Datenbank die einzeilige Steuertabelle `work_period_chain_guard`
 * (`id INTEGER PRIMARY KEY CHECK(id = 1)`, `suspended INTEGER NOT NULL DEFAULT 0`). Jede
 * RAISE(ABORT)-Bedingung des INSERT- und des UPDATE-Riegels bekommt als erste Teilbedingung
 * eine Abfrage der `suspended`-Spalte dieser Steuertabelle (Wert 0 = scharf). Der DELETE-Riegel
 * bleibt absolut und ist NICHT aussetzbar — kein Code-Pfad dieser Phase fuehrt ein echtes
 * DELETE aus (D2 verbietet es), ein Notausgang, den niemand braucht, gehoert nicht ins
 * Schema. Der Betrieb ist ungefaehrlich: eine geteilte better-sqlite3-Verbindung, die
 * Aussetzung laeuft ausschliesslich innerhalb einer einzigen db.transaction()-Klammer, die im
 * Fehlerfall komplett zurueckrollt.
 *
 * Zusaetzlich bekommt der UPDATE-Riegel die weitere Teilbedingung `NEW.deletedAt IS NULL` —
 * eine weggenommene Periode verlaesst die Kette und darf nicht mehr gegen sie geprueft
 * werden, sonst schlaegt der Soft-Delete selbst fehl.
 *
 * Die Meldungstexte der vier RAISE(ABORT)-Aufrufe bleiben WORTGLEICH —
 * `translateWorkPeriodError()` in workPeriodService.ts erkennt sie am Textbestandteil
 * `user_work_periods:`.
 *
 * PARITAET: `server/src/database/schema.ts` wird im selben Plan auf denselben Stand gebracht
 * — eine frische Installation und eine migrierte Bestandsdatenbank muessen dasselbe Schema
 * erzeugen (schemaMigrationParity.test.ts weist das nach).
 *
 * SAFE: Preserves all existing data (Zeilenzahlvergleich vor DROP TABLE, wortgleiches Muster
 * aus Migration 012). Kein Code-Pfad dieser Phase fuehrt ein echtes DELETE aus.
 *
 * Kontext: .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-CONTEXT.md (D2/D3),
 * .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-01-PLAN.md (DD-1/DD-2, Task 1)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

const EXPECTED_NEW_COLUMNS = ['deletedAt', 'deletedBy'];

const EXPECTED_INDEXES = [
  'idx_user_work_periods_user_from',
  'idx_user_work_periods_one_open',
  'idx_user_work_periods_user_from_unique',
  'idx_user_work_periods_deleted',
];

export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 013: Soft-Delete-Fundament auf user_work_periods (D2/D3)...');

    // Schritt A — Steuertabelle fuer DD-2 anlegen, bevor die Trigger neu entstehen.
    logger.info('📝 Creating work_period_chain_guard control table...');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS work_period_chain_guard (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        suspended INTEGER NOT NULL DEFAULT 0 CHECK (suspended IN (0, 1))
      )
    `).run();
    db.prepare(`
      INSERT OR IGNORE INTO work_period_chain_guard (id, suspended) VALUES (1, 0)
    `).run();

    // Schritt B — Tabellen-Neubau von user_work_periods.
    const countBefore = (db.prepare(`
      SELECT COUNT(*) as count FROM user_work_periods
    `).get() as { count: number }).count;

    logger.info(`Migration 013: ${countBefore} Perioden vorhanden`);

    logger.info('📝 Creating user_work_periods_new (deletedAt/deletedBy, kein UNIQUE table constraint)...');
    db.prepare(`
      CREATE TABLE user_work_periods_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        validFrom TEXT NOT NULL,
        validTo TEXT,
        weeklyHours REAL NOT NULL,
        workSchedule TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        deletedAt TEXT,
        deletedBy INTEGER,
        CHECK (validFrom GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        CHECK (validTo IS NULL OR validTo GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        CHECK (validTo IS NULL OR validTo > validFrom),
        CHECK (weeklyHours >= 0 AND weeklyHours <= 168),
        CHECK (deletedAt IS NULL OR deletedAt GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id),
        FOREIGN KEY (deletedBy) REFERENCES users(id)
      )
    `).run();

    db.prepare(`
      INSERT INTO user_work_periods_new
        (id, userId, validFrom, validTo, weeklyHours, workSchedule, note, createdAt, createdBy, deletedAt, deletedBy)
      SELECT
        id, userId, validFrom, validTo, weeklyHours, workSchedule, note, createdAt, createdBy, NULL, NULL
      FROM user_work_periods
    `).run();

    const countAfter = (db.prepare(`
      SELECT COUNT(*) as count FROM user_work_periods_new
    `).get() as { count: number }).count;

    if (countBefore !== countAfter) {
      throw new Error(
        `Migration 013: Datenkopie fehlgeschlagen — ${countBefore} Zeilen in der Quelle, ` +
        `${countAfter} Zeilen im Ziel`
      );
    }

    db.prepare(`DROP TABLE user_work_periods`).run();
    db.prepare(`ALTER TABLE user_work_periods_new RENAME TO user_work_periods`).run();

    // Schritt C — Indizes neu anlegen.
    logger.info('📝 Creating indexes...');
    db.prepare(`
      CREATE INDEX idx_user_work_periods_user_from ON user_work_periods(userId, validFrom)
    `).run();
    db.prepare(`
      CREATE UNIQUE INDEX idx_user_work_periods_one_open
      ON user_work_periods(userId) WHERE validTo IS NULL AND deletedAt IS NULL
    `).run();
    db.prepare(`
      CREATE UNIQUE INDEX idx_user_work_periods_user_from_unique
      ON user_work_periods(userId, validFrom) WHERE deletedAt IS NULL
    `).run();
    db.prepare(`
      CREATE INDEX idx_user_work_periods_deleted ON user_work_periods(userId, deletedAt)
    `).run();

    // Schritt D — die drei Trigger neu anlegen. DROP TRIGGER IF EXISTS ist nach dem
    // Tabellen-DROP nicht noetig, die Trigger sind mit der Tabelle verschwunden.
    //
    // Meldungstexte bleiben wortgleich zu Migration 008/010 — translateWorkPeriodError()
    // erkennt sie am Textbestandteil "user_work_periods:".
    logger.info('📝 Creating triggers (chain-guard aussetzbar, deletedAt-bewusst)...');
    db.prepare(`
      CREATE TRIGGER trg_user_work_periods_insert_guard
      BEFORE INSERT ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
        WHERE (SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0
          AND EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = NEW.userId
              AND p.deletedAt IS NULL
              AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
              AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
          );
        SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
        WHERE (SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0
          AND EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId AND p.deletedAt IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = NEW.userId
              AND p.deletedAt IS NULL
              AND (p.validTo = NEW.validFrom
                   OR (NEW.validTo IS NOT NULL AND p.validFrom = NEW.validTo))
          );
      END
    `).run();

    db.prepare(`
      CREATE TRIGGER trg_user_work_periods_update_guard
      BEFORE UPDATE ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
        WHERE (SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0
          AND NEW.deletedAt IS NULL
          AND EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = NEW.userId AND p.id <> NEW.id
              AND p.deletedAt IS NULL
              AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
              AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
          );
        SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
        WHERE (SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0
          AND NEW.deletedAt IS NULL
          AND EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId AND p.id <> NEW.id AND p.deletedAt IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = NEW.userId AND p.id <> NEW.id
              AND p.deletedAt IS NULL
              AND (p.validTo = NEW.validFrom
                   OR (NEW.validTo IS NOT NULL AND p.validFrom = NEW.validTo))
          );
      END
    `).run();

    // DELETE-Riegel bleibt absolut (nicht aussetzbar, DD-2) — kein Code-Pfad dieser Phase
    // fuehrt ein echtes DELETE aus (D2 verbietet es). Jede Unterabfrage ignoriert
    // weggenommene Perioden, damit eine bereits geloeschte Periode nicht mehr als
    // "letzte verbleibende" oder "lueckenschliessende" Nachbarin zaehlt.
    db.prepare(`
      CREATE TRIGGER trg_user_work_periods_delete_guard
      BEFORE DELETE ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen')
        WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.deletedAt IS NULL
          );
        SELECT RAISE(ABORT, 'user_work_periods: Löschen würde eine Lücke in der Periodenkette hinterlassen')
        WHERE OLD.validTo IS NOT NULL
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
          AND EXISTS (SELECT 1 FROM user_work_periods p
                      WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.deletedAt IS NULL AND p.validTo = OLD.validFrom)
          AND EXISTS (SELECT 1 FROM user_work_periods p
                      WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.deletedAt IS NULL AND p.validFrom = OLD.validTo);
      END
    `).run();

    // Schritt E — Selbstverifikation (Muster Migration 010): schlaegt eine Pruefung fehl,
    // wird geworfen — die Migration gilt dann als nicht angewendet.
    const columns = db
      .prepare(`PRAGMA table_info(user_work_periods)`)
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    const missingColumns = EXPECTED_NEW_COLUMNS.filter((c) => !columnNames.includes(c));
    if (missingColumns.length > 0) {
      throw new Error(
        `Migration 013 unvollständig: fehlende Spalten in user_work_periods: ` +
        `${missingColumns.join(', ')}. Migration wird NICHT als angewendet markiert.`
      );
    }

    const indexes = db
      .prepare(`PRAGMA index_list(user_work_periods)`)
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    const missingIndexes = EXPECTED_INDEXES.filter((i) => !indexNames.includes(i));
    if (missingIndexes.length > 0) {
      throw new Error(
        `Migration 013 unvollständig: fehlende Indizes: ${missingIndexes.join(', ')}. ` +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    const triggerCount = (db
      .prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_user_work_periods_%'`)
      .get() as { count: number }).count;
    if (triggerCount !== 3) {
      throw new Error(
        `Migration 013 unvollständig: erwartete 3 Trigger auf user_work_periods, gefunden ${triggerCount}. ` +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    const rowCountAfter = (db
      .prepare(`SELECT COUNT(*) as count FROM user_work_periods`)
      .get() as { count: number }).count;

    logger.info(
      { rowsBefore: countBefore, rowsAfter: rowCountAfter, columns: columns.length, indexes: indexNames.length, triggers: triggerCount },
      '✅ Migration 013 verified: deletedAt/deletedBy vorhanden, Riegel deletedAt-bewusst und aussetzbar, Zeilenbestand unveraendert'
    );
  },
};
