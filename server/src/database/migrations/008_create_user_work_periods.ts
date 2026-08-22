/**
 * Migration 008: Create user_work_periods (Arbeitszeit-Perioden)
 *
 * PROBLEM: `users.weeklyHours` und `users.workSchedule` sind flache Felder ohne Historie.
 * `getDailyTargetHours()` löst die Sollstunden aus dem heutigen Stammdatensatz auf, weshalb
 * jeder Rebuild die gesamte Vergangenheit mit den neuen Stunden nachrechnet — still, ohne
 * dass es jemand auslöst. Ein konkreter Umstellungsfall steht an (Stand 21.08.2026).
 *
 * LÖSUNG: Eine Periodentabelle mit halboffenem Gültigkeitsintervall
 * `[validFrom, validTo)` (D1). `validFrom` ist inklusiv, `validTo` exklusiv; die laufende
 * Periode hat `validTo = NULL`. Halboffene Intervalle machen Lückenlosigkeit trivial
 * prüfbar (`periode[n].validTo === periode[n+1].validFrom`) und vermeiden die klassische
 * Ein-Tages-Lücke am Monatswechsel.
 *
 * `weeklyHours` und `workSchedule` werden gemeinsam in derselben Zeile versioniert (D2,
 * REQ-20): Eine Kombination aus alter Wochenstundenzahl und neuem Tagesplan darf nicht
 * entstehen. Die drei Trigger unten sind die Datenbankseite von REQ-22/D3 — SQLite kennt
 * keine Range-Exclusion-Constraints wie Postgres, deshalb übernehmen `BEFORE
 * INSERT`/`UPDATE`/`DELETE`-Trigger mit `RAISE(ABORT, ...)` die Überlappungs- und
 * Lückenprüfung, ergänzt um einen partiellen UNIQUE-Index, der höchstens eine offene
 * Periode je Nutzer erlaubt.
 *
 * SCOPE: Diese Migration legt nur die Tabelle, Indizes und Trigger an. Es wird **keine
 * einzige Zeile geschrieben** und `users.weeklyHours`/`users.workSchedule` bleiben
 * unangetastet (D4, REQ-21) — dadurch ist REQ-21 („an den Zahlen nicht ablesbar")
 * mechanisch garantiert statt nur behauptet. Die Bestandsüberführung (heutiger Stand jedes
 * Nutzers wird eine Periode ab `hireDate`) liegt in Migration 009.
 *
 * SAFE: Reines CREATE TABLE/INDEX/TRIGGER IF NOT EXISTS, keine bestehende Tabelle wird
 * angefasst — insbesondere kein ALTER, DROP oder UPDATE auf `users`.
 *
 * Kontext: .planning/phases/10-perioden-fundament/10-CONTEXT.md (D1–D7),
 * .planning/phases/10-perioden-fundament/10-01-PLAN.md (verbindlicher DDL-Vertrag)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

/** Spalten, die nach dieser Migration existieren müssen (Selbstverifikation unten). */
const EXPECTED_COLUMNS = [
  'id',
  'userId',
  'validFrom',
  'validTo',
  'weeklyHours',
  'workSchedule',
  'note',
  'createdAt',
  'createdBy',
];

const EXPECTED_INDEXES = [
  'idx_user_work_periods_user_from',
  'idx_user_work_periods_one_open',
];

const EXPECTED_TRIGGERS = [
  'trg_user_work_periods_insert_guard',
  'trg_user_work_periods_update_guard',
  'trg_user_work_periods_delete_guard',
];

/**
 * DELETE-Riegel als exportierte Konstante (WR-01, 10-06-PLAN.md), damit Migration 010 sie
 * unverändert nachrüsten kann, statt eine dritte SQL-Kopie zu pflegen —
 * `schemaMigrationParity.test.ts` vergleicht ohnehin die tatsächlichen `sqlite_master`-
 * Einträge, keine gemeinsam genutzte Konstante schwächt diesen Nachweis ab.
 *
 * Zwei RAISE-Klauseln:
 *   1. NEU (WR-01): verweigert das Löschen der letzten verbleibenden Periode eines noch
 *      existierenden Nutzers — unabhängig davon, ob sie offen (validTo IS NULL) oder
 *      geschlossen ist. Das ist die datenbankseitige Erfüllung der von Migration 009
 *      hergestellten Invariante „jeder Nutzer hat mindestens eine Periode".
 *   2. Bestehend: verweigert das Löschen, wenn dadurch eine Lücke zwischen einer
 *      Vorgänger- und einer Nachfolgerperiode entstünde.
 * Die Klausel `EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)` ist in BEIDEN
 * RAISE-Klauseln zwingend beizubehalten: Ohne sie bricht `DELETE FROM users`
 * (ON DELETE CASCADE) bei einem Nutzer mit mehreren Perioden ab, weil der Elternsatz zu
 * diesem Zeitpunkt bereits fort ist und jede der beiden Bedingungen sonst zuschlägt.
 */
