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
 * BL-04 — EIN GENEHMIGTER UEBERSTUNDENAUSGLEICH HINTERLAESST GENAU EINE SALDOWIRKSAME SPUR
 * (Phase 14.1, Plan 14.1-05, D-04; Befund BL-04 aus `14-WEITERE-BEFUNDE.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: Bis zu diesem Plan lief der Abzug bei der Genehmigung eines
 * Ueberstundenausgleichs auf DREI Wegen gleichzeitig.
 *
 *   Weg A — der handgeschriebene FIFO-Abzug in `overtime_balance` (ENTFERNT).
 *           Er suchte `WHERE userId = ? AND overtime > 0 ORDER BY month ASC`, also den
 *           AELTESTEN Monat mit positivem Saldo, und zog die Ausgleichsstunden dort von
 *           `actualHours` ab. `overtime_balance` ist eine ABGELEITETE Tabelle; jede
 *           Neuberechnung loeschte den Eingriff stillschweigend wieder. Bis dahin stand in
 *           einem laengst abgeschlossenen Monat eine Ist-Stundenzahl, die nicht mehr zu den
 *           Zeiteintraegen dieses Monats passte, und der Tag war doppelt abgezogen.
 *   Weg B — die `compensation`-Journalzeile (BLEIBT, Entscheidung des Anwenders vom
 *           25.08.2026). Sie ist ein Pruefnachweis und bewegt keinen Saldo.
 *   Weg C — der Rebuild (`overtimeTransactionRebuildService.ts:412-448`, `handleAbsenceDay`,
 *           REQ-19). Der richtige Weg: Der Ausgleichstag wird als Minus in Tagessollhoehe
 *           gebucht und damit aus dem Ueberstundenkonto bezahlt. UNVERAENDERT.
 *
 * KERNZUSICHERUNG DIESER DATEI (Test 1): Der Saldo unmittelbar nach der Genehmigung und der
 * Saldo nach einer erzwungenen Neuberechnung sind gleich — der Sprung, den der Befund
 * beschreibt, tritt nicht mehr auf. Vor dem Fix betrug er 8,00 h (68,00 h -> 76,00 h).
 *
 * Die Tests geben ihre Messwerte zusaetzlich per `console.log` aus. Das ist Absicht: Die
 * Zahlen in `14.1-NACHWEIS-BL04.md` sind aus genau diesen Ausgaben abgeschrieben und jederzeit
 * nachstellbar.
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
 *     positiven Saldo, den der frueher hier wirkende FIFO-Abzug ueberhaupt erst gefunden
 *     haette. Der Ueberschuss entsteht ueber ZEITEINTRAEGE, nicht ueber ein direktes `UPDATE`
 *     auf `overtime_balance` — sonst maesse der Test eine Lage, die der naechste Rebuild
 *     sofort wieder aufloest.
 *   Monat -1 („Ausgleichsmonat"): voll gearbeitet mit genau dem Tagessoll, AUSSER am
 *     Ausgleichstag. Dort darf kein Zeiteintrag stehen — `createAbsenceRequest` weist einen
 *     Zeitraum mit vorhandenen Zeiterfassungen sonst zurueck.
 *
 * Dass der Ueberschuss in einem ANDEREN, AELTEREN Monat liegt als der Ausgleichstag, ist
 * die Nichttrivialitaetsbedingung dieser Datei: Nur so wird sichtbar, ob ein Abzug in einen
 * fremden, abgeschlossenen Monat wandert. Laegen beide im selben Monat, waere der Befund
 * nicht messbar.
 *
 * Kein Tag liegt in der Zukunft: nach Plan 14.1-01 (BL-01) wird dort nicht mehr gerechnet,
 * ein Zukunftszeitraum wuerde diesen Test still leerlaufen lassen.
 *
 * D-11 — ANGEHALTENER NACHTLAUF: Zwischen dem ausloesenden Vorgang (Genehmigung, Ablehnung,
 * Loeschung) und der Messung liegt KEIN Aufruf einer Berichtsfunktion, kein Rebuild von Hand
 * und selbstverstaendlich kein Nachtlauf. Wo ein erzwungenes `updateMonthlyOvertime` gemessen
 * wird, ist es ausdruecklich der Messgegenstand und als solcher benannt.
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
    'BL-04 Regressionstest'
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
/** Monat -2: liefert den positiven Saldo in einem abgeschlossenen, fremden Monat. */
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

describe('BL-04: Ein genehmigter Ueberstundenausgleich bewegt genau eine Zahl (Phase 14.1, D-04)', () => {
  it('Test 1 (KERNZUSICHERUNG): Der Saldo springt nach einer Genehmigung nicht mehr', async () => {
    const { adminId, userId, compDay } = setupSzenario('genehmigung');
    try {
      expect(compDay < TODAY).toBe(true);

      const surplusVorher = balanceRow(userId, SURPLUS_MONTH);
      const compMonatVorher = balanceRow(userId, COMP_MONTH);
      const saldoVorher = getOvertimeBalance(userId);
      expect(surplusVorher).not.toBeNull();
      // NICHTTRIVIALITAET: Ohne positiven Saldo im aelteren Monat haette der frueher hier
      // wirkende FIFO-Abzug gar nichts gefunden — die Zusicherungen unten waeren dann auch
      // mit unveraendertem Code gruen und wuerden nichts beweisen.
      expect(surplusVorher!.actualHours - surplusVorher!.targetHours).toBeGreaterThan(0);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: compDay,
        endDate: compDay,
        reason: 'BL-04 Regressionstest',
      });
      await approveAbsenceRequest(request.id, adminId);

      // ---- Unmittelbar nach der Genehmigung, ohne Berichtsabfrage dazwischen (D-11).
      const surplusNachGenehmigung = balanceRow(userId, SURPLUS_MONTH)!;
      const compMonatNachGenehmigung = balanceRow(userId, COMP_MONTH)!;
      const saldoNachGenehmigung = getOvertimeBalance(userId);
      const buchungenNachGenehmigung = dayTransactionsByType(userId, compDay);

      protokoll('Test 1 — Genehmigung', {
        ausgleichstag: compDay,
        ueberschussmonat: SURPLUS_MONTH,
        ausgleichsmonat: COMP_MONTH,
        'overtime_balance[-2].actualHours vorher': surplusVorher!.actualHours,
        'overtime_balance[-2].actualHours nachher': surplusNachGenehmigung.actualHours,
        'overtime_balance[-1] vorher': compMonatVorher,
        'overtime_balance[-1] nachher': compMonatNachGenehmigung,
        'getOvertimeBalance vorher': saldoVorher,
        'getOvertimeBalance nachher': saldoNachGenehmigung,
        'overtime_transactions des Ausgleichstags je type': buchungenNachGenehmigung,
      });

      // T-14.1-05-01 (Tampering): Die Ist-Stunden eines laengst abgeschlossenen, vom Antrag
      // gar nicht betroffenen Monats bewegen sich nach einer Genehmigung nicht mehr.
      // Vor dem Fix fielen sie hier von 252,00 h auf 244,00 h.
      expect(surplusNachGenehmigung.actualHours).toBe(surplusVorher!.actualHours);

      // ---- Erzwungene Neuberechnung des Ueberschussmonats. Sie ist hier der Messgegenstand:
      // Vor dem Fix loeste sie den handgeschriebenen Abzug wieder auf, und genau daraus
      // entstand der Sprung.
      updateMonthlyOvertime(userId, SURPLUS_MONTH);

      const surplusNachRebuild = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachRebuild = getOvertimeBalance(userId);
      const buchungenNachRebuild = dayTransactionsByType(userId, compDay);

      protokoll('Test 1 — nach erzwungener Neuberechnung', {
        'overtime_balance[-2].actualHours nach Genehmigung': surplusNachGenehmigung.actualHours,
        'overtime_balance[-2].actualHours nach Neuberechnung': surplusNachRebuild.actualHours,
        'getOvertimeBalance nach Genehmigung': saldoNachGenehmigung,
        'getOvertimeBalance nach Neuberechnung': saldoNachRebuild,
        'SPRUNG (Saldo nach Genehmigung minus Saldo nach Neuberechnung)': round2(
          saldoNachGenehmigung - saldoNachRebuild
        ),
        'overtime_transactions des Ausgleichstags je type': buchungenNachRebuild,
      });

      // T-14.1-05-02 (Denial of Service): DIE KERNZUSICHERUNG DIESES PLANS.
      // Der Saldo unmittelbar nach der Genehmigung und der Saldo nach der naechsten
      // Neuberechnung sind gleich. Vor dem Fix betrug die Differenz 8,00 h
      // (68,00 h -> 76,00 h) — der Mitarbeiter sah zwei verschiedene Zahlen fuer denselben
      // Sachverhalt, ohne dass zwischendurch etwas passiert waere.
      expect(round2(saldoNachGenehmigung - saldoNachRebuild)).toBe(0);

      // Genau EINE saldowirksame Zeile am Ausgleichstag — die des Rebuilds (Weg C, REQ-19).
      expect(buchungenNachRebuild['time_entry']?.count).toBe(1);
      // Weg B bleibt (Entscheidung des Anwenders vom 25.08.2026, Option A): eine
      // Belegzeile, die die Neuberechnung ueberlebt.
      expect(buchungenNachRebuild['compensation']?.count).toBe(1);
      // Und keine dritte Spur.
      expect(Object.keys(buchungenNachRebuild).sort()).toEqual(['compensation', 'time_entry']);

      // Dass die Belegzeile keinen Saldo bewegt, wird nicht behauptet, sondern gemessen:
      // Sie wird geloescht und der Saldo erneut gelesen.
      const saldoMitBelegzeile = getOvertimeBalance(userId);
      const geloescht = db
        .prepare(`DELETE FROM overtime_transactions WHERE userId = ? AND date = ? AND type = 'compensation'`)
        .run(userId, compDay);
      const saldoOhneBelegzeile = getOvertimeBalance(userId);

      protokoll('Test 1 — Saldowirkung der Belegzeile', {
        'geloeschte compensation-Zeilen': geloescht.changes,
        'getOvertimeBalance mit Belegzeile': saldoMitBelegzeile,
        'getOvertimeBalance ohne Belegzeile': saldoOhneBelegzeile,
        Differenz: round2(saldoMitBelegzeile - saldoOhneBelegzeile),
      });

      expect(geloescht.changes).toBe(1);
      expect(round2(saldoMitBelegzeile - saldoOhneBelegzeile)).toBe(0);
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });

  it('Test 2: Die Ablehnung eines genehmigten Ausgleichs gibt die Stunden vollstaendig zurueck', async () => {
    const { adminId, userId, compDay } = setupSzenario('ablehnung');
    try {
      const surplusVorher = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoVorher = getOvertimeBalance(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: compDay,
        endDate: compDay,
        reason: 'BL-04 Regressionstest Ablehnung',
      });
      await approveAbsenceRequest(request.id, adminId);
      const surplusNachGenehmigung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachGenehmigung = getOvertimeBalance(userId);

      await rejectAbsenceRequest(request.id, adminId, 'BL-04 Regressionstest');
      // D-11: unmittelbar danach gemessen — keine Berichtsabfrage, kein Rebuild von Hand,
      // kein Nachtlauf. Die naechste Anweisung ist die Messung.
      const surplusNachAblehnung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachAblehnung = getOvertimeBalance(userId);
      const buchungenNachAblehnung = dayTransactionsByType(userId, compDay);

      protokoll('Test 2 — Ablehnung', {
        ausgleichstag: compDay,
        'overtime_balance[-2].actualHours vorher': surplusVorher.actualHours,
        'overtime_balance[-2].actualHours nach Genehmigung': surplusNachGenehmigung.actualHours,
        'overtime_balance[-2].actualHours nach Ablehnung': surplusNachAblehnung.actualHours,
        'getOvertimeBalance vorher': saldoVorher,
        'getOvertimeBalance nach Genehmigung': saldoNachGenehmigung,
        'getOvertimeBalance nach Ablehnung': saldoNachAblehnung,
        'RUECKGABE (Saldo nach Ablehnung minus Saldo vorher)': round2(saldoNachAblehnung - saldoVorher),
        'overtime_transactions des Ausgleichstags je type': buchungenNachAblehnung,
      });

      // T-14.1-05-04 (Denial of Service): Weg C traegt die Rueckgabe allein.
      // Vor dem Fix fehlten hier 8,00 h — der frueher gerufene Rueckgabezweig war
      // wirkungslos, weil seine Schleife bei negativem Argument sofort abbrach.
      expect(round2(saldoNachAblehnung - saldoVorher)).toBe(0);
      expect(surplusNachAblehnung.actualHours).toBe(surplusVorher.actualHours);
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });

  it('Test 3: Die Loeschung eines genehmigten Ausgleichs gibt die Stunden vollstaendig zurueck', async () => {
    const { adminId, userId, compDay } = setupSzenario('loeschung');
    try {
      const surplusVorher = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoVorher = getOvertimeBalance(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'overtime_comp',
        startDate: compDay,
        endDate: compDay,
        reason: 'BL-04 Regressionstest Loeschung',
      });
      await approveAbsenceRequest(request.id, adminId);
      const surplusNachGenehmigung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachGenehmigung = getOvertimeBalance(userId);

      deleteAbsenceRequest(request.id, adminId);
      // D-11: unmittelbar danach gemessen.
      const surplusNachLoeschung = balanceRow(userId, SURPLUS_MONTH)!;
      const saldoNachLoeschung = getOvertimeBalance(userId);
      const buchungenNachLoeschung = dayTransactionsByType(userId, compDay);

      protokoll('Test 3 — Loeschung', {
        ausgleichstag: compDay,
        'overtime_balance[-2].actualHours vorher': surplusVorher.actualHours,
        'overtime_balance[-2].actualHours nach Genehmigung': surplusNachGenehmigung.actualHours,
        'overtime_balance[-2].actualHours nach Loeschung': surplusNachLoeschung.actualHours,
        'getOvertimeBalance vorher': saldoVorher,
        'getOvertimeBalance nach Genehmigung': saldoNachGenehmigung,
        'getOvertimeBalance nach Loeschung': saldoNachLoeschung,
        'RUECKGABE (Saldo nach Loeschung minus Saldo vorher)': round2(saldoNachLoeschung - saldoVorher),
        'overtime_transactions des Ausgleichstags je type': buchungenNachLoeschung,
      });

      // Weg C ist im Loeschpfad erst seit Plan 14.1-02 (BL-02) erreichbar. Ohne diesen
      // Plan waere das Entfernen des Rueckgabezweigs hier nicht tragfaehig gewesen.
      expect(round2(saldoNachLoeschung - saldoVorher)).toBe(0);
      expect(surplusNachLoeschung.actualHours).toBe(surplusVorher.actualHours);
    } finally {
      cleanupEmployee(userId);
      cleanupEmployee(adminId);
    }
  });
});

describe('Aufraeumnachweis', () => {
  it('Test 4: kein Nutzer mit dem Praefix test-141-05- bleibt in users stehen', () => {
    const rest = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE username LIKE ?')
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    expect(rest.c).toBe(0);
  });
});
