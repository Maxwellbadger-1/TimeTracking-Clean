import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { db } from '../database/connection.js';
import {
  resolveWorkPeriodAt,
  getWorkPeriods,
  getCurrentWorkPeriod,
  createWorkPeriod,
  closeWorkPeriod,
  checkPeriodChain,
  WorkPeriodConflictError,
} from './workPeriodService.js';
import type { WorkSchedule } from '../types/index.js';

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
 * Wörtliche Kopie des INSERT-Guard-Triggers aus
 * `server/src/database/migrations/008_create_user_work_periods.ts:176-196`. Wird nur genutzt,
 * um den Trigger innerhalb einer einzigen atomaren Transaktion kurz zu entfernen und sofort
 * wiederherzustellen (siehe Test zu `checkPeriodChain` mit eingeschleuster Lücke unten) — die
 * Transaktion hält den SQLite-Schreiblock, sodass kein anderer Prozess in der Lücke zwischen
 * DROP und CREATE schreiben kann.
 */
const INSERT_GUARD_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_user_work_periods_insert_guard
  BEFORE INSERT ON user_work_periods
  BEGIN
    SELECT RAISE(ABORT, 'user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers')
    WHERE EXISTS (
      SELECT 1 FROM user_work_periods p
      WHERE p.userId = NEW.userId
        AND (NEW.validTo IS NULL OR p.validFrom < NEW.validTo)
        AND (p.validTo   IS NULL OR NEW.validFrom < p.validTo)
    );
    SELECT RAISE(ABORT, 'user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers')
    WHERE EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = NEW.userId)
      AND NOT EXISTS (
        SELECT 1 FROM user_work_periods p
        WHERE p.userId = NEW.userId
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
