import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { runOvertimeRecalcForAllUsers } from './overtimeRecalcRunner.js';

/**
 * D-05 — Nachweis der Fehlerisolierung (Plan 09.1-04, Task 1).
 *
 * Ein defekter Nutzer (eine garantiert nicht vergebene id) und ein gültiger Testnutzer laufen
 * im selben Aufruf, die defekte id steht ZUERST — das belegt, dass der Lauf danach
 * weiterarbeitet statt beim ersten Fehler abzubrechen. Muster (Nutzeranlage/Aufräumen) aus
 * `overtimeFutureCapping.test.ts`; kein `vi.stubEnv('DATABASE_PATH', …)`, kein Zugriff auf
 * `production.db` (D-16) — beide Tests laufen ausschließlich gegen die geteilte
 * `db`-Verbindung aus `connection.js`, dieselbe, die `getDatabasePath()` (Arbeitsdatenbank)
 * liefert.
 */

let testUserId: number;

beforeEach(() => {
  const username = 'testuser_recalcrunner';
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'Test', 'Recalcrunner', 'hash', 'employee', 40, '2026-06-01');
  testUserId = result.lastInsertRowid as number;

  insertTestWorkPeriod(testUserId, { validFrom: '2026-06-01', weeklyHours: 40 });
});

afterEach(() => {
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(testUserId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(testUserId);
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(testUserId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(testUserId);
  db.prepare('DELETE FROM work_time_accounts WHERE userId = ?').run(testUserId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(testUserId);
});

describe('runOvertimeRecalcForAllUsers — Fehlerisolierung (D-05)', () => {
  it('Fall 1: ein defekter Nutzer blockiert den nachfolgenden gültigen Nutzer nicht', async () => {
    const maxIdRow = db.prepare('SELECT MAX(id) + 100000 AS maxId FROM users').get() as {
      maxId: number;
    };
    const nichtVergebeneId = maxIdRow.maxId;

    const bilanz = await runOvertimeRecalcForAllUsers({
      anlass: 'handbetrieb',
      userIds: [nichtVergebeneId, testUserId],
    });

    expect(bilanz.gesamt).toBe(2);
    expect(bilanz.verarbeitet).toBe(1);
    expect(bilanz.fehlgeschlagen).toBe(1);
    expect(bilanz.fehler.length).toBe(1);
    expect(bilanz.fehler[0].userId).toBe(nichtVergebeneId);
    expect(bilanz.fehler[0].meldung).toContain('User not found');

    const balanceRows = db
      .prepare('SELECT COUNT(*) AS c FROM overtime_balance WHERE userId = ?')
      .get(testUserId) as { c: number };
    expect(balanceRows.c).toBeGreaterThanOrEqual(1);
  });

  it('Fall 2: die Bilanz stimmt', async () => {
    const maxIdRow = db.prepare('SELECT MAX(id) + 100000 AS maxId FROM users').get() as {
      maxId: number;
    };
    const nichtVergebeneId = maxIdRow.maxId;

    const bilanz = await runOvertimeRecalcForAllUsers({
      anlass: 'handbetrieb',
      userIds: [nichtVergebeneId, testUserId],
    });

    expect(bilanz.verarbeitet + bilanz.fehlgeschlagen).toBe(bilanz.gesamt);
    expect(bilanz.dauerMs).toBeGreaterThanOrEqual(0);
    expect(bilanz.anlass).toBe('handbetrieb');
  });
});
