import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { addDays } from 'date-fns';
import { db } from '../database/connection.js';
import { getAllUsers } from './userService.js';
import { createWorkPeriod, softDeleteWorkPeriod } from './workPeriodService.js';
import { formatDate, getCurrentDate, getTodayString } from '../utils/timezone.js';
import type { UserPublic, WorkSchedule } from '../types/index.js';

/**
 * F-2 (Phase 14.2, Plan 08) — Die Nutzerliste liefert die HEUTE gueltige Periode mit.
 *
 * Befund (14-ABNAHME-SICHT.md, NB-2): Der Desktop zeigt die Stammdaten
 * (`users.weeklyHours`/`users.workSchedule`), rechnet aber mit der Periode
 * (`user_work_periods`). Fuer Listen (Nutzerverwaltung, Admin-Dashboard) darf die
 * Aufloesung NICHT je Zeile einzeln nachgeladen werden (N+1) — `getAllUsers()` liefert sie
 * deshalb in derselben Abfrage mit.
 *
 * Testaufbau wie `workPeriodService.test.ts`: gegen die geteilte Verbindung aus
 * `connection.js` (der Service hat sie fest verdrahtet). Fixtures werden per direktem
 * INSERT in `users` angelegt — bewusst NICHT ueber `createUser()`, weil dieser Weg
 * Urlaubskonten schreibt und damit `vacation_balance`/`vacation_transactions` beruehren
 * wuerde; diese Tabellen stehen unter D-01 und bleiben unangetastet.
 *
 * Alle Datumsangaben sind relativ zu heute gebildet (`shiftDays`) — kein fest verdrahtetes
 * Jahr, damit die Faelle "Stichtag in der Vergangenheit" und "Stichtag in der Zukunft" an
 * jedem Kalendertag dasselbe messen.
 */

const TEST_PREFIX = 'test-142-08-';

/** Datum relativ zu heute, YYYY-MM-DD, Europe/Berlin — nie `toISOString().split('T')[0]`. */
function shiftDays(days: number): string {
  return formatDate(addDays(getCurrentDate(), days), 'yyyy-MM-dd');
}

const TODAY = getTodayString();

