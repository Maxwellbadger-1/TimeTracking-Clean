import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../database/connection.js';
import { getTodayString } from '../utils/timezone.js';
import { insertTestWorkPeriod } from '../test-support/workPeriodFixtures.js';
import { createAbsenceRequest } from './absenceService.js';

/**
 * BL-05 — REGRESSIONSNETZ FUER DEN ANLEGEPFAD EINER KRANKMELDUNG
 * (Phase 14.1, Plan 14.1-03, D-05; Befund BL-05 aus `14-WEITERE-BEFUNDE.md`.)
 *
 * WAS HIER ABGESICHERT WIRD: Eine Krankmeldung wird beim Anlegen automatisch genehmigt
 * (`status = 'approved'`). Der regulaere Genehmigungsweg (`approveAbsenceRequest`) fuehrt
 * unmittelbar nach dem Statuswechsel den Block aus, der die Neuberechnung je betroffenem
 * Monat anstoesst und dabei die `sick_credit`-Buchungen erzeugt. Dem Auto-Genehmigungszweig
 * in `createAbsenceRequest` fehlte genau dieser Block: Die Krankmeldung stand im Antrag,
 * aber im Journal stand nichts.
 *
 * Verdeckt hat das der naechtliche Lauf um 03:00 Uhr, der die Neuberechnung nachholte. Er ist
 * seit dem 23.08.2026 angehalten (D-11) — seither wirkt der Fehler am selben Tag.
 *
 * WAS AUSDRUECKLICH KEIN FEHLER IST UND HIER FESTGESCHRIEBEN WIRD: Die Auto-Genehmigung
 * selbst. Krankmeldungen muessen nicht genehmigt werden (Festlegung des Anwenders vom
 * 25.08.2026, D-05). Genehmiger-Feld und Genehmigungszeitpunkt bleiben leer, es wird kein
 * Protokolleintrag geschrieben. Test 2 und Test 3 sichern genau das zu, damit ein spaeterer
 * Umbau daran scheitert statt still durchzugehen.
 *
 * Vier Sachtests:
 *   1. Journal sofort  — `sick_credit`-Zeilen unmittelbar nach dem Anlegen (0 -> groesser 0).
 *   2. Auto-Genehmigung unveraendert — `approved`, Genehmiger und Zeitstempel leer.
 *   3. Kein Protokolleintrag — Zeilenzahl im Protokoll vorher = nachher.
 *   4. Abgrenzung — ein Urlaubsantrag bleibt `pending` und erzeugt beim Anlegen KEINE
 *      Journalzeilen; der neue Block feuert ausschliesslich im Auto-Genehmigungszweig.
 * Dazu ein Aufraeumnachweis am Dateiende.
 *
 * ------------------------------------------------------------------------------------
 * D-11 — WARUM HIER NICHT UEBER `overtime_balance` NACHGEWIESEN WIRD:
 *
 * `overtime_balance` wird bei JEDER Berichtsabfrage neu geschrieben
 * (`updateMonthlyOvertime` -> `INSERT ... ON CONFLICT DO UPDATE`, `overtimeService.ts`;
 * `rebuildOvertimeTransactionsForMonth`, `overtimeTransactionRebuildService.ts`). Ein Test,
 * der dort misst, wuerde auch mit fehlendem Neuberechnungsblock gruen, sobald irgendetwas
 * dazwischen einmal rechnet. Er beweist nichts.
 *
 * Deshalb: In dieser Datei stehen Treffer auf `overtime_balance` AUSSCHLIESSLICH in
 * Kommentaren und in der Aufraeumanweisung — in keiner einzigen `expect`-Zusicherung.
 * Nachgewiesen wird gegen `overtime_transactions`, die nur der reparierte Pfad schreibt.
 *
 * Und: Zwischen `createAbsenceRequest(...)` und der Messung steht KEINE Berichtsabfrage,
 * KEIN Rebuild von Hand und selbstverstaendlich kein Nachtlauf. Die naechste Anweisung nach
 * dem Anlegen ist die Messung.
 * ------------------------------------------------------------------------------------
 *
 * AUFBAU (Muster aus `absenceDeletionRecalc.test.ts` / `absencePeriodAwareness.test.ts`):
 * geteilte Verbindung aus `connection.js`, kein Speicher-Abbild; eigenes Nutzerpraefix
 * `test-141-03-`, weil alle Testdateien dieselbe `development.db` teilen
 * (`vitest.config.ts` -> `fileParallelism: false`); "heute" ausschliesslich ueber
 * `getTodayString()` (Berlin), nie ueber `new Date()`; Datumsfortschaltung ueber lokale
 * Kalenderfelder statt einer ISO-String-Konvertierung (`.claude/CLAUDE.md`, "Timezone Bugs").
 *
 * ZEITRAUMWAHL: Der Krankheitszeitraum liegt im VORMONAT, nie in der Zukunft. Nach Plan
 * 14.1-01 (BL-01) wird fuer Tage in der Zukunft nicht mehr gerechnet — ein Zukunftszeitraum
 * wuerde diesen Test still leerlaufen lassen. Der gewaehlte Tag ist ein Werktag ohne
 * Feiertag und traegt nach dem Wochenplan des Testnutzers Sollstunden; ohne Sollstunden
 * gaebe es nichts gutzuschreiben und Test 1 waere trivial gruen.
 */

