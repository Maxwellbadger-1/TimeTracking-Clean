import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { spawn, ChildProcess } from 'child_process';
import Database from 'better-sqlite3';

/**
 * Nebenläufigkeitsnachweis zu WR-03 (09-REVIEW.md) / D-08 (09.1-CONTEXT.md).
 *
 * Ein Test, der nur `PRAGMA busy_timeout` ausliest, belegt bloß einen Konfigurationswert -
 * nicht, dass ein echter Schreibkonflikt tatsächlich abgewartet wird statt sofort mit
 * SQLITE_BUSY zu scheitern. Deshalb hält hier eine zweite Verbindung ausdrücklich eine
 * Schreibsperre, während eine erste versucht zu schreiben (Fall 2), und eine Gegenprobe
 * ohne busy_timeout zeigt den Kontrast (Fall 3).
 *
 * Der Sperrhalter läuft in einem eigenen Kindprozess: better-sqlite3 ist synchron - eine
 * blockierende Transaktion im selben Thread wie der Test könnte nie committen, und der Test
 * würde nie fortfahren. Der Kindprozess bekommt den Pfad zu `better-sqlite3` explizit als
 * Argument, weil sein Arbeitsverzeichnis (ein Temp-Ordner) keine `node_modules`-Auflösung
 * zum Projekt hat.
 *
 * Arbeitet ausschließlich auf einer Wegwerf-Datenbank in `os.tmpdir()` (D-16) - niemals auf
 * einer Arbeitsdatenbank aus `getDatabasePath()`.
 */
