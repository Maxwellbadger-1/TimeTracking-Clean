import db from '../database/connection.js';
import { hashPassword, comparePassword, findUserById as findUserByIdWithPassword } from './authService.js';
import type { User, UserPublic, UserCreateInput, GDPRDataExport, TimeEntry, AbsenceRequest, UserWorkPeriod } from '../types/index.js';
import { getVacationBalance } from './absenceService.js';
import { getOvertimeBalance } from './overtimeTransactionService.js';
// UNUSED: import { calculateMonthlyTargetHours } from '../utils/workingDays.js';
import logger from '../utils/logger.js';
import { createWorkPeriod, getWorkPeriods, getCurrentWorkPeriod, setWorkPeriodValidFrom, updateWorkPeriodValues } from './workPeriodService.js';
import { formatDate, getCurrentDate } from '../utils/timezone.js';

/**
 * WR-09: Zeilenform der `users`-Tabelle, wie sie better-sqlite3 liefert — `workSchedule`
 * ist dort die rohe JSON-Zeichenkette, `isActive` eine 0/1-Zahl. Vorher stand an beiden
 * Lesestellen `as any`/`as any[]`; damit war jeder Tippfehler in einem Spaltennamen
 * typkorrekt. Das Projekt hat mit `UserWorkPeriodRow` bereits dasselbe Muster.
 */
interface UserRow extends Omit<UserPublic, 'workSchedule' | 'isActive'> {
  workSchedule: string | null;
  isActive: number;
}

/**
 * User Service - Business Logic for User Management
 */

/** Dieselbe Formprüfung wie das GLOB-CHECK von `user_work_periods.validFrom`
 *  (Migration 008) und wie `HIRE_DATE_PATTERN` in Migration 009. */
const HIRE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * CR-02 (Code-Review Phase 11, Durchlauf 2): Weist ein nicht wohlgeformtes `hireDate` ab,
 * BEVOR irgendetwas geschrieben wird.
 *
 * WARUM ein `throw` und keine Warnung: Vorher schrieb `updateUser()` den Wert ungeprüft in
 * die Spalte (weder Routenvalidierung noch CHECK in `users`), `syncStartPeriodToHireDate()`
 * protokollierte anschließend nur eine Warnung und ließ die Periode stehen, und direkt
 * danach lief `DELETE FROM overtime_balance` bedingungslos durch. Der versprochene
 * Wiederaufbau konnte nicht greifen: `ensureOvertimeBalanceEntries()` bildet
 * `new Date(user.hireDate)`; bei `Invalid Date` liefert `getFullYear()` `NaN` und die
 * Monatsschleife läuft null mal. Ergebnis war HTTP 200 bei gelöschtem Saldo ohne jede
 * Möglichkeit, ihn wiederzubekommen — genau der Zustand, den CR-01 aus Durchlauf 1
 * verhindern sollte.
 *
 * Die Prüfung ist bewusst dieselbe Formprüfung wie das GLOB-CHECK von
 * `user_work_periods.validFrom` (Migration 008): Was die Periodenkette nicht aufnehmen
 * kann, darf auch nicht in `users.hireDate` stehen.
 *
 * Zusätzlich zur Form wird die Gültigkeit geprüft — `2026-02-31` und `2026-13-01` passen
 * auf das Muster, sind aber keine Kalendertage. `new Date('2026-02-31')` ergibt in
 * JavaScript den 3. März; die Rückprobe über die normalisierte Zeichenkette fängt das ab.
 */
function assertWellFormedHireDate(hireDate: string | null | undefined): void {
  if (hireDate === undefined) {
    return; // Feld nicht mitgesendet — keine Änderung, nichts zu prüfen.
  }

  const value = hireDate ?? '';

  if (!HIRE_DATE_PATTERN.test(value)) {
    throw new Error(
      `hireDate muss das Format JJJJ-MM-TT haben, erhalten: ${JSON.stringify(hireDate)}`
    );
  }

  // Kalendarische Gültigkeit. `Date.UTC` statt `new Date(str)`, damit die Prüfung nicht von
  // der Prozess-Zeitzone abhängt (dieselbe Begründung wie bei `dayIndexFromDateString()`
  // in workingDays.ts).
  const [year, month, day] = value.split('-').map(part => Number.parseInt(part, 10));
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDay =
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day;

  if (!isRealCalendarDay) {
    throw new Error(`hireDate ist kein gültiges Kalenderdatum: ${JSON.stringify(hireDate)}`);
  }
}

/**
 * Ersatzdatum-Kette für die Startperiode eines Nutzers (Plan 11-03, Fortschreibung von D5
 * aus Migration 009). Anders als beim Bestandsbackfill gibt es hier KEIN
 * `time_entries`-Zwischenglied: Ein Nutzer, für den diese Funktion eine Periode anlegt, hat
 * zum Zeitpunkt der Anlage noch keine Zeiteinträge, aus denen sich ein früheres Datum
 * ableiten ließe (Plan-Interfaces). `hireDate`, sofern wohlgeformt (`JJJJ-MM-TT`), sonst das
 * heutige Datum (Europe/Berlin, `formatDate`/`getCurrentDate` — kein `toISOString()`).
 */
function resolveInitialValidFrom(
  hireDate: string | null | undefined
): { validFrom: string; source: 'hireDate' | 'anlagedatum' } {
  if (hireDate && HIRE_DATE_PATTERN.test(hireDate)) {
    return { validFrom: hireDate, source: 'hireDate' };
  }
  return { validFrom: formatDate(getCurrentDate(), 'yyyy-MM-dd'), source: 'anlagedatum' };
}