function createTestUser(
  suffix: string,
  weeklyHours: number,
  workSchedule: WorkSchedule | null = null
): number {
  const username = `${TEST_PREFIX}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, firstName, lastName, password, role, weeklyHours, workSchedule, hireDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      username,
      `${username}@test.local`,
      'Test',
      'CurrentPeriod',
      'hash',
      'employee',
      weeklyHours,
      workSchedule ? JSON.stringify(workSchedule) : null,
      shiftDays(-2000)
    );
  return result.lastInsertRowid as number;
}

function findUser(users: UserPublic[], userId: number): UserPublic {
  const found = users.find((u) => u.id === userId);
  if (!found) {
    throw new Error(`Testnutzer ${userId} fehlt in der Ausgabe von getAllUsers()`);
  }
  return found;
}

const INDIVIDUAL_SCHEDULE: WorkSchedule = {
  monday: 8,
  tuesday: 4,
  wednesday: 6,
  thursday: 6,
  friday: 6,
  saturday: 0,
  sunday: 0,
};

beforeAll(() => {
  // Ohne aktive Fremdschluessel raeumt ON DELETE CASCADE die Perioden beim Loeschen des
  // Testnutzers nicht ab — einmal setzen und den tatsaechlichen Wert zuruecklesen.
  db.pragma('foreign_keys = ON');
  const fkStatus = db.pragma('foreign_keys', { simple: true }) as number;
  expect(fkStatus).toBe(1);
});

afterAll(() => {
  // Aufraeumen ausschliesslich ueber `users` — der BEFORE-DELETE-Trigger auf
  // `user_work_periods` (Migration 008/013) weist ein einzelnes DELETE einer Periode ab,
  // solange der Nutzer noch existiert; ON DELETE CASCADE raeumt sie beim Loeschen des
  // Nutzers mit ab (deferred-items.md, Plan 14.1-03, Punkt 2).
  db.prepare(`DELETE FROM users WHERE username LIKE ?`).run(`${TEST_PREFIX}%`);
});

describe('F-2 — getAllUsers() loest die heute gueltige Arbeitszeitperiode mit auf', () => {
  it('Test 1 — Stichtag in der Vergangenheit: currentWeeklyHours folgt der Periode, weeklyHours bleibt Stammdatum', () => {
    const userId = createTestUser('vergangenheit', 40);
    createWorkPeriod({
      userId,
      validFrom: shiftDays(-2000),
      validTo: shiftDays(-30),
      weeklyHours: 40,
      workSchedule: null,
      note: 'F-2 Test 1: Periode vor dem Stichtag',
    });
    createWorkPeriod({
      userId,
      validFrom: shiftDays(-30),
      validTo: null,
      weeklyHours: 30,
      workSchedule: null,
      note: 'F-2 Test 1: Periode ab dem Stichtag',
    });

    const user = findUser(getAllUsers(), userId);

    // Das IST der Befund: beide Werte weichen ab, und der neue folgt der Periode.
    expect(user.weeklyHours).toBe(40);
    expect(user.currentWeeklyHours).toBe(30);
    expect(user.currentValidFrom).toBe(shiftDays(-30));
  });

  it('Test 2 — Stichtag in der Zukunft: die kuenftige Periode wird NICHT vorweggenommen', () => {
    const userId = createTestUser('zukunft', 40);
    createWorkPeriod({
      userId,
      validFrom: shiftDays(-2000),
      validTo: shiftDays(30),
      weeklyHours: 40,
      workSchedule: null,
      note: 'F-2 Test 2: heute gueltige Periode',
    });
    createWorkPeriod({
      userId,
      validFrom: shiftDays(30),
      validTo: null,
      weeklyHours: 20,
      workSchedule: null,
      note: 'F-2 Test 2: kuenftige Periode',
    });

    const user = findUser(getAllUsers(), userId);

    expect(user.currentWeeklyHours).toBe(40);
    expect(user.currentWeeklyHours).not.toBe(20);
    expect(user.currentValidFrom).toBe(shiftDays(-2000));
  });

  it('Test 3 — kein Periodeneintrag: alle drei Felder sind null (der Client faellt auf die Stammdaten zurueck)', () => {
    const userId = createTestUser('ohne-periode', 35);

    const user = findUser(getAllUsers(), userId);

    expect(user.currentWeeklyHours).toBeNull();
    expect(user.currentWorkSchedule).toBeNull();
    expect(user.currentValidFrom).toBeNull();
    // Die Stammdaten bleiben erhalten — sie sind der Rueckfall der Anzeige.
    expect(user.weeklyHours).toBe(35);
  });

  it('Test 4 — eine weggenommene Periode zaehlt nicht mehr als gueltig', () => {
    const userId = createTestUser('weggenommen', 40);
    const period = createWorkPeriod({
      userId,
      validFrom: shiftDays(-2000),
      validTo: null,
      weeklyHours: 33,
      workSchedule: null,
      note: 'F-2 Test 4: wird weggenommen',
    });

    const before = findUser(getAllUsers(), userId);
    expect(before.currentWeeklyHours).toBe(33);

    softDeleteWorkPeriod(period.id, null);

    const after = findUser(getAllUsers(), userId);
    expect(after.currentWeeklyHours).not.toBe(33);
    expect(after.currentWeeklyHours).toBeNull();
    expect(after.currentValidFrom).toBeNull();
  });

  it('Test 5 — currentWorkSchedule kommt als Objekt an, nicht als Zeichenkette', () => {
    const mitPlan = createTestUser('mit-plan', 40);
    createWorkPeriod({
      userId: mitPlan,
      validFrom: shiftDays(-2000),
      validTo: null,
      weeklyHours: 30,
      workSchedule: INDIVIDUAL_SCHEDULE,
      note: 'F-2 Test 5: Periode mit Tagesplan',
    });

    const ohnePlan = createTestUser('ohne-plan', 40);
    createWorkPeriod({
      userId: ohnePlan,
      validFrom: shiftDays(-2000),
      validTo: null,
      weeklyHours: 30,
      workSchedule: null,
      note: 'F-2 Test 5: Periode ohne Tagesplan',
    });

    const users = getAllUsers();
    const withSchedule = findUser(users, mitPlan);
    const withoutSchedule = findUser(users, ohnePlan);

    expect(typeof withSchedule.currentWorkSchedule).toBe('object');
    expect(withSchedule.currentWorkSchedule).toEqual(INDIVIDUAL_SCHEDULE);
    expect(Object.keys(withSchedule.currentWorkSchedule ?? {})).toHaveLength(7);
    expect(withoutSchedule.currentWorkSchedule).toBeNull();
  });

  it('Test 6 — NO REGRESSION: kein Nutzer verliert ein bestehendes Feld von UserPublic', () => {
    const userId = createTestUser('kein-feldverlust', 38, INDIVIDUAL_SCHEDULE);
    createWorkPeriod({
      userId,
      validFrom: shiftDays(-2000),
      validTo: null,
      weeklyHours: 30,
      workSchedule: null,
      note: 'F-2 Test 6: irgendeine gueltige Periode',
    });

    const user = findUser(getAllUsers(), userId);

    // Explizite Feldliste — die Form von UserPublic, wie getAllUsers() sie VOR dieser
    // Aenderung geliefert hat. Kein `toMatchObject` mit Teilmenge, sondern jedes Feld
    // einzeln benannt, damit ein weggefallenes Feld tatsaechlich auffaellt.
    const EXPECTED_FIELDS = [
      'id',
      'username',
      'email',
      'firstName',
      'lastName',
      'role',
      'department',
      'position',
      'weeklyHours',
      'workSchedule',
      'vacationDaysPerYear',
      'hireDate',
      'endDate',
      'status',
      'privacyConsentAt',
      'createdAt',
      'deletedAt',
      'isActive',
    ] as const;

    for (const field of EXPECTED_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(user, field)).toBe(true);
    }

    // Und die Werte stammen unveraendert aus der `users`-Zeile, nicht aus der Periode.
    const row = db
      .prepare(
        `SELECT username, email, firstName, lastName, role, weeklyHours, workSchedule, hireDate, status
         FROM users WHERE id = ?`
      )
      .get(userId) as {
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      weeklyHours: number;
      workSchedule: string | null;
      hireDate: string;
      status: string;
    };

    expect(user.username).toBe(row.username);
    expect(user.email).toBe(row.email);
    expect(user.firstName).toBe(row.firstName);
    expect(user.lastName).toBe(row.lastName);
    expect(user.role).toBe(row.role);
    expect(user.weeklyHours).toBe(row.weeklyHours);
    expect(user.workSchedule).toEqual(INDIVIDUAL_SCHEDULE);
    expect(user.hireDate).toBe(row.hireDate);
    expect(user.status).toBe(row.status);
    // Die drei neuen Felder kommen ZUSAETZLICH, sie ersetzen nichts.
    expect(user.currentWeeklyHours).toBe(30);
    expect(user.currentValidFrom).toBe(shiftDays(-2000));
    expect(TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
