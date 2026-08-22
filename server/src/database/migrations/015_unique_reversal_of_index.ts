/**
 * Migration 015 — `idx_overtime_transactions_reversal_of` wird EINDEUTIG.
 *
 * WR-11 (Code-Review Phase 13): Der Kontoauszug verbindet eine Originalbuchung mit ihrer
 * Gegenbuchung über einen Selbst-Join
 * (`LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id`,
 * `overtimeLiveCalculationService.ts`). Dieser Join ist 1:n. Die Datenbank erzwang bislang
 * nirgends, dass höchstens EINE Zeile auf dieselbe Originalzeile zeigt: Migration 014 legte
 * `idx_overtime_transactions_reversal_of` als NICHT eindeutigen Teilindex an, `schema.ts`
 * genauso. Die einzige Absicherung war Anwendungslogik (die NOT-EXISTS-Unterabfrage in
 * `workPeriodDeletionService.ts`).
 *
 * Kommt jemals eine zweite Gegenbuchung zustande (Reparaturskript, manueller Eingriff,
 * künftiger Aufrufer), zeigt der Kontoauszug die Originalzeile DOPPELT, jeweils mit anderem
 * `reversedBy` — und ihr `documentedDelta` wird dem Leser zweimal präsentiert. Mit dem
 * eindeutigen Teilindex trägt die Datenbank die Invariante, nicht mehr die Aufrufreihenfolge.
 *
 * WARUM EINE EIGENE MIGRATION UND NICHT NUR EINE ÄNDERUNG AN 014: Auf jeder Datenbank, auf
 * der 014 bereits gelaufen ist, ist sie als angewendet vermerkt und läuft nie wieder. Ein
 * `CREATE UNIQUE INDEX IF NOT EXISTS` mit demselben Namen wäre dort ein stiller No-Op (das
 * `IF NOT EXISTS` prüft den NAMEN, nicht die Eindeutigkeit). Der Index muss deshalb
 * ausdrücklich verworfen und neu angelegt werden. Migration 014 und `schema.ts` legen ihn
 * für neue Datenbanken bereits eindeutig an — diese Migration ist dort ein folgenloser
 * Neuaufbau desselben Objekts.
 *
 * VORSICHT BEI BESTANDSDATEN: Existieren bereits zwei Gegenbuchungen auf dieselbe
 * Originalzeile, kann der eindeutige Index nicht angelegt werden. Dieser Fall wird VORHER
 * erhoben und mit einer sprechenden Meldung geworfen — die Migration gilt dann als nicht
 * angewendet, der alte (nicht eindeutige) Index bleibt bestehen, und niemand hat still eine
 * halbe Änderung im Bestand.
 *
 * Kontext: .planning/phases/13-korrigieren-und-r-ckg-ngig-machen/13-REVIEW.md (WR-11)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

const INDEX_NAME = 'idx_overtime_transactions_reversal_of';

export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 015: idx_overtime_transactions_reversal_of eindeutig machen (WR-11)...');

    const columns = db
      .prepare(`PRAGMA table_info(overtime_transactions)`)
      .all() as Array<{ name: string }>;

    if (!columns.some((c) => c.name === 'reversalOf')) {
      // Kann nur auftreten, wenn 014 nicht gelaufen ist. Dann gibt es auch nichts zu
      // verschärfen — 014 legt den Index bereits eindeutig an.
      logger.info('✅ Migration 015: Spalte reversalOf fehlt (Migration 014 offen) — folgenlos übersprungen');
      return;
    }

    // 1. Bestandsprüfung VOR dem Umbau: mehr als eine Gegenbuchung auf dieselbe Originalzeile.
    const duplicates = db
      .prepare(
        `SELECT reversalOf, COUNT(*) AS anzahl
         FROM overtime_transactions
         WHERE reversalOf IS NOT NULL
         GROUP BY reversalOf
         HAVING COUNT(*) > 1
         ORDER BY reversalOf ASC`
      )
      .all() as Array<{ reversalOf: number; anzahl: number }>;

    if (duplicates.length > 0) {
      const details = duplicates
        .map((row) => `Originalbuchung ${row.reversalOf}: ${row.anzahl} Gegenbuchungen`)
        .join('; ');
      throw new Error(
        `Migration 015 abgebrochen: Es existieren bereits mehrfache Gegenbuchungen auf dieselbe ` +
        `Originalbuchung (${details}). Der eindeutige Teilindex kann deshalb nicht angelegt ` +
        `werden. Die Doppelungen müssen zuerst fachlich bereinigt werden. Migration wird NICHT ` +
        `als angewendet markiert; der bisherige Index bleibt unverändert bestehen.`
      );
    }

    // 2. Umbau. DROP + CREATE UNIQUE, weil IF NOT EXISTS nur den Namen prüft.
    db.prepare(`DROP INDEX IF EXISTS ${INDEX_NAME}`).run();
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME}
      ON overtime_transactions(reversalOf) WHERE reversalOf IS NOT NULL
    `).run();

    // 3. Selbstverifikation (Muster Migration 010/013/014): schlägt sie fehl, wird geworfen —
    //    die Migration gilt dann als nicht angewendet.
    const index = db
      .prepare(`SELECT name, sql FROM sqlite_master WHERE type='index' AND name = ?`)
      .get(INDEX_NAME) as { name: string; sql: string | null } | undefined;

    if (!index) {
      throw new Error(
        `Migration 015 unvollständig: ${INDEX_NAME} wurde nicht angelegt. Migration wird NICHT ` +
        `als angewendet markiert.`
      );
    }
    if (!index.sql || !/CREATE\s+UNIQUE\s+INDEX/i.test(index.sql)) {
      throw new Error(
        `Migration 015 unvollständig: ${INDEX_NAME} ist nicht eindeutig (${index.sql ?? 'kein SQL'}). ` +
        `Migration wird NICHT als angewendet markiert.`
      );
    }

    logger.info('✅ Migration 015 verified: idx_overtime_transactions_reversal_of ist eindeutig');
  },
};