function initialPeriodNote(source: 'hireDate' | 'anlagedatum'): string {
  return `[ANLAGE-11-03] Startperiode, Quelle: ${source === 'hireDate' ? 'hireDate' : 'Anlagedatum'}`;
}

/**
 * Stellt sicher, dass `user` mindestens eine Arbeitszeitperiode hat. D4 (Phase 11) macht
 * eine fehlende Periode zum harten Fehler bei jeder Sollstunden-Berechnung — Migration 009
 * hat das für den damaligen Bestand hergestellt, diese Funktion schließt dieselbe Lücke für
 * jeden Nutzer, der seither entsteht oder aus anderem Grund (Alt-Import, Seed-Skript aus
 * Plan 11-08) noch keine Periode hat.
 *
 * Idempotent: Hat der Nutzer bereits mindestens eine Periode, passiert nichts und die
 * Funktion liefert `null`. Ausschließlich `createWorkPeriod()` legt an — kein zweiter
 * Schreibweg.
 */
export function ensureInitialWorkPeriod(
  user: UserPublic,
  createdBy: number | null = null
): UserWorkPeriod | null {
  if (getWorkPeriods(user.id).length > 0) {
    return null;
  }

  const { validFrom, source } = resolveInitialValidFrom(user.hireDate);
  if (source !== 'hireDate') {
    logger.info(
      { userId: user.id, validFrom, source },
      'ℹ️ ensureInitialWorkPeriod: Ersatzdatum verwendet (kein wohlgeformtes hireDate)'
    );
  }

  return createWorkPeriod({
    userId: user.id,
    validFrom,
    validTo: null,
    weeklyHours: user.weeklyHours,
    workSchedule: user.workSchedule,
    note: initialPeriodNote(source),
    createdBy,
  });
}

/**
 * Zieht die Startperiode eines Nutzers nach, wenn sein `hireDate` geändert wurde (CR-01).
 *
 * WARUM: D4 (Phase 11) macht eine fehlende Periode zum harten Laufzeitfehler. Wird das
 * Eintrittsdatum VORVERLEGT (Korrekturfall: 2025-03-01 -> 2025-01-01), liegt jeder Tag im
 * Intervall [neues hireDate, validFrom) hinter der D4-Ausnahme "vor hireDate = 0h", findet
 * aber keine Periode — `getDailyTargetHours()` wirft dann `MissingWorkPeriodError` ab dem
 * ersten Tag. Da `updateUser()` unmittelbar danach `overtime_balance` löscht, hätte der
 * Nutzer weder Saldo noch die Möglichkeit, wieder einen zu bekommen.
 *
 * Drei Fälle, alle ausdrücklich entschieden (keiner dem Zufall überlassen):
 * 1. Keine Periode vorhanden (Alt-Fall) -> `ensureInitialWorkPeriod()` mit dem NEUEN
 *    hireDate legt die Startperiode an.
 * 2. Neues hireDate < validFrom der ersten Periode -> Kette nach vorn verlängern.
 * 3. Neues hireDate >= validFrom der ersten Periode -> Kette bewusst STEHEN LASSEN. Die
 *    Periode deckt dann mehr ab als das Beschäftigungsverhältnis; das ist ungefährlich,
 *    weil `getDailyTargetHours()` für Daten vor `hireDate` ohnehin 0 liefert (D4-Ausnahme),
 *    und ein Kürzen würde bei einer mehrgliedrigen Kette eine Lücke erzeugen.
 *
 * Läuft innerhalb derselben Transaktion wie das `UPDATE users` — sonst bleibt bei einem
 * Fehlschlag ein Nutzer ohne passende Periode zurück.
 */
function syncStartPeriodToHireDate(
  userId: number,
  newHireDate: string | null | undefined,
  userForFallback: UserPublic
): void {
  // CR-02: Hier stand vorher `logger.warn(...) + return`. Die Warnung war die Stelle, an der
  // ein Müllwert lautlos durchrutschte: Die Periode blieb stehen, das `UPDATE users` war
  // schon durch, und die anschließende Saldolöschung lief trotzdem. Jetzt bricht der
  // gesamte Vorgang ab — und weil `assertWellFormedHireDate()` in `updateUser()` bereits
  // VOR dem Bau der SQL-Anweisung prüft, ist dieser Zweig für den Update-Weg unerreichbar.
  // Er bleibt als Zusicherung für die übrigen Aufrufer stehen (`mirrorUserToWorkPeriod()`,
  // das `hireDate` aus einer bestehenden `users`-Zeile weiterreicht).
  if (!newHireDate || !HIRE_DATE_PATTERN.test(newHireDate)) {
    throw new Error(
      `syncStartPeriodToHireDate: hireDate von Nutzer ${userId} ist nicht wohlgeformt ` +
        `(erwartet JJJJ-MM-TT, erhalten: ${JSON.stringify(newHireDate)}). ` +
        'Die Startperiode kann darauf nicht nachgeführt werden; ein Weiterlaufen würde ' +
        'einen Nutzer ohne passende Periode hinterlassen (D4).'
    );
  }

  const periods = getWorkPeriods(userId); // aufsteigend nach validFrom
  const first = periods[0];

  if (!first) {
    ensureInitialWorkPeriod({ ...userForFallback, hireDate: newHireDate }, null);
    return;
  }

  if (newHireDate < first.validFrom) {
    logger.info(
      { userId, periodId: first.id, oldValidFrom: first.validFrom, newValidFrom: newHireDate },
      '🔄 hireDate vorverlegt — Startperiode wird nach vorn verlängert (CR-01)'
    );
    setWorkPeriodValidFrom(first.id, newHireDate);
  }
  // newHireDate >= first.validFrom: Fall 3 oben — bewusst keine Änderung.
}

