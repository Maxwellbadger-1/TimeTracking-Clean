import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  resolveWorkPeriodAt,
  resolveWorkPeriodIn,
  getWorkPeriods,
  getCurrentWorkPeriod,
  createWorkPeriod,
  closeWorkPeriod,
  checkPeriodChain,
  checkAllPeriodChains,
  WorkPeriodConflictError,
  getWorkPeriodById,
  extendWorkPeriodTo,
  updateWorkPeriodValues,
  setWorkPeriodValidFrom,
  softDeleteWorkPeriod,
  getWorkPeriodsWithFlags,
  withSuspendedChainGuard,
} from './workPeriodService.js';
import type { UserWorkPeriod, WorkSchedule } from '../types/index.js';

/**
 * WORK PERIOD SERVICE TESTS — Grenzfälle der Auflösung und des Schreibpfads (Plan 10-04)
 *
 * Diese Tests laufen gegen die geteilte Verbindung aus `connection.js` und damit gegen
 * `database/development.db`, weil der Service diese Verbindung fest verdrahtet hat (Muster
 * aus `overtimeTransactionRebuildService.test.ts`). Fixtures werden je Test frisch mit einem
 * eindeutigen `username` angelegt; das Aufräumen läuft ausschließlich über
 * `DELETE FROM users WHERE id = ?` (ON DELETE CASCADE räumt die Perioden ab — einzelnes
 * Löschen einer mittleren Periode weist der DELETE-Trigger aus Migration 008 ab, solange der
 * Nutzer noch existiert).
 *
 * Jeder Test, der eine Periode zu einem Datum braucht, ruft `resolveWorkPeriodAt()` auf statt
 * die Auflösung nachzubauen — genau das soll dieser Service verhindern (Lehre aus
 * `09-INVENTAR-KREDITIERUNG.md`: zwölf Kopien derselben Regel).
 */

const TEST_NOTE_MARKER = 'workperiod-test-marker-10-04';

/**
 * Wörtliche Kopie des INSERT-Guard-Triggers aus `server/src/database/schema.ts` (Stand
 * Migration 013, DD-2/D3 aus 13-01-PLAN.md) — NICHT mehr die Fassung aus Migration 008. Wird
 * nur genutzt, um den Trigger innerhalb einer einzigen atomaren Transaktion kurz zu entfernen
 * und sofort wiederherzustellen (siehe Test zu `checkPeriodChain` mit eingeschleuster Lücke
 * unten) — die Transaktion hält den SQLite-Schreiblock, sodass kein anderer Prozess in der
 * Lücke zwischen DROP und CREATE schreiben kann.
 *
 * PHASE 13 (Rule 1 — Bugfix, 13-03-PLAN.md Task 2): Diese Konstante trug bis hierhin noch die
 * VORPHASE-13-Fassung des Triggers (ohne `suspended`-Abfrage, ohne `deletedAt IS NULL`-Filter).
 * Jeder Testlauf dieser Datei DROPPTE den migrierten (korrekten) Trigger auf der geteilten
 * `development.db` und ERSETZTE ihn dauerhaft durch diese veraltete Fassung — die Migration
 * 013/014-Zusage (aussetzbarer Kettenriegel, `withSuspendedChainGuard()`) war danach für JEDEN
 * nachfolgenden Testlauf und jeden Serverstart gegen dieselbe Datenbank wirkungslos, bis die
 * Migration erneut liefe (was `runMigrations()` wegen der bereits verbuchten Zeile in
 * `migrations` nie täte). Plan 13-03 (Task 2, `correctWorkPeriod()`) deckte das auf, weil sein
 * `withSuspendedChainGuard()`-Aufruf dadurch nicht mehr griff.
 */
const INSERT_GUARD_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_insert_guard
  BEFORE INSERT ON user_work_periods
  BEGIN
    SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
    WHERE (SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0
      AND EXISTS (
        SELECT 1 FROM user_work_periods p
        WHERE p.userId = NEW.userId
          AND p.deletedAt IS NULL
          AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
          AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
      );
    SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
    WHERE (SELECT suspended FROM work_period_chain_guard WHERE id = 1) = 0
      AND EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId AND p.deletedAt IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM user_work_periods p
        WHERE p.userId = NEW.userId
          AND p.deletedAt IS NULL
          AND (p.validTo = NEW.validFrom
               OR (NEW.validTo IS NOT NULL AND p.validFrom = NEW.validTo))
      );
  END
