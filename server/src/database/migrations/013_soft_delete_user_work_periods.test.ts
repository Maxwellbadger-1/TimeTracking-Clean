import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import migration008 from './008_create_user_work_periods.js';
import migration from './013_soft_delete_user_work_periods.js';

/**
 * Verhaltensnachweis für Migration 013 (Soft-Delete-Fundament auf user_work_periods,
 * DD-1/DD-2 aus 13-01-PLAN.md, Task 3).
 *
 * Arbeitet ausschließlich auf `new Database(':memory:')` — wortgleiches Muster wie
 * `008_create_user_work_periods.test.ts`/`012_fix_reference_type_check_constraint.test.ts`:
 * kein `initializeDatabase()`-Aufruf (der WAL erzwingen würde), deshalb ist `:memory:` hier
 * sicher. Die lokale Arbeitsdatenbank unter `server/database/` bleibt unberührt.
 *
 * Migration 013 ist ein Tabellen-NEUBAU auf der bestehenden `user_work_periods`-Tabelle
 * (DD-1) — sie setzt Migration 008 voraus (liest `COUNT(*) FROM user_work_periods`, bevor
 * sie die Tabelle neu baut). Der Testaufbau fährt deshalb beide Migrationen nacheinander,
 * genau wie `schemaMigrationParity.test.ts` es für den echten Migrationspfad tut.
 */
