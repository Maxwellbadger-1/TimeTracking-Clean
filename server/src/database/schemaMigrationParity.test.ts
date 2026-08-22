import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initializeDatabase } from './schema.js';
import migration008 from './migrations/008_create_user_work_periods.js';
import migration013 from './migrations/013_soft_delete_user_work_periods.js';

/**
 * Maschineller Nachweis, dass `schema.ts` und Migration 008 wortgleiche Datenbankobjekte
 * für `user_work_periods` erzeugen — der Ersatz für den Kommentar „MUSS identisch bleiben".
 *
 * Seit Migration 013 (13-01-PLAN.md, Task 1/3) läuft auf dem Migrationspfad zusätzlich
 * migration013.up(dbB) nach migration008.up(dbB) — genau die Kette, die auf einer echten
 * Bestandsdatenbank auch abläuft (008 legt die Tabelle an, 013 rüstet deletedAt/deletedBy
 * und den aussetzbaren Kettenriegel nach). Ohne diese Ergänzung würde dieser Test seit der
 * Parität-Erweiterung in schema.ts (deletedAt/deletedBy, work_period_chain_guard-bewusste
 * Trigger) rot laufen, weil dbA (schema.ts) dann mehr Spalten/Indizes trägt als dbB.
 *
 * Beide Datenbanken sind Dateien in os.tmpdir() mit eindeutigen Namen, nicht `:memory:`:
 * `initializeDatabase()` erzwingt WAL-Modus und wirft bei einer Speicherdatenbank.
 */
describe('schema.ts <-> migrations/008+013 (user_work_periods) Gleichheit', () => {
  const pathA = path.join(os.tmpdir(), `parity-schema-${Date.now()}-${process.pid}.db`);
  const pathB = path.join(os.tmpdir(), `parity-migration-${Date.now()}-${process.pid}.db`);

  afterAll(() => {
    for (const p of [pathA, pathB]) {
      for (const suffix of ['', '-wal', '-shm']) {
        const file = `${p}${suffix}`;
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  });

  function normalizeSql(sql: string | null): string {
    if (sql === null) return '';
    // SQLite quotiert den Tabellennamen automatisch in doppelten Anfuehrungszeichen, wenn
    // die CREATE-TABLE-Anweisung aus einem ALTER TABLE ... RENAME TO hervorgegangen ist
    // (Tabellen-Neubau-Technik aus Migration 012/013) — schema.ts legt dieselbe Tabelle ohne
    // RENAME an und bleibt unquotiert. Beide Formen sind semantisch identisch (alle
    // Bezeichner in diesem Projekt sind quotierungsfrei gueltig), deshalb werden doppelt
    // quotierte Bezeichner vor dem Vergleich normalisiert — reine SQL-Stringliterale nutzen
    // ausschliesslich einfache Anfuehrungszeichen und sind davon nicht betroffen.
    return sql
      .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function objectsFor(db: Database.Database): Array<{ type: string; name: string; sql: string }> {
    const rows = db
      .prepare(
        `SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'user_work_periods' ORDER BY type, name`
      )
      .all() as Array<{ type: string; name: string; sql: string | null }>;
    return rows.map((r) => ({ type: r.type, name: r.name, sql: normalizeSql(r.sql) }));
  }

  it('erzeugt identische Objektlisten (Tabelle, Indizes, Trigger)', () => {
    // Datenbank A: über initializeDatabase() (schema.ts) — der volle Produktionspfad.
    const dbA = new Database(pathA);
    initializeDatabase(dbA);
    const objectsA = objectsFor(dbA);
    dbA.close();

    // Datenbank B: minimale users-Tabelle plus migration008.up(db) — der Migrationspfad.
    const dbB = new Database(pathB);
    dbB.pragma('journal_mode = WAL');
    dbB.pragma('foreign_keys = ON');
    dbB.prepare(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL
      )
    `).run();
    migration008.up(dbB);
    migration013.up(dbB);
    const objectsB = objectsFor(dbB);
    dbB.close();

    expect(objectsA).toEqual(objectsB);
  });

  it('Gegenprobe 1: ein zusätzliches Leerzeichen darf den Test nicht rot machen', () => {
    const sqlWithExtraSpace = 'CREATE TABLE  foo (id  INTEGER)';
    const sqlNormal = 'CREATE TABLE foo (id INTEGER)';
    expect(normalizeSql(sqlWithExtraSpace)).toEqual(normalizeSql(sqlNormal));
  });

  it('Gegenprobe 2: eine geänderte Spaltendefinition muss den Test rot machen', () => {
    const sqlOriginal = 'CREATE TABLE foo (id INTEGER, weeklyHours REAL NOT NULL)';
    const sqlChanged = 'CREATE TABLE foo (id INTEGER, weeklyHours REAL)'; // NOT NULL entfernt
    expect(normalizeSql(sqlOriginal)).not.toEqual(normalizeSql(sqlChanged));
  });
});
