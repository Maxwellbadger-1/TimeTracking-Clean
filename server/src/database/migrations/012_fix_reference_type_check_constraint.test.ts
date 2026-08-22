import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import migration011 from './011_add_model_change_transaction_type.js';
import migration012 from './012_fix_reference_type_check_constraint.js';

/**
 * Nachweis fuer CR-05 (Code-Review Phase 12): Der `referenceType`-CHECK war durch das `NULL`
 * in der IN-Liste wirkungslos; Migration 012 macht ihn wirksam.
 *
 * Arbeitet ausschliesslich auf `new Database(':memory:')` — die lokale Arbeitsdatenbank
 * bleibt unberuehrt. Die alte, fehlerhafte Tabellenform wird hier woertlich nachgebaut
 * (so, wie Migration 006/011 sie vor der Korrektur angelegt haben), damit die Gegenprobe
 * belegt, dass der Fehler real war und nicht nur behauptet wird.
 */
describe('Migration 012: referenceType-CHECK (CR-05)', () => {
  let db: Database.Database;

  /** Die Tabellenform, die Migration 011 VOR der Korrektur angelegt hat — mit NULL in der IN-Liste. */
  const LEGACY_TABLE_SQL = `
    CREATE TABLE overtime_transactions (
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
      referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system', 'work_period', NULL)),
      referenceId INTEGER,
      balanceBefore REAL,
      balanceAfter REAL,
      createdAt TEXT DEFAULT (datetime('now')),
      createdBy INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `;

  function insertRow(referenceType: string | null): void {
    db.prepare(
      `INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType)
       VALUES (1, '2026-01-15', 'correction', 1.5, 'Testzeile', ?)`
    ).run(referenceType);
  }

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.prepare(
      `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL)`
    ).run();
    db.prepare(`INSERT INTO users (id, username) VALUES (1, 'test-012')`).run();
  });

  afterEach(() => {
    db.close();
  });

  it('Gegenprobe: die alte Tabellenform akzeptiert JEDEN referenceType (NULL in der IN-Liste hebt den CHECK auf)', () => {
    db.prepare(LEGACY_TABLE_SQL).run();

    expect(() => insertRow('voellig-erfundener-typ')).not.toThrow();

    const stored = db
      .prepare(`SELECT referenceType FROM overtime_transactions`)
      .all() as Array<{ referenceType: string | null }>;
    expect(stored).toEqual([{ referenceType: 'voellig-erfundener-typ' }]);
  });

  it('nach Migration 012 wird ein unzulaessiger referenceType abgewiesen, NULL und die fuenf erlaubten Werte bleiben zulaessig', () => {
    db.prepare(LEGACY_TABLE_SQL).run();
    migration012.up(db);

    expect(() => insertRow('voellig-erfundener-typ')).toThrow(/CHECK constraint failed/i);

    for (const allowed of ['time_entry', 'absence', 'manual', 'system', 'work_period']) {
      expect(() => insertRow(allowed)).not.toThrow();
    }
    expect(() => insertRow(null)).not.toThrow();

    const count = (
      db.prepare(`SELECT COUNT(*) as c FROM overtime_transactions`).get() as { c: number }
    ).c;
    expect(count).toBe(6);
  });

  it('erhaelt alle Bestandszeilen und neutralisiert nur den unzulaessigen referenceType', () => {
    db.prepare(LEGACY_TABLE_SQL).run();
    insertRow('absence');
    insertRow('voellig-erfundener-typ');
    insertRow(null);

    migration012.up(db);

    const rows = db
      .prepare(`SELECT id, referenceType FROM overtime_transactions ORDER BY id`)
      .all() as Array<{ id: number; referenceType: string | null }>;

    expect(rows).toEqual([
      { id: 1, referenceType: 'absence' },
      { id: 2, referenceType: null },
      { id: 3, referenceType: null },
    ]);
  });

  it('laesst den type-Wert model_change aus Migration 011 unveraendert zu', () => {
    db.prepare(LEGACY_TABLE_SQL).run();
    migration012.up(db);

    expect(() =>
      db
        .prepare(
          `INSERT INTO overtime_transactions (userId, date, type, hours, description, referenceType, referenceId)
           VALUES (1, '2026-01-15', 'model_change', -12.5, 'Stundenwechsel', 'work_period', 42)`
        )
        .run()
    ).not.toThrow();
  });

  it('Migration 011 legt die Tabelle jetzt selbst ohne NULL in der IN-Liste an', () => {
    // Ausgangslage: die Tabellenform vor 011 (ohne model_change, mit NULL in der IN-Liste).
    db.prepare(`
      CREATE TABLE overtime_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('correction', 'time_entry')),
        hours REAL NOT NULL,
        description TEXT,
        referenceType TEXT CHECK(referenceType IN ('time_entry', 'absence', 'manual', 'system', NULL)),
        referenceId INTEGER,
        balanceBefore REAL,
        balanceAfter REAL,
        createdAt TEXT DEFAULT (datetime('now')),
        createdBy INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `).run();

    migration011.up(db);

    expect(() => insertRow('voellig-erfundener-typ')).toThrow(/CHECK constraint failed/i);
  });
});
