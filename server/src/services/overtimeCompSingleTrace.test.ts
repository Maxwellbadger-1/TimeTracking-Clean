import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import {
  createAbsenceRequest,
  approveAbsenceRequest,
  rejectAbsenceRequest,
  deleteAbsenceRequest,
} from './absenceService.js';
import { updateMonthlyOvertime } from './overtimeService.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';

/**
 * BL-04 — NACHMESSUNG DER DREI AUSGLEICHSWEGE
 * (Phase 14.1, Plan 14.1-05, D-04; Befund BL-04 aus `14-WEITERE-BEFUNDE.md`.)
 *
 * STAND DIESER DATEI: Task 1 des Plans — sie MISST, sie entfernt nichts und sie sichert
 * noch keinen Zielzustand zu. D-04 verlangt woertlich: „Der Befundbericht empfiehlt, Weg A
 * ersatzlos zu entfernen — aber ausdruecklich erst nach Nachmessung an Testdaten. Diese
 * Nachmessung ist Teil der Phase, nicht optional. Ohne sie wird nicht entfernt."
 * Die Zusicherungen auf den Zielzustand kommen in Task 3 desselben Plans hinzu.
 *
 * WAS GEMESSEN WIRD — die drei Wege, die ein genehmigter Ueberstundenausgleich heute geht:
 *   Weg A  `deductOvertimeHours()`     — schreibt VON HAND in `overtime_balance`, eine
 *                                        ABGELEITETE Tabelle, und zwar in den aeltesten
 *                                        Monat mit positivem Saldo (FIFO). Zwei Aufrufer:
 *                                        `updateBalancesAfterApproval` (positiv) und
 *                                        `revertBalancesAfterDeletion` (negativ).
 *   Weg B  `recordOvertimeCompensation()` — schreibt eine `compensation`-Journalzeile.
 *   Weg C  `updateMonthlyOvertime()`   — der richtige Weg: der Rebuild bucht den
 *                                        Ausgleichstag als Minus in Tagessollhoehe (REQ-19).
 *
 * ----------------------------------------------------------------------------------
 * TESTAUFBAU (Muster aus `absenceDeletionRecalc.test.ts` und `workPeriodChangeService.test.ts`):
 * geteilte Verbindung aus `connection.js`, kein `:memory:`; eigenes Nutzerpraefix
 * `test-141-05-`, weil alle Testdateien dieselbe `development.db` teilen
 * (`vitest.config.ts` -> `fileParallelism: false`); „heute" ausschliesslich ueber
 * `getTodayString()` (Berlin); Datumsfortschaltung ueber lokale Kalenderfelder statt
 * `toISOString()` (`.claude/CLAUDE.md`, „Timezone Bugs").
 *
 * ZEITRAUMWAHL — zwei Monate, und zwar beide in der VERGANGENHEIT:
 *   Monat -2 („Ueberschussmonat"): voll gearbeitet mit 12 h je Werktag. Er liefert den
 *     positiven Saldo, den Weg A ueberhaupt erst findet
 *     (`deductOvertimeHours`: `WHERE userId = ? AND overtime > 0 ORDER BY month ASC`).
 *     Der Ueberschuss entsteht ueber ZEITEINTRAEGE, nicht ueber ein direktes `UPDATE` auf
 *     `overtime_balance` — sonst maesse der Test eine Lage, die der naechste Rebuild sofort
 *     wieder aufloest.
 *   Monat -1 („Ausgleichsmonat"): voll gearbeitet mit genau dem Tagessoll, AUSSER am
 *     Ausgleichstag. Dort darf kein Zeiteintrag stehen — `createAbsenceRequest` weist einen
 *     Zeitraum mit vorhandenen Zeiterfassungen sonst zurueck.
 *
 * Kein Tag liegt in der Zukunft: nach Plan 14.1-01 (BL-01) wird dort nicht mehr gerechnet,
 * ein Zukunftszeitraum wuerde diesen Test still leerlaufen lassen.
 *
 * D-11 — ANGEHALTENER NACHTLAUF: Zwischen dem ausloesenden Vorgang (Genehmigung, Ablehnung,
 * Loeschung) und der Messung liegt KEIN Aufruf einer Berichtsfunktion, kein Rebuild von Hand
 * und selbstverstaendlich kein Nachtlauf. Wo ein erzwungenes `updateMonthlyOvertime` gemessen
 * wird, ist es ausdruecklich der Messgegenstand („Messung 2") und als solcher benannt.
 *
 * D-08 — Der Test legt eigene Zeilen in `time_entries` und `absence_requests` an und raeumt
 * sie im `finally` wieder ab. Die D-08-Kennzahlen werden NACH dem Aufraeumen erhoben.
 * ----------------------------------------------------------------------------------
 */

