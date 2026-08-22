/**
 * Migration 010: Nachrüstung des korrigierten DELETE-Riegels auf user_work_periods (WR-01,
 * 10-REVIEW.md; 10-06-PLAN.md, Task 2)
 *
 * PROBLEM: Migration 008 ist auf `server/database/development.db` und auf den lokalen
 * Arbeitskopien bereits angewendet und läuft dort NIE erneut (`migrationRunner.ts` überspringt
 * bereits in der `migrations`-Tabelle verzeichnete Namen vollständig). Ohne diese Migration
 * trüge genau die Datenbank, gegen die Phase 11 bis 13 entwickelt werden, weiterhin den alten,
 * löchrigen `trg_user_work_periods_delete_guard`, der das Löschen der letzten verbleibenden
 * Periode eines noch existierenden Nutzers zulässt — exakt der in WR-01 beschriebene Bruch der
 * von Migration 009 hergestellten Invariante „jeder Nutzer hat mindestens eine Periode".
 * `CREATE TRIGGER IF NOT EXISTS` allein repariert das nicht, weil der alte Trigger bereits
 * existiert und `IF NOT EXISTS` dann ein No-Op ist.
 *
 * LÖSUNG: `DROP TRIGGER IF EXISTS` gefolgt von einer Neuerstellung aus
 * `DELETE_GUARD_TRIGGER_SQL`, derselben Konstante, die Migration 008 selbst für den
 * Erststart-Fall verwendet — eine Quelle, keine dritte SQL-Kopie auf dem Migrationsweg.
 *
 * AUF EINER FRISCHEN DATENBANK: Migration 008 erzeugt dort bereits die korrigierte Fassung
 * (008 selbst importiert dieselbe Konstante). Diese Migration ersetzt den Trigger dann durch
 * eine wortgleiche Neufassung — folgenlos und idempotent, kein Fehlerfall.
 *
 * SAFE: Berührt ausschließlich den einen Trigger. Keine Tabelle, kein Index, keine Zeile in
 * `user_work_periods` oder `users` wird angefasst.
 *
 * Kontext: .planning/phases/10-perioden-fundament/10-REVIEW.md (WR-01),
 * .planning/phases/10-perioden-fundament/10-06-PLAN.md (Task 2)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';
import { DELETE_GUARD_TRIGGER_SQL } from './008_create_user_work_periods.js';

export default {
  up(db: Database.Database): void {
    logger.info(
      '🚀 Migration 010: Nachrüstung des korrigierten DELETE-Riegels auf user_work_periods...'
    );

    // Step 0: Zieltabelle muss existieren (Migration 008 muss vorher gelaufen sein).
    const tableExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_work_periods'`)
      .get();

    if (!tableExists) {
      throw new Error(
        'Migration 010 fehlgeschlagen: Tabelle user_work_periods existiert nicht. ' +
        'Migration 008 (008_create_user_work_periods) muss zuerst laufen.'
      );
    }

    // Step 1: alten (möglicherweise löchrigen) Trigger entfernen und aus derselben
    // Konstante wie Migration 008 neu erzeugen.
    logger.info('🗑️  Dropping trg_user_work_periods_delete_guard...');
    db.prepare(`DROP TRIGGER IF EXISTS trg_user_work_periods_delete_guard`).run();

    logger.info('📝 Recreating trg_user_work_periods_delete_guard...');
    db.prepare(DELETE_GUARD_TRIGGER_SQL).run();

    // Step 2: Selbstverifikation — die neue Triggerdefinition muss die WR-01-Klausel
    // enthalten, sonst wird die Migration NICHT als angewendet verbucht (Lehre aus
    // Migration 003/007/008/009: eine als erledigt markierte Migration läuft nie wieder an).
    const trigger = db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_user_work_periods_delete_guard'`
      )
      .get() as { sql: string } | undefined;

    if (!trigger) {
      throw new Error(
        'Migration 010 fehlgeschlagen: trg_user_work_periods_delete_guard existiert nach dem ' +
        'DROP/CREATE nicht. Migration wird NICHT als angewendet markiert.'
      );
    }

    if (!trigger.sql.includes('ohne jede Periode')) {
      throw new Error(
        'Migration 010 unvollständig: trg_user_work_periods_delete_guard enthält nicht die ' +
        'erwartete WR-01-Klausel ("ohne jede Periode"). Migration wird NICHT als angewendet ' +
        'markiert.'
      );
    }

    logger.info(
      '✅ Migration 010 verified: trg_user_work_periods_delete_guard trägt den WR-01-Riegel'
    );
  },
};
