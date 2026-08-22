import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { db } from '../database/connection.js';
import * as workPeriodService from './workPeriodService.js';
import { getWorkPeriods, getCurrentWorkPeriod, checkPeriodChain } from './workPeriodService.js';
import { createUser, updateUser, ensureInitialWorkPeriod, usernameExists } from './userService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import type { UserCreateInput, WorkSchedule } from '../types/index.js';

/**
 * USER WORK PERIOD PROVISIONING TESTS — Plan 11-03
 *
 * Nachweis, dass die Periodenkette lückenlos bleibt, nicht nur für den Bestand aus
 * Migration 009, sondern für jeden Nutzer, der seither über `createUser()` entsteht, und
 * dass eine Stammdatenänderung (`updateUser()`) weiterhin in die offene Periode spiegelt
 * (D4/Plan-Objective 11-03).
 *
 * Diese Tests laufen — wie `workPeriodService.test.ts` und `workPeriodContext.test.ts` —
 * gegen die geteilte Verbindung aus `connection.js` und damit gegen
 * `database/development.db`. Es laufen gleichzeitig andere Executor-Agenten auf derselben
 * Arbeitsdatenbank; jeder Testnutzer trägt deshalb den eindeutigen Präfix `t1103-` und wird
 * in `afterEach` wieder entfernt (`DELETE FROM users` cascadet die Perioden — Migration 008,
 * DELETE-Guard lässt das zu, weil der Elternsatz zum Zeitpunkt der Kaskade bereits fort ist).
 */

const TEST_USERNAME_PREFIX = 't1103-';

function testUsername(suffix: string): string {
  return `${TEST_USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
}

function baseUserInput(suffix: string, overrides: Partial<UserCreateInput> = {}): UserCreateInput {
  const username = testUsername(suffix);
  return {
    username,
    email: `${username}@test.local`,
    password: 'test-secret-12345',
    firstName: 'Test',
    lastName: 'Provisioning',
    role: 'employee',
    weeklyHours: 40,
    ...overrides,
  };
}

function deleteTestUser(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/** Legt einen Nutzer OHNE Periode an — direktes INSERT statt createUser(), um den
 *  „Alt-Nutzer ohne Periode"-Fall (Sicherheitsnetz aus Task 2) ohne Trigger-Umgehung
 *  nachzustellen (Muster aus workPeriodService.test.ts:createTestUser). */
function createRawTestUser(suffix: string, weeklyHours: number, hireDate: string | null): number {
  const username = testUsername(suffix);
  const result = db
    .prepare(
      `INSERT INTO users (username, email, password, firstName, lastName, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'hash', 'Test', 'Provisioning', 'employee', weeklyHours, hireDate);
  return result.lastInsertRowid as number;
}

