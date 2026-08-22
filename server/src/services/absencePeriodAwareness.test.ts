import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../database/connection.js';
import { createAbsenceRequest, approveAbsenceRequest, getAbsenceRequestsPaginated } from './absenceService.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';

/**
 * ABSENCE PERIOD AWARENESS TESTS (Plan 11-07, REQ-23)
 *
 * Nachweis, dass eine Abwesenheit, die einen Periodenstichtag überspannt, an allen vier
 * Fundstellen in `absenceService.ts` (Anreicherung, Genehmigungsvorbehalt, Abbuchung,
 * `calculateAbsenceCredits`) mit der am jeweiligen Tag gültigen Periode rechnet — nicht mit
 * dem heutigen Stammdatensatz.
 *
 * Szenario (identisch zu `<behavior>` in `11-07-PLAN.md`, Task 1): Stichtag 15.07.2026,
 * davor 40h/Woche, danach 20h/Woche, kein Wochenplan. Eine Abwesenheit vom 13.07. bis
 * 17.07.2026 (Mo–Fr, keine Feiertage) liegt zwei Tage in der ersten und drei Tage in der
 * zweiten Periode: 2×8h + 3×4h = 28h — weder 40h (5×8h, alte Periode) noch 20h (5×4h, neue
 * Periode).
 *
 * Läuft gegen die geteilte `development.db` (Muster aus
 * `overtimeTransactionRebuildService.test.ts`, Plan 11-05): parallel arbeitende
 * Executor-Agenten teilen sich dieselbe Arbeitsdatenbank. Jeder hier angelegte Nutzer trägt
 * das Präfix `t1107-` und wird über `finally`/`afterEach`-Äquivalent sofort wieder entfernt;
 * der Aufräumnachweis am Dateiende prüft das maschinell.
 */

const createdUserIds: number[] = [];