describe('busy_timeout - echter Nebenläufigkeitsnachweis', () => {
  const aufraeumen: string[] = [];
  const kinder: ChildProcess[] = [];
  const abschalter: Array<() => void> = [];

  function warteAufExit(kind: ChildProcess): Promise<void> {
    if (kind.exitCode !== null || kind.signalCode !== null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      kind.once('exit', () => resolve());
    });
  }

  // Windows sperrt eine Datei, solange irgendein Prozess (auch ein soeben geschlossener)
  // noch einen Handle darauf haelt - der Handle wird nicht immer synchron mit close()/exit()
  // freigegeben. Ein paar kurze Wiederholungen sind deshalb kein Symptom eines Fehlers.
  async function entferneVerzeichnisMitWiederholung(dir: string, versucheUebrig = 5): Promise<void> {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (fehler) {
      if (versucheUebrig <= 1) {
        throw fehler;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      await entferneVerzeichnisMitWiederholung(dir, versucheUebrig - 1);
    }
  }

  afterEach(async () => {
    const laufende = kinder.splice(0);
    for (const kind of laufende) {
      if (kind.exitCode === null && !kind.killed) {
        kind.kill();
      }
    }
    await Promise.all(laufende.map(warteAufExit));

    for (const schliessen of abschalter.splice(0)) {
      schliessen();
    }

    vi.unstubAllEnvs();
    vi.resetModules();

    for (const dir of aufraeumen.splice(0)) {
      await entferneVerzeichnisMitWiederholung(dir);
    }
  });

  async function frischeVerbindung() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-busytimeout-'));
    aufraeumen.push(dir);
    const dbPath = path.join(dir, 'test.db');

    // Muss VOR dem Import gesetzt sein: config/database.ts wertet den Pfad beim Laden aus.
    vi.stubEnv('DATABASE_PATH', dbPath);
    vi.resetModules();

    const modul = await import('./connection.js');
    abschalter.push(modul.shutdownDatabase);
    return { dir, dbPath, ...modul };
  }

  // Wird einmal aufgelöst und an den Kindprozess weitergereicht - sein Temp-Verzeichnis hat
  // keine node_modules-Auflösung zum Projekt, ein bloßer Modulname würde dort scheitern.
  const sqlitePfad = createRequire(import.meta.url).resolve('better-sqlite3');

  function schreibeSperrhalter(dir: string): string {
    const skriptPfad = path.join(dir, 'sperrhalter.cjs');
    fs.writeFileSync(
      skriptPfad,
      `
// Sperrhalter (D-08): haelt eine Schreibsperre auf der Wegwerf-Datenbank, damit der Test
// einen echten Wartenachweis fuehren kann. Eigener Prozess, weil better-sqlite3 synchron
// ist und eine blockierende Transaktion im Testprozess selbst nie committen koennte.
const [, , dbPath, sqlitePfad] = process.argv;
const Database = require(sqlitePfad);

const db = new Database(dbPath);
db.pragma('busy_timeout = 0');

db.exec('BEGIN IMMEDIATE');
db.prepare("INSERT INTO pruef (quelle) VALUES ('sperrhalter')").run();

process.stdout.write('LOCKED\\n');

setTimeout(() => {
  db.exec('COMMIT');
  db.close();
  process.exit(0);
}, 1000);
`,
      'utf-8'
    );
    return skriptPfad;
  }

  function starteSperrhalter(dir: string, dbPath: string): ChildProcess {
    const skriptPfad = schreibeSperrhalter(dir);
    // Kein shell: true - keine Kommandoverkettung moeglich; execPath und skriptPfad
    // stammen beide aus dem Testprozess selbst, keine Eingabe von aussen (T-09.1-04).
    const kind = spawn(process.execPath, [skriptPfad, dbPath, sqlitePfad]);
    kinder.push(kind);
    return kind;
  }

  function warteAufLocked(kind: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      let ausgabe = '';
      const timeout = setTimeout(() => {
        reject(
          new Error(`Sperrhalter meldete 'LOCKED' nicht innerhalb von 5000ms. Ausgabe bisher: ${ausgabe}`)
        );
      }, 5000);

      kind.stdout?.on('data', (chunk: Buffer) => {
        ausgabe += chunk.toString();
        if (ausgabe.includes('LOCKED')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      kind.stderr?.on('data', (chunk: Buffer) => {
        ausgabe += chunk.toString();
      });
      kind.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      kind.on('exit', (code) => {
        if (!ausgabe.includes('LOCKED')) {
          clearTimeout(timeout);
          reject(
            new Error(`Sperrhalter beendete sich (Code ${code}) bevor 'LOCKED' gemeldet wurde. Ausgabe: ${ausgabe}`)
          );
        }
      });
    });
  }

  it('(1) Konfiguration: busy_timeout ist auf 5000 gesetzt - notwendige, aber allein nicht ausreichende Vorbedingung fuer (2) und (3)', async () => {
    const { db } = await frischeVerbindung();
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });

  it('(2) Wartenachweis: eine zweite Verbindung wartet auf die Sperrfreigabe und schreibt danach erfolgreich', async () => {
    const { dir, dbPath, db } = await frischeVerbindung();
    db.prepare('CREATE TABLE IF NOT EXISTS pruef (id INTEGER PRIMARY KEY, quelle TEXT)').run();

    const kind = starteSperrhalter(dir, dbPath);
    await warteAufLocked(kind);

    const start = Date.now();
    expect(() => {
      db.prepare("INSERT INTO pruef (quelle) VALUES ('test')").run();
    }).not.toThrow();
    const dauer = Date.now() - start;

    // Die Sperre wurde tatsaechlich abgewartet (Haltedauer 1000ms), nicht zufaellig
    // durchgewinkt - Schwelle bewusst grosszuegig fuer langsame Laeufer.
    expect(dauer).toBeGreaterThanOrEqual(300);

    const anzahl = db.prepare('SELECT COUNT(*) AS n FROM pruef').get() as { n: number };
    expect(anzahl.n).toBe(2);
  });

  it('(3) Gegenprobe: ohne busy_timeout scheitert derselbe Schreibversuch sofort mit SQLITE_BUSY', async () => {
    const { dir, dbPath, db } = await frischeVerbindung();
    db.prepare('CREATE TABLE IF NOT EXISTS pruef (id INTEGER PRIMARY KEY, quelle TEXT)').run();

    const kind = starteSperrhalter(dir, dbPath);
    await warteAufLocked(kind);

    // Rohe zweite Verbindung mit ausdruecklich busy_timeout = 0 - der Kontrast zu Fall (2).
    const rohVerbindung = new Database(dbPath);
    rohVerbindung.pragma('busy_timeout = 0');

    const start = Date.now();
    let geworfenerFehler: unknown;
    try {
      rohVerbindung.prepare("INSERT INTO pruef (quelle) VALUES ('gegenprobe')").run();
    } catch (fehler) {
      geworfenerFehler = fehler;
    }
    const dauer = Date.now() - start;

    rohVerbindung.close();

    expect(geworfenerFehler).toBeDefined();
    expect((geworfenerFehler as { code?: string }).code).toBe('SQLITE_BUSY');
    // Ohne busy_timeout scheitert der Zugriff sofort - kein Warten wie in Fall (2).
    expect(dauer).toBeLessThan(250);
  });
});
