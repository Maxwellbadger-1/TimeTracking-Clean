import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * Regressionstest zum Vorfall vom 27.08.2026.
 *
 * Der Server hatte keinen Signalbehandler: PM2 schickte SIGINT, der Prozess starb ohne
 * `db.close()`. Im Regelfall ist das folgenlos - SQLite liest die WAL beim naechsten Start
 * ein. War die WAL aber vom Dateisystem abgehaengt, verschwand sie mit dem Prozess.
 * `shutdownDatabase()` setzt deshalb vor dem Schliessen einen Pruefpunkt.
 * Siehe .planning/debug/wal-abgehaengt-20260827.md
 *
 * Der Test arbeitet auf einer eigenen Datenbank in einem Temp-Verzeichnis, nicht auf der
 * Arbeitsdatenbank aus `getDatabasePath()`.
 */
describe('shutdownDatabase', () => {
  const aufraeumen: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    for (const dir of aufraeumen.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  async function frischeVerbindung() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-shutdown-'));
    aufraeumen.push(dir);
    const dbPath = path.join(dir, 'test.db');

    // Muss VOR dem Import gesetzt sein: config/database.ts wertet den Pfad beim Laden aus.
    vi.stubEnv('DATABASE_PATH', dbPath);
    vi.resetModules();

    const modul = await import('./connection.js');
    return { dbPath, ...modul };
  }

  /**
   * Kopiert NUR die Hauptdatei - ohne WAL. Genau das, was von einer abgehaengten WAL
   * uebrig bleibt, wenn der Prozess stirbt: der Stand des letzten Pruefpunkts.
   */
  function nurHauptdateiLesen(dbPath: string, name: string) {
    const kopie = path.join(path.dirname(dbPath), name);
    fs.copyFileSync(dbPath, kopie);
    return new Database(kopie, { readonly: true, fileMustExist: true });
  }

  it('schreibt die WAL vor dem Schliessen in die Hauptdatei zurueck', async () => {
    const { dbPath, db, shutdownDatabase } = await frischeVerbindung();

    // Bewusst wenig Daten: Unterhalb der automatischen Pruefpunktschwelle von 1000 Seiten
    // bleibt alles in der WAL stehen. Nur so prueft der Test den Pruefpunkt und nicht
    // SQLites Selbstaufraeumen.
    db.prepare('CREATE TABLE IF NOT EXISTS pruef (id INTEGER PRIMARY KEY, wert TEXT)').run();
    const einfuegen = db.prepare('INSERT INTO pruef (wert) VALUES (?)');
    for (let i = 0; i < 50; i++) {
      einfuegen.run(`Zeile ${i}`);
    }

    expect(fs.statSync(`${dbPath}-wal`).size).toBeGreaterThan(0);

    // KONTRAST: Ohne Pruefpunkt kennt die Hauptdatei die Tabelle noch gar nicht.
    // Stuerbe der Prozess jetzt mit abgehaengter WAL, waere genau das der Datenverlust.
    const vorher = nurHauptdateiLesen(dbPath, 'vor-shutdown.db');
    expect(() => vorher.prepare('SELECT COUNT(*) FROM pruef').get()).toThrow(/no such table/i);
    vorher.close();

    shutdownDatabase();

    // Nach sauberem Schliessen ist die WAL leer oder ganz verschwunden.
    if (fs.existsSync(`${dbPath}-wal`)) {
      expect(fs.statSync(`${dbPath}-wal`).size).toBe(0);
    }

    // Der fachliche Beweis: Die Hauptdatei ALLEIN traegt jetzt alle 50 Zeilen.
    const nachher = nurHauptdateiLesen(dbPath, 'nach-shutdown.db');
    expect(nachher.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(nachher.prepare('SELECT COUNT(*) AS n FROM pruef').get()).toEqual({ n: 50 });
    nachher.close();
  });

  it('oeffnet die Datenbank waehrend des Herunterfahrens nicht erneut', async () => {
    const { db, shutdownDatabase } = await frischeVerbindung();

    db.prepare('CREATE TABLE IF NOT EXISTS pruef (id INTEGER PRIMARY KEY)').run();
    shutdownDatabase();

    // Ein noch feuernder Cron-Job darf keine frische WAL/SHM anlegen, kurz bevor der
    // Prozess endet - der Proxy muss den automatischen Reconnect verweigern.
    expect(() => db.prepare('SELECT 1')).toThrow(/shutting down/i);
  });

  it('ist idempotent', async () => {
    const { shutdownDatabase } = await frischeVerbindung();

    shutdownDatabase();
    expect(() => shutdownDatabase()).not.toThrow();
  });
});
