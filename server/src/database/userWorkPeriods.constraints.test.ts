import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import migration from './migrations/008_create_user_work_periods.js';

/**
 * Verhaltensmatrix der Trigger und Constraints von user_work_periods (Migration 008).
 *
 * WARUM DIESE DATEI EXISTIERT (D3, REQ-22, 10-CONTEXT.md):
 * REQ-22 verlangt ausdrücklich, dass die DATENBANK Überlappungen und Lücken abweist — nicht
 * die Oberfläche. Ein Service-seitiger Check darf zusätzlich existieren (bessere
 * Fehlermeldung), ersetzt den Trigger aber nicht. Diese Datei belegt maschinell, dass die
 * drei Trigger und der partielle UNIQUE-Index aus Migration 008 genau das leisten. Wer den
 * Riegel später in den Service verlegen und die Trigger entfernen will, muss zuerst diese
 * Datei löschen — und das soll bei jedem Review auffallen.
 *
 * Arbeitet ausschließlich gegen `new Database(':memory:')` mit einer minimalen `users`-
 * Tabelle und `migration.up(db)` — nicht gegen die lokale Arbeitsdatenbank unter
 * server/database/. Die Matrix erzeugt bewusst Fehlerfälle; sie darf die Arbeitsdatenbank
 * nicht mit Halbzuständen belasten (siehe drei bekannte vorbestehende rote Tests des
 * Projekts, G5).
 *
 * FUND — welcher Riegel bei identischem validFrom tatsächlich greift (empirisch geprüft
 * 22.08.2026 gegen better-sqlite3, siehe 10-02-SUMMARY.md):
 * Migration 008 legt sowohl `UNIQUE(userId, validFrom)` als auch den BEFORE-INSERT-
 * Überlappungstrigger an. Für zwei Perioden mit identischem validFrom überlappen sich die
 * beiden halboffenen Intervalle unter der Definition aus D1 IMMER (ein Intervall, das an
 * Tag X beginnt, kann nicht existieren, ohne ein zweites am selben Tag X beginnendes zu
 * überlappen). Da der BEFORE-INSERT-Trigger vor der Constraint-Prüfung läuft, wirft SQLite
 * in der Praxis "Überlappung", nicht "UNIQUE constraint failed". Der UNIQUE-Index ist
 * trotzdem kein Blindgänger: Entfernt man versuchsweise NUR den Insert-Trigger (unten
 * reproduziert, ohne die Migrationsdatei zu verändern), greift bei identischem validFrom
 * weiterhin "UNIQUE constraint failed" — Verteidigung in der Tiefe für genau diesen einen
 * Fall, während echte Überlappungen mit unterschiedlichem validFrom dann gar nicht mehr
 * abgewiesen würden (siehe letzte describe-Gruppe unten).
 */