const USERNAME_PREFIX = 'test-141-03-';
const createdUserIds: number[] = [];

/** Beobachtete Zahlen fuer `14.1-NACHWEIS-BL05.md` — Dokumentation, keine Zusicherung. */
const messwerte: string[] = [];

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE die abhaengigen Zeilen beim
  // Loeschen des Testnutzers nicht ab.
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
  // Sicherheitsnetz: Was ein fehlgeschlagener Test im `finally` nicht abgeraeumt hat, faellt
  // hier weg — der Aufraeumnachweis am Dateiende laeuft danach und wuerde es sonst melden.
  for (const userId of createdUserIds) {
    cleanupEmployee(userId);
  }
  if (messwerte.length > 0) {
    console.log('\n--- BL-05 Messwerte fuer 14.1-NACHWEIS-BL05.md ---\n' + messwerte.join('\n') + '\n');
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

/** Letzter Tag des Monats, dessen erster Tag `isoFirstOfMonth` ist. */
function lastOfMonth(isoFirstOfMonth: string): string {
  const [y, m] = isoFirstOfMonth.split('-').map(Number);
  return isoDate(new Date(y, m, 0));
}

/**
 * Erster Werktag (Mo bis Fr) des Monats, der kein Feiertag ist. Abwesenheiten schliessen
 * Feiertage aus; faellt der gewaehlte Tag auf einen Feiertag, waere `days === 0` und
 * `createAbsenceRequest` wuerfe "must span at least one business day".
 */
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

function createEmployee(suffix: string, weeklyHours: number, hireDate: string): number {
  const username = `${USERNAME_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username, `${username}@test.local`, 'T14103', suffix, 'hash', 'employee', weeklyHours, hireDate);
  const userId = result.lastInsertRowid as number;
  createdUserIds.push(userId);
  return userId;
}

/**
 * Raeumt jede Zeile ab, die ein Testnutzer erzeugt haben kann. Die fuenf nach D-08
 * geschuetzten Tabellen (`time_entries`, `absence_requests`, `overtime_corrections`,
 * `vacation_balance`, `vacation_transactions`) stehen bewusst mit drin: Der Test legt dort
 * eigene Zeilen an, und die D-08-Kennzahlen werden NACH dem Aufraeumen erhoben. Weicht eine
 * Zahl dann ab, ist dieser Aufraeumpfad unvollstaendig — nicht die Kennzahl.
 *
 * `overtime_balance` erscheint hier als AUFRAEUMANWEISUNG, nicht als Beleg (D-11, siehe
 * Kopfkommentar).
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

/** `sick_credit`-Zeilen des Nutzers im Zeitraum — die Buchungen, die BL-05 vermissen liess. */
function sickCreditRows(
  userId: number,
  fromDate: string,
  toDate: string
): Array<{ date: string; hours: number }> {
  return db
    .prepare(
      `SELECT date, hours FROM overtime_transactions
       WHERE userId = ? AND type = 'sick_credit' AND date BETWEEN ? AND ?
       ORDER BY date`
    )
    .all(userId, fromDate, toDate) as Array<{ date: string; hours: number }>;
}

/** Alle Journalzeilen des Nutzers im Zeitraum — fuer die Abgrenzung in Test 4. */
function journalRowCount(userId: number, fromDate: string, toDate: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM overtime_transactions
       WHERE userId = ? AND date BETWEEN ? AND ?`
    )
    .get(userId, fromDate, toDate) as { c: number };
  return row.c;
}