/**
 * Bringt die Periodenkette eines Nutzers auf den Stand seines Stammdatensatzes (CR-02).
 *
 * WARUM: `ensureInitialWorkPeriod()` ist per Vertrag idempotent und tut NICHTS, wenn bereits
 * eine Periode existiert. Ein Schreibweg außerhalb von `updateUser()` — namentlich der
 * Update-Zweig von `seedTestUsers.upsertUser()` — hinterließ dadurch einen Nutzer, dessen
 * `users`-Zeile die neuen Sollwerte trug, dessen Berechnung aber weiter die ALTEN
 * Periodenwerte benutzte. Die anschließende Validierung verglich dann Erwartungen aus der
 * `users`-Zeile gegen Ergebnisse aus der Periode und meldete Abweichungen, deren Ursache
 * nicht im Rechenweg lag.
 *
 * Drei Schritte, alle idempotent — ein zweiter Aufruf mit unveränderten Stammdaten schreibt
 * nichts:
 * 1. Startperiode anlegen, falls gar keine existiert (Alt-Fall).
 * 2. `validFrom` nachziehen, falls `hireDate` vorverlegt wurde (CR-01).
 * 3. `weeklyHours`/`workSchedule` der offenen Periode angleichen.
 *
 * Legt bewusst KEINE zweite Periode an und verschiebt keinen Stichtag — das ist Phase 12.
 * Der Aufrufer ist für die transaktionale Klammer zuständig, wenn er eine braucht.
 */
export function mirrorUserToWorkPeriod(user: UserPublic): void {
  ensureInitialWorkPeriod(user, null);
  syncStartPeriodToHireDate(user.id, user.hireDate, user);

  const current = getCurrentWorkPeriod(user.id);
  if (!current) {
    throw new Error(
      `mirrorUserToWorkPeriod: Nutzer ${user.id} hat auch nach ensureInitialWorkPeriod keine offene Periode.`
    );
  }

  const desiredSchedule = user.workSchedule ?? null;
  const valuesDiffer =
    current.weeklyHours !== user.weeklyHours ||
    JSON.stringify(current.workSchedule ?? null) !== JSON.stringify(desiredSchedule);

  if (valuesDiffer) {
    logger.info(
      {
        userId: user.id,
        periodId: current.id,
        oldWeeklyHours: current.weeklyHours,
        newWeeklyHours: user.weeklyHours,
      },
      '🔄 mirrorUserToWorkPeriod: offene Periode wird an den Stammdatensatz angeglichen (CR-02)'
    );
    updateWorkPeriodValues(current.id, user.weeklyHours, desiredSchedule);
  }
}

/**
 * Get all users (including deleted for archive view)
 */
export function getAllUsers(): UserPublic[] {
  try {
    const stmt = db.prepare(`
      SELECT id, username, email, firstName, lastName, role,
             department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status, privacyConsentAt, createdAt, deletedAt,
             CASE WHEN status = 'active' AND deletedAt IS NULL THEN 1 ELSE 0 END as isActive
      FROM users
      ORDER BY createdAt DESC
    `);

    const users = stmt.all() as UserRow[];
    // Parse workSchedule JSON
    return users.map(user => ({
      ...user,
      workSchedule: user.workSchedule ? JSON.parse(user.workSchedule) : null
    // WR-09: Der Zeilentyp `UserRow` ersetzt das frühere `as any` — Tippfehler in einem
    // Spaltennamen fallen jetzt beim Übersetzen auf. Der Weg über `unknown` bleibt
    // NÖTIG und ist kein verstecktes `any`: SQLite liefert `isActive` als 0/1-Zahl,
    // `UserPublic.isActive` ist als `boolean` deklariert. Diese Abweichung besteht seit
    // jeher und wird hier BEWUSST NICHT geglättet — eine Umstellung auf `true`/`false`
    // würde die API-Ausgabe ändern und damit den Desktop-Filter
    // `u.isActive !== false` (AbsenceRequestForm.tsx:234, TimeEntryForm.tsx:150)
    // kippen: heute filtert er wegen `0 !== false` NICHT, danach würde er filtern. Das
    // ist eine Verhaltensänderung und gehört nicht in eine Typkorrektur.
    })) as unknown as UserPublic[];
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting all users');
    throw error;
  }
}

/**
 * Get user by ID (public data only)
 */
export function getUserById(id: number): UserPublic | undefined {
  try {
    const stmt = db.prepare(`
      SELECT id, username, email, firstName, lastName, role,
             department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status, privacyConsentAt, createdAt,
             CASE WHEN status = 'active' THEN 1 ELSE 0 END as isActive
      FROM users
      WHERE id = ? AND deletedAt IS NULL
    `);

    const user = stmt.get(id) as UserRow | undefined;
    if (!user) return undefined;

    // Parse workSchedule JSON
    return {
      ...user,
      workSchedule: user.workSchedule ? JSON.parse(user.workSchedule) : null
      // WR-09: s. Begründung zum `unknown`-Zwischenschritt in getAllUsers().
    } as unknown as UserPublic;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error getting user by ID');
    throw error;
  }
}

