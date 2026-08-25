import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { formatDate, getCurrentDate, getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { generateHistoricalExport, generateDATEVExport } from './exportService.js';

/**
 * BL-03 — REGRESSIONSNETZ FUER DIE FILTER DES HISTORIEN-EXPORTS
 * (Phase 14.1, Plan 14.1-04, D-03; Befund BL-03 aus `14-WEITERE-BEFUNDE.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: `generateHistoricalExport()` nahm **alle**
 * Abwesenheitsantraege auf — auch abgelehnte — und **alle** Nutzer, auch stillgelegte
 * (soft-geloeschte). Ein abgelehnter Urlaub war im Export von einem genehmigten nicht zu
 * unterscheiden. Das ist nicht nur ein Rechenfehler: Der Export verlaesst das System, und
 * er gab damit Daten stillgelegter Konten und abgelehnter Antraege heraus.
 *
 * Auf der Produktionsarbeitskopie gemessen (siehe `14.1-NACHWEIS-BL03.md`): 15 abgelehnte
 * Antraege (10 Urlaub, 2 Krank, 2 Ueberstundenausgleich, 1 unbezahlt) und 5 stillgelegte
 * Konten (Ids 15, 26, 28, 30, 31) standen vor dem Fix in der Ausgabedatei.
 *
 * ------------------------------------------------------------------------------------
 * DIE ABWEICHUNG ZUR DATEV-SCHWESTERFUNKTION IST ABSICHT — UND TEST 5 SICHERT SIE AB:
 *
 * `generateDATEVExport()` in derselben Datei nimmt soft-geloeschte Nutzer AUSDRUECKLICH mit
 * ("including deleted for historical accuracy", WR-11 aus Phase 11). Der Grund liegt im
 * Zweck: Der DATEV-Export beliefert eine Lohnbuchhaltung, die auch fuer ausgeschiedene
 * Mitarbeiter vollstaendig sein muss. Der Historien-Export ist dagegen ein allgemeiner
 * Datenexport; das Erfolgskriterium der Phase 14.1 verlangt, dass er keine stillgelegten
 * Konten enthaelt.
 *
 * Die beiden Funktionen entscheiden also verschieden. Test 5 haelt fest, dass der BL-03-Fix
 * die DATEV-Entscheidung NICHT mitgerissen hat — sonst waere aus einem behobenen Befund ein
 * neuer geworden.
 * ------------------------------------------------------------------------------------
 *
 * Fuenf Sachtests:
 *   1. Abgelehnte Antraege, Sammelvariante (ohne `userId`) — genau 1 Antrag des Testnutzers.
 *   2. Abgelehnte Antraege, Einzelnutzer-Variante (mit `userId`) — beide Abfragevarianten
 *      der Funktion sind damit abgedeckt.
 *   3. Stillgelegtes Konto — taucht im Sammelexport nicht auf.
 *   4. `totalOvertime` — kein Zukunftsmonat, kein Beitrag eines stillgelegten Kontos,
 *      geprueft ueber zwei konkrete Zahlen (2,00 und 0,00), nicht ueber ein Vorzeichen.
 *   5. DATEV unveraendert — der stillgelegte Nutzer steht dort weiterhin drin.
 * Dazu ein Aufraeumnachweis am Dateiende.
 *
 * AUFBAU (Muster aus `sickLeaveRecalc.test.ts` / `absenceDeletionRecalc.test.ts`): geteilte
 * Verbindung aus `connection.js`; eigenes Nutzerpraefix `test-141-04-`, weil alle Testdateien
 * dieselbe `development.db` teilen (`vitest.config.ts` -> `fileParallelism: false`); "heute"
 * ausschliesslich ueber `getTodayString()` (Berlin), nie ueber `new Date()`; Datumsrechnung
 * ueber lokale Kalenderfelder statt einer UTC-Zeichenkette (`.claude/CLAUDE.md`,
 * "Timezone Bugs").
 *
 * D-08: `absence_requests` gehoert zu den fuenf geschuetzten Tabellen. Diese Datei legt dort
 * ausschliesslich eigene Zeilen fuer eigene Testnutzer an und raeumt sie vollstaendig ab; die
 * D-08-Kennzahlen in `14.1-NACHWEIS-BL03.md` werden NACH dem Aufraeumen erhoben und belegen
 * das in Zeilenzahl und Pruefsumme. `vacation_balance` und `vacation_transactions` werden von
 * dieser Datei ueberhaupt nicht beschrieben.
 */

const USERNAME_PREFIX = 'test-141-04-';
const createdUserIds: number[] = [];

/** Beobachtete Zahlen fuer `14.1-NACHWEIS-BL03.md` — Dokumentation, keine Zusicherung. */
const messwerte: string[] = [];

beforeAll(() => {
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
  // Sicherheitsnetz fuer den Fall, dass ein `finally` nicht gelaufen ist.
  for (const userId of createdUserIds) {
    cleanupEmployee(userId);
  }
  if (messwerte.length > 0) {
    console.log('\n--- BL-03 Messwerte fuer 14.1-NACHWEIS-BL03.md ---\n' + messwerte.join('\n') + '\n');
  }
});

/** YYYY-MM-DD einer lokalen Date-Instanz — keine UTC-Zeichenkette. */
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

/** Letzter Tag des Monats, dessen erster Tag `isoFirstOfMonth` ist. */
function lastOfMonth(isoFirstOfMonth: string): string {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  return isoDate(new Date(y, m, 0));
}

/** Erster Werktag (Mo bis Fr) des Monats, der kein Feiertag ist. */
function firstNonHolidayWeekday(isoFirstOfMonth: string): string {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = isoDate(d);
    const holiday = db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr);
    if (holiday) continue;
    return dateStr;
  }
  throw new Error(`Kein Werktag ohne Feiertag in ${isoFirstOfMonth} gefunden`);
}

