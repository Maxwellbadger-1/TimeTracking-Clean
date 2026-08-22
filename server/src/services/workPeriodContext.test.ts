import { describe, it, expect, beforeAll, vi } from 'vitest';
import { db } from '../database/connection.js';
import * as workPeriodService from './workPeriodService.js';
import { createWorkPeriod, closeWorkPeriod } from './workPeriodService.js';
import { createWorkPeriodContext, directWorkPeriodLookup } from './workPeriodContext.js';

/**
 * WORK PERIOD CONTEXT TESTS — Plan 11-02
 *
 * D1: der Kontext lädt die Perioden eines Nutzers genau einmal vor, danach löst er
 * ausschließlich im Speicher auf (Nachweis über einen `vi.spyOn`-Zähler auf
 * `getWorkPeriods`, keine Behauptung im Kommentar).
 *
 * D2: der Kontext lebt nur für seinen Lauf — kein Modulzustand überlebt einen Request. Ein
 * neuer Kontext nach einem Schreibvorgang sieht den neuen Stand, ein alter Kontext behält
 * seinen geladenen Stand.
 *
 * Fixtures und Aufräummuster sind wörtlich aus `workPeriodService.test.ts` (Plan 10-04)
 * übernommen — dieselbe geteilte Verbindung, dasselbe `DELETE FROM users`-Aufräumen.
 */

const TEST_NOTE_MARKER = 'workperiodcontext-test-marker-11-02';