/**
 * WR-11: Nutzer laden, EINSCHLIESSLICH soft-gelöschter.
 *
 * `getUserById()` filtert `WHERE id = ? AND deletedAt IS NULL` — richtig für jeden
 * laufenden Betriebsfall, falsch für den DATEV-/Historien-Export. Dessen Nutzerabfrage
 * wählt ausdrücklich OHNE `deletedAt`-Filter aus ("including deleted for historical
 * accuracy"), lud die vollständigen Daten danach aber über `getUserById()` — und
 * übersprang damit jeden soft-gelöschten Nutzer mit einer Warnung. Seine Zeiteinträge und
 * Abwesenheiten fehlten im Export, der für Finanzamt und Betriebsprüfung gedacht ist
 * (GoBD, Aufbewahrungsfrist im Metadatenblock). Die Datei sah dabei vollständig aus —
 * stiller Datenverlust.
 *
 * Diese Funktion ist AUSSCHLIESSLICH für historische Auswertungen gedacht. Für jeden
 * laufenden Betriebsfall bleibt `getUserById()` die richtige Wahl.
 */
export function getUserByIdIncludingDeleted(id: number): UserPublic | undefined {
  try {
    const stmt = db.prepare(`
      SELECT id, username, email, firstName, lastName, role,
             department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status, privacyConsentAt, createdAt, deletedAt,
             CASE WHEN status = 'active' AND deletedAt IS NULL THEN 1 ELSE 0 END as isActive
      FROM users
      WHERE id = ?
    `);

    const user = stmt.get(id) as UserRow | undefined;
    if (!user) return undefined;

    return {
      ...user,
      workSchedule: user.workSchedule ? JSON.parse(user.workSchedule) : null
      // WR-09: s. Begründung zum `unknown`-Zwischenschritt in getAllUsers().
    } as unknown as UserPublic;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error getting user by ID (including deleted)');
    throw error;
  }
}
/**
 * Create new user
 */
