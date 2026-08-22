import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initializeDatabase } from '../schema.js';
import migration015 from './015_unique_reversal_of_index.js';

/**
 * Verhaltensnachweis für Migration 015 (WR-11, Code-Review Phase 13): der Teilindex
 * `idx_overtime_transactions_reversal_of` ist EINDEUTIG — höchstens eine Gegenbuchung je
 * Originalzeile, von der Datenbank getragen statt von der Aufrufreihenfolge.
 *
 * Läuft gegen eigene Dateidatenbanken in `os.tmpdir()` (Muster aus
 * `schemaMigrationParity.test.ts`), nicht gegen die geteilte Verbindung: Die Migration baut
 * einen Index um, und der Ausgangszustand (nicht eindeutiger Index, wie ihn Migration 014 vor
 * dieser Korrektur anlegte) muss dafür gezielt herstellbar sein. `initializeDatabase()`
 * erzwingt WAL-Modus und wirft bei `:memory:`.
 */
describe('Migration 015: idx_overtime_transactions_reversal_of ist eindeutig (WR-11)', () => {
  const createdPaths: string[] = [];

  afterAll(() => {
    for (const p of createdPaths) {
      for (const suffix of ['', '-wal', '-shm']) {
        const file = `${p}${suffix}`;
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  });

  /** Legt eine frische Datenbank an und versetzt sie in den ALTZUSTAND: Teilindex vorhanden,
   *  aber NICHT eindeutig — genau das, was Migration 014 vor dieser Korrektur hinterliess. */
  function createLegacyDatabase(label: string): { db: Database.Database; dbPath: string } {
    const dbPath = path.join(os.tmpdir(), `mig015-${label}-${Date.now()}-${process.pid}.db`);
    createdPaths.push(dbPath);
    const db = new Database(dbPath);
    initializeDatabase(db);

    db.exec('DROP INDEX IF EXISTS idx_overtime_transactions_reversal_of');
    db.exec(
      `CREATE INDEX idx_overtime_transactions_reversal_of
       ON overtime_transactions(reversalOf) WHERE reversalOf IS NOT NULL`
    );

    const before = db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_overtime_transactions_reversal_of'`
      )
      .get() as { sql: string };
    expect(before.sql).not.toMatch(/UNIQUE/i);

    return { db, dbPath };
  }

  function insertUser(db: Database.Database, username: string): number {
    const result = db
      .prepare(
        `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(username, `${username}@test.local`, 'T', 'U', 'hash', 'employee', 40, '2020-01-01');
    return result.lastInsertRowid as number;
  }

  function insertTransaction(
    db: Database.Database,
    userId: number,
    hours: number,
    reversalOf: number | null
  ): number {
    const result = db
      .prepare(
        `INSERT INTO overtime_transactions (userId, date, type, hours, description, reversalOf)
         VALUES (?, ?, 'model_change', ?, ?, ?)`
      )
      .run(userId, '2026-03-01', hours, 'Fixture', reversalOf);
    return result.lastInsertRowid as number;
  }

  it('macht den bestehenden, nicht eindeutigen Teilindex eindeutig — und die Datenbank weist eine zweite Gegenbuchung danach ab', () => {
    const { db } = createLegacyDatabase('happy');
    try {
      const userId = insertUser(db, 'mig015-happy');
      const originalId = insertTransaction(db, userId, 5, null);
      const firstReversalId = insertTransaction(db, userId, -5, originalId);
      expect(firstReversalId).toBeGreaterThan(0);

      migration015.up(db);

      const after = db
        .prepare(
          `SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_overtime_transactions_reversal_of'`
        )
        .get() as { sql: string };
      expect(after.sql).toMatch(/CREATE\s+UNIQUE\s+INDEX/i);

      // DIE EIGENTLICHE ZUSICHERUNG: eine ZWEITE Gegenbuchung auf dieselbe Originalzeile
      // wird jetzt von der Datenbank abgewiesen, nicht mehr nur von der Anwendungslogik.
      // Vorher zeigte der Selbst-Join im Kontoauszug die Originalzeile doppelt.
      expect(() => insertTransaction(db, userId, -5, originalId)).toThrow(/UNIQUE constraint failed/i);

      // Eine Gegenbuchung auf eine ANDERE Originalzeile bleibt selbstverständlich erlaubt,
      // und mehrere Zeilen mit reversalOf IS NULL ebenfalls (Teilindex).
      const secondOriginalId = insertTransaction(db, userId, 3, null);
      expect(() => insertTransaction(db, userId, -3, secondOriginalId)).not.toThrow();
      expect(() => insertTransaction(db, userId, 1, null)).not.toThrow();

      // Idempotenz: ein zweiter Lauf ist folgenlos.
      expect(() => migration015.up(db)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('bricht ab und laesst den alten Index stehen, wenn im Bestand bereits mehrfache Gegenbuchungen existieren', () => {
    const { db } = createLegacyDatabase('duplikate');
    try {
      const userId = insertUser(db, 'mig015-duplikate');
      const originalId = insertTransaction(db, userId, 5, null);
      insertTransaction(db, userId, -5, originalId);
      insertTransaction(db, userId, -5, originalId);

      expect(() => migration015.up(db)).toThrow(/mehrfache Gegenbuchungen/);

      // Der bisherige (nicht eindeutige) Index steht unveraendert — keine halbe Aenderung
      // im Bestand.
      const after = db
        .prepare(
          `SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_overtime_transactions_reversal_of'`
        )
        .get() as { sql: string };
      expect(after.sql).not.toMatch(/UNIQUE/i);
    } finally {
      db.close();
    }
  });
});