/** Naechster Werktag nach `isoDateStr`, der kein Feiertag ist. */
function nextNonHolidayWeekday(isoDateStr: string): string {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  for (let i = 0; i < 40; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = isoDate(cursor);
    if (db.prepare('SELECT 1 FROM holidays WHERE date = ?').get(dateStr)) continue;
    return dateStr;
  }
  throw new Error(`Kein weiterer Werktag nach ${isoDateStr} gefunden`);
}

function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14104', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  insertTestWorkPeriod(userId, { validFrom: hireDate, weeklyHours, workSchedule: null });
  return userId;
}

/**
 * Stillegung des eigenen Testnutzers. `users` gehoert NICHT zu den fuenf nach D-08
 * geschuetzten Tabellen, und der Nutzer wird im Aufraeumen wieder entfernt.
 */
function softDelete(userId: number): void {
  db.prepare("UPDATE users SET deletedAt = ?, status = 'inactive' WHERE id = ?").run(
    `${getTodayString()} 00:00:00`,
    userId
  );
}

/** Legt einen Abwesenheitsantrag mit vorgegebenem Status an (auch `rejected`). */
function insertAbsence(
  userId: number,
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp',
  status: 'pending' | 'approved' | 'rejected',
  startDate: string,
  endDate: string
): number {
  const result = db
    .prepare(
      `INSERT INTO absence_requests (userId, type, startDate, endDate, days, status, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, type, startDate, endDate, 1, status, `BL-03 Regressionstest (${status})`);
  return result.lastInsertRowid as number;
}

function insertOvertimeBalance(userId: number, month: string, targetHours: number, actualHours: number): void {
  db.prepare(
    'INSERT INTO overtime_balance (userId, month, targetHours, actualHours) VALUES (?, ?, ?, ?)'
  ).run(userId, month, targetHours, actualHours);
}

/**
 * Raeumt jede Zeile ab, die ein Testnutzer erzeugt haben kann. Reihenfolge beachten:
 * `users` ZUERST — auf `user_work_periods` liegt ein Trigger, der das Loeschen der letzten
 * Periode eines noch bestehenden Nutzers verhindert (Falle aus Plan 14.1-03).
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

const TODAY = getTodayString();
const CURRENT_MONTH = formatDate(getCurrentDate(), 'yyyy-MM');
/** Zeitraum: Vormonat bis heute — vollstaendig in der Vergangenheit. */
const PERIOD_START = firstOfMonthOffset(TODAY, -1);
const PERIOD_END = TODAY;
/** Ein Zeitraumende in der ZUKUNFT — genau der Fall, den der Monatsdeckel abfangen muss. */
const FUTURE_END = lastOfMonth(firstOfMonthOffset(TODAY, 2));
const FUTURE_MONTH = firstOfMonthOffset(TODAY, 1).substring(0, 7);

describe('BL-03: Der Historien-Export filtert Status und stillgelegte Konten (Phase 14.1, D-03)', () => {
  it('Test 1: Ein abgelehnter Antrag steht nicht im Sammelexport (ohne userId)', () => {
    const userId = createEmployee('abgelehnt-sammel', 40, '2020-01-01');
    try {
      const tagGenehmigt = firstNonHolidayWeekday(PERIOD_START);
      const tagAbgelehnt = nextNonHolidayWeekday(tagGenehmigt);
      expect(tagAbgelehnt < TODAY).toBe(true);

      const genehmigtId = insertAbsence(userId, 'vacation', 'approved', tagGenehmigt, tagGenehmigt);
      const abgelehntId = insertAbsence(userId, 'vacation', 'rejected', tagAbgelehnt, tagAbgelehnt);

      const daten = generateHistoricalExport(PERIOD_START, PERIOD_END);
      const eigene = daten.absences.filter(a => a.userId === userId);

      messwerte.push(
        `Test 1 | userId=${userId} | angelegt: genehmigt=${genehmigtId} abgelehnt=${abgelehntId} | ` +
          `im Export: ${eigene.length} (${eigene.map(a => `${a.id}/${a.status}`).join(', ') || '—'})`
      );

      // Ohne den Statusfilter stehen hier 2 Antraege — genau das macht den Test ohne den
      // Fix rot.
      expect(eigene.length).toBe(1);
      expect(eigene[0].id).toBe(genehmigtId);
      expect(eigene[0].status).toBe('approved');
      expect(daten.absences.some(a => a.id === abgelehntId)).toBe(false);
      // Im gesamten Export steht kein einziger nicht genehmigter Antrag mehr.
      expect(daten.absences.filter(a => a.status !== 'approved').length).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 2: Ein abgelehnter Antrag steht auch in der Einzelnutzer-Variante nicht im Export (mit userId)', () => {
    const userId = createEmployee('abgelehnt-einzel', 40, '2020-01-01');
    try {
      const tagGenehmigt = firstNonHolidayWeekday(PERIOD_START);
      const tagAbgelehnt = nextNonHolidayWeekday(tagGenehmigt);

      const genehmigtId = insertAbsence(userId, 'sick', 'approved', tagGenehmigt, tagGenehmigt);
      const abgelehntId = insertAbsence(userId, 'sick', 'rejected', tagAbgelehnt, tagAbgelehnt);

      const daten = generateHistoricalExport(PERIOD_START, PERIOD_END, userId);

      messwerte.push(
        `Test 2 | userId=${userId} | angelegt: genehmigt=${genehmigtId} abgelehnt=${abgelehntId} | ` +
          `im Export: ${daten.absences.length} (${daten.absences.map(a => `${a.id}/${a.status}`).join(', ') || '—'})`
      );

      // Die Einzelnutzer-Variante ist eine EIGENE Abfrage in derselben Funktion — ohne den
      // Fix fehlt ihr der Statusfilter genauso.
      expect(daten.absences.length).toBe(1);
      expect(daten.absences[0].id).toBe(genehmigtId);
      expect(daten.absences.some(a => a.id === abgelehntId)).toBe(false);
      // Der Nutzer selbst ist aktiv und steht deshalb im Export.
      expect(daten.users.length).toBe(1);
      expect(daten.users[0].id).toBe(userId);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 3: Ein stillgelegtes Konto taucht im Sammelexport nicht auf', () => {
    const aktivId = createEmployee('aktiv', 40, '2020-01-01');
    const stillgelegtId = createEmployee('stillgelegt', 40, '2020-01-01');
    try {
      softDelete(stillgelegtId);
      const geprueft = db
        .prepare('SELECT deletedAt FROM users WHERE id = ?')
        .get(stillgelegtId) as { deletedAt: string | null };
      expect(geprueft.deletedAt).not.toBeNull();

      const daten = generateHistoricalExport(PERIOD_START, PERIOD_END);
      const aktivImExport = daten.users.filter(u => u.id === aktivId).length;
      const stillgelegtImExport = daten.users.filter(u => u.id === stillgelegtId).length;

      messwerte.push(
        `Test 3 | aktiv=${aktivId} stillgelegt=${stillgelegtId} | im Export: aktiv=${aktivImExport} ` +
          `stillgelegt=${stillgelegtImExport} | Nutzer im Export gesamt=${daten.users.length} | ` +
          `davon mit deletedAt=${daten.users.filter(u => u.deletedAt !== null).length}`
      );

      // Ohne den deletedAt-Filter steht hier 1 — genau das macht den Test ohne den Fix rot.
      expect(stillgelegtImExport).toBe(0);
      expect(aktivImExport).toBe(1);
      // Und im gesamten Export steht kein einziges stillgelegtes Konto mehr.
      expect(daten.users.filter(u => u.deletedAt !== null).length).toBe(0);
      // Auch die Einzelnutzer-Variante gibt ein stillgelegtes Konto nicht mehr heraus.
      const einzeln = generateHistoricalExport(PERIOD_START, PERIOD_END, stillgelegtId);
      expect(einzeln.users.length).toBe(0);
    } finally {
      cleanupEmployee(aktivId);
      cleanupEmployee(stillgelegtId);
    }
  });

  it('Test 4: totalOvertime kennt keinen Zukunftsmonat und keinen Beitrag eines stillgelegten Kontos', () => {
    const aktivId = createEmployee('saldo-aktiv', 40, '2020-01-01');
    const stillgelegtId = createEmployee('saldo-still', 40, '2020-01-01');
    try {
      // Laufender Monat: +2,00 h. Zukunftsmonat: −20,00 h (Sollstunden ohne Iststunden —
      // genau die Zeilen, die BL-01/D-06 als Datenrest behandeln).
      insertOvertimeBalance(aktivId, CURRENT_MONTH, 10, 12);
      insertOvertimeBalance(aktivId, FUTURE_MONTH, 20, 0);
      // Ein absichtlich auffaelliger Beitrag des stillgelegten Kontos: +999,00 h.
      insertOvertimeBalance(stillgelegtId, CURRENT_MONTH, 0, 999);
      softDelete(stillgelegtId);

      // (a) Einzelnutzer, Zeitraumende in der ZUKUNFT: Der Monatsdeckel muss greifen.
      const aktivExport = generateHistoricalExport(PERIOD_START, FUTURE_END, aktivId);

      messwerte.push(
        `Test 4a | userId=${aktivId} | Zeitraum ${PERIOD_START}..${FUTURE_END} (Ende in der Zukunft) | ` +
          `laufender Monat=${CURRENT_MONTH} Zukunftsmonat=${FUTURE_MONTH} | ` +
          `overtimeBalance-Zeilen=${aktivExport.overtimeBalance.length} ` +
          `(${aktivExport.overtimeBalance.map(r => `${r.month}:${r.overtime}`).join(', ') || '—'}) | ` +
          `totalOvertime=${aktivExport.statistics.totalOvertime}`
      );

      // Zwei konkrete Zahlen, kein Vorzeichenvergleich:
      // ohne den Deckel waeren es 2 Zeilen und −18,00 h.
      expect(aktivExport.overtimeBalance.length).toBe(1);
      expect(aktivExport.overtimeBalance[0].month).toBe(CURRENT_MONTH);
      expect(aktivExport.statistics.totalOvertime).toBe(2);
      expect(aktivExport.overtimeBalance.filter(r => r.month > CURRENT_MONTH).length).toBe(0);

      // (b) Einzelnutzer, stillgelegt: kein Nutzer, keine Monatszeile, kein Beitrag.
      const stillExport = generateHistoricalExport(PERIOD_START, FUTURE_END, stillgelegtId);

      messwerte.push(
        `Test 4b | userId=${stillgelegtId} (stillgelegt, +999 h im laufenden Monat) | ` +
          `Nutzer im Export=${stillExport.users.length} | ` +
          `overtimeBalance-Zeilen=${stillExport.overtimeBalance.length} | ` +
          `totalOvertime=${stillExport.statistics.totalOvertime}`
      );

      // Ohne den Nutzerfilter stuende hier 999,00 h.
      expect(stillExport.users.length).toBe(0);
      expect(stillExport.overtimeBalance.length).toBe(0);
      expect(stillExport.statistics.totalOvertime).toBe(0);

      // (c) Sammelvariante: weder Zukunftsmonat noch stillgelegtes Konto in der Liste.
      const sammelExport = generateHistoricalExport(PERIOD_START, FUTURE_END);
      const zukunftszeilen = sammelExport.overtimeBalance.filter(r => r.month > CURRENT_MONTH);
      const stillZeilen = sammelExport.overtimeBalance.filter(r => r.userId === stillgelegtId);

      messwerte.push(
        `Test 4c | Sammelexport ${PERIOD_START}..${FUTURE_END} | ` +
          `overtimeBalance-Zeilen gesamt=${sammelExport.overtimeBalance.length} | ` +
          `davon Zukunftsmonat=${zukunftszeilen.length} | davon stillgelegtes Konto=${stillZeilen.length} | ` +
          `totalOvertime=${Math.round(sammelExport.statistics.totalOvertime * 100) / 100}`
      );

      expect(zukunftszeilen.length).toBe(0);
      expect(stillZeilen.length).toBe(0);
    } finally {
      cleanupEmployee(aktivId);
      cleanupEmployee(stillgelegtId);
    }
  });

  it('Test 5: Der DATEV-Export liefert stillgelegte Konten weiterhin mit (bewusste Gegenentscheidung, WR-11)', () => {
    const stillgelegtId = createEmployee('datev-still', 40, '2020-01-01');
    try {
      const tag = firstNonHolidayWeekday(PERIOD_START);
      insertAbsence(stillgelegtId, 'vacation', 'approved', tag, tag);
      softDelete(stillgelegtId);

      const csv = generateDATEVExport(PERIOD_START, PERIOD_END);
      const zeilenDesNutzers = csv
        .split('\n')
        .filter(line => line.startsWith(`${stillgelegtId};`));

      // Gegenprobe in derselben Messung: Der Historien-Export laesst denselben Nutzer weg.
      const historie = generateHistoricalExport(PERIOD_START, PERIOD_END);
      const imHistorienExport = historie.users.filter(u => u.id === stillgelegtId).length;

      messwerte.push(
        `Test 5 | userId=${stillgelegtId} (stillgelegt, 1 genehmigte Abwesenheit am ${tag}) | ` +
          `DATEV-Zeilen=${zeilenDesNutzers.length} | im Historien-Export=${imHistorienExport}`
      );

      // Die DATEV-Entscheidung ist unangetastet ...
      expect(zeilenDesNutzers.length).toBeGreaterThan(0);
      // ... und der Historien-Export entscheidet weiterhin anders. Beides zugleich ist der
      // Sollzustand; keine der beiden Stellen wird an die andere angeglichen.
      expect(imHistorienExport).toBe(0);
    } finally {
      cleanupEmployee(stillgelegtId);
    }
  });

  it('Aufraeumnachweis: kein Testnutzer mit dem Praefix bleibt stehen', () => {
    for (const userId of createdUserIds) {
      cleanupEmployee(userId);
    }
    const reste = db
      .prepare('SELECT COUNT(*) AS c FROM users WHERE username LIKE ?')
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    const absenceReste = db
      .prepare(
        `SELECT COUNT(*) AS c FROM absence_requests
         WHERE userId IN (SELECT id FROM users WHERE username LIKE ?)`
      )
      .get(`${USERNAME_PREFIX}%`) as { c: number };

    messwerte.push(
      `Aufraeumnachweis | users mit Praefix=${reste.c} | absence_requests dieser Nutzer=${absenceReste.c}`
    );

    expect(reste.c).toBe(0);
    expect(absenceReste.c).toBe(0);
  });
});