export async function createUser(data: UserCreateInput): Promise<UserPublic> {
  try {
    // VALIDATION: Weekly hours must be reasonable
    // Min: 0 hours/week (Aushilfen - all hours = overtime), Max: 80 hours/week (extreme case)
    const weeklyHours = data.weeklyHours !== undefined ? data.weeklyHours : 40;
    if (weeklyHours < 0 || weeklyHours > 80) {
      throw new Error(`Weekly hours must be between 0 and 80, got: ${weeklyHours}`);
    }

    // Hash password
    // better-sqlite3-Transaktionen vertragen kein `await` — das Hashing bleibt deshalb
    // davor (Muster wie in Plan 06-01).
    const hashedPassword = await hashPassword(data.password);

    // D4 (Phase 11) macht eine fehlende Arbeitszeitperiode zum harten Fehler bei jeder
    // Sollstunden-Berechnung — ohne diese Klammer würde die erste Überstundenberechnung
    // jedes neu angelegten Mitarbeiters sofort abbrechen. Nutzer- und Periodenanlage laufen
    // deshalb in EINER Transaktion: Schlägt die Periodenanlage fehl, wird auch der Nutzer
    // nicht angelegt — kein halber Zustand.
    // Rule 1 (Bugfix, im Zuge dieses Tasks gefunden): `users.hireDate` ist `NOT NULL
    // DEFAULT (date('now'))` (schema.ts:45) — ein explizit gebundenes `NULL` (vorher:
    // `data.hireDate || null`) verletzt diese Spalte und ließ `createUser()` ohne hireDate
    // schon vor diesem Plan mit einem SqliteError abbrechen, sobald der Aufrufer (die Route
    // validiert hireDate nicht) keins mitgab. Derselbe Ersatzwert, den die Startperiode
    // unten ohnehin braucht, schließt die Lücke: kein zweiter Rundungsweg für „kein
    // hireDate", eine Quelle für beide Spalten.
    const { validFrom: resolvedHireDate, source: hireDateSource } = resolveInitialValidFrom(
      data.hireDate ?? null
    );

    const insertUserAndPeriod = db.transaction((): number => {
      const stmt = db.prepare(`
        INSERT INTO users (
          username, email, password, firstName, lastName, role,
          department, position, weeklyHours, workSchedule, vacationDaysPerYear, hireDate, endDate, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.username,
        data.email && data.email.trim() !== '' ? data.email : null, // Convert empty strings to NULL
        hashedPassword,
        data.firstName,
        data.lastName,
        data.role,
        data.department || null,
        data.position || null,
        weeklyHours, // Use validated weeklyHours
        data.workSchedule ? JSON.stringify(data.workSchedule) : null,
        data.vacationDaysPerYear !== undefined ? data.vacationDaysPerYear : 30, // Allow 0 vacation days
        resolvedHireDate,
        data.endDate || null,
        'active'
      );

      const userId = result.lastInsertRowid as number;

      // Kein zweiter Schreibweg: die Startperiode entsteht ausschließlich über
      // createWorkPeriod() (workPeriodService.ts), nie über ein direktes INSERT hier.
      const validFrom = resolvedHireDate;
      const source = hireDateSource;
      if (source !== 'hireDate') {
        logger.info(
          { userId, validFrom, source },
          'ℹ️ createUser: Ersatzdatum für Startperiode verwendet (kein wohlgeformtes hireDate)'
        );
      }

      createWorkPeriod({
        userId,
        validFrom,
        validTo: null,
        weeklyHours,
        workSchedule: data.workSchedule ?? null,
        note: initialPeriodNote(source),
        createdBy: null,
      });

      return userId;
    });

    const userId = insertUserAndPeriod();

    logger.info({ username: data.username, userId }, '✅ User created');

    // Return created user (without password)
    const user = getUserById(userId);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }

    return user;
  } catch (error) {
    logger.error({ err: error, username: data.username }, '❌ Error creating user');
    throw error;
  }
}

/**
 * WR-07 (Plan 14-02, siehe `.planning/phases/14-absicherung-und-auslieferung/14-WR07-ENTSCHEIDUNG.md`):
 * `updateUser()` wirft diesen Fehler, wenn `weeklyHours`/`workSchedule` sich gegenüber dem
 * gespeicherten Wert tatsächlich ändern sollen. `name` wird explizit gesetzt, damit
 * `instanceof` über Modulgrenzen zuverlässig bleibt (Muster: `WorkTimeChangeValidationError`
 * in `workPeriodChangeService.ts`).
 */
export class WorkPeriodBypassError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkPeriodBypassError';
  }
}

/**
 * Update user
 */
export async function updateUser(
  id: number,
  data: Partial<UserCreateInput>
): Promise<UserPublic> {
  try {
    logger.debug('🔥🔥🔥 UPDATE USER - BACKEND DEBUG 🔥🔥🔥');
    logger.debug({ userId: id, data }, 'Update user parameters');

    // Check if user exists
    const existingUser = getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    logger.debug({ hireDate: existingUser.hireDate, endDate: existingUser.endDate }, 'Existing user dates');

    // CR-02: VOR jedem Schreibvorgang, nicht erst in der Perioden-Nachführung. Analog zur
    // bereits vorhandenen `weeklyHours`-Prüfung weiter unten — nur dass ein unbrauchbares
    // `hireDate` schwerer wiegt: Es löscht `overtime_balance` und macht den Wiederaufbau
    // unmöglich. Begründung vollständig bei `assertWellFormedHireDate()`.
    assertWellFormedHireDate(data.hireDate);

    // WR-07 (Plan 14-02, siehe 14-WR07-ENTSCHEIDUNG.md): PUT /api/users/:id aendert
    // weeklyHours/workSchedule nicht mehr an der Perioden-Historie vorbei. Die Abweisung
    // greift ausschliesslich bei einer tatsaechlichen WERTAENDERUNG (nicht bei blosser
    // Anwesenheit des Feldes, sonst bricht das Speichern unveraenderter Stammdaten aus
    // EditUserModal.handleSubmit) und wirft VOR jedem Lese-/Schreibzugriff dieser Funktion,
    // damit nachweislich nichts geschrieben wird. Ersatzwege: POST /api/work-periods/change
    // (Stundenwechsel ab Stichtag) und PUT /api/work-periods/:id (Stammdaten korrigieren).
    const weeklyHoursChanged =
      data.weeklyHours !== undefined && data.weeklyHours !== existingUser.weeklyHours;
    const workScheduleChanged =
      data.workSchedule !== undefined &&
      JSON.stringify(data.workSchedule ?? null) !== JSON.stringify(existingUser.workSchedule ?? null);
    if (weeklyHoursChanged || workScheduleChanged) {
      throw new WorkPeriodBypassError(
        'Wochenstunden und Tagesplan werden nicht mehr ueber PUT /api/users/:id geaendert. Nutzen Sie POST /api/work-periods/change (Stundenwechsel ab Stichtag) oder PUT /api/work-periods/:id (Stammdaten korrigieren).'
      );
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email || null); // Convert empty/falsy values to NULL
    }
    if (data.firstName !== undefined) {
      updates.push('firstName = ?');
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push('lastName = ?');
      values.push(data.lastName);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.department !== undefined) {
      updates.push('department = ?');
      values.push(data.department || null); // Convert empty/falsy values to NULL
    }
    if (data.position !== undefined) {
      updates.push('position = ?');
      values.push(data.position || null); // Convert empty/falsy values to NULL
    }
    // WR-07 (Plan 14-02): Die beiden Zweige fuer weeklyHours/workSchedule sind entfallen.
    // Jede tatsaechliche Wertaenderung wirft bereits oben WorkPeriodBypassError; erreicht
    // dieser Punkt, ist der Wert (falls im Payload vorhanden) mit dem gespeicherten Wert
    // identisch — ein erneutes Schreiben desselben Werts waere ein leerer Vorgang.
    if (data.vacationDaysPerYear !== undefined) {
      updates.push('vacationDaysPerYear = ?');
      values.push(data.vacationDaysPerYear);
    }
    if (data.hireDate !== undefined) {
      updates.push('hireDate = ?');
      values.push(data.hireDate);
    }
    if (data.endDate !== undefined) {
      updates.push('endDate = ?');
      values.push(data.endDate || null); // Convert empty/falsy values to NULL
    }
    if (data.isActive !== undefined) {
      // isActive is stored as status field ('active' or 'inactive')
      updates.push('status = ?');
      values.push(data.isActive ? 'active' : 'inactive');
    }
    if (data.password !== undefined) {
      updates.push('password = ?');
      values.push(await hashPassword(data.password));
    }

    if (updates.length === 0) {
      return existingUser; // Nothing to update
    }

    values.push(id); // For WHERE clause

    const sqlQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ? AND deletedAt IS NULL
    `;

    logger.debug({ sqlQuery, values, updates }, '📝 SQL details');

    // CR-01: Eine hireDate-Änderung muss die Startperiode mitziehen — sonst entsteht ein
    // Datum ohne Periode und jede Folgeberechnung wirft (D4). Von WR-07 unberührt: das ist
    // kein Schreibweg an weeklyHours/workSchedule vorbei, sondern die Nachführung eines
    // reinen Datumsfelds.
    const hireDateChanged =
      data.hireDate !== undefined && data.hireDate !== existingUser.hireDate;

    let changes = 0;
    const applyUpdate = db.transaction((): void => {
      const stmt = db.prepare(sqlQuery);
      const result = stmt.run(...values);
      changes = result.changes;

      // CR-01: In DERSELBEN Transaktion wie das UPDATE users — ein halber Zustand
      // (neues hireDate, alte Periodenkette) ist genau der Datendefekt, den D4 verbietet.
      if (hireDateChanged) {
        syncStartPeriodToHireDate(id, data.hireDate, existingUser);

        // WR-09 (Code-Review Phase 11, Durchlauf 2): Die Saldolöschung steht jetzt IN der
        // Transaktion, nicht mehr dahinter in einem eigenen `try/catch`, das seinen Fehler
        // nur protokollierte ("Don't fail the update").
        //
        // WARUM: Vorher konnte sie scheitern (gesperrte Datei, Verbindungsverlust), ohne
        // dass irgendjemand es merkte — der Nutzer blieb mit NEUEM `hireDate`, NEUER
        // Periode und Salden zurück, die gegen das ALTE `hireDate` gerechnet waren, und die
        // API antwortete mit 200 und dem aktualisierten Nutzer. Genau die Art von
        // unsichtbarem Ausfall, die dieser Durchlauf an mehreren Stellen beseitigt.
        //
        // Die Reihenfolge bleibt erhalten (erst Periode nachführen, dann Salden löschen),
        // und `db.prepare(...).run()` ist synchron — es passt damit in eine
        // better-sqlite3-Transaktion, die kein `await` verträgt. Schlägt es fehl, wird die
        // gesamte Änderung zurückgerollt und der Aufrufer bekommt den Fehler.
        //
        // `overtime_transactions` bleiben unangetastet (unveränderlicher Prüfpfad); die
        // gelöschten `overtime_balance`-Zeilen entstehen beim nächsten Zugriff neu.
        logger.info(
          { userId: id, oldHireDate: existingUser.hireDate, newHireDate: data.hireDate },
          '🔄 hireDate changed, clearing overtime balance in same transaction (WR-09)'
        );
        db.prepare('DELETE FROM overtime_balance WHERE userId = ?').run(id);
      }
    });

    applyUpdate();
    const result = { changes };

    logger.info({ userId: id, changes: result.changes }, '✅ User updated');

    // Return updated user
    const updatedUser = getUserById(id);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    logger.debug({ hireDate: updatedUser.hireDate, endDate: updatedUser.endDate }, '📤 Updated user dates');

    // CRITICAL: Handle side effects of changes
    //
    // WR-09: Der frühere Block "If hireDate changed, DELETE ... overtime_balance" stand
    // HIER — außerhalb der Transaktion und mit einem `catch`, das den Fehler verschluckte.
    // Er ist nach oben in `applyUpdate()` gezogen (Begründung dort). An dieser Stelle
    // bleiben nur noch die Seiteneffekte, die tatsächlich asynchron sind und deshalb NICHT
    // in eine better-sqlite3-Transaktion passen.

    // WR-07 (Plan 14-02): Die beiden Neuberechnungs-Bloecke fuer weeklyHours/workSchedule
    // sind entfallen. Sie waren nur nach einer erfolgreichen Spiegelung erreichbar; diese
    // Funktion wirft jetzt bei jeder tatsaechlichen Wertaenderung bereits vor dem Schreiben
    // WorkPeriodBypassError, der Codepfad hier ist damit unerreichbar geworden.

    // If vacationDaysPerYear changed, update vacation_balance entitlement for all years
    if (data.vacationDaysPerYear !== undefined && data.vacationDaysPerYear !== existingUser.vacationDaysPerYear) {
      logger.info({ oldDays: existingUser.vacationDaysPerYear, newDays: data.vacationDaysPerYear }, '🔄 vacationDaysPerYear changed, updating entitlement');
      try {
        updateVacationEntitlementForUser(id, data.vacationDaysPerYear);
        logger.info('✅ Vacation entitlement updated');
      } catch (error) {
        logger.error({ err: error }, '❌ Failed to update vacation entitlement');
        // Don't fail the update, but log the error
      }
    }

    logger.debug('🔥🔥🔥 END UPDATE USER DEBUG 🔥🔥🔥');

    return updatedUser;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error updating user');
    throw error;
  }
}

/**
 * Recalculate all overtime_balance entries for a user
 * Called when weeklyHours, workSchedule, or hireDate changes
 * Best Practice (SAP/Personio): Delete and rebuild from scratch for hireDate changes
 *
 * ✅ NOW: Uses updateMonthlyOvertime() for correct workSchedule support!
 */
async function recalculateOvertimeForUser(userId: number): Promise<void> {
  logger.debug({ userId }, '🔄 Recalculating overtime for user');

  // Get user
  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Get all existing overtime_balance entries
  const entries = db.prepare(`
    SELECT month
    FROM overtime_balance
    WHERE userId = ?
    ORDER BY month
  `).all(userId) as Array<{ month: string }>;

  logger.debug({ count: entries.length }, `📊 Found overtime_balance entries to recalculate`);

  // Use updateMonthlyOvertime() from overtimeService (Single Source of Truth!)
  // This handles weeklyHours AND workSchedule correctly
  const { updateMonthlyOvertime } = await import('./overtimeService.js');

  // Recalculate each month
  for (const entry of entries) {
    try {
      updateMonthlyOvertime(userId, entry.month);
      logger.debug({ month: entry.month }, `  ✅ Month recalculated`);
    } catch (error) {
      logger.error({ err: error, userId, month: entry.month }, '❌ Failed to recalculate month');
      // Continue with other months
    }
  }

  logger.info('✅ All overtime_balance entries recalculated');
}

/**
 * Update vacation_balance entitlement for all years for a user
 * Called when vacationDaysPerYear changes
 */
function updateVacationEntitlementForUser(userId: number, newEntitlement: number): void {
  logger.debug({ userId, newEntitlement }, '🔄 Updating vacation entitlement for user');

  // FIX (2026-08-18): Only touch the current and future years.
  //
  // This used to rewrite the entitlement of EVERY year on file, including closed ones.
  // Raising an employee's annual allowance in 2026 retroactively changed their 2025
  // entitlement — the historical record no longer matched what they were actually
  // granted back then (observed: Christine Glas, 2025 silently moved from 12 to 13).
  //
  // Past years are a closed record and must stay as booked.
  // See .planning/debug/urlaubstage-bei-ablehnung-verloren.md
  const currentYear = new Date().getFullYear();

  // Get vacation_balance entries for the current and future years only
  const entries = db.prepare(`
    SELECT year, entitlement, carryover, taken
    FROM vacation_balance
    WHERE userId = ? AND year >= ?
  `).all(userId, currentYear) as Array<{ year: number; entitlement: number; carryover: number; taken: number }>;

  logger.debug({ count: entries.length, fromYear: currentYear }, `📊 Found vacation_balance entries to update (current + future years only)`);

  // Update entitlement for each year
  for (const entry of entries) {
    db.prepare(`
      UPDATE vacation_balance
      SET entitlement = ?
      WHERE userId = ? AND year = ?
    `).run(newEntitlement, userId, entry.year);

    const newRemaining = newEntitlement + entry.carryover - entry.taken;
    logger.debug({ year: entry.year, oldEntitlement: entry.entitlement, newEntitlement, newRemaining }, `  ✅ Updated entitlement`);
  }

  logger.info('✅ All vacation_balance entries updated');
}

/**
 * Soft delete user
 */
export function deleteUser(id: number): void {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET deletedAt = datetime('now'), status = 'inactive'
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('User not found or already deleted');
    }

    logger.info({ userId: id }, '✅ User soft-deleted');
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error deleting user');
    throw error;
  }
}

/**
 * Reactivate a user (F-1)
 *
 * Covers both restorable states of a user record:
 *   - aktiv           status='active'    deletedAt IS NULL      -> NOT restorable (already active, stays a 404)
 *   - deaktiviert      status='inactive'  deletedAt IS NULL      -> restorable (deactivated via updateUser/updateUserStatus)
 *   - soft-geloescht   status='inactive'  deletedAt IS NOT NULL  -> restorable (deleteUser)
 *
 * A user that is already active never matches and remains a 404 ("User not found or not
 * deleted") — a silent success for an already-active user would mask a genuine operator error.
 */
export function reactivateUser(id: number): UserPublic {
  try {
    // Check if user exists and is either soft-deleted or merely deactivated
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND (deletedAt IS NOT NULL OR status = 'inactive')").get(id) as User | undefined;

    if (!user) {
      throw new Error('User not found or not deleted');
    }

    // Reactivate user
    const stmt = db.prepare(`
      UPDATE users
      SET deletedAt = NULL, status = 'active'
      WHERE id = ?
    `);

    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('Failed to reactivate user');
    }

    logger.info({ userId: id, username: user.username, email: user.email }, '🔄 User reactivated');

    // Return updated user
    const reactivatedUser = getUserById(id);
    if (!reactivatedUser) {
      throw new Error('Failed to fetch reactivated user');
    }

    return reactivatedUser;
  } catch (error) {
    logger.error({ err: error, userId: id }, '❌ Error reactivating user');
    throw error;
  }
}

