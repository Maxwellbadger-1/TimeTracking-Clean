import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { db } from '../database/connection.js';
import * as workPeriodService from './workPeriodService.js';
import { getWorkPeriods, getCurrentWorkPeriod, checkPeriodChain } from './workPeriodService.js';
import { createUser, updateUser, ensureInitialWorkPeriod, usernameExists, WorkPeriodBypassError } from './userService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';
import { getDailyTargetHours } from '../utils/workingDays.js';
import { createWorkPeriodContext } from './workPeriodContext.js';
import type { UserCreateInput, WorkSchedule } from '../types/index.js';

/**
 * USER WORK PERIOD PROVISIONING TESTS — Plan 11-03, umgestellt in Plan 14-02 (WR-07)
 *
 * Nachweis, dass die Periodenkette lückenlos bleibt, nicht nur für den Bestand aus
 * Migration 009, sondern für jeden Nutzer, der seither über `createUser()` entsteht.
 *
 * WR-07 (Plan 14-02): `updateUser()` spiegelt eine geänderte `weeklyHours`/`workSchedule`
 * NICHT MEHR in die offene Periode — sie wird mit `WorkPeriodBypassError` abgewiesen, bevor
 * irgendetwas geschrieben wird. Die Tests dieser Datei bilden das umgekehrte Verhalten ab:
 * eine tatsächliche Wertänderung wirft, ein unveränderter Wert (der Weg, den
 * `EditUserModal.handleSubmit` geht) läuft weiterhin durch. Siehe
 * `.planning/phases/14-absicherung-und-auslieferung/14-WR07-ENTSCHEIDUNG.md`.
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

describe('updateUser — WR-07: Abweisung statt Spiegelung (Plan 14-02)', () => {
  let createdUserId: number | null = null;

  afterEach(() => {
    if (createdUserId !== null) {
      deleteTestUser(createdUserId);
      createdUserId = null;
    }
  });

  function countTransactions(userId: number): number {
    return (
      db.prepare('SELECT COUNT(*) as c FROM overtime_transactions WHERE userId = ?').get(userId) as {
        c: number;
      }
    ).c;
  }

  it('WR-07: eine weeklyHours-Aenderung ueber updateUser wird abgewiesen, Periode und Saldo bleiben unangetastet', async () => {
    const input = baseUserInput('mirror-hours', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const periodBefore = getCurrentWorkPeriod(user.id);
    expect(periodBefore?.weeklyHours).toBe(40);
    const transactionsBefore = countTransactions(user.id);

    await expect(updateUser(user.id, { weeklyHours: 20 })).rejects.toThrow(WorkPeriodBypassError);

    const usersRow = db.prepare('SELECT weeklyHours FROM users WHERE id = ?').get(user.id) as {
      weeklyHours: number;
    };
    expect(usersRow.weeklyHours).toBe(40);

    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.weeklyHours).toBe(40);
    expect(periodAfter?.id).toBe(periodBefore?.id);
    expect(getWorkPeriods(user.id).length).toBe(1);
    expect(countTransactions(user.id)).toBe(transactionsBefore);
  });

  it('WR-07: eine workSchedule-Aenderung ueber updateUser wird abgewiesen, Periode und Saldo bleiben unangetastet', async () => {
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
    const transactionsBefore = countTransactions(user.id);

    await expect(updateUser(user.id, { workSchedule: newSchedule })).rejects.toThrow(
      WorkPeriodBypassError
    );

    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.workSchedule).toBeNull();
    expect(getWorkPeriods(user.id).length).toBe(1);
    expect(countTransactions(user.id)).toBe(transactionsBefore);
  });

  it('Gegenprobe: ein Update ohne weeklyHours/workSchedule wirft NICHT und ruehrt die Periode nicht an', async () => {
    const input = baseUserInput('mirror-untouched', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const spy = vi.spyOn(workPeriodService, 'getCurrentWorkPeriod');
    spy.mockClear();

    await expect(updateUser(user.id, { firstName: 'Geändert' })).resolves.toMatchObject({
      firstName: 'Geändert',
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.weeklyHours).toBe(40);
  });

  it('Gegenprobe: ein Update, das den bisherigen weeklyHours-Wert wiederholt, wirft NICHT (das ist der Weg von EditUserModal.handleSubmit)', async () => {
    const input = baseUserInput('mirror-noop', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const spy = vi.spyOn(workPeriodService, 'getCurrentWorkPeriod');
    spy.mockClear();

    await expect(updateUser(user.id, { weeklyHours: 40 })).resolves.toMatchObject({
      weeklyHours: 40,
    });

    // Kein Wertwechsel -> keine Abweisung, und der (ohnehin entfallene) Mirror-Zweig hätte
    // getCurrentWorkPeriod() auch vorher nicht aufgerufen.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('WR-07: ein Nutzer ohne Periode bekommt bei einer weeklyHours-Aenderung ebenfalls WorkPeriodBypassError, es entsteht KEINE Periode', async () => {
    // Alt-Nutzer-Fall: direktes INSERT statt createUser(), damit gar keine Periode existiert.
    // Vor WR-07 legte der Mirror-Zweig hier per ensureInitialWorkPeriod() eine Periode an —
    // dieser Sicherheitsnetz-Pfad ist mit dem gesamten Mirror-Zweig entfallen.
    const userId = createRawTestUser('mirror-noperiod', 40, '2026-01-01');
    createdUserId = userId;
    expect(getWorkPeriods(userId).length).toBe(0);

    await expect(updateUser(userId, { weeklyHours: 25 })).rejects.toThrow(WorkPeriodBypassError);

    const usersRow = db.prepare('SELECT weeklyHours FROM users WHERE id = ?').get(userId) as {
      weeklyHours: number;
    };
    expect(usersRow.weeklyHours).toBe(40);
    expect(getWorkPeriods(userId).length).toBe(0);
  });

  it('WR-07: die Abweisung greift VOR jedem Perioden-Zugriff — getCurrentWorkPeriod() wird bei einer geaenderten weeklyHours gar nicht mehr aufgerufen', async () => {
    const input = baseUserInput('mirror-atomic', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const periodBefore = getCurrentWorkPeriod(user.id);

    // Vor WR-07 bewies dieser Mock die Transaktionsatomaritaet (ein Fehler beim Spiegeln
    // rollte auch das users-UPDATE zurueck). Nach WR-07 wirft updateUser() bereits VOR dem
    // Aufbau des SQL-UPDATE ab — dieser Mock wird fuer eine geaenderte weeklyHours gar nicht
    // mehr erreicht. Das ist die Antwort auf "welcher Fehler greift zuerst": WorkPeriodBypassError,
    // nicht der injizierte Periodenfehler.
    const spy = vi
      .spyOn(workPeriodService, 'getCurrentWorkPeriod')
      .mockImplementation(() => {
        throw new Error('sollte fuer eine geaenderte weeklyHours nicht mehr aufgerufen werden (WR-07)');
      });
    spy.mockClear();

    await expect(updateUser(user.id, { weeklyHours: 55 })).rejects.toThrow(WorkPeriodBypassError);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    // Weder users.weeklyHours noch die Periode wurden geändert.
    const usersRow = db.prepare('SELECT weeklyHours FROM users WHERE id = ?').get(user.id) as {
      weeklyHours: number;
    };
    expect(usersRow.weeklyHours).toBe(40);
    const periodAfter = getCurrentWorkPeriod(user.id);
    expect(periodAfter?.weeklyHours).toBe(periodBefore?.weeklyHours);
  });

  it('WR-07: die Fehlermeldung nennt beide Ersatzwege woertlich', async () => {
    const input = baseUserInput('mirror-message', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    await expect(updateUser(user.id, { weeklyHours: 41 })).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('POST /api/work-periods/change'),
      })
    );

    try {
      await updateUser(user.id, { weeklyHours: 41 });
      throw new Error('updateUser haette werfen muessen');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkPeriodBypassError);
      expect((error as Error).message).toContain('POST /api/work-periods/change');
      expect((error as Error).message).toContain('PUT /api/work-periods/:id');
    }
  });
});

describe('updateUser — hireDate-Änderung zieht die Startperiode mit (CR-01)', () => {
  let createdUserId: number | null = null;

  afterEach(() => {
    if (createdUserId !== null) {
      deleteTestUser(createdUserId);
      createdUserId = null;
    }
  });

  it('hireDate vorverlegen verlängert die Startperiode nach vorn — checkPeriodChain bleibt ok, getDailyTargetHours wirft nicht', async () => {
    const input = baseUserInput('hiredate-earlier', { weeklyHours: 40, hireDate: '2026-03-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const periodBefore = getCurrentWorkPeriod(user.id);
    expect(periodBefore?.validFrom).toBe('2026-03-01');

    const updated = await updateUser(user.id, { hireDate: '2026-01-01' });
    expect(updated.hireDate).toBe('2026-01-01');

    const periods = getWorkPeriods(user.id);
    expect(periods.length).toBe(1);
    expect(periods[0].id).toBe(periodBefore?.id);
    expect(periods[0].validFrom).toBe('2026-01-01');
    expect(checkPeriodChain(user.id)).toEqual({ ok: true, findings: [] });

    // 2026-01-05 liegt im vormals periodenlosen Loch [neues hireDate, altes validFrom).
    // Vor CR-01 warf getDailyTargetHours hier MissingWorkPeriodError.
    const periodsContext = createWorkPeriodContext();
    expect(() => getDailyTargetHours(updated, '2026-01-05', periodsContext)).not.toThrow();
    expect(getDailyTargetHours(updated, '2026-01-05', createWorkPeriodContext())).toBe(8);
  });

  it('hireDate nach hinten verlegen lässt die Kette bewusst stehen — kein Loch, kein Wurf', async () => {
    const input = baseUserInput('hiredate-later', { weeklyHours: 40, hireDate: '2026-01-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    const periodBefore = getCurrentWorkPeriod(user.id);
    expect(periodBefore?.validFrom).toBe('2026-01-01');

    const updated = await updateUser(user.id, { hireDate: '2026-03-01' });
    expect(updated.hireDate).toBe('2026-03-01');

    const periods = getWorkPeriods(user.id);
    expect(periods.length).toBe(1);
    expect(periods[0].validFrom).toBe('2026-01-01');
    expect(checkPeriodChain(user.id)).toEqual({ ok: true, findings: [] });

    expect(() => getDailyTargetHours(updated, '2026-03-05', createWorkPeriodContext())).not.toThrow();
  });

  it('hireDate-Änderung bei einem Nutzer ganz ohne Periode legt die Startperiode mit dem NEUEN Datum an', async () => {
    const userId = createRawTestUser('hiredate-noperiod', 40, '2026-05-01');
    createdUserId = userId;
    expect(getWorkPeriods(userId).length).toBe(0);

    await updateUser(userId, { hireDate: '2026-02-01' });

    const periods = getWorkPeriods(userId);
    expect(periods.length).toBe(1);
    expect(periods[0].validFrom).toBe('2026-02-01');
    expect(periods[0].validTo).toBeNull();
    expect(checkPeriodChain(userId)).toEqual({ ok: true, findings: [] });
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

  it('WR-07: ein abgewiesener updateUser-Aufruf mit geaenderten Wochenstunden laesst checkPeriodChain unveraendert ok: true, weiterhin genau 1 Periode', async () => {
    const input = baseUserInput('chain-update', { weeklyHours: 40, hireDate: '2026-02-01' });
    const user = await createUser(input);
    createdUserId = user.id;

    await expect(updateUser(user.id, { weeklyHours: 15 })).rejects.toThrow(WorkPeriodBypassError);

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
