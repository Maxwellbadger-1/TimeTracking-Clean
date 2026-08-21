import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import migration from './008_create_user_work_periods.js';

/**
 * Tests für Migration 008 (user_work_periods).
 *
 * Arbeiten ausschließlich auf `new Database(':memory:')` — die lokale Arbeitsdatenbank
 * bleibt unberührt. Eine minimale `users`-Tabelle wird lokal angelegt, dann
 * `migration.up(db)` direkt aufgerufen (kein migrationRunner nötig).
 */
describe('Migration 008: user_work_periods', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.prepare(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('legt alle neun Spalten an', async () => {
    await migration.up(db);

    const columns = db
      .prepare(`PRAGMA table_info(user_work_periods)`)
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'validFrom',
        'validTo',
        'weeklyHours',
        'workSchedule',
        'note',
        'createdAt',
        'createdBy',
      ])
    );
    expect(columnNames.length).toBe(9);
  });

  it('legt beide Indizes an', async () => {
    await migration.up(db);

    const indexes = db
      .prepare(`PRAGMA index_list(user_work_periods)`)
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_user_work_periods_user_from');
    expect(indexNames).toContain('idx_user_work_periods_one_open');
  });

  it('legt alle drei Trigger an', async () => {
    await migration.up(db);

    const triggers = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='user_work_periods'`)
      .all() as Array<{ name: string }>;
    const triggerNames = triggers.map((t) => t.name);

    expect(triggerNames).toContain('trg_user_work_periods_insert_guard');
    expect(triggerNames).toContain('trg_user_work_periods_update_guard');
    expect(triggerNames).toContain('trg_user_work_periods_delete_guard');
  });

  it('läuft bei zweitem Lauf idempotent durch (D7)', async () => {
    await migration.up(db);
    await expect(migration.up(db)).resolves.not.toThrow();

    const columns = db.prepare(`PRAGMA table_info(user_work_periods)`).all() as Array<{ name: string }>;
    const indexes = db.prepare(`PRAGMA index_list(user_work_periods)`).all() as Array<{ name: string }>;
    const triggers = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='user_work_periods'`)
      .all() as Array<{ name: string }>;

    // index_list enthält zusätzlich den von SQLite automatisch angelegten Index für den
    // UNIQUE(userId, validFrom)-Constraint — deshalb hier auf die beiden benannten
    // Indizes prüfen statt auf eine feste Gesamtzahl.
    const indexNames = indexes.map((i) => i.name);
    expect(columns.length).toBe(9);
    expect(indexNames).toContain('idx_user_work_periods_user_from');
    expect(indexNames).toContain('idx_user_work_periods_one_open');
    expect(triggers.length).toBe(3);
  });

  it('schreibt keine Zeile (Migration ist reines DDL)', async () => {
    await migration.up(db);

    const rowCount = (db
      .prepare(`SELECT COUNT(*) as count FROM user_work_periods`)
      .get() as { count: number }).count;

    expect(rowCount).toBe(0);
  });

  describe('Trigger-Verhalten (Konsistenzprüfung, D3/REQ-22)', () => {
    let userId: number;

    beforeEach(async () => {
      await migration.up(db);
      const user = db.prepare(`INSERT INTO users (username) VALUES (?)`).run('trigger-test-user');
      userId = user.lastInsertRowid as number;
    });

    it('lässt eine erste offene Periode zu', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
          VALUES (?, ?, NULL, ?)
        `).run(userId, '2026-01-01', 40);
      }).not.toThrow();
    });

    it('weist eine Überlappung ab', () => {
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-01-01', '2026-06-01', 40);

      expect(() => {
        db.prepare(`
          INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
          VALUES (?, ?, NULL, ?)
        `).run(userId, '2026-03-01', 30);
      }).toThrow(/Überlappung/);
    });

    it('weist eine Lücke ab', () => {
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-01-01', '2026-06-01', 40);

      // 2026-07-01 statt 2026-06-01: eine Lücke von einem Monat
      expect(() => {
        db.prepare(`
          INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
          VALUES (?, ?, NULL, ?)
        `).run(userId, '2026-07-01', 30);
      }).toThrow(/Lücke/);
    });

    it('weist eine zweite offene Periode ab', () => {
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, NULL, ?)
      `).run(userId, '2026-01-01', 40);

      expect(() => {
        db.prepare(`
          INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
          VALUES (?, ?, NULL, ?)
        `).run(userId, '2026-06-01', 30);
      }).toThrow();
    });

    it('weist einen Formatverstoß ab (GLOB-Check)', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
          VALUES (?, ?, NULL, ?)
        `).run(userId, '01.01.2026', 40);
      }).toThrow();
    });

    it('lässt den Stichtagswechsel zu (UPDATE schließt, INSERT eröffnet)', () => {
      const first = db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, NULL, ?)
      `).run(userId, '2026-01-01', 40);

      expect(() => {
        const tx = db.transaction(() => {
          db.prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ?`)
            .run('2026-07-01', first.lastInsertRowid);
          db.prepare(`
            INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
            VALUES (?, ?, NULL, ?)
          `).run(userId, '2026-07-01', 30);
        });
        tx();
      }).not.toThrow();
    });

    it('weist ein UPDATE ab, das validTo über die nächste Periode hinaus verlängert', () => {
      const p1 = db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-01-01', '2026-06-01', 40);

      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, NULL, ?)
      `).run(userId, '2026-06-01', 30);

      expect(() => {
        db.prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ?`)
          .run('2026-08-01', p1.lastInsertRowid);
      }).toThrow(/Überlappung/);
    });

    it('erlaubt DELETE FROM users bei drei verketteten Perioden (Kaskade)', () => {
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-01-01', '2026-04-01', 40);
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-04-01', '2026-07-01', 32);
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, NULL, ?)
      `).run(userId, '2026-07-01', 20);

      expect(() => {
        db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
      }).not.toThrow();

      const remaining = (db
        .prepare(`SELECT COUNT(*) as count FROM user_work_periods WHERE userId = ?`)
        .get(userId) as { count: number }).count;
      expect(remaining).toBe(0);
    });

    it('weist das direkte Löschen einer mittleren Periode bei fortbestehendem Nutzer ab', () => {
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-01-01', '2026-04-01', 40);
      const mid = db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, ?, ?)
      `).run(userId, '2026-04-01', '2026-07-01', 32);
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
        VALUES (?, ?, NULL, ?)
      `).run(userId, '2026-07-01', 20);

      expect(() => {
        db.prepare(`DELETE FROM user_work_periods WHERE id = ?`).run(mid.lastInsertRowid);
      }).toThrow(/Lücke/);
    });
  });
});