/**
 * Update user status (active/inactive)
 */
export function updateUserStatus(
  id: number,
  status: 'active' | 'inactive'
): UserPublic {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET status = ?
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(status, id);

    if (result.changes === 0) {
      throw new Error('User not found');
    }

    logger.info({ userId: id, status }, '✅ User status updated');

    const user = getUserById(id);
    if (!user) {
      throw new Error('Failed to retrieve updated user');
    }

    return user;
  } catch (error) {
    logger.error({ err: error, userId: id, status }, '❌ Error updating user status');
    throw error;
  }
}

/**
 * Check if username exists
 */
export function usernameExists(username: string, excludeId?: number): boolean {
  try {
    let stmt;
    if (excludeId) {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE username = ? AND id != ?
      `);
      const result = stmt.get(username, excludeId) as { count: number };
      return result.count > 0;
    } else {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE username = ?
      `);
      const result = stmt.get(username) as { count: number };
      return result.count > 0;
    }
  } catch (error) {
    logger.error({ err: error, username }, '❌ Error checking username');
    throw error;
  }
}

/**
 * Check if email exists
 */
export function emailExists(email: string, excludeId?: number): boolean {
  try {
    // Empty or null emails should not be checked (email is optional)
    if (!email || email.trim() === '') {
      return false;
    }

    let stmt;
    if (excludeId) {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email = ? AND id != ?
      `);
      const result = stmt.get(email, excludeId) as { count: number };
      return result.count > 0;
    } else {
      // Check ALL users (including deleted) to respect UNIQUE constraint
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email = ?
      `);
      const result = stmt.get(email) as { count: number };
      return result.count > 0;
    }
  } catch (error) {
    logger.error({ err: error, email }, '❌ Error checking email');
    throw error;
  }
}