const USERNAME_PREFIX = 'test-141-05-';
const createdUserIds: number[] = [];

beforeAll(() => {
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
  for (const userId of createdUserIds) {
    cleanupEmployee(userId);
  }
});

/** YYYY-MM-DD einer lokalen Date-Instanz — keine ISO-String-Konvertierung. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Erster Tag des Monats, der `deltaMonths` Monate von `baseIsoDate` entfernt liegt. */
function firstOfMonthOffset(baseIsoDate: string, deltaMonths: number): string {
  const [y, m] = baseIsoDate.split('-').map(Number);
  const total = y * 12 + (m - 1) + deltaMonths;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}-01`;
}

/** Alle Werktage (Mo–Fr) eines Monats, die kein Feiertag sind. */
function nonHolidayWeekdays(isoFirstOfMonth: string): string[] {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const days: string[] = [];
  for (let day = 1; day <= last; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = isoDate(d);
    const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (holiday) continue;
    days.push(dateStr);
  }
  return days;
}

function createEmployee(suffix: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14105', suffix, 'hash', 'employee', 40, '2020-01-01');
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

function createAdmin(): number {
  const username = `${USERNAME_PREFIX}admin-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14105', 'Admin', 'hash', 'admin', 40, '2020-01-01');
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/**
 * Raeumt jede Zeile ab, die ein Testnutzer erzeugt haben kann.
 *
 * REIHENFOLGE IST WESENTLICH — erst `users`, dann die abhaengigen Zeilen. Auf
 * `user_work_periods` liegt ein Trigger, der das Loeschen der LETZTEN Periode eines noch
 * bestehenden Nutzers verhindert (`SQLITE_CONSTRAINT_TRIGGER`); ein Aufraeumpfad, der erst
 * die abhaengigen Tabellen und danach `users` loescht, scheitert still und laesst den
 * Testnutzer stehen. Festgehalten in `deferred-items.md`, Eintrag „Aufraeumreihenfolge bei
 * Testnutzern" aus Plan 14.1-03.
 */
function cleanupEmployee(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM overtime_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM work_time_accounts WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM time_entries WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM absence_requests WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM vacation_transactions WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM vacation_balance WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_work_periods WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM notifications WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM audit_log WHERE userId = ?').run(userId);
}

