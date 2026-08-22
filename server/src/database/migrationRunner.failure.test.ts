import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureMigrationsTable, applyMigration, type Migration } from './migrationRunner.js';

/**
 * Fehlerpfad-Nachweis für CR-01 (10-REVIEW.md): Eine Migration, die wirft, darf NICHT als
 * angewendet in der `migrations`-Tabelle verbucht werden. Für den synchronen Regelfall
 * müssen zusätzlich ihre Schreibvorgänge zurückgerollt sein.
 *
 * WAR ROT gegen den unveränderten Läufer (siehe 10-06-SUMMARY.md für die wörtliche
 * Konsolenausgabe): `migrationRunner.ts` kapselte `migration.up(db)` in `db.transaction()`,
 * ohne den Rückgabewert zu awaiten. Eine als `async up()` deklarierte Migration, die nach
 * einem bereits ausgeführten Schreibvorgang wirft, erzeugt dabei eine rejected Promise statt
 * eines synchronen Wurfs — `db.transaction()` sieht keinen synchronen Fehler, committet, und
 * `recordMigration` läuft trotzdem. Der Test „async: eine werfende Migration wird NICHT
 * verbucht" erwartete `rejects`, bekam aber eine erfüllte (resolved) Promise — GENAU dieser
 * Fehlschlag war der Beweis.
 *
 * Arbeitet gegen echte Dateien in os.tmpdir() (Muster aus schemaMigrationParity.test.ts:13-15),
 * nicht gegen `:memory:` — jeder Testfall bekommt eine frische Datei samt echter,
 * über den bestehenden `ensureMigrationsTable`-Weg angelegter `migrations`-Tabelle, damit die
 * UNIQUE-Gegenprobe unten gegen eine echte Tabelle läuft, nicht gegen eine Attrappe.
 */
describe('migrationRunner: Fehlerpfad-Nachweis (CR-01, 10-REVIEW.md)', () => {
  const dbPaths: string[] = [];

  function freshDb(): Database.Database {
    const dbPath = path.join(
      os.tmpdir(),
      `migrationrunner-failure-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    );
    dbPaths.push(dbPath);
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    ensureMigrationsTable(db);
    db.prepare(`CREATE TABLE probe (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)`).run();
    return db;
  }

  afterAll(() => {
    for (const p of dbPaths) {
      for (const suffix of ['', '-wal', '-shm']) {
        const file = `${p}${suffix}`;
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  });

  it('synchron: eine werfende Migration wird NICHT verbucht, ihr Schreibvorgang wird zurückgerollt', async () => {
    const db = freshDb();
    const migration: Migration = {
      name: 'sync_throwing',
      up: (db) => {
        db.prepare(`INSERT INTO probe (value) VALUES (?)`).run('before-throw');
        throw new Error('absichtlicher Fehler (sync)');
      },
    };

    await expect(applyMigration(db, migration)).rejects.toThrow(/absichtlicher Fehler \(sync\)/);

    const recorded = db.prepare(`SELECT name FROM migrations WHERE name = ?`).get('sync_throwing');
    expect(recorded).toBeUndefined();

    const rows = db.prepare(`SELECT value FROM probe`).all();
    expect(rows).toEqual([]); // Rollback belegt: der INSERT vor dem throw ist nicht mehr da.

    db.close();
  });

  it('async: eine werfende Migration wird NICHT verbucht (kein Rollback-Anspruch für den async-Pfad, siehe Objective)', async () => {
    const db = freshDb();
    const migration: Migration = {
      name: 'async_throwing',
      up: async (db) => {
        db.prepare(`INSERT INTO probe (value) VALUES (?)`).run('async-before-throw');
        throw new Error('absichtlicher Fehler (async)');
      },
    };

    await expect(applyMigration(db, migration)).rejects.toThrow(/absichtlicher Fehler \(async\)/);

    const recorded = db.prepare(`SELECT name FROM migrations WHERE name = ?`).get('async_throwing');
    expect(recorded).toBeUndefined();

    db.close();
  });

  it('synchron: Erfolgsfall wird verbucht, Schreibvorgang vorhanden', async () => {
    const db = freshDb();
    const migration: Migration = {
      name: 'sync_success',
      up: (db) => {
        db.prepare(`INSERT INTO probe (value) VALUES (?)`).run('sync-ok');
      },
    };

    await expect(applyMigration(db, migration)).resolves.toBeUndefined();

    const recorded = db.prepare(`SELECT name FROM migrations WHERE name = ?`).get('sync_success');
    expect(recorded).toBeDefined();
    const rows = db.prepare(`SELECT value FROM probe`).all();
    expect(rows).toEqual([{ value: 'sync-ok' }]);

    db.close();
  });

  it('async: Erfolgsfall wird verbucht, Schreibvorgang vorhanden', async () => {
    const db = freshDb();
    const migration: Migration = {
      name: 'async_success',
      up: async (db) => {
        db.prepare(`INSERT INTO probe (value) VALUES (?)`).run('async-ok');
      },
    };

    await expect(applyMigration(db, migration)).resolves.toBeUndefined();

    const recorded = db.prepare(`SELECT name FROM migrations WHERE name = ?`).get('async_success');
    expect(recorded).toBeDefined();
    const rows = db.prepare(`SELECT value FROM probe`).all();
    expect(rows).toEqual([{ value: 'async-ok' }]);

    db.close();
  });

  it('Gegenprobe: doppeltes Verbuchen desselben Namens scheitert am UNIQUE der migrations-Tabelle (belegt echte Tabelle, keine Attrappe)', async () => {
    const db = freshDb();
    const migration: Migration = {
      name: 'duplicate_name',
      up: () => {
        // keine Schreibvorgänge nötig, nur der Name muss zweimal verbucht werden
      },
    };

    await applyMigration(db, migration);
    await expect(applyMigration(db, migration)).rejects.toThrow(/UNIQUE constraint failed/);

    db.close();
  });
});