/**
 * Update Privacy Consent (DSGVO)
 * Set privacy consent timestamp for user
 */
export function updatePrivacyConsent(userId: number): UserPublic {
  try {
    const stmt = db.prepare(`
      UPDATE users
      SET privacyConsentAt = datetime('now')
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(userId);

    if (result.changes === 0) {
      throw new Error('User not found');
    }

    logger.info({ userId }, '✅ Privacy consent updated for user');

    const user = getUserById(userId);
    if (!user) {
      throw new Error('Failed to retrieve updated user');
    }

    return user;
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Error updating privacy consent');
    throw error;
  }
}

/**
 * GDPR Data Export (DSGVO Art. 15)
 * Export all user data for GDPR compliance
 */
export function exportUserData(userId: number): GDPRDataExport {
  try {
    logger.info({ userId }, '📊 Exporting user data for GDPR compliance');

    // 1. Get user data
    const user = getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 2. Get all time entries
    const timeEntriesStmt = db.prepare(`
      SELECT id, userId, date, startTime, endTime, breakMinutes, hours,
             activity, project, location, notes, createdAt, updatedAt
      FROM time_entries
      WHERE userId = ?
      ORDER BY date DESC
    `);
    const timeEntries = timeEntriesStmt.all(userId) as TimeEntry[];

    // 3. Get all absence requests
    const absencesStmt = db.prepare(`
      SELECT id, userId, type, startDate, endDate, days, status,
             reason, adminNote, approvedBy, approvedAt, createdAt
      FROM absence_requests
      WHERE userId = ?
      ORDER BY startDate DESC
    `);
    const absenceRequests = absencesStmt.all(userId) as AbsenceRequest[];

    // 4. Get overtime balance (current - from SSOT)
    const overtimeBalance = getOvertimeBalance(userId);

    // 5. Get vacation balance (current year)
    const currentYear = new Date().getFullYear();
    const vacationBalance = getVacationBalance(userId, currentYear);

    // 6. Build export data
    const exportData: GDPRDataExport = {
      exportDate: new Date().toISOString(),
      user,
      timeEntries,
      absenceRequests,
      absences: absenceRequests, // Alias for backward compatibility
      overtimeBalance: {
        totalHours: overtimeBalance || 0,
        lastUpdated: new Date().toISOString(),
      },
      vacationBalance: {
        availableDays: vacationBalance?.remaining || 0,
        usedDays: vacationBalance?.taken || 0,
        totalDays: vacationBalance?.entitlement || 0,
        lastUpdated: new Date().toISOString(),
      },
      // WR-09: `as any` ersetzt durch den tatsächlichen Rückgabetyp. `absences` ist ein
      // bewusster Alias für `absenceRequests` (Abwärtskompatibilität) und steht deshalb
      // ausdrücklich in der Typangabe, statt die Prüfung ganz abzuschalten.
    } as GDPRDataExport & { absences: AbsenceRequest[] };

    logger.info({
      timeEntriesCount: timeEntries.length,
      absenceRequestsCount: absenceRequests.length,
      overtimeHours: overtimeBalance || 0,
      vacationRemaining: vacationBalance?.remaining || 0,
      vacationTotal: vacationBalance?.entitlement || 0
    }, '✅ User data exported successfully');

    return exportData;
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Error exporting user data');
    throw error;
  }
}

/**
 * PASSWORD MANAGEMENT
 */

/**
 * Log password change to audit table
 */
function logPasswordChange(
  userId: number,
  changedBy: number,
  changeType: 'self-service' | 'admin-reset',
  ipAddress?: string
): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO password_change_log (userId, changedBy, changeType, ipAddress)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(userId, changedBy, changeType, ipAddress || null);

    logger.info({ userId, changedBy, changeType }, '✅ Password change logged');
  } catch (error) {
    logger.error({ err: error, userId, changedBy, changeType }, '❌ Error logging password change');
    // Don't throw - logging failure shouldn't block password change
  }
}

/**
 * Change own password (Self-Service)
 * Requires current password for verification
 */
export async function changeOwnPassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info({ userId }, '🔐 Self-service password change requested');

    // Validation: New password length
    if (!newPassword || newPassword.length < 10) {
      return { success: false, error: 'New password must be at least 10 characters long' };
    }

    // Get user with password hash
    const user = findUserByIdWithPassword(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      logger.warn({ userId }, '⚠️ Invalid current password provided');
      return { success: false, error: 'Current password is incorrect' };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    const stmt = db.prepare(`
      UPDATE users
      SET password = ?, forcePasswordChange = 0
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(hashedPassword, userId);

    if (result.changes === 0) {
      return { success: false, error: 'Failed to update password' };
    }

    // Log password change
    logPasswordChange(userId, userId, 'self-service', ipAddress);

    logger.info({ userId }, '✅ Password changed successfully (self-service)');

    return { success: true };
  } catch (error) {
    logger.error({ err: error, userId }, '❌ Error changing own password');
    return { success: false, error: 'Failed to change password' };
  }
}

/**
 * Reset user password (Admin only)
 * Can force user to change password on next login
 */
export async function resetUserPassword(
  adminId: number,
  targetUserId: number,
  newPassword: string,
  forceChange: boolean = true,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info({ adminId, targetUserId, forceChange }, '🔐 Admin password reset requested');

    // Validation: New password length
    if (!newPassword || newPassword.length < 10) {
      return { success: false, error: 'New password must be at least 10 characters long' };
    }

    // Check if target user exists
    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and forcePasswordChange flag
    const stmt = db.prepare(`
      UPDATE users
      SET password = ?, forcePasswordChange = ?
      WHERE id = ? AND deletedAt IS NULL
    `);

    const result = stmt.run(hashedPassword, forceChange ? 1 : 0, targetUserId);

    if (result.changes === 0) {
      return { success: false, error: 'Failed to update password' };
    }

    // Log password change
    logPasswordChange(targetUserId, adminId, 'admin-reset', ipAddress);

    logger.info({ adminId, targetUserId, forceChange }, '✅ Password reset successfully (admin)');

    return { success: true };
  } catch (error) {
    logger.error({ err: error, adminId, targetUserId }, '❌ Error resetting user password');
    return { success: false, error: 'Failed to reset password' };
  }
}