function insertTimeEntry(userId: number, date: string, hours: number): void {
  const endHour = 8 + hours;
  db.prepare(
    `INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, location, activity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    date,
    '08:00',
    `${String(endHour).padStart(2, '0')}:00`,
    0,
    hours,
    'office',
    'Arbeit',
    'BL-04 Messtest'
  );
}

/** `actualHours` und `targetHours` einer Monatszeile in `overtime_balance`. */
function balanceRow(userId: number, month: string): { actualHours: number; targetHours: number } | null {
  const row = db
    .prepare('SELECT actualHours, targetHours FROM overtime_balance WHERE userId = ? AND month = ?')
    .get(userId, month) as { actualHours: number; targetHours: number } | undefined;
  return row ?? null;
}

/** Zahl und Summe der `overtime_transactions` eines Tages, je `type`. */
function dayTransactionsByType(userId: number, date: string): Record<string, { count: number; hours: number }> {
  const rows = db
    .prepare(
      `SELECT type, COUNT(*) AS count, COALESCE(SUM(hours), 0) AS hours
       FROM overtime_transactions
       WHERE userId = ? AND date = ?
       GROUP BY type
       ORDER BY type`
    )
    .all(userId, date) as Array<{ type: string; count: number; hours: number }>;
  const out: Record<string, { count: number; hours: number }> = {};
  for (const r of rows) {
    out[r.type] = { count: r.count, hours: Math.round(r.hours * 100) / 100 };
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TODAY = getTodayString();
/** Monat -2: liefert den positiven Saldo, den Weg A per FIFO findet. */
const SURPLUS_MONTH_START = firstOfMonthOffset(TODAY, -2);
const SURPLUS_MONTH = SURPLUS_MONTH_START.slice(0, 7);
/** Monat -1: hier liegt der Ausgleichstag. */
const COMP_MONTH_START = firstOfMonthOffset(TODAY, -1);
const COMP_MONTH = COMP_MONTH_START.slice(0, 7);

interface Szenario {
  adminId: number;
  userId: number;
  compDay: string;
}

/**
 * Baut die Ausgangslage auf: Ueberschussmonat -2 (12 h je Werktag), Ausgleichsmonat -1
 * (8 h je Werktag ausser am Ausgleichstag), beide Monate materialisiert.
 */
function setupSzenario(suffix: string): Szenario {
  const adminId = createAdmin();
  const userId = createEmployee(suffix);
  insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });

  for (const day of nonHolidayWeekdays(SURPLUS_MONTH_START)) {
    insertTimeEntry(userId, day, 12);
  }

  const compMonthDays = nonHolidayWeekdays(COMP_MONTH_START);
  // Der Ausgleichstag ist der ZWEITE Werktag des Monats — der erste bleibt frei von
  // Sonderrollen, damit ein Monatsanfangs-Effekt die Messung nicht traegt.
  const compDay = compMonthDays[1];
  for (const day of compMonthDays) {
    if (day === compDay) continue;
    insertTimeEntry(userId, day, 8);
  }

  updateMonthlyOvertime(userId, SURPLUS_MONTH);
  updateMonthlyOvertime(userId, COMP_MONTH);

  return { adminId, userId, compDay };
}

function protokoll(titel: string, werte: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`\n[BL-04 MESSUNG] ${titel}\n${JSON.stringify(werte, null, 2)}`);
}

describe('BL-04: Nachmessung der drei Ausgleichswege (Phase 14.1, D-04)', () => {
  it('Messung 1 + 2: Genehmigung und der Sprung bei der naechsten Neuberechnung', async () => {
    const { adminId, userId, compDay } = setupSzenario('genehmigung');
    try {
      expect(compDay < TODAY).toBe(true);

      const surplusVorher = balanceRow(userId, SURPLUS_MONTH);
      const compMonatVorher = balanceRow(userId, COMP_MONTH);
      const saldoVorher = getOvertimeBalance(userId);
      expect(surplusVorher).not.toBeNull();
      // Nichttrivialitaet: Ohne positiven Saldo im Vormonat findet Weg A gar nichts, und
      // die Messung wuerde einen Nullbefund liefern, der nichts beweist.
      expect(surplusVorher!.actualHours - surplusVorher!.targetHours).toBeGreaterThan(0);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: compDay,
        endDate: compDay,
        reason: 'BL-04 Nachmessung',
      });
      await approveAbsenceRequest(request.id, adminId);

      // ---- MESSUNG 1: unmittelbar nach der Genehmigung, ohne Berichtsabfrage dazwischen.
      const surplusNachGenehmigung = balanceRow(userId, SURPLUS_MONTH);
      const compMonatNachGenehmigung = balanceRow(userId, COMP_MONTH);
      const saldoNachGenehmigung = getOvertimeBalance(userId);
      const buchungenNachGenehmigung = dayTransactionsByType(userId, compDay);

      protokoll('Messung 1 — Genehmigung', {
        ausgleichstag: compDay,
        ueberschussmonat: SURPLUS_MONTH,
        ausgleichsmonat: COMP_MONTH,
        'overtime_balance[-2].actualHours vorher': surplusVorher!.actualHours,
        'overtime_balance[-2].actualHours nachher': surplusNachGenehmigung!.actualHours,
        'overtime_balance[-2].actualHours Differenz': round2(
          surplusNachGenehmigung!.actualHours - surplusVorher!.actualHours
        ),
        'overtime_balance[-1] vorher': compMonatVorher,
        'overtime_balance[-1] nachher': compMonatNachGenehmigung,
        'getOvertimeBalance vorher': saldoVorher,
        'getOvertimeBalance nachher': saldoNachGenehmigung,
        'getOvertimeBalance Differenz': round2(saldoNachGenehmigung - saldoVorher),
        'overtime_transactions des Ausgleichstags je type': buchungenNachGenehmigung,
      });

      // ---- MESSUNG 2: erzwungenes updateMonthlyOvertime fuer den Ueberschussmonat.
      // Das ist hier ausdruecklich der Messgegenstand, nicht ein verdeckender Zwischenschritt:
      // Es beziffert, wie viel Weg A vor seiner Aufloesung zu viel abgezogen hatte.
      updateMonthlyOvertime(userId, SURPLUS_MONTH);

      const surplusNachRebuild = balanceRow(userId, SURPLUS_MONTH);
      const saldoNachRebuild = getOvertimeBalance(userId);
      const buchungenNachRebuild = dayTransactionsByType(userId, compDay);

      protokoll('Messung 2 — Doppelabzug / Sprung', {
        'overtime_balance[-2].actualHours nach Genehmigung': surplusNachGenehmigung!.actualHours,
        'overtime_balance[-2].actualHours nach Neuberechnung': surplusNachRebuild!.actualHours,
        'getOvertimeBalance nach Genehmigung': saldoNachGenehmigung,
        'getOvertimeBalance nach Neuberechnung': saldoNachRebuild,
        'SPRUNG (Saldo nach Genehmigung minus Saldo nach Neuberechnung)': round2(
          saldoNachGenehmigung - saldoNachRebuild
        ),
        'overtime_transactions des Ausgleichstags je type': buchungenNachRebuild,
        'compensation-Zeilen vor der Neuberechnung': buchungenNachGenehmigung['compensation']?.count ?? 0,
        'compensation-Zeilen nach der Neuberechnung': buchungenNachRebuild['compensation']?.count ?? 0,
      });

      // ---- MESSUNG 2b: Bewegt die compensation-Zeile ueberhaupt eine Zahl?
      // Sie wird testweise geloescht und getOvertimeBalance erneut gelesen.
      const saldoMitCompZeile = getOvertimeBalance(userId);
      const geloescht = db
        .prepare(`DELETE FROM overtime_transactions WHERE userId = ? AND date = ? AND type = 'compensation'`)
        .run(userId, compDay);
      const saldoOhneCompZeile = getOvertimeBalance(userId);

      protokoll('Messung 2b — Saldowirkung der compensation-Zeile', {
        'geloeschte compensation-Zeilen': geloescht.changes,
        'getOvertimeBalance mit compensation-Zeile': saldoMitCompZeile,
        'getOvertimeBalance ohne compensation-Zeile': saldoOhneCompZeile,
        'Differenz': round2(saldoMitCompZeile - saldoOhneCompZeile),
      });
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });

  it('Messung 3: Ablehnung eines genehmigten Ausgleichs — kommen die Stunden zurueck?', async () => {
    const { adminId, userId, compDay } = setupSzenario('ablehnung');
    try {
      const surplusVorher = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoVorher = getOvertimeBalance(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: compDay,
        endDate: compDay,
        reason: 'BL-04 Nachmessung Ablehnung',
      });
      await approveAbsenceRequest(request.id, adminId);
      const surplusNachGenehmigung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachGenehmigung = getOvertimeBalance(userId);

      await rejectAbsenceRequest(request.id, adminId, 'BL-04 Nachmessung');
      // D-11: unmittelbar danach gemessen — keine Berichtsabfrage, kein Rebuild von Hand.
      const surplusNachAblehnung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachAblehnung = getOvertimeBalance(userId);
      const buchungenNachAblehnung = dayTransactionsByType(userId, compDay);

      protokoll('Messung 3 — Ablehnung', {
        ausgleichstag: compDay,
        'overtime_balance[-2].actualHours vorher': surplusVorher.actualHours,
        'overtime_balance[-2].actualHours nach Genehmigung': surplusNachGenehmigung.actualHours,
        'overtime_balance[-2].actualHours nach Ablehnung': surplusNachAblehnung.actualHours,
        'getOvertimeBalance vorher': saldoVorher,
        'getOvertimeBalance nach Genehmigung': saldoNachGenehmigung,
        'getOvertimeBalance nach Ablehnung': saldoNachAblehnung,
        'RUECKGABE vollstaendig? (Saldo nach Ablehnung minus Saldo vorher)': round2(
          saldoNachAblehnung - saldoVorher
        ),
        'overtime_transactions des Ausgleichstags je type': buchungenNachAblehnung,
      });
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });

  it('Messung 4: Loeschung eines genehmigten Ausgleichs — kommen die Stunden zurueck?', async () => {
    const { adminId, userId, compDay } = setupSzenario('loeschung');
    try {
      const surplusVorher = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoVorher = getOvertimeBalance(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: compDay,
        endDate: compDay,
        reason: 'BL-04 Nachmessung Loeschung',
      });
      await approveAbsenceRequest(request.id, adminId);
      const surplusNachGenehmigung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachGenehmigung = getOvertimeBalance(userId);

      deleteAbsenceRequest(request.id, adminId);
      // D-11: unmittelbar danach gemessen.
      const surplusNachLoeschung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachLoeschung = getOvertimeBalance(userId);
      const buchungenNachLoeschung = dayTransactionsByType(userId, compDay);

      protokoll('Messung 4 — Loeschung', {
        ausgleichstag: compDay,
        'overtime_balance[-2].actualHours vorher': surplusVorher.actualHours,
        'overtime_balance[-2].actualHours nach Genehmigung': surplusNachGenehmigung.actualHours,
        'overtime_balance[-2].actualHours nach Loeschung': surplusNachLoeschung.actualHours,
        'getOvertimeBalance vorher': saldoVorher,
        'getOvertimeBalance nach Genehmigung': saldoNachGenehmigung,
        'getOvertimeBalance nach Loeschung': saldoNachLoeschung,
        'RUECKGABE vollstaendig? (Saldo nach Loeschung minus Saldo vorher)': round2(
          saldoNachLoeschung - saldoVorher
        ),
        'overtime_transactions des Ausgleichstags je type': buchungenNachLoeschung,
      });
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });
});

describe('Aufraeumnachweis', () => {
  it('kein Nutzer mit dem Praefix test-141-05- bleibt in users stehen', () => {
    const rest = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE username LIKE ?')
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    expect(rest.c).toBe(0);
  });
});