describe('Migration 013: Soft-Delete-Fundament auf user_work_periods (D2/D3, DD-1/DD-2)', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.prepare(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL
      )
    `).run();
    migration008.up(db);
    migration.up(db);
  });

  afterAll(() => {
    db.prepare(`DELETE FROM users WHERE username LIKE 'test-13-01-%'`).run();
    db.close();
  });

  let userCounter = 0;
  function createTestUser(): number {
    userCounter += 1;
    const username = `test-13-01-${userCounter}`;
    const result = db.prepare(`INSERT INTO users (username) VALUES (?)`).run(username);
    return result.lastInsertRowid as number;
  }

  function insertPeriod(userId: number, validFrom: string, validTo: string | null, weeklyHours = 40): number {
    const result = db.prepare(`
      INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
      VALUES (?, ?, ?, ?)
    `).run(userId, validFrom, validTo, weeklyHours);
    return result.lastInsertRowid as number;
  }

  function softDelete(periodId: number, deletedBy: number | null = null): void {
    db.prepare(`UPDATE user_work_periods SET deletedAt = datetime('now'), deletedBy = ? WHERE id = ?`)
      .run(deletedBy, periodId);
  }

  it('1. nimmt eine Periode per UPDATE deletedAt weg, auch wenn sie die letzte offene Periode ist', () => {
    const userId = createTestUser();
    const periodId = insertPeriod(userId, '2026-01-01', null);

    expect(() => softDelete(periodId)).not.toThrow();

    const row = db.prepare(`SELECT deletedAt FROM user_work_periods WHERE id = ?`).get(periodId) as { deletedAt: string | null };
    expect(row.deletedAt).not.toBeNull();
  });

  it('2. lässt die Vorperiode A die Lücke einer weggenommenen mittleren Periode B schließen', () => {
    const userId = createTestUser();
    const a = insertPeriod(userId, '2026-01-01', '2026-04-01');
    const b = insertPeriod(userId, '2026-04-01', '2026-07-01');
    insertPeriod(userId, '2026-07-01', null); // C, offen

    softDelete(b);

    expect(() => {
      db.prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ?`).run('2026-07-01', a);
    }).not.toThrow();

    const row = db.prepare(`SELECT validTo FROM user_work_periods WHERE id = ?`).get(a) as { validTo: string };
    expect(row.validTo).toBe('2026-07-01');
  });

  it('3. lässt die Vorperiode wieder offen werden, nachdem die offene letzte Periode weggenommen wurde', () => {
    const userId = createTestUser();
    const a = insertPeriod(userId, '2026-01-01', '2026-04-01');
    const b = insertPeriod(userId, '2026-04-01', null); // offen

    softDelete(b);

    expect(() => {
      db.prepare(`UPDATE user_work_periods SET validTo = NULL WHERE id = ?`).run(a);
    }).not.toThrow();

    const row = db.prepare(`SELECT validTo FROM user_work_periods WHERE id = ?`).get(a) as { validTo: string | null };
    expect(row.validTo).toBeNull();
  });

  it('4. erlaubt eine neue Periode mit demselben validFrom, nachdem die alte weggenommen wurde', () => {
    const userId = createTestUser();
    const p1 = insertPeriod(userId, '2026-01-01', '2026-06-01');

    softDelete(p1);

    expect(() => insertPeriod(userId, '2026-01-01', null)).not.toThrow();
  });

  it('5. weist eine echte Überlappung zwischen zwei nicht weggenommenen Perioden weiterhin ab (wortgleicher Text)', () => {
    const userId = createTestUser();
    insertPeriod(userId, '2026-01-01', '2026-06-01');

    expect(() => insertPeriod(userId, '2026-03-01', null)).toThrow(
      /user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers/
    );
  });

  it('6. (DD-2) work_period_chain_guard.suspended setzt den Riegel innerhalb des Fensters aus und danach wieder scharf', () => {
    const userId = createTestUser();
    const a = insertPeriod(userId, '2026-01-01', '2026-04-01');
    const b = insertPeriod(userId, '2026-04-01', '2026-07-01');

    // Ziel-validFrom bewusst verschieden von A.validFrom (2026-01-01): Der partielle
    // UNIQUE-Index idx_user_work_periods_user_from_unique wird von work_period_chain_guard
    // NICHT ausgesetzt (nur die beiden Trigger sind aussetzbar) — ein Kollisionswert würde
    // unabhängig vom Riegel mit "UNIQUE constraint failed" abgewiesen und nichts über den
    // Trigger aussagen. 2026-02-01 liegt innerhalb von A's Intervall [2026-01-01,
    // 2026-04-01) und überlappt damit, kollidiert aber nicht mit A.validFrom selbst.
    const overlappingValidFrom = '2026-02-01';

    // Baseline: der Riegel ist scharf — die Verschiebung von B in A's Intervall hinein wird
    // abgewiesen.
    expect(() => {
      db.prepare(`UPDATE user_work_periods SET validFrom = ? WHERE id = ?`).run(overlappingValidFrom, b);
    }).toThrow(/Überlappung/);

    try {
      db.prepare(`UPDATE work_period_chain_guard SET suspended = 1 WHERE id = 1`).run();

      expect(() => {
        db.prepare(`UPDATE user_work_periods SET validFrom = ? WHERE id = ?`).run(overlappingValidFrom, b);
      }).not.toThrow();
    } finally {
      db.prepare(`UPDATE work_period_chain_guard SET suspended = 0 WHERE id = 1`).run();
    }

    // B trägt jetzt validFrom = 2026-02-01 (aus dem ausgesetzten Fenster oben). Derselbe
    // Versuch (ein No-Op-Wert für validFrom, aber der Trigger feuert bei jedem UPDATE erneut)
    // muss jetzt wieder abgewiesen werden — der Riegel ist wieder scharf.
    expect(() => {
      db.prepare(`UPDATE user_work_periods SET validFrom = ? WHERE id = ?`).run(overlappingValidFrom, b);
    }).toThrow(/Überlappung/);

    // A blieb während des gesamten Tests unverändert — der ausgesetzte Riegel betraf nur B.
    const rowA = db.prepare(`SELECT validFrom, validTo FROM user_work_periods WHERE id = ?`).get(a) as {
      validFrom: string;
      validTo: string;
    };
    expect(rowA).toEqual({ validFrom: '2026-01-01', validTo: '2026-04-01' });
  });
});