beforeAll(() => {
  // Ohne aktive Fremdschlüssel räumt ON DELETE CASCADE die Perioden beim Löschen des
  // Testnutzers nicht ab (Muster aus workPeriodService.test.ts/workPeriodContext.test.ts).
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

describe('createUser — Startperiode (Task 1)', () => {
  let createdUserId: number | null = null;

  afterEach(() => {
    if (createdUserId !== null) {
      deleteTestUser(createdUserId);
      createdUserId = null;
    }
  });

  it('legt bei hireDate genau eine offene Periode ab hireDate an, Werte wörtlich aus dem Nutzer', async () => {
    const workSchedule: WorkSchedule = {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 4,
      saturday: 0,
      sunday: 0,
    };
    const input = baseUserInput('hiredate', {
      weeklyHours: 36,
      workSchedule,
      hireDate: '2026-03-15',
    });

    const user = await createUser(input);
    createdUserId = user.id;

    const periods = getWorkPeriods(user.id);
    expect(periods.length).toBe(1);
    expect(periods[0].validFrom).toBe('2026-03-15');
    expect(periods[0].validTo).toBeNull();
    expect(periods[0].weeklyHours).toBe(36);
    expect(periods[0].workSchedule).toEqual(workSchedule);
    expect(periods[0].note).toContain('hireDate');

    expect(checkPeriodChain(user.id).ok).toBe(true);
  });

  it('ohne hireDate wird validFrom = heutiges Datum, note nennt den Grund', async () => {
    const input = baseUserInput('nohiredate', { hireDate: undefined });

    const user = await createUser(input);
    createdUserId = user.id;

    const periods = getWorkPeriods(user.id);
    expect(periods.length).toBe(1);
    expect(periods[0].validFrom).toBe(formatDate(getCurrentDate(), 'yyyy-MM-dd'));
    expect(periods[0].validTo).toBeNull();
    expect(periods[0].note).toContain('Anlagedatum');

    expect(checkPeriodChain(user.id).ok).toBe(true);
  });

  it('schlägt das Anlegen der Periode fehl, wird auch der Nutzer nicht angelegt (Atomarität, T-11-09)', async () => {
    const spy = vi
      .spyOn(workPeriodService, 'createWorkPeriod')
      .mockImplementation(() => {
        throw new Error('injizierter Fehler für den Atomaritätsnachweis (11-03)');
      });

    const input = baseUserInput('atomicfail', { hireDate: '2026-03-15' });

    await expect(createUser(input)).rejects.toThrow(
      'injizierter Fehler für den Atomaritätsnachweis (11-03)'
    );

    spy.mockRestore();

    expect(usernameExists(input.username)).toBe(false);
  });

  it('ensureInitialWorkPeriod auf einen Nutzer mit bestehender Periode erzeugt keine zweite', async () => {
    const input = baseUserInput('idempotent', { hireDate: '2026-03-15' });
    const user = await createUser(input);
    createdUserId = user.id;

    expect(getWorkPeriods(user.id).length).toBe(1);

    const result = ensureInitialWorkPeriod(user);

    expect(result).toBeNull();
    expect(getWorkPeriods(user.id).length).toBe(1);
  });
});

describe('updateUser — Spiegelung in die offene Periode (Task 2)', () => {
  let createdUserId: number | null = null;

  afterEach(() => {
    if (createdUserId !== null) {
      deleteTestUser(createdUserId);
      createdUserId = null;
    }
  });

  it('weeklyHours-Änderung spiegelt in users UND in die offene Periode, validFrom bleibt', async () => {
    const input = baseUserInput('mirror-hours', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const periodBefore = getCurrentWorkPeriod(user.id);
    expect(periodBefore?.weeklyHours).toBe(40);

    const updated = await updateUser(user.id, { weeklyHours: 20 });
    expect(updated.weeklyHours).toBe(20);

    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.weeklyHours).toBe(20);
    expect(periodAfter?.validFrom).toBe(periodBefore?.validFrom);
    expect(periodAfter?.id).toBe(periodBefore?.id);
    expect(getWorkPeriods(user.id).length).toBe(1);
  });

  it('workSchedule-Änderung spiegelt genauso in die offene Periode', async () => {
    const input = baseUserInput('mirror-schedule', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const newSchedule: WorkSchedule = {
      monday: 6,
      tuesday: 6,
      wednesday: 6,
      thursday: 6,
      friday: 6,
      saturday: 0,
      sunday: 0,
    };

    await updateUser(user.id, { workSchedule: newSchedule });

    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.workSchedule).toEqual(newSchedule);
    expect(getWorkPeriods(user.id).length).toBe(1);
  });

  it('ein Update ohne weeklyHours/workSchedule rührt die Periode nicht an', async () => {
    const input = baseUserInput('mirror-untouched', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const spy = vi.spyOn(workPeriodService, 'getCurrentWorkPeriod');
    spy.mockClear();

    await updateUser(user.id, { firstName: 'Geändert' });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.weeklyHours).toBe(40);
  });

  it('ein Update, das den bisherigen Wert wiederholt, schreibt nicht (kein leerer Vorgang)', async () => {
    const input = baseUserInput('mirror-noop', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const spy = vi.spyOn(workPeriodService, 'getCurrentWorkPeriod');
    spy.mockClear();

    await updateUser(user.id, { weeklyHours: 40 });

    // mustMirrorPeriod bleibt false, weil der Wert unverändert ist — der Mirror-Zweig ruft
    // getCurrentWorkPeriod() gar nicht erst auf.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('hat der Nutzer keine Periode, wird über ensureInitialWorkPeriod erst eine angelegt und danach gespiegelt', async () => {
    // Alt-Nutzer-Fall: direktes INSERT statt createUser(), damit gar keine Periode existiert
    // (das Sicherheitsnetz aus Task 2 soll genau diesen Fall abfangen).
    const userId = createRawTestUser('mirror-noperiod', 40, '2026-01-01');
    createdUserId = userId;
    expect(getWorkPeriods(userId).length).toBe(0);

    const updated = await updateUser(userId, { weeklyHours: 25 });
    expect(updated.weeklyHours).toBe(25);

    const periods = getWorkPeriods(userId);
    expect(periods.length).toBe(1);
    expect(periods[0].weeklyHours).toBe(25);
    expect(periods[0].validTo).toBeNull();
    expect(checkPeriodChain(userId).ok).toBe(true);
  });

  it('Nutzer-Update und Periodenspiegelung sind atomar', async () => {
    const input = baseUserInput('mirror-atomic', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const periodBefore = getCurrentWorkPeriod(user.id);

    const spy = vi
      .spyOn(workPeriodService, 'getCurrentWorkPeriod')
      .mockImplementation(() => {
        throw new Error('injizierter Fehler für den Atomaritätsnachweis (Task 2)');
      });

    await expect(updateUser(user.id, { weeklyHours: 55 })).rejects.toThrow(
      'injizierter Fehler für den Atomaritätsnachweis (Task 2)'
    );

    spy.mockRestore();

    // Weder users.weeklyHours noch die Periode wurden geändert — die Transaktion hat
    // beides zurückgerollt.
    const usersRow = db.prepare('SELECT weeklyHours FROM users WHERE id = ?').get(user.id) as {
      weeklyHours: number;
    };
    expect(usersRow.weeklyHours).toBe(40);
    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.weeklyHours).toBe(periodBefore?.weeklyHours);
  });
});

describe('Vollständige Kette nach Anlage und Änderung (Task 3, zusätzliche Fälle)', () => {
  let createdUserId: number | null = null;

  afterEach(() => {
    if (createdUserId !== null) {
      deleteTestUser(createdUserId);
      createdUserId = null;
    }
  });

  it('nach createUser liefert checkPeriodChain(userId) ok: true', async () => {
    const input = baseUserInput('chain-create', { hireDate: '2026-02-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    expect(checkPeriodChain(user.id)).toEqual({ ok: true, findings: [] });
  });

  it('nach updateUser mit geänderten Wochenstunden bleibt checkPeriodChain ok: true, weiterhin genau 1 Periode', async () => {
    const input = baseUserInput('chain-update', { weeklyHours: 40, hireDate: '2026-02-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    await updateUser(user.id, { weeklyHours: 15 });

    expect(checkPeriodChain(user.id)).toEqual({ ok: true, findings: [] });
    expect(getWorkPeriods(user.id).length).toBe(1);
  });

  it('ein zweiter ensureInitialWorkPeriod-Aufruf erzeugt keine zweite Periode', async () => {
    const input = baseUserInput('chain-ensure-twice', { hireDate: '2026-02-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const first = ensureInitialWorkPeriod(user);
    const second = ensureInitialWorkPeriod(user);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(getWorkPeriods(user.id).length).toBe(1);
  });
});

describe('userWorkPeriodProvisioning — Aufräumnachweis', () => {
  it('hinterlässt nach dem Lauf keinen Nutzer mit dem Testmarker t1103- und keine seiner Perioden', () => {
    const userRow = db
      .prepare(`SELECT COUNT(*) as count FROM users WHERE username LIKE ?`)
      .get(`${TEST_USERNAME_PREFIX}%`) as { count: number };
    expect(userRow.count).toBe(0);

    const periodRow = db
      .prepare(
        `SELECT COUNT(*) as count FROM user_work_periods p
         JOIN users u ON u.id = p.userId
         WHERE u.username LIKE ?`
      )
      .get(`${TEST_USERNAME_PREFIX}%`) as { count: number };
    expect(periodRow.count).toBe(0);
  });
});