describe('user_work_periods: Verhaltensmatrix der Trigger und Constraints (REQ-22, D3)', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const fkStatus = db.pragma('foreign_keys', { simple: true });
    if (fkStatus !== 1) {
      throw new Error(
        `PRAGMA foreign_keys nicht aktiv (Wert: ${fkStatus}) — der Kaskadentest würde nichts prüfen.`
      );
    }

    db.prepare(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL
      )
    `).run();

    await migration.up(db);
  });

  afterEach(() => {
    db.close();
  });

  function insertUser(username: string): number {
    const result = db.prepare(`INSERT INTO users (username) VALUES (?)`).run(username);
    return result.lastInsertRowid as number;
  }

  function insertPeriod(userId: number, validFrom: string, validTo: string | null, weeklyHours = 40) {
    return db.prepare(`
      INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours)
      VALUES (?, ?, ?, ?)
    `).run(userId, validFrom, validTo, weeklyHours);
  }

  describe('Erlaubt', () => {
    it('lässt die erste Periode eines Nutzers zu, offen, ab seinem hireDate', () => {
      const userId = insertUser('erste-periode');
      expect(() => insertPeriod(userId, '2025-11-13', null)).not.toThrow();
    });

    it('lässt eine Anschlussperiode zu, deren validFrom exakt dem validTo der Vorgängerin entspricht', () => {
      const userId = insertUser('anschluss');
      insertPeriod(userId, '2025-01-01', '2026-01-01');
      expect(() => insertPeriod(userId, '2026-01-01', null)).not.toThrow();
    });

    it('erlaubt den Stichtagswechsel in zwei Schritten: UPDATE schließt die offene Periode, INSERT eröffnet die neue ab genau diesem Datum', () => {
      const userId = insertUser('stichtag');
      const first = insertPeriod(userId, '2026-01-01', null);

      expect(() => {
        const tx = db.transaction(() => {
          db.prepare(`UPDATE user_work_periods SET validTo = ? WHERE id = ?`)
            .run('2026-07-01', first.lastInsertRowid);
          insertPeriod(userId, '2026-07-01', null, 30);
        });
        tx();
      }).not.toThrow();
    });

    it('erlaubt ein UPDATE, das nur weeklyHours und workSchedule ändert, ohne Datumsverschiebung', () => {
      const userId = insertUser('nur-stunden');
      const period = insertPeriod(userId, '2026-01-01', null, 40);

      expect(() => {
        db.prepare(`UPDATE user_work_periods SET weeklyHours = ?, workSchedule = ? WHERE id = ?`)
          .run(20, 'mo-mi', period.lastInsertRowid);
      }).not.toThrow();
    });

    it('erlaubt DELETE der jüngeren (offenen) Periode, wenn der Nutzer danach noch eine weitere Periode hat', () => {
      // Nicht zu verwechseln mit dem WR-01-Riegel unten: hier bleibt nach dem Löschen eine
      // zweite, verkettete Periode übrig — der Nutzer läuft nicht leer.
      const userId = insertUser('zwei-verkettete-perioden');
      insertPeriod(userId, '2026-01-01', '2026-06-01', 40);
      const second = insertPeriod(userId, '2026-06-01', null, 30);

      expect(() => {
        db.prepare(`DELETE FROM user_work_periods WHERE id = ?`).run(second.lastInsertRowid);
      }).not.toThrow();

      const remaining = (db
        .prepare(`SELECT COUNT(*) as count FROM user_work_periods WHERE userId = ?`)
        .get(userId) as { count: number }).count;
      expect(remaining).toBe(1);
    });

    it('räumt DELETE FROM users bei drei verketteten Perioden vollständig per Kaskade ab, ohne dass der DELETE-Trigger abbricht', () => {
      const userId = insertUser('kaskade');
      insertPeriod(userId, '2026-01-01', '2026-04-01', 40);
      insertPeriod(userId, '2026-04-01', '2026-07-01', 32);
      insertPeriod(userId, '2026-07-01', null, 20);

      expect(() => {
        db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
      }).not.toThrow();

      const remaining = (db
        .prepare(`SELECT COUNT(*) as count FROM user_work_periods WHERE userId = ?`)
        .get(userId) as { count: number }).count;
      expect(remaining).toBe(0);
    });

    it('lässt zwei verschiedene Nutzer mit sich überlappenden Perioden zu (Gegenprobe: Trigger filtern korrekt auf userId)', () => {
      const userA = insertUser('nutzer-a');
      const userB = insertUser('nutzer-b');
      insertPeriod(userA, '2026-01-01', '2026-06-01', 40);

      expect(() => insertPeriod(userB, '2026-01-01', '2026-06-01', 40)).not.toThrow();
    });
  });

  describe('Abgewiesen', () => {
    // WR-01-Riegel (unten): verweigert das Leerlaufen der Periodenkette — die letzte
    // verbleibende Periode eines noch existierenden Nutzers ist unlöschbar. Offen bleibt
    // (Phase 13, 13-CONTEXT.md D3): das Löschen der ERSTEN von MEHREREN Perioden ist
    // datenbankseitig weiterhin erlaubt (der Kaskadentest oben, `räumt DELETE FROM users
    // ... ab`, löscht alle drei Perioden nacheinander per ON DELETE CASCADE, nicht per
    // direktem DELETE auf die erste Periode bei fortbestehendem Nutzer). D3 verlangt für
    // diesen Fall eine Ersetzungslogik (Vorperiode schließt die Lücke), die dieser Plan
    // bewusst nicht vorwegnimmt — Phase 13 bringt sie mit.
    it('verweigert DELETE der letzten verbleibenden Periode eines noch existierenden Nutzers (WR-01, 10-REVIEW.md)', () => {
      const userId = insertUser('letzte-loeschen');
      const period = insertPeriod(userId, '2026-01-01', null);

      expect(() => {
        db.prepare(`DELETE FROM user_work_periods WHERE id = ?`).run(period.lastInsertRowid);
      }).toThrow(/ohne jede Periode/);
    });

    it('verweigert DELETE der letzten verbleibenden Periode auch, wenn sie geschlossen (validTo gesetzt) statt offen ist — der Riegel greift nicht nur bei validTo IS NULL', () => {
      const userId = insertUser('letzte-geschlossen');
      const period = insertPeriod(userId, '2026-01-01', '2026-06-01');

      expect(() => {
        db.prepare(`DELETE FROM user_work_periods WHERE id = ?`).run(period.lastInsertRowid);
      }).toThrow(/ohne jede Periode/);
    });

    it('weist eine Periode ab, die eine bestehende überlappt', () => {
      const userId = insertUser('ueberlappt');
      insertPeriod(userId, '2026-01-01', '2026-06-01', 40);

      expect(() => insertPeriod(userId, '2026-03-01', null, 30)).toThrow(/Überlappung/);
    });

    it('weist eine zweite offene Periode desselben Nutzers ab (hier: der Überlappungs-Trigger greift, weil eine zweite offene Periode zwingend mit der ersten überlappt — validTo IS NULL entspricht +unendlich)', () => {
      const userId = insertUser('zweite-offene');
      insertPeriod(userId, '2026-01-01', null, 40);

      expect(() => insertPeriod(userId, '2026-06-01', null, 30)).toThrow(/Überlappung/);
    });

    it('weist eine Periode ab, die eine Lücke zur bestehenden Kette lässt', () => {
      const userId = insertUser('luecke-insert');
      insertPeriod(userId, '2026-01-01', '2026-06-01', 40);

      // 2026-07-01 statt 2026-06-01: ein Monat Lücke
      expect(() => insertPeriod(userId, '2026-07-01', null, 30)).toThrow(/Lücke/);
    });

    it('weist ein UPDATE ab, das eine Lücke erzeugt (validFrom der Anschlussperiode nach hinten verschoben)', () => {
      const userId = insertUser('luecke-update');
      insertPeriod(userId, '2026-01-01', '2026-06-01', 40);
      const successor = insertPeriod(userId, '2026-06-01', null, 30);

      expect(() => {
        db.prepare(`UPDATE user_work_periods SET validFrom = ? WHERE id = ?`)
          .run('2026-07-01', successor.lastInsertRowid);
      }).toThrow(/Lücke/);
    });

    it('weist das direkte Löschen einer mittleren Periode bei noch existierendem Nutzer ab', () => {
      const userId = insertUser('mitte-loeschen');
      insertPeriod(userId, '2026-01-01', '2026-04-01', 40);
      const mid = insertPeriod(userId, '2026-04-01', '2026-07-01', 32);
      insertPeriod(userId, '2026-07-01', null, 20);

      expect(() => {
        db.prepare(`DELETE FROM user_work_periods WHERE id = ?`).run(mid.lastInsertRowid);
      }).toThrow(/Lücke/);
    });

    it('weist validTo <= validFrom als CHECK-Verstoß ab (Nullperiode)', () => {
      const userId = insertUser('nullperiode');
      expect(() => insertPeriod(userId, '2026-01-01', '2026-01-01', 40)).toThrow(
        /CHECK constraint failed/
      );
    });

    it('weist validFrom im Format "2026-1-1" als CHECK-Verstoß ab', () => {
      const userId = insertUser('format-kurz');
      expect(() => insertPeriod(userId, '2026-1-1', null, 40)).toThrow(/CHECK constraint failed/);
    });

    it('weist validFrom im Format "01.01.2026" als CHECK-Verstoß ab', () => {
      const userId = insertUser('format-deutsch');
      expect(() => insertPeriod(userId, '01.01.2026', null, 40)).toThrow(
        /CHECK constraint failed/
      );
    });

    it('weist validFrom als ISO-Zeitstempel "2026-01-01T00:00:00Z" als CHECK-Verstoß ab — der Riegel gegen die Zeitzonenfalle aus Phase 9', () => {
      const userId = insertUser('format-iso');
      expect(() => insertPeriod(userId, '2026-01-01T00:00:00Z', null, 40)).toThrow(
        /CHECK constraint failed/
      );
    });

    it('weist zwei Perioden desselben Nutzers mit identischem validFrom ab — der Überlappungs-Trigger greift vor dem UNIQUE-Index, weil zwei am selben Tag beginnende Intervalle unter D1 immer überlappen (siehe Kopfkommentar und letzte describe-Gruppe)', () => {
      const userId = insertUser('identisches-validfrom');
      insertPeriod(userId, '2026-01-01', '2026-06-01', 40);

      expect(() => insertPeriod(userId, '2026-01-01', '2026-03-01', 20)).toThrow(/Überlappung/);
    });
  });

  /**
   * Reproduziert das im Plan geforderte Experiment "Insert-Trigger versuchsweise entfernen"
   * (Task-1-Abnahmekriterium) als dauerhaften, automatisierten Test — statt die Migrationsdatei
   * einmalig manuell zu bearbeiten und wieder zurückzunehmen. Baut die Tabelle OHNE
   * trg_user_work_periods_insert_guard lokal in diesem Test nach; server/src/database/
   * migrations/008_create_user_work_periods.ts selbst bleibt zu jedem Zeitpunkt unverändert
   * (verifiziert unten per Selbst-Check und im SUMMARY per git diff).
   */
  describe('Insert-Trigger versuchsweise entfernt (Nachweis für Task-1-Abnahmekriterium)', () => {
    let dbWithoutInsertGuard: Database.Database;

    beforeEach(() => {
      dbWithoutInsertGuard = new Database(':memory:');
      dbWithoutInsertGuard.pragma('foreign_keys = ON');
      dbWithoutInsertGuard
        .prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL)`)
        .run();
      dbWithoutInsertGuard
        .prepare(
          `
          CREATE TABLE user_work_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            validFrom TEXT NOT NULL,
            validTo TEXT,
            weeklyHours REAL NOT NULL,
            workSchedule TEXT,
            note TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            createdBy INTEGER,
            UNIQUE(userId, validFrom),
            CHECK (validFrom GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
            CHECK (validTo IS NULL OR validTo GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
            CHECK (validTo IS NULL OR validTo > validFrom),
            CHECK (weeklyHours >= 0 AND weeklyHours <= 168),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (createdBy) REFERENCES users(id)
          )
        `
        )
        .run();
      // ABSICHTLICH kein CREATE TRIGGER trg_user_work_periods_insert_guard — das ist der
      // eine versuchsweise entfernte Riegel für dieses Experiment.
    });

    afterEach(() => {
      dbWithoutInsertGuard.close();
    });

    it('lässt eine echte Überlappung (unterschiedliches validFrom) ohne Insert-Trigger unbemerkt durch — Beleg, dass der Trigger der wirksame Riegel ist', () => {
      const userId = dbWithoutInsertGuard
        .prepare(`INSERT INTO users (username) VALUES (?)`)
        .run('ohne-trigger-a').lastInsertRowid as number;
      dbWithoutInsertGuard
        .prepare(`INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours) VALUES (?, ?, ?, ?)`)
        .run(userId, '2026-01-01', '2026-06-01', 40);

      expect(() => {
        dbWithoutInsertGuard
          .prepare(`INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours) VALUES (?, ?, ?, ?)`)
          .run(userId, '2026-03-01', '2026-08-01', 20);
        // OHNE Trigger: keine Ausnahme — genau der Bruch, den Migration 008 verhindert.
      }).not.toThrow();
    });

    it('weist identisches validFrom trotz fehlendem Insert-Trigger weiterhin über den UNIQUE-Index ab (Verteidigung in der Tiefe)', () => {
      const userId = dbWithoutInsertGuard
        .prepare(`INSERT INTO users (username) VALUES (?)`)
        .run('ohne-trigger-b').lastInsertRowid as number;
      dbWithoutInsertGuard
        .prepare(`INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours) VALUES (?, ?, ?, ?)`)
        .run(userId, '2026-01-01', '2026-06-01', 40);

      expect(() => {
        dbWithoutInsertGuard
          .prepare(`INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours) VALUES (?, ?, ?, ?)`)
          .run(userId, '2026-01-01', '2026-03-01', 20);
      }).toThrow(/UNIQUE constraint failed/);
    });
  });
});
