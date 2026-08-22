/**
 * Migration 014: reversalOf-Selbstreferenz auf overtime_transactions (DD-4, 13-01-PLAN.md,
 * Task 2)
 *
 * PROBLEM: Ein Storno (D2, 13-CONTEXT.md) gleicht eine Korrekturbuchung durch eine
 * Gegenbuchung aus, statt sie zu löschen (Storno-Prinzip aus Milestone v2.0). Damit der
 * Kontoauszug den Bezug zwischen Buchung und Gegenbuchung maschinenlesbar zeigen kann
 * (REQ-31: "storniert, nicht gelöscht — die Storno-Geschichte bleibt im Auszug sichtbar"),
 * braucht es einen eindeutigen Paarbezug zwischen zwei `overtime_transactions`-Zeilen.
 *
 * `referenceId` ist dafür NICHT geeignet: Es zeigt auf die AUSLÖSENDE Fremdentität (hier
 * `user_work_periods.id`) und ist die gemeinsame Belegnummer der Oberfläche — aber kein
 * eindeutiger Paarbezug. Wird dieselbe Periode erst korrigiert und dann gelöscht, tragen
 * DREI Zeilen dieselbe `referenceId`. Die neue Spalte `reversalOf` wird ausschließlich auf
 * der Gegenbuchung gesetzt und zeigt auf die stornierte Original-Buchungszeile.
 *
 * `reversedBy`/`reversedAt`/`reversedByName` aus dem Datenvertrag der 13-UI-SPEC bekommen
 * bewusst KEINE eigenen Spalten: Sie werden im Lesepfad über einen Selbst-Join auf
 * `reversalOf` und einen Join auf `users` abgeleitet (Plan 13-06). Redundante Spalten wären
 * eine zweite Quelle für dieselbe Aussage.
 *
 * LÖSUNG (DD-3): KEIN Tabellen-Neubau nötig — weder die `type`-Liste noch die
 * `referenceType`-Liste ändert sich (Korrektur- und Storno-Buchungen laufen beide unter dem
 * bestehenden `type = 'model_change'` mit `referenceType = 'work_period'`, 13-UI-SPEC). Es
 * kommt genau eine Spalte hinzu, mit Vorgabewert NULL — dafür genügt
 * `ALTER TABLE ... ADD COLUMN`, SQLite erlaubt dabei auch die `REFERENCES`-Klausel.
 *
 * IDEMPOTENZ: Diese Migration prüft vor dem ALTER, ob die Spalte schon existiert (z. B. weil
 * eine frische Installation sie bereits über `schema.ts` mitbringt) und kehrt dann folgenlos
 * zurück — kein zweiter ALTER-Versuch, kein Fehler.
 *
 * PARITÄT: `server/src/database/schema.ts` bekommt im selben Plan dieselbe Spalte, denselben
 * Fremdschlüssel und denselben Teilindex.
 *
 * SAFE: Reines ADD COLUMN mit Vorgabewert NULL, keine bestehende Zeile wird verändert. Kein
 * Code-Pfad dieser Phase führt ein DELETE aus.
 *
 * Kontext: .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-CONTEXT.md (D2),
 * .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-01-PLAN.md (DD-3/DD-4, Task 2)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 014: reversalOf-Selbstreferenz auf overtime_transactions (DD-4)...');

    const columns = db
      .prepare(`PRAGMA table_info(overtime_transactions)`)
      .all() as Array<{ name: string }>;

    if (columns.some((c) => c.name === 'reversalOf')) {
      logger.info('✅ Migration 014: Spalte reversalOf existiert bereits — folgenlos übersprungen');
      return;
    }

    db.prepare(`
      ALTER TABLE overtime_transactions ADD COLUMN reversalOf INTEGER REFERENCES overtime_transactions(id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_overtime_transactions_reversal_of
      ON overtime_transactions(reversalOf) WHERE reversalOf IS NOT NULL
    `).run();

    // Selbstverifikation (Muster Migration 010/013): schlägt die Prüfung fehl, wird
    // geworfen — die Migration gilt dann als nicht angewendet.
    const columnsAfter = db
      .prepare(`PRAGMA table_info(overtime_transactions)`)
      .all() as Array<{ name: string }>;

    if (!columnsAfter.some((c) => c.name === 'reversalOf')) {
      throw new Error(
        'Migration 014 unvollständig: Spalte reversalOf fehlt nach dem ALTER TABLE. ' +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    const index = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_overtime_transactions_reversal_of'`
      )
      .get();

    if (!index) {
      throw new Error(
        'Migration 014 unvollständig: idx_overtime_transactions_reversal_of wurde nicht ' +
        'angelegt. Migration wird NICHT als angewendet markiert.'
      );
    }

    logger.info(
      '✅ Migration 014 verified: reversalOf vorhanden, Teilindex angelegt'
    );
  },
};