function createTestUser(suffix: string): number {
  const username = `testuser_workperiodctx_${suffix}_${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'Test', 'WorkPeriodContext', 'hash', 'employee', 40, '2020-01-01');
  return result.lastInsertRowid as number;
}

function deleteTestUser(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

beforeAll(() => {
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

describe('createWorkPeriodContext — Vertrag', () => {
  it('liefert ein Objekt mit resolve(userId, date)', () => {
    const ctx = createWorkPeriodContext();
    expect(typeof ctx.resolve).toBe('function');
  });
});

describe('createWorkPeriodContext — Vorladen, genau ein Ladevorgang je Nutzer (D1)', () => {
  it('zweimal resolve für denselben Nutzer an verschiedenen Daten löst getWorkPeriods genau einmal aus', () => {
    const userId = createTestUser('preload-same-user');
    try {
      createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

      const spy = vi.spyOn(workPeriodService, 'getWorkPeriods');
      const ctx = createWorkPeriodContext();

      ctx.resolve(userId, '2026-02-01');
      ctx.resolve(userId, '2026-06-01');

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    } finally {
      deleteTestUser(userId);
    }
  });

  it('resolve für zwei verschiedene Nutzer löst getWorkPeriods zweimal aus', () => {
    const userA = createTestUser('preload-user-a');
    const userB = createTestUser('preload-user-b');
    try {
      createWorkPeriod({ userId: userA, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
      createWorkPeriod({ userId: userB, validFrom: '2026-01-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });

      const spy = vi.spyOn(workPeriodService, 'getWorkPeriods');
      const ctx = createWorkPeriodContext();

      ctx.resolve(userA, '2026-02-01');
      ctx.resolve(userB, '2026-02-01');

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    } finally {
      deleteTestUser(userA);
      deleteTestUser(userB);
    }
  });

  it('ein Nutzer ohne Periode liefert null und merkt sich das negative Ergebnis — kein zweiter Ladevorgang', () => {
    const userId = createTestUser('preload-empty');
    try {
      const spy = vi.spyOn(workPeriodService, 'getWorkPeriods');
      const ctx = createWorkPeriodContext();

      expect(ctx.resolve(userId, '2026-02-01')).toBeNull();
      expect(ctx.resolve(userId, '2026-06-01')).toBeNull();

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    } finally {
      deleteTestUser(userId);
    }
  });

  it('löst dieselben Perioden auf wie resolveWorkPeriodAt (halboffenes Intervall, D1 Phase 10)', () => {
    const userId = createTestUser('preload-correctness');
    try {
      createWorkPeriod({ userId, validFrom: '2026-01-01', validTo: '2026-07-15', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
      createWorkPeriod({ userId, validFrom: '2026-07-15', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });

      const ctx = createWorkPeriodContext();

      expect(ctx.resolve(userId, '2026-07-14')?.weeklyHours).toBe(40);
      expect(ctx.resolve(userId, '2026-07-15')?.weeklyHours).toBe(20);
      expect(ctx.resolve(userId, '2025-12-31')).toBeNull();
    } finally {
      deleteTestUser(userId);
    }
  });
});

describe('createWorkPeriodContext — Lebensdauer nur für den eigenen Lauf (D2)', () => {
  it('ein NEUER Kontext nach einem Periodenschreibvorgang sieht den neuen Stand; der ALTE Kontext behält seinen geladenen Stand', () => {
    const userId = createTestUser('lifetime');
    try {
      const first = createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

      const oldCtx = createWorkPeriodContext();
      // Erster Zugriff lädt und merkt den Stand vor dem Wechsel.
      expect(oldCtx.resolve(userId, '2026-06-01')?.weeklyHours).toBe(40);

      // Stichtagswechsel: alte Periode schließen, neue anlegen.
      closeWorkPeriod(first.id, '2026-09-01');
      createWorkPeriod({ userId, validFrom: '2026-09-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });

      // Der alte Kontext hat seinen Stand VOR dem Wechsel gemerkt — er sieht die alte,
      // inzwischen bereits geschlossene Periode weiterhin unverändert für dasselbe Datum.
      expect(oldCtx.resolve(userId, '2026-06-01')?.weeklyHours).toBe(40);
      // Ein Datum NACH dem Wechsel wird vom alten (veralteten) Stand her weiterhin auf die
      // ursprüngliche laufende Periode aufgelöst, weil der alte Kontext den Schreibvorgang
      // nicht mehr sieht (D2 — genau das ist die geforderte Isolation).
      expect(oldCtx.resolve(userId, '2026-09-01')?.weeklyHours).toBe(40);

      // Ein NEUER Kontext sieht den aktuellen Stand.
      const newCtx = createWorkPeriodContext();
      expect(newCtx.resolve(userId, '2026-08-31')?.weeklyHours).toBe(40);
      expect(newCtx.resolve(userId, '2026-09-01')?.weeklyHours).toBe(20);
    } finally {
      deleteTestUser(userId);
    }
  });
});

describe('directWorkPeriodLookup — Fallback ohne Kontext (D2)', () => {
  it('liefert für dieselben Daten dasselbe Ergebnis wie ein frischer Kontext', () => {
    const userId = createTestUser('direct-parity');
    try {
      createWorkPeriod({ userId, validFrom: '2026-01-01', validTo: '2026-07-15', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
      createWorkPeriod({ userId, validFrom: '2026-07-15', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });

      const ctx = createWorkPeriodContext();

      expect(directWorkPeriodLookup.resolve(userId, '2026-07-14')?.weeklyHours).toBe(
        ctx.resolve(userId, '2026-07-14')?.weeklyHours
      );
      expect(directWorkPeriodLookup.resolve(userId, '2026-07-15')?.weeklyHours).toBe(
        ctx.resolve(userId, '2026-07-15')?.weeklyHours
      );
    } finally {
      deleteTestUser(userId);
    }
  });

  it('ruft resolveWorkPeriodAt auf und schlägt bei jedem Aufruf erneut nach (kein Vorladen)', () => {
    const userId = createTestUser('direct-refetch');
    try {
      createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

      const spy = vi.spyOn(workPeriodService, 'resolveWorkPeriodAt');

      directWorkPeriodLookup.resolve(userId, '2026-02-01');
      directWorkPeriodLookup.resolve(userId, '2026-06-01');

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    } finally {
      deleteTestUser(userId);
    }
  });
});

describe('Fehlerverhalten — ungültiges Datumsformat (beide Varianten gleich)', () => {
  it('createWorkPeriodContext().resolve wirft mit einer Meldung, die den Wert zitiert', () => {
    const ctx = createWorkPeriodContext();
    expect(() => ctx.resolve(1, '2026-8-1')).toThrow('2026-8-1');
  });

  it('directWorkPeriodLookup.resolve wirft mit einer Meldung, die den Wert zitiert', () => {
    expect(() => directWorkPeriodLookup.resolve(1, '2026-8-1')).toThrow('2026-8-1');
  });
});

describe('workPeriodContext — Aufräumnachweis', () => {
  it('hinterlässt nach dem Lauf keine Periode eines Testnutzers dieser Datei', () => {
    const markerRow = db
      .prepare('SELECT COUNT(*) as count FROM user_work_periods WHERE note = ?')
      .get(TEST_NOTE_MARKER) as { count: number };
    expect(markerRow.count).toBe(0);
  });
});
