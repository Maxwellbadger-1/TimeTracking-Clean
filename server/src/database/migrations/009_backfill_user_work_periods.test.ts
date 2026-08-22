import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import migration008 from './008_create_user_work_periods.js';
import migration009, { FALLBACK_PROJECT_START, resolveValidFrom } from './009_backfill_user_work_periods.js';

/**
 * Tests für Migration 009 (Bestandsüberführung user_work_periods).
 *
 * Arbeiten ausschließlich auf `new Database(':memory:')` — niemals gegen die lokale
 * Arbeitsdatenbank-Datei und niemals über das zentrale Verbindungsmodul. Ein solcher
 * Import würde die Migration gegen die echte Arbeitsdatenbank laufen lassen und allen
 * 20 echten Nutzern eine Periode geben — das verfälschte die spätere
 * Nullwirkungsmessung aus Plan 10-05.
 */
describe('Migration 009: Backfill user_work_periods', () => {
  describe('resolveValidFrom (reine Funktion, D5)', () => {
    it('wohlgeformtes hireDate gewinnt, auch wenn ein früherer Zeiteintrag existiert', () => {
      const result = resolveValidFrom('2026-01-01', '2025-01-01');
      expect(result).toEqual({ validFrom: '2026-01-01', source: 'hireDate' });
    });

    it('null als hireDate fällt auf den frühesten Zeiteintrag zurück (Ersatzdatum, ohne hireDate)', () => {
      const result = resolveValidFrom(null, '2025-07-01');
      expect(result).toEqual({ validFrom: '2025-07-01', source: 'earliestTimeEntry' });
    });

    it.each(['', '2026-1-1', '01.01.2026'])(
      'unbrauchbares hireDate "%s" fällt auf den frühesten Zeiteintrag zurück',
      (invalidHireDate) => {
        const result = resolveValidFrom(invalidHireDate, '2025-07-01');
        expect(result).toEqual({ validFrom: '2025-07-01', source: 'earliestTimeEntry' });
      }
    );

    it('weder hireDate noch Zeiteintrag fällt auf FALLBACK_PROJECT_START zurück', () => {
      const result = resolveValidFrom(null, null);
      expect(result).toEqual({ validFrom: FALLBACK_PROJECT_START, source: 'projectStart' });
    });

    it('liefert nie ein frei erfundenes Epoch-Datum als Ersatzwert', () => {
      const withoutAnything = resolveValidFrom(null, null);
      const withEmptyStrings = resolveValidFrom('', '');
      const epoch = ['1970', '01', '01'].join('-');
      expect(withoutAnything.validFrom).not.toBe(epoch);
      expect(withEmptyStrings.validFrom).not.toBe(epoch);
    });
  });

  describe('Migrationslauf: sechs Grenzfall-Nutzer', () => {
    let db: Database.Database;
    let userA: number;
    let userB: number;
    let userC: number;
    let userD: number;
    let userE: number;
    let userF: number;

    function insertUser(fields: {
      hireDate: string | null;
      weeklyHours: number | null;
      workSchedule: string | null;
      endDate?: string | null;
      status?: string | null;
      deletedAt?: string | null;
    }): number {
      const result = db
        .prepare(
          `INSERT INTO users (hireDate, weeklyHours, workSchedule, endDate, status, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          fields.hireDate,
          fields.weeklyHours,
          fields.workSchedule,
          fields.endDate ?? null,
          fields.status ?? 'active',
          fields.deletedAt ?? null
        );
      return result.lastInsertRowid as number;
    }

    beforeEach(async () => {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
      db.prepare(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hireDate TEXT,
          weeklyHours REAL,
          workSchedule TEXT,
          endDate TEXT,
          status TEXT,
          deletedAt TEXT
        )
      `).run();
      db.prepare(`
        CREATE TABLE time_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          date TEXT NOT NULL
        )
      `).run();
      await migration008.up(db);

      // (a) aktiv mit workSchedule
      userA = insertUser({
        hireDate: '2026-01-15',
        weeklyHours: 40,
        workSchedule: '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":8,"saturday":0,"sunday":0}',
      });
      // (b) aktiv ohne workSchedule
      userB = insertUser({ hireDate: '2026-02-01', weeklyHours: 32, workSchedule: null });
      // (c) weeklyHours = 0 (Aushilfe)
      userC = insertUser({ hireDate: '2026-03-01', weeklyHours: 0, workSchedule: null });
      // (d) weeklyHours = 2.5 (REAL, keine Ganzzahl)
      userD = insertUser({ hireDate: '2026-04-01', weeklyHours: 2.5, workSchedule: null });
      // (e) soft-gelöscht und inaktiv — bekommt trotzdem eine Periode (D5, zweiter Absatz)
      userE = insertUser({
        hireDate: '2025-12-01',
        weeklyHours: 20,
        workSchedule: null,
        status: 'inactive',
        deletedAt: '2026-05-01 10:00:00',
      });
      // (f) endDate in der Vergangenheit — validTo bleibt trotzdem NULL (D5, dritter Absatz)
      userF = insertUser({
        hireDate: '2025-06-01',
        weeklyHours: 40,
        workSchedule: null,
        endDate: '2026-01-01',
        status: 'inactive',
      });

      await migration009.up(db);
    });

    afterEach(() => {
      db.close();
    });

    function getPeriod(userId: number) {
      return db
        .prepare(`SELECT * FROM user_work_periods WHERE userId = ?`)
        .get(userId) as {
        userId: number;
        validFrom: string;
        validTo: string | null;
        weeklyHours: number;
        workSchedule: string | null;
        note: string | null;
      };
    }

    it('(a) aktiv mit workSchedule: Periode übernimmt weeklyHours, workSchedule zeichengleich und validFrom = hireDate', () => {
      const period = getPeriod(userA);
      expect(period).toBeDefined();
      expect(period.weeklyHours).toBe(40);
      expect(period.workSchedule).toBe(
        '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":8,"saturday":0,"sunday":0}'
      );
      expect(period.validFrom).toBe('2026-01-15');
      expect(period.validTo).toBeNull();
      expect(period.note).toContain('[MIGRATION-009]');
      expect(period.note).toContain('hireDate');
    });

    it('(b) aktiv ohne workSchedule: workSchedule bleibt NULL, weeklyHours 32', () => {
      const period = getPeriod(userB);
      expect(period.weeklyHours).toBe(32);
      expect(period.workSchedule).toBeNull();
      expect(period.validFrom).toBe('2026-02-01');
    });

    it('(c) weeklyHours = 0 wird unverändert übernommen, nicht als "fehlend" behandelt', () => {
      const period = getPeriod(userC);
      expect(period.weeklyHours).toBe(0);
      expect(period.validFrom).toBe('2026-03-01');
    });

    it('(d) weeklyHours = 2.5 (REAL) wird exakt übernommen', () => {
      const period = getPeriod(userD);
      expect(period.weeklyHours).toBe(2.5);
      expect(period.validFrom).toBe('2026-04-01');
    });

    it('(e) soft-gelöschter, inaktiver Nutzer erhält trotzdem genau eine Periode', () => {
      const period = getPeriod(userE);
      expect(period).toBeDefined();
      expect(period.weeklyHours).toBe(20);
      expect(period.validFrom).toBe('2025-12-01');
      expect(period.validTo).toBeNull();
    });

    it('(f) endDate in der Vergangenheit ändert nichts an validTo — bleibt NULL', () => {
      const period = getPeriod(userF);
      expect(period).toBeDefined();
      expect(period.validTo).toBeNull();
      expect(period.validFrom).toBe('2025-06-01');
    });

    it('zweiter Lauf (idempotent, D7): keine zusätzliche Periode, kein Fehler', async () => {
      const countBefore = (
        db.prepare(`SELECT COUNT(*) as c FROM user_work_periods`).get() as { c: number }
      ).c;
      expect(countBefore).toBe(6);

      await expect(migration009.up(db)).resolves.not.toThrow();

      const countAfter = (
        db.prepare(`SELECT COUNT(*) as c FROM user_work_periods`).get() as { c: number }
      ).c;
      expect(countAfter).toBe(6);
    });
  });

  describe('Idempotenz bei bereits vorhandener, manuell eingefügter Periode (D7)', () => {
    let db: Database.Database;

    beforeEach(async () => {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
      db.prepare(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hireDate TEXT,
          weeklyHours REAL,
          workSchedule TEXT,
          endDate TEXT,
          status TEXT,
          deletedAt TEXT
        )
      `).run();
      db.prepare(`
        CREATE TABLE time_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          date TEXT NOT NULL
        )
      `).run();
      await migration008.up(db);
    });

    afterEach(() => {
      db.close();
    });

    it('Nutzer mit bereits vorhandener Periode wird übersprungen, seine Periode bleibt unverändert', async () => {
      const userResult = db
        .prepare(
          `INSERT INTO users (hireDate, weeklyHours, workSchedule, status)
           VALUES (?, ?, ?, ?)`
        )
        .run('2026-05-01', 25, null, 'active');
      const userId = userResult.lastInsertRowid as number;

      // Manuell eine Periode mit einem anderen validFrom als hireDate einfügen — gleiche
      // weeklyHours/workSchedule wie der Nutzer, damit die Selbstverifikation der
      // Migration (Erfolgskriterium 2) nicht wegen dieser bewusst abweichenden
      // manuellen Zeile fehlschlägt.
      db.prepare(`
        INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours, workSchedule, note, createdAt, createdBy)
        VALUES (?, ?, NULL, ?, ?, ?, datetime('now'), NULL)
      `).run(userId, '2020-01-01', 25, null, '[TEST] manuell eingefügte Periode vor Migrationslauf');

      await migration009.up(db);

      const periods = db
        .prepare(`SELECT * FROM user_work_periods WHERE userId = ?`)
        .all(userId) as Array<{ validFrom: string; note: string | null }>;

      expect(periods.length).toBe(1);
      expect(periods[0].validFrom).toBe('2020-01-01');
      expect(periods[0].note).toBe('[TEST] manuell eingefügte Periode vor Migrationslauf');
    });
  });

  describe('Fehlerfall: weeklyHours NULL (D2, Riegel gegen künftige Schemaänderung)', () => {
    let db: Database.Database;

    beforeEach(async () => {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
      // Bewusst OHNE NOT NULL auf weeklyHours: die echte Tabelle führt die Spalte als
      // `NOT NULL DEFAULT 40` (schema.ts:43), dieser Zweig ist deshalb heute kein
      // erreichbarer Fall, sondern ein Riegel gegen eine künftige Schemaänderung.
      db.prepare(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hireDate TEXT,
          weeklyHours REAL,
          workSchedule TEXT,
          endDate TEXT,
          status TEXT,
          deletedAt TEXT
        )
      `).run();
      db.prepare(`
        CREATE TABLE time_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          date TEXT NOT NULL
        )
      `).run();
      await migration008.up(db);
    });

    afterEach(() => {
      db.close();
    });

    it('wirft, und die Fehlermeldung enthält die userId', async () => {
      const userResult = db
        .prepare(
          `INSERT INTO users (hireDate, weeklyHours, workSchedule, status)
           VALUES (?, ?, ?, ?)`
        )
        .run('2026-01-01', null, null, 'active');
      const userId = userResult.lastInsertRowid as number;

      await expect(migration009.up(db)).rejects.toThrow(new RegExp(`userId ${userId}`));
    });
  });

  describe('Ersatzdatum bei fehlendem hireDate (D5)', () => {
    let db: Database.Database;

    beforeEach(async () => {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
      db.prepare(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hireDate TEXT,
          weeklyHours REAL,
          workSchedule TEXT,
          endDate TEXT,
          status TEXT,
          deletedAt TEXT
        )
      `).run();
      db.prepare(`
        CREATE TABLE time_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          date TEXT NOT NULL
        )
      `).run();
      await migration008.up(db);
    });

    afterEach(() => {
      db.close();
    });

    it('Nutzer ohne hireDate, aber mit Zeiteinträgen: validFrom ist der früheste Zeiteintrag, note nennt die Quelle', async () => {
      const userResult = db
        .prepare(
          `INSERT INTO users (hireDate, weeklyHours, workSchedule, status)
           VALUES (?, ?, ?, ?)`
        )
        .run(null, 30, null, 'active');
      const userId = userResult.lastInsertRowid as number;

      db.prepare(`INSERT INTO time_entries (userId, date) VALUES (?, ?)`).run(userId, '2025-09-15');
      db.prepare(`INSERT INTO time_entries (userId, date) VALUES (?, ?)`).run(userId, '2025-07-01');
      db.prepare(`INSERT INTO time_entries (userId, date) VALUES (?, ?)`).run(userId, '2025-08-01');

      await migration009.up(db);

      const period = db
        .prepare(`SELECT * FROM user_work_periods WHERE userId = ?`)
        .get(userId) as { validFrom: string; note: string | null };

      expect(period.validFrom).toBe('2025-07-01');
      expect(period.note).toContain('earliestTimeEntry');
    });
  });
});
