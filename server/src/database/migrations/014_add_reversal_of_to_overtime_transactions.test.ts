import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../connection.js';
import { createTransaction } from '../../services/overtimeTransactionManager.js';

/**
 * Verhaltensnachweis für Migration 014 (reversalOf-Selbstreferenz auf
 * overtime_transactions, DD-3/DD-4 aus 13-01-PLAN.md, Task 3).
 *
 * Läuft gegen die geteilte Verbindung aus `connection.js` (Muster aus
 * `workPeriodChangeService.test.ts`), nicht gegen `:memory:` — `createTransaction()`
 * (`overtimeTransactionManager.ts`) importiert `db` fest aus `connection.js` und lässt sich
 * nicht mit einer anderen Datenbank aufrufen. Echte Testnutzer mit eindeutigem `username`
 * (Präfix `test-13-01-`), Aufräumen über `DELETE FROM users WHERE id = ?` (CASCADE räumt
 * `overtime_transactions` ab).
 */
describe('Migration 014: reversalOf-Selbstreferenz auf overtime_transactions (DD-3/DD-4)', () => {
  const USERNAME_PREFIX = 'test-13-01-014-';
  const createdUserIds: number[] = [];

  beforeAll(() => {
    db.pragma('foreign_keys = ON');
    const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
    expect(fkStatus).toBe(1);
  });

  afterAll(() => {
    for (const userId of createdUserIds) {
      db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    }

    const leftover = db.prepare(`SELECT id FROM users WHERE username LIKE ?`).all(`${USERNAME_PREFIX}%`);
    expect(leftover).toEqual([]);
  });

  function createEmployee(suffix: string): number {
    const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
    const result = db
      .prepare(
        `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(username, `${username}@test.local`, 'T1301', suffix, 'hash', 'employee', 40, '2020-01-01');
    const userId = result.lastInsertRowid as number;
    createdUserIds.push(userId);
    return userId;
  }

  it('1. createTransaction() mit reversalOf schreibt die Spalte, SELECT liefert dieselbe Id zurück', () => {
    const userId = createEmployee('reversal-write');

    const originalId = createTransaction({
      userId,
      date: '2026-05-01',
      type: 'correction',
      hours: 5,
      description: 'Original-Korrektur (Testfixture)',
      referenceType: 'work_period',
      referenceId: 999001,
    });
    expect(originalId).not.toBeNull();

    const reversalId = createTransaction({
      userId,
      date: '2026-05-01',
      type: 'correction',
      hours: -5,
      description: 'Storno der Original-Korrektur (Testfixture)',
      referenceType: 'work_period',
      referenceId: 999001,
      reversalOf: originalId as number,
    });
    expect(reversalId).not.toBeNull();

    const row = db
      .prepare(`SELECT reversalOf FROM overtime_transactions WHERE id = ?`)
      .get(reversalId) as { reversalOf: number | null };
    expect(row.reversalOf).toBe(originalId);
  });

  it('2. eine Gegenbuchung mit umgekehrtem Vorzeichen wird trotz sonst gleicher Merkmale nicht als Duplikat verworfen', () => {
    const userId = createEmployee('idempotenz');

    const originalId = createTransaction({
      userId,
      date: '2026-05-02',
      type: 'correction',
      hours: 3,
      description: 'Original (Testfixture)',
      referenceType: 'work_period',
      referenceId: 999002,
    });
    expect(originalId).not.toBeNull();

    // Gleiche userId/date/type/referenceType/referenceId wie oben, nur hours mit
    // umgekehrtem Vorzeichen — die Idempotenzprüfung in createTransaction() bleibt
    // unverändert (kein reversalOf-Filter), erkennt das aber NICHT als Duplikat, weil
    // ABS(hours - hours) bereits über die Vorzeichenumkehr hinausgeht.
    const reversalId = createTransaction({
      userId,
      date: '2026-05-02',
      type: 'correction',
      hours: -3,
      description: 'Storno (Testfixture)',
      referenceType: 'work_period',
      referenceId: 999002,
      reversalOf: originalId as number,
    });

    expect(reversalId).not.toBeNull();
    expect(reversalId).not.toBe(originalId);
  });

  it('3. der Fremdschlüssel greift: ein INSERT mit reversalOf auf eine nicht existierende Id schlägt fehl', () => {
    const userId = createEmployee('fk-verletzung');
    const nonExistentId = 999999999;

    expect(() => {
      db.prepare(`
        INSERT INTO overtime_transactions (userId, date, type, hours, description, reversalOf)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, '2026-05-03', 'correction', -1, 'FK-Verletzungstest (Testfixture)', nonExistentId);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });
});