`;

function createTestUser(suffix: string): number {
  const username = `testuser_workperiod_${suffix}_${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'Test', 'WorkPeriod', 'hash', 'employee', 40, '2020-01-01');
  return result.lastInsertRowid as number;
}

function deleteTestUser(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

beforeAll(() => {
  // Ohne aktive Fremdschlüssel räumt ON DELETE CASCADE die Perioden beim Löschen des
  // Testnutzers nicht ab — einmal setzen und den tatsächlichen Wert zurücklesen statt ihn
  // nur anzunehmen.
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

/** Baut eine UserWorkPeriod-Fixture ohne Datenbankzugriff — für resolveWorkPeriodIn(). */
function makePeriod(
  overrides: Partial<UserWorkPeriod> & Pick<UserWorkPeriod, 'validFrom' | 'validTo' | 'weeklyHours'>
): UserWorkPeriod {
  return {
    id: overrides.id ?? 1,
    userId: overrides.userId ?? 1,
    validFrom: overrides.validFrom,
    validTo: overrides.validTo,
    weeklyHours: overrides.weeklyHours,
    workSchedule: overrides.workSchedule ?? null,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    createdBy: overrides.createdBy ?? null,
    deletedAt: overrides.deletedAt ?? null,
    deletedBy: overrides.deletedBy ?? null,
  };
}

describe('resolveWorkPeriodIn — die eine Auflösung, jetzt datenbankfrei (Plan 11-02)', () => {
  it('leere Liste liefert null', () => {
    expect(resolveWorkPeriodIn([], '2026-05-01')).toBeNull();
  });

  it('eine laufende Periode [2026-01-01, null) löst am validFrom auf', () => {
    const p = makePeriod({ id: 1, validFrom: '2026-01-01', validTo: null, weeklyHours: 40 });
    expect(resolveWorkPeriodIn([p], '2026-01-01')).toBe(p);
  });

  it('zwei Perioden: 2026-07-14 löst die erste, 2026-07-15 die zweite auf (halboffen, D1 Phase 10)', () => {
    const p1 = makePeriod({ id: 1, validFrom: '2026-01-01', validTo: '2026-07-15', weeklyHours: 40 });
    const p2 = makePeriod({ id: 2, validFrom: '2026-07-15', validTo: null, weeklyHours: 20 });
    expect(resolveWorkPeriodIn([p1, p2], '2026-07-14')).toBe(p1);
    expect(resolveWorkPeriodIn([p1, p2], '2026-07-15')).toBe(p2);
  });

  it('Datum vor der ersten Periode liefert null', () => {
    const p1 = makePeriod({ id: 1, validFrom: '2026-01-01', validTo: null, weeklyHours: 40 });
    expect(resolveWorkPeriodIn([p1], '2025-12-31')).toBeNull();
  });

  it("ein Datum ohne YYYY-MM-DD-Muster wirft mit einer Meldung, die den Wert zitiert", () => {
    expect(() => resolveWorkPeriodIn([], '2026-8-1')).toThrow('2026-8-1');
  });

  it('ein zur Laufzeit übergebenes Date-Objekt wirft trotz TypeScript-Signatur', () => {
    const runtimeDate = new Date('2026-08-01') as unknown as string;
    expect(() => resolveWorkPeriodIn([], runtimeDate)).toThrow();
  });
});

describe('resolveWorkPeriodAt — Grenzfälle des halboffenen Intervalls (D1)', () => {
  let userId: number;
  const P1_FROM = '2026-01-01';
  const P1_TO = '2026-08-01'; // = P2_FROM
  const P2_TO = '2027-01-01'; // = P3_FROM

  beforeEach(() => {
    userId = createTestUser('resolve');
    // P1 [2026-01-01, 2026-08-01) 40h, P2 [2026-08-01, 2027-01-01) 20h, P3 [2027-01-01, NULL) 10h
    createWorkPeriod({ userId, validFrom: P1_FROM, validTo: P1_TO, weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
    createWorkPeriod({ userId, validFrom: P1_TO, validTo: P2_TO, weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });
    createWorkPeriod({ userId, validFrom: P2_TO, weeklyHours: 10, workSchedule: null, note: TEST_NOTE_MARKER });
  });

  afterEach(() => {
    deleteTestUser(userId);
  });

  it('2026-01-01 löst P1 auf (validFrom ist inklusiv, D1)', () => {
    expect(resolveWorkPeriodAt(userId, '2026-01-01')?.weeklyHours).toBe(40);
  });

  it('2026-07-31 löst P1 auf (letzter Kalendertag des Monats — die Zeitzonenfalle aus Phase 9)', () => {
    expect(resolveWorkPeriodAt(userId, '2026-07-31')?.weeklyHours).toBe(40);
  });

  it('2026-08-01 löst P2 auf (validTo ist exklusiv, D1)', () => {
    expect(resolveWorkPeriodAt(userId, '2026-08-01')?.weeklyHours).toBe(20);
  });

  it('2026-12-31 löst P2 auf (letzter Tag des Jahres)', () => {
    expect(resolveWorkPeriodAt(userId, '2026-12-31')?.weeklyHours).toBe(20);
  });

  it('2027-01-01 löst P3 auf (Jahresgrenze)', () => {
    expect(resolveWorkPeriodAt(userId, '2027-01-01')?.weeklyHours).toBe(10);
  });

  it('2029-06-30 löst P3 auf (offene Periode gilt unbegrenzt fort)', () => {
    expect(resolveWorkPeriodAt(userId, '2029-06-30')?.weeklyHours).toBe(10);
  });

  it('2025-12-31 liefert null (vor der ersten Periode)', () => {
    expect(resolveWorkPeriodAt(userId, '2025-12-31')).toBeNull();
  });

  it('eine unbekannte userId liefert null', () => {
    expect(resolveWorkPeriodAt(999999999, '2026-06-01')).toBeNull();
  });

  it('2026-03-29 (Beginn der Sommerzeit) löst dieselbe Periode auf wie die Nachbartage — die Zeitumstellung hat keine Wirkung', () => {
    const before = resolveWorkPeriodAt(userId, '2026-03-28');
    const dstDay = resolveWorkPeriodAt(userId, '2026-03-29');
    const after = resolveWorkPeriodAt(userId, '2026-03-30');
    expect(dstDay?.id).toBe(before?.id);
    expect(dstDay?.id).toBe(after?.id);
  });

  it('2026-10-25 (Ende der Sommerzeit) löst dieselbe Periode auf wie die Nachbartage — die Zeitumstellung hat keine Wirkung', () => {
    const before = resolveWorkPeriodAt(userId, '2026-10-24');
    const dstDay = resolveWorkPeriodAt(userId, '2026-10-25');
    const after = resolveWorkPeriodAt(userId, '2026-10-26');
    expect(dstDay?.id).toBe(before?.id);
    expect(dstDay?.id).toBe(after?.id);
  });

  it('2028-02-29 (Schalttag) wird aufgelöst, ohne zu werfen', () => {
    expect(() => resolveWorkPeriodAt(userId, '2028-02-29')).not.toThrow();
    expect(resolveWorkPeriodAt(userId, '2028-02-29')?.weeklyHours).toBe(10);
  });

  it("'2026-8-1' (fehlende führende Nullen) wirft mit einer Meldung, die den Wert zitiert", () => {
    expect(() => resolveWorkPeriodAt(userId, '2026-8-1')).toThrow('2026-8-1');
  });

  it("'01.08.2026' (deutsches Datumsformat) wirft mit einer Meldung, die den Wert zitiert", () => {
    expect(() => resolveWorkPeriodAt(userId, '01.08.2026')).toThrow('01.08.2026');
  });

  it("'2026-08-01T00:00:00Z' (ISO-Zeitstempel mit Zeitanteil) wirft mit einer Meldung, die den Wert zitiert", () => {
    expect(() => resolveWorkPeriodAt(userId, '2026-08-01T00:00:00Z')).toThrow('2026-08-01T00:00:00Z');
  });

  it('ein Date-Objekt zur Laufzeit wirft trotz TypeScript-Signatur', () => {
    const runtimeDate = new Date('2026-08-01') as unknown as string;
    expect(() => resolveWorkPeriodAt(userId, runtimeDate)).toThrow();
  });
});

describe('getWorkPeriods / getCurrentWorkPeriod — Lesepfad', () => {
  let userId: number;

  beforeEach(() => {
    userId = createTestUser('read');
  });

  afterEach(() => {
    deleteTestUser(userId);
  });

  it('getWorkPeriods liefert alle Perioden aufsteigend nach validFrom', () => {
    createWorkPeriod({ userId, validFrom: '2026-06-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });
    // Zweite Periode kann erst nach dem Schließen der ersten offenen Periode angelegt werden
    // (partieller UNIQUE-Index: höchstens eine offene Periode je Nutzer).
    const first = getCurrentWorkPeriod(userId)!;
    closeWorkPeriod(first.id, '2026-09-01');
    createWorkPeriod({ userId, validFrom: '2026-09-01', weeklyHours: 30, workSchedule: null, note: TEST_NOTE_MARKER });

    const periods = getWorkPeriods(userId);
    expect(periods).toHaveLength(2);
    expect(periods[0].validFrom).toBe('2026-06-01');
    expect(periods[1].validFrom).toBe('2026-09-01');
  });

  it('getCurrentWorkPeriod liefert null, solange keine Periode existiert', () => {
    expect(getCurrentWorkPeriod(userId)).toBeNull();
  });

  it('getCurrentWorkPeriod liefert die offene Periode (validTo IS NULL)', () => {
    createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
    expect(getCurrentWorkPeriod(userId)?.validTo).toBeNull();
  });
});

describe('workPeriodService — Schreibpfad', () => {
  let userId: number;

  beforeEach(() => {
    userId = createTestUser('write');
  });

  afterEach(() => {
    deleteTestUser(userId);
  });

  it('createWorkPeriod legt die erste Periode an und gibt sie mit id zurück', () => {
    const period = createWorkPeriod({
      userId,
      validFrom: '2026-01-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });
    expect(period.id).toBeGreaterThan(0);
    expect(period.userId).toBe(userId);
    expect(period.validTo).toBeNull();
  });

  it('eine überlappende Periode wird als WorkPeriodConflictError abgewiesen, Meldung nennt "Überlappung"', () => {
    createWorkPeriod({ userId, validFrom: '2026-01-01', validTo: '2026-06-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    let caught: unknown;
    try {
      createWorkPeriod({ userId, validFrom: '2026-03-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(WorkPeriodConflictError);
    expect((caught as Error).message).toContain('Überlappung');
  });

  it('eine Periode mit Lücke wird als WorkPeriodConflictError abgewiesen, Meldung nennt "Lücke"', () => {
    createWorkPeriod({ userId, validFrom: '2026-01-01', validTo: '2026-06-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    let caught: unknown;
    try {
      createWorkPeriod({ userId, validFrom: '2026-08-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(WorkPeriodConflictError);
    expect((caught as Error).message).toContain('Lücke');
  });

  it('Stichtagswechsel (closeWorkPeriod + createWorkPeriod): Datum davor löst die alte, das Stichtagsdatum die neue Periode auf', () => {
    const first = createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    closeWorkPeriod(first.id, '2026-09-01');
    createWorkPeriod({ userId, validFrom: '2026-09-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });

    expect(resolveWorkPeriodAt(userId, '2026-08-31')?.weeklyHours).toBe(40);
    expect(resolveWorkPeriodAt(userId, '2026-09-01')?.weeklyHours).toBe(20);
  });

  it('workSchedule überlebt Hin- und Rückweg unverändert (alle sieben Tage, auch 2.5)', () => {
    const schedule: WorkSchedule = {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 2.5,
      saturday: 0,
      sunday: 0,
    };
    const created = createWorkPeriod({
      userId,
      validFrom: '2026-01-01',
      weeklyHours: 34.5,
      workSchedule: schedule,
      note: TEST_NOTE_MARKER,
    });

    expect(created.workSchedule).toEqual(schedule);
    expect(resolveWorkPeriodAt(userId, '2026-06-01')?.workSchedule).toEqual(schedule);
  });

  it('workSchedule: null bleibt null', () => {
    createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
    expect(resolveWorkPeriodAt(userId, '2026-06-01')?.workSchedule).toBeNull();
  });

  it('eine Periode mit inhaltlich kaputtem workSchedule-Text (per SQL eingeschleust) wirft beim Lesen mit Nennung der periodId, statt einer stillen 0-Stunden-Woche', () => {
    const created = createWorkPeriod({ userId, validFrom: '2026-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    // workSchedule ist keine SQL-Spalte, die von den Triggern/CHECK-Constraints aus
    // Migration 008 geprüft wird — ein direktes UPDATE reicht, um kaputten Text
    // einzuschleusen.
    db.prepare('UPDATE user_work_periods SET workSchedule = ? WHERE id = ?').run('{"monday":"acht"}', created.id);

    expect(() => resolveWorkPeriodAt(userId, '2026-06-01')).toThrow(String(created.id));
    expect(() => getWorkPeriods(userId)).toThrow(String(created.id));
  });
});

describe('checkPeriodChain — Service-Check ergänzt die Trigger, ersetzt sie nicht (D3)', () => {
  let userId: number;

  beforeEach(() => {
    userId = createTestUser('chain');
  });

  afterEach(() => {
    deleteTestUser(userId);
  });

  it('meldet ok: true für eine intakte, lückenlose Kette', () => {
    createWorkPeriod({ userId, validFrom: '2026-01-01', validTo: '2026-06-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });
    createWorkPeriod({ userId, validFrom: '2026-06-01', weeklyHours: 20, workSchedule: null, note: TEST_NOTE_MARKER });

    const result = checkPeriodChain(userId);
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('benennt bei einer per SQL eingeschleusten Lücke die betroffenen Daten', () => {
    createWorkPeriod({ userId, validFrom: '2026-01-01', validTo: '2026-06-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    // Der INSERT-Trigger aus Migration 008 verhindert genau diese Lücke auch bei einer
    // direkten SQL-Injektion — das ist sein Zweck (D3). checkPeriodChain muss aber auch dann
    // korrekt melden, wenn eine Lücke auf einem anderen Weg in die Tabelle gelangt ist (z. B.
    // Altbestand vor Migration 008). Der Trigger wird deshalb innerhalb EINER atomaren
    // Transaktion entfernt, der Insert ausgeführt und der Trigger sofort wiederhergestellt —
    // die Transaktion hält den SQLite-Schreiblock, kein anderer Prozess kann in der Lücke
    // schreiben.
    const injectGapBypassingGuard = db.transaction(() => {
      db.exec('DROP TRIGGER trg_user_work_periods_insert_guard');
      db.prepare(
        `INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours, workSchedule, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userId, '2026-08-01', null, 20, null, TEST_NOTE_MARKER);
      db.exec(INSERT_GUARD_TRIGGER_SQL);
    });
    injectGapBypassingGuard();

    const result = checkPeriodChain(userId);
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.includes('2026-06-01') && f.includes('2026-08-01'))).toBe(true);
  });
});

describe('checkAllPeriodChains — Bestands-Check über alle Nutzer (WR-03)', () => {
  let userId: number;

  afterEach(() => {
    deleteTestUser(userId);
  });

  it('meldet einen Nutzer GANZ OHNE Periode — checkPeriodChain allein tut das nicht', () => {
    userId = createTestUser('allchains-noperiod');

    // Belegt die Lücke, die diese Funktion schließt: für eine leere Periodenliste findet
    // checkPeriodChain() strukturell nichts zu beanstanden.
    expect(checkPeriodChain(userId)).toEqual({ ok: true, findings: [] });

    const issues = checkAllPeriodChains();
    const own = issues.find((i) => i.userId === userId);
    expect(own).toBeDefined();
    expect(own!.findings.some((msg) => msg.includes('keine einzige Arbeitszeitperiode'))).toBe(true);
  });

  it('meldet eine Kette, die erst nach dem hireDate beginnt', () => {
    userId = createTestUser('allchains-late');
    // createTestUser setzt hireDate = 2020-01-01.
    createWorkPeriod({ userId, validFrom: '2021-03-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    const own = checkAllPeriodChains().find((i) => i.userId === userId);
    expect(own).toBeDefined();
    expect(own!.findings.some((msg) => msg.includes('2021-03-01') && msg.includes('2020-01-01'))).toBe(true);
  });

  it('meldet einen Nutzer mit lückenloser Kette ab hireDate NICHT', () => {
    userId = createTestUser('allchains-ok');
    createWorkPeriod({ userId, validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null, note: TEST_NOTE_MARKER });

    expect(checkAllPeriodChains().some((i) => i.userId === userId)).toBe(false);
  });
});
describe('Soft-Delete (Phase 13, D2/D3)', () => {
  const PHASE13_PREFIX = 'test-13-02-';

  function createPhase13TestUser(suffix: string): number {
    const username = `${PHASE13_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
    const result = db
      .prepare(
        `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(username, `${username}@test.local`, 'Test', 'Phase13', 'hash', 'employee', 40, '2020-01-01');
    return result.lastInsertRowid as number;
  }

  function deletePhase13TestUser(id: number): void {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  let userId: number;

  afterEach(() => {
    deletePhase13TestUser(userId);
  });

  it('getWorkPeriods() liefert eine weggenommene Periode nicht mehr — die Länge sinkt um genau 1', () => {
    userId = createPhase13TestUser('list-length');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      validTo: '2020-06-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });
    createWorkPeriod({
      userId,
      validFrom: '2020-06-01',
      weeklyHours: 20,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    expect(getWorkPeriods(userId).length).toBe(2);

    softDeleteWorkPeriod(p1.id, userId);

    expect(getWorkPeriods(userId).length).toBe(1);
  });

  it('getCurrentWorkPeriod() liefert null, wenn die einzige offene Periode weggenommen wurde', () => {
    userId = createPhase13TestUser('current-null');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    expect(getCurrentWorkPeriod(userId)?.id).toBe(p1.id);

    softDeleteWorkPeriod(p1.id, userId);

    expect(getCurrentWorkPeriod(userId)).toBeNull();
  });

  it('getWorkPeriodById() liefert null für eine weggenommene Periode', () => {
    userId = createPhase13TestUser('byid-null');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    expect(getWorkPeriodById(p1.id)?.id).toBe(p1.id);

    softDeleteWorkPeriod(p1.id, userId);

    expect(getWorkPeriodById(p1.id)).toBeNull();
  });

  it('resolveWorkPeriodAt() löst innerhalb des Zeitraums einer weggenommenen Periode nicht mehr auf — die Berechnung sieht sie nicht mehr', () => {
    userId = createPhase13TestUser('resolve-gone');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    expect(resolveWorkPeriodAt(userId, '2020-03-01')?.id).toBe(p1.id);

    softDeleteWorkPeriod(p1.id, userId);

    expect(resolveWorkPeriodAt(userId, '2020-03-01')).toBeNull();
  });

  it('softDeleteWorkPeriod() setzt deletedAt und deletedBy; ein zweiter Aufruf für dieselbe Periode wirft', () => {
    userId = createPhase13TestUser('double-delete');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    const deleted = softDeleteWorkPeriod(p1.id, userId);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.deletedBy).toBe(userId);

    expect(() => softDeleteWorkPeriod(p1.id, userId)).toThrow();
  });

  it('extendWorkPeriodTo(id, null) macht eine geschlossene Periode zur offenen — ein anschließendes getCurrentWorkPeriod() liefert genau diese', () => {
    userId = createPhase13TestUser('extend-open');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      validTo: '2020-06-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    expect(getCurrentWorkPeriod(userId)).toBeNull();

    const extended = extendWorkPeriodTo(p1.id, null);
    expect(extended.validTo).toBeNull();

    expect(getCurrentWorkPeriod(userId)?.id).toBe(p1.id);
  });

  it('getWorkPeriodsWithFlags() markiert genau eine Periode mit isFirst und höchstens eine mit isCurrent — nach dem Wegnehmen der ersten Periode wandert isFirst auf die nächste', () => {
    userId = createPhase13TestUser('flags');
    const p1 = createWorkPeriod({
      userId,
      validFrom: '2020-01-01',
      validTo: '2020-06-01',
      weeklyHours: 40,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });
    const p2 = createWorkPeriod({
      userId,
      validFrom: '2020-06-01',
      weeklyHours: 20,
      workSchedule: null,
      note: TEST_NOTE_MARKER,
    });

    const withFlags = getWorkPeriodsWithFlags(userId);
    expect(withFlags.length).toBe(2);
    expect(withFlags.filter((p) => p.isFirst).map((p) => p.id)).toEqual([p1.id]);
    expect(withFlags.filter((p) => p.isCurrent).length).toBeLessThanOrEqual(1);
    expect(withFlags.find((p) => p.id === p2.id)?.isCurrent).toBe(true);

    softDeleteWorkPeriod(p1.id, userId);

    const afterDelete = getWorkPeriodsWithFlags(userId);
    expect(afterDelete.length).toBe(1);
    expect(afterDelete[0].id).toBe(p2.id);
    expect(afterDelete[0].isFirst).toBe(true);
  });

  it('withSuspendedChainGuard() setzt work_period_chain_guard.suspended innerhalb des Aufrufs auf 1 und danach wieder auf 0 — auch dann, wenn die übergebene Funktion wirft', () => {
    userId = createPhase13TestUser('chain-guard');

    let suspendedDuringCall: number | undefined;
    withSuspendedChainGuard(() => {
      suspendedDuringCall = (
        db.prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1').get() as { suspended: number }
      ).suspended;
    });
    expect(suspendedDuringCall).toBe(1);

    const afterCall = (
      db.prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1').get() as { suspended: number }
    ).suspended;
    expect(afterCall).toBe(0);

    expect(() =>
      withSuspendedChainGuard(() => {
        throw new Error('x');
      })
    ).toThrow();

    const afterThrow = (
      db.prepare('SELECT suspended FROM work_period_chain_guard WHERE id = 1').get() as { suspended: number }
    ).suspended;
    expect(afterThrow).toBe(0);
  });

  it(
    'WR-12 (Code-Review Phase 13): keiner der vier UPDATE-Schreibwege fasst eine ' +
      'weggenommene Periode an — sonst aenderte er ihre Werte UNTER UMGEHUNG jeder ' +
      'Ueberlappungs-/Lueckenpruefung (der UPDATE-Riegel aus Migration 013 traegt ' +
      'NEW.deletedAt IS NULL und ueberspringt geloeschte Zeilen, checkPeriodChain() liest ' +
      'sie ohnehin nicht).',
    () => {
      userId = createPhase13TestUser('wr12-schreibriegel');
      const p1 = createWorkPeriod({
        userId,
        validFrom: '2020-01-01',
        validTo: '2020-06-01',
        weeklyHours: 40,
        workSchedule: null,
        note: TEST_NOTE_MARKER,
      });
      createWorkPeriod({
        userId,
        validFrom: '2020-06-01',
        weeklyHours: 20,
        workSchedule: null,
        note: TEST_NOTE_MARKER,
      });

      softDeleteWorkPeriod(p1.id, userId);

      // Alle vier Schreibwege weisen die Id der weggenommenen Periode ab.
      expect(() => closeWorkPeriod(p1.id, '2020-05-01')).toThrow(/bereits gelöscht/);
      expect(() => updateWorkPeriodValues(p1.id, 12, null)).toThrow(/bereits gelöscht/);
      expect(() => setWorkPeriodValidFrom(p1.id, '2019-12-01')).toThrow(/bereits gelöscht/);
      expect(() => extendWorkPeriodTo(p1.id, null)).toThrow(/bereits gelöscht/);

      // Und die Zeile ist wirklich unveraendert geblieben — kein halber Schreibvorgang.
      const raw = db
        .prepare(
          'SELECT validFrom, validTo, weeklyHours FROM user_work_periods WHERE id = ?'
        )
        .get(p1.id) as { validFrom: string; validTo: string | null; weeklyHours: number };
      expect(raw.validFrom).toBe('2020-01-01');
      expect(raw.validTo).toBe('2020-06-01');
      expect(raw.weeklyHours).toBe(40);
    }
  );
});

describe('workPeriodService — Aufräumnachweis', () => {
  it('hinterlässt nach dem Lauf keine Periode eines Testnutzers dieser Datei', () => {
    const totalCount = (
      db.prepare('SELECT COUNT(*) as count FROM user_work_periods').get() as { count: number }
    ).count;

    if (totalCount === 0) {
      // Migration 009 (Bestandsüberführung, Plan 10-03) ist auf dieser Datenbank noch nicht
      // gelaufen — die Tabelle ist nach dem Testlauf schlicht leer.
      expect(totalCount).toBe(0);
      return;
    }

    // Migration 009 ist inzwischen gelaufen und hat reguläre Bestandsperioden für echte
    // Nutzer angelegt — die zulässige Prüfung ist dann, dass keine Zeile den Testmarker
    // dieser Datei in `note` trägt.
    const markerRow = db
      .prepare('SELECT COUNT(*) as count FROM user_work_periods WHERE note = ?')
      .get(TEST_NOTE_MARKER) as { count: number };
    expect(markerRow.count).toBe(0);
  });
});