/** Zeilen im Aenderungsprotokoll des Nutzers. */
function protocolRowCount(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM audit_log WHERE userId = ?')
    .get(userId) as { c: number };
  return row.c;
}

/** Kontostand-Cache. `null`, wenn noch kein Konto existiert. Nur Dokumentation (D-05). */
function workTimeAccountBalance(userId: number): number | null {
  const row = db
    .prepare('SELECT currentBalance FROM work_time_accounts WHERE userId = ?')
    .get(userId) as { currentBalance: number } | undefined;
  return row ? row.currentBalance : null;
}

const TODAY = getTodayString();
/** Vormonat — garantiert vollstaendig in der Vergangenheit, an jedem Kalendertag. */
const PREV_MONTH_START = firstOfMonthOffset(TODAY, -1);
const PREV_MONTH_END = lastOfMonth(PREV_MONTH_START);

describe('BL-05: Eine neu angelegte Krankmeldung rechnet sofort neu (Phase 14.1, D-05)', () => {
  it('Test 1: Die sick_credit-Buchungen stehen unmittelbar nach dem Anlegen im Journal', () => {
    const userId = createEmployee('journal', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const day = firstNonHolidayWeekday(PREV_MONTH_START);
      // Nie in der Zukunft — sonst rechnet nach Plan 14.1-01 (BL-01) niemand mehr.
      expect(day < TODAY).toBe(true);
      expect(PREV_MONTH_END < TODAY).toBe(true);

      const vorher = sickCreditRows(userId, PREV_MONTH_START, PREV_MONTH_END);
      expect(vorher.length).toBe(0);
      const kontoVorher = workTimeAccountBalance(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'sick',
        startDate: day,
        endDate: day,
        reason: 'BL-05 Regressionstest',
      });

      // D-11: unmittelbar danach gemessen. Keine Berichtsabfrage, kein Rebuild von Hand,
      // kein Nachtlauf dazwischen — die naechste Anweisung ist die Messung.
      const nachher = sickCreditRows(userId, PREV_MONTH_START, PREV_MONTH_END);
      const kontoNachher = workTimeAccountBalance(userId);

      const summe = nachher.reduce((s, r) => s + r.hours, 0);
      messwerte.push(
        `Test 1 | userId=${userId} | Antrag=${request.id} | Tag=${day} | ` +
          `sick_credit vorher=${vorher.length} nachher=${nachher.length} | ` +
          `Summe hours=${summe} | work_time_accounts vorher=${kontoVorher} nachher=${kontoNachher}`
      );

      // Ohne den Neuberechnungsblock im Auto-Genehmigungszweig bleibt diese Zahl 0 —
      // genau das macht den Test ohne den Fix rot.
      expect(nachher.length).toBeGreaterThan(0);
      expect(summe).toBeGreaterThan(0);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 2: Die Auto-Genehmigung bleibt unveraendert — approved, ohne Genehmiger und ohne Zeitstempel', () => {
    const userId = createEmployee('autogen', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const day = firstNonHolidayWeekday(PREV_MONTH_START);

      const request = createAbsenceRequest({
        userId,
        type: 'sick',
        startDate: day,
        endDate: day,
        reason: 'BL-05 Regressionstest',
      });

      const row = db
        .prepare('SELECT status, approvedBy, approvedAt, createdAt FROM absence_requests WHERE id = ?')
        .get(request.id) as {
        status: string;
        approvedBy: number | null;
        approvedAt: string | null;
        createdAt: string | null;
      };

      messwerte.push(
        `Test 2 | userId=${userId} | Antrag=${request.id} | status=${row.status} | ` +
          `approvedBy=${row.approvedBy} | approvedAt=${row.approvedAt} | createdAt=${row.createdAt}`
      );

      // Krankmeldungen muessen nicht genehmigt werden (Festlegung des Anwenders vom
      // 25.08.2026, D-05). Diese Zusicherungen halten das fest, damit ein spaeterer Umbau
      // daran scheitert.
      expect(row.status).toBe('approved');
      expect(row.approvedBy).toBeNull();
      expect(row.approvedAt).toBeNull();
      // Der Anlegezeitpunkt steht in `createdAt` — ein zusaetzlicher Genehmigungszeitstempel
      // wurde am 25.08.2026 ausdruecklich verworfen.
      expect(row.createdAt).not.toBeNull();
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 3: Das Anlegen einer Krankmeldung erzeugt keinen Protokolleintrag', () => {
    const userId = createEmployee('protokoll', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const day = firstNonHolidayWeekday(PREV_MONTH_START);

      const vorher = protocolRowCount(userId);

      const request = createAbsenceRequest({
        userId,
        type: 'sick',
        startDate: day,
        endDate: day,
        reason: 'BL-05 Regressionstest',
      });

      const nachher = protocolRowCount(userId);
      messwerte.push(
        `Test 3 | userId=${userId} | Antrag=${request.id} | audit_log vorher=${vorher} nachher=${nachher}`
      );

      expect(nachher).toBe(vorher);
    } finally {
      cleanupEmployee(userId);
    }
  });

  it('Test 4: Ein Urlaubsantrag bleibt pending und erzeugt beim Anlegen keine Journalzeilen', () => {
    const userId = createEmployee('urlaub', 40, '2020-01-01');
    try {
      insertTestWorkPeriod(userId, { validFrom: '2020-01-01', weeklyHours: 40, workSchedule: null });
      const day = firstNonHolidayWeekday(PREV_MONTH_START);

      expect(journalRowCount(userId, PREV_MONTH_START, PREV_MONTH_END)).toBe(0);

      const request = createAbsenceRequest({
        userId,
        type: 'vacation',
        startDate: day,
        endDate: day,
        reason: 'BL-05 Regressionstest',
      });

      // Der neue Block steht im Zweig `status === 'approved'` und feuert daher nur bei der
      // Auto-Genehmigung. Ein Urlaubsantrag ist beim Anlegen `pending`; seine Buchungen
      // entstehen erst mit der Genehmigung durch `approveAbsenceRequest`.
      const row = db
        .prepare('SELECT status FROM absence_requests WHERE id = ?')
        .get(request.id) as { status: string };
      const journal = journalRowCount(userId, PREV_MONTH_START, PREV_MONTH_END);

      messwerte.push(
        `Test 4 | userId=${userId} | Antrag=${request.id} | status=${row.status} | ` +
          `Journalzeilen nach dem Anlegen=${journal}`
      );

      expect(row.status).toBe('pending');
      expect(journal).toBe(0);
    } finally {
      cleanupEmployee(userId);
    }
  });
});

describe('Aufraeumnachweis', () => {
  it('Test 5: kein Nutzer mit dem Praefix test-141-03- bleibt in users stehen', () => {
    const rest = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE username LIKE ?')
      .get(`${USERNAME_PREFIX}%`) as { c: number };
    expect(rest.c).toBe(0);
  });
});