function createT1107User(suffix: string): number {
  const username = `t1107-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T1107', suffix, 'hash', 'employee', 40, '2020-01-01');
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

function cleanupT1107User(userId: number): void {
  // Cascade (ON DELETE CASCADE, Migration 008) räumt user_work_periods mit ab; vacation_balance
  // und vacation_transactions ebenso (Migrationen 003/007). Die übrigen Tabellen kaskadieren
  // nicht und werden hier explizit geräumt (Muster aus overtimeTransactionRebuildService.test.ts).
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM work_time_accounts WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
}

const STICHTAG = '2026-07-15';

/** Legt Testnutzer + die beiden Perioden aus dem Plan-Szenario an, gibt {userId, adminId} zurück. */
function setupUserWithPeriods(suffix: string): { userId: number; adminId: number } {
  const userId = createT1107User(`${suffix}-user`);
  const adminId = createT1107User(`${suffix}-admin`);

  // P1 [.., 2026-07-15) 40h/Woche, kein Wochenplan
  insertTestWorkPeriod(userId, {
    validFrom: '2020-01-01',
    validTo: STICHTAG,
    weeklyHours: 40,
    workSchedule: null,
    note: 't1107-period-vor-stichtag',
  });
  // P2 [2026-07-15, ..) 20h/Woche, kein Wochenplan
  insertTestWorkPeriod(userId, {
    validFrom: STICHTAG,
    validTo: null,
    weeklyHours: 20,
    workSchedule: null,
    note: 't1107-period-nach-stichtag',
  });

  return { userId, adminId };
}

beforeAll(() => {
  // Ohne aktive Fremdschlüssel räumt ON DELETE CASCADE user_work_periods/vacation_balance
  // beim Löschen des Testnutzers nicht ab — einmal setzen und zurücklesen statt annehmen
  // (Muster aus workPeriodService.test.ts).
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

describe('absenceService — Abwesenheit über den Stichtag hinweg (Plan 11-07, REQ-23)', () => {
  it('Anreicherung (getAbsenceRequestsPaginated): calculatedHours = 28, nicht 40 und nicht 20', () => {
    const { userId, adminId } = setupUserWithPeriods('anreicherung');
    try {
      const request = createAbsenceRequest({
        userId,
        type: 'vacation',
        startDate: '2026-07-13',
        endDate: '2026-07-17',
      });

      const result = getAbsenceRequestsPaginated({ userId, year: 2026 });
      const enriched = result.rows.find((r) => r.id === request.id) as
        | (typeof result.rows)[number] & { calculatedHours?: number }
        | undefined;

      expect(enriched?.calculatedHours).toBe(28);
      expect(enriched?.calculatedHours).not.toBe(40);
      expect(enriched?.calculatedHours).not.toBe(20);
    } finally {
      cleanupT1107User(userId);
      cleanupT1107User(adminId);
    }
  });

  it('Ein Antrag vollständig vor dem Stichtag liefert unverändert die alten Werte (40h)', () => {
    const { userId, adminId } = setupUserWithPeriods('vor-stichtag');
    try {
      // 06.–10.07.2026 = Mo–Fr, vollständig in P1 (40h/Woche → 5 × 8h = 40h)
      const request = createAbsenceRequest({
        userId,
        type: 'vacation',
        startDate: '2026-07-06',
        endDate: '2026-07-10',
      });

      const result = getAbsenceRequestsPaginated({ userId, year: 2026 });
      const enriched = result.rows.find((r) => r.id === request.id) as
        | (typeof result.rows)[number] & { calculatedHours?: number }
        | undefined;

      expect(enriched?.calculatedHours).toBe(40);
    } finally {
      cleanupT1107User(userId);
      cleanupT1107User(adminId);
    }
  });

  it('Genehmigungsvorbehalt und Abbuchung eines overtime_comp-Antrags über den Stichtag nennen denselben Stundenwert (28h) — nicht 40, nicht 20 (T-11-01/CR-01)', async () => {
    const { userId, adminId } = setupUserWithPeriods('overtime-comp');
    try {
      // Genug Guthaben für die Antragsstellung selbst (createAbsenceRequest prüft ebenfalls
      // über calculateAbsenceCredits, bereits Teil dieses Plans).
      db.prepare(
        `INSERT INTO overtime_balance (userId, month, targetHours, actualHours) VALUES (?, '2026-01', 0, 30)`
      ).run(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: '2026-07-13',
        endDate: '2026-07-17',
      });

      // GENEHMIGUNGSVORBEHALT: Guthaben = 5h. Mit dem korrekten Wert (28h, Limit -20h) ist
      // 5 − 28 = −23h < −20h → MUSS ablehnen und exakt "Benötigt: 28.00h" nennen. Ein
      // fälschlich mit 20h rechnender Vorbehalt würde hier (5 − 20 = −15h ≥ −20h)
      // fälschlich DURCHLASSEN — dieser Test deckt genau das auf.
      db.prepare(`UPDATE overtime_balance SET actualHours = 5 WHERE userId = ? AND month = '2026-01'`).run(userId);
      await expect(approveAbsenceRequest(request.id, adminId)).rejects.toThrow('Benötigt: 28.00h');

      // ABBUCHUNG: Guthaben = 15h. Mit dem korrekten Wert (28h) ist 15 − 28 = −13h ≥ −20h →
      // MUSS gelingen. Ein fälschlich mit 40h rechnender Vorbehalt würde hier (15 − 40 =
      // −25h < −20h) fälschlich ABLEHNEN — dieser Test deckt auch das auf. Die anschließend
      // gebuchte Transaktion muss ebenfalls exakt 28h nennen (derselbe Wert wie der
      // Vorbehalt oben — CR-01).
      db.prepare(`UPDATE overtime_balance SET actualHours = 15 WHERE userId = ? AND month = '2026-01'`).run(userId);
      await approveAbsenceRequest(request.id, adminId);

      const transaction = db
        .prepare(
          `SELECT hours FROM overtime_transactions WHERE referenceType = 'absence' AND referenceId = ? AND type = 'compensation'`
        )
        .get(request.id) as { hours: number } | undefined;

      expect(transaction?.hours).toBe(-28);
    } finally {
      cleanupT1107User(userId);
      cleanupT1107User(adminId);
    }
  });
});

describe('Aufräumnachweis', () => {
  it('kein Testnutzer mit Präfix t1107- bleibt in users, user_work_periods, overtime_transactions, overtime_balance oder absence_requests zurück', () => {
    expect(createdUserIds.length).toBeGreaterThan(0);

    const leftoverUsers = db.prepare(`SELECT id FROM users WHERE username LIKE 't1107-%'`).all();
    expect(leftoverUsers).toHaveLength(0);

    for (const userId of createdUserIds) {
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT id FROM user_work_periods WHERE userId = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT id FROM overtime_transactions WHERE userId = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT userId FROM overtime_balance WHERE userId = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT id FROM absence_requests WHERE userId = ?').get(userId)).toBeUndefined();
    }
  });
});