export const DELETE_GUARD_TRIGGER_SQL = `
      CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_delete_guard
      BEFORE DELETE ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen')
        WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = OLD.userId AND p.id <> OLD.id
          );
        SELECT RAISE(ABORT, 'user_work_periods: Löschen würde eine Lücke in der Periodenkette hinterlassen')
        WHERE OLD.validTo IS NOT NULL
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
          AND EXISTS (SELECT 1 FROM user_work_periods p
                      WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.validTo = OLD.validFrom)
          AND EXISTS (SELECT 1 FROM user_work_periods p
                      WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.validFrom = OLD.validTo);
      END
    `;

export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 008: Creating user_work_periods (Arbeitszeit-Perioden)...');

    // Step 1: Tabelle anlegen
    //
    // - UNIQUE(userId, validFrom): zwei Perioden desselben Nutzers dürfen nicht am selben
    //   Tag beginnen.
    // - GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' statt date(validFrom) = validFrom:
    //   GLOB ist deterministisch und in einem CHECK unbedenklich, die Datumsfunktionen von
    //   SQLite sind es nicht zwangsläufig. Das ist der letzte Riegel gegen die
    //   Zeitzonenfalle aus Phase 9 — ein durch toISOString() verschobener oder anders
    //   formatierter Wert kommt gar nicht erst in die Tabelle.
    // - validTo > validFrom: schließt eine Nullperiode (validTo === validFrom) aus.
    // - weeklyHours 0..168: 168 = 24h * 7 Tage, die theoretische Obergrenze.
    logger.info('📝 Creating table user_work_periods...');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_work_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        validFrom TEXT NOT NULL,
        validTo TEXT,
        weeklyHours REAL NOT NULL,
        workSchedule TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        UNIQUE(userId, validFrom),
        CHECK (validFrom GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        CHECK (validTo IS NULL OR validTo GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        CHECK (validTo IS NULL OR validTo > validFrom),
        CHECK (weeklyHours >= 0 AND weeklyHours <= 168),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();

    // Step 2: Spalten verifizieren — VOR dem Anlegen der Indizes und Trigger
    //
    // Lehre aus Migration 003 (siehe Kopf von 007): Eine als erledigt markierte Migration
    // läuft nie wieder an. Diese Migration prüft ihr eigenes Ergebnis und wirft, damit der
    // migrationRunner sie nicht als erledigt bucht.
    const columns = db
      .prepare(`PRAGMA table_info(user_work_periods)`)
      .all() as Array<{ name: string }>;

    if (columns.length === 0) {
      throw new Error(
        'Migration 008 fehlgeschlagen: Tabelle user_work_periods existiert nach dem ' +
        'CREATE nicht. Migration wird NICHT als angewendet markiert.'
      );
    }

    const missingColumns = EXPECTED_COLUMNS.filter(
      (expected) => !columns.some((c) => c.name === expected)
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Migration 008 unvollständig: fehlende Spalten in user_work_periods: ` +
        `${missingColumns.join(', ')}. Vermutlich existierte bereits eine abweichende ` +
        'Tabelle. Migration wird NICHT als angewendet markiert.'
      );
    }

    // Step 3: Indizes
    //   - idx_user_work_periods_user_from: Lesepfad "alle Perioden eines Nutzers,
    //     chronologisch" (Phase 11 löst darüber zum Datum auf).
    //   - idx_user_work_periods_one_open: partieller UNIQUE-Index, erzwingt höchstens EINE
    //     offene Periode (validTo IS NULL) je Nutzer — die datenbankseitige Erfüllung von
    //     REQ-22/D3 zusammen mit den Triggern unten.
    logger.info('📝 Creating indexes...');
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_work_periods_user_from
      ON user_work_periods(userId, validFrom)
    `).run();

    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_work_periods_one_open
      ON user_work_periods(userId) WHERE validTo IS NULL
    `).run();

    // Step 4: Indizes verifizieren
    const indexes = db
      .prepare(`PRAGMA index_list(user_work_periods)`)
      .all() as Array<{ name: string }>;

    const missingIndexes = EXPECTED_INDEXES.filter(
      (expected) => !indexes.some((i) => i.name === expected)
    );

    if (missingIndexes.length > 0) {
      throw new Error(
        `Migration 008 unvollständig: fehlende Indizes: ${missingIndexes.join(', ')}. ` +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    // Step 5: Trigger
    //
    // Alle drei prüfen dieselbe halboffene Überlappungsbedingung und denselben
    // Lücken-Riegel; INSERT/UPDATE unterscheiden sich nur darin, ob NEW.id sich selbst
    // ausschließen muss.
    //
    // Der DELETE-Trigger (Definition: DELETE_GUARD_TRIGGER_SQL oben, WR-01) verweigert
    // sowohl das Leerlaufen der Periodenkette (letzte verbleibende Periode eines noch
    // existierenden Nutzers) als auch das Aufreißen einer Lücke zwischen Vorgänger- und
    // Nachfolgerperiode. Die Klausel `EXISTS (SELECT 1 FROM users u WHERE u.id =
    // OLD.userId)` ist in BEIDEN RAISE-Klauseln kein Beiwerk: Ohne sie bricht ein
    // `DELETE FROM users` (ON DELETE CASCADE) bei einem Nutzer mit mehreren verketteten
    // Perioden ab, weil der Elternsatz zu diesem Zeitpunkt bereits fort ist und jede
    // Bedingung sonst zuschlägt. Getestet am 22.08.2026 gegen better-sqlite3: mit der
    // Bedingung räumt die Kaskade alle Perioden ab, ohne sie scheitert sie.
    // Testaufräumarbeiten (`DELETE FROM users WHERE id = ?`) hängen an dieser Klausel.
    logger.info('📝 Creating triggers...');
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_insert_guard
      BEFORE INSERT ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
        WHERE EXISTS (
          SELECT 1 FROM user_work_periods p
          WHERE p.userId = NEW.userId
            AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
            AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
        );
        SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
        WHERE EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = NEW.userId
              AND (p.validTo = NEW.validFrom
                   OR (NEW.validTo IS NOT NULL AND p.validFrom = NEW.validTo))
          );
      END
    `).run();

    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_update_guard
      BEFORE UPDATE ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
        WHERE EXISTS (
          SELECT 1 FROM user_work_periods p
          WHERE p.userId = NEW.userId AND p.id <> NEW.id
            AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
            AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
        );
        SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
        WHERE EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId AND p.id <> NEW.id)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = NEW.userId AND p.id <> NEW.id
              AND (p.validTo = NEW.validFrom
                   OR (NEW.validTo IS NOT NULL AND p.validFrom = NEW.validTo))
          );
      END
    `).run();

    db.prepare(DELETE_GUARD_TRIGGER_SQL).run();

    // Step 6: Indizes und Trigger gemeinsam verifizieren
    const finalIndexes = db
      .prepare(`PRAGMA index_list(user_work_periods)`)
      .all() as Array<{ name: string }>;

    const stillMissingIndexes = EXPECTED_INDEXES.filter(
      (expected) => !finalIndexes.some((i) => i.name === expected)
    );

    if (stillMissingIndexes.length > 0) {
      throw new Error(
        `Migration 008 unvollständig: fehlende Indizes nach Trigger-Erstellung: ` +
        `${stillMissingIndexes.join(', ')}. Migration wird NICHT als angewendet markiert.`
      );
    }

    const triggers = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='user_work_periods'`)
      .all() as Array<{ name: string }>;

    const missingTriggers = EXPECTED_TRIGGERS.filter(
      (expected) => !triggers.some((t) => t.name === expected)
    );

    if (missingTriggers.length > 0) {
      throw new Error(
        `Migration 008 unvollständig: fehlende Trigger: ${missingTriggers.join(', ')}. ` +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    const rowCount = (db
      .prepare(`SELECT COUNT(*) as count FROM user_work_periods`)
      .get() as { count: number }).count;

    logger.info(
      { columns: columns.length, indexes: finalIndexes.length, triggers: triggers.length, rows: rowCount },
      '✅ Migration 008 verified: user_work_periods ready (0 Zeilen geschrieben, users unangetastet)'
    );
  },
};
