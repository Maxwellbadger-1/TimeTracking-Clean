/**
 * Migration 009: Backfill user_work_periods (Bestandsüberführung)
 *
 * PROBLEM: Migration 008 legt `user_work_periods` an, aber die Tabelle ist leer. Ohne
 * einen Startzustand hätte Phase 11 für die Vergangenheit nichts aufzulösen — jede
 * datumsabhängige Berechnung bräuchte einen Sonderfall für "keine Periode gefunden".
 *
 * LÖSUNG: Der heutige Stand jedes Nutzers (`weeklyHours`, `workSchedule` aus `users`)
 * wird zu genau EINER offenen Periode ab seinem `hireDate`. Weil die Werte wörtlich aus
 * der aktuellen `users`-Zeile stammen, kann sich rechnerisch nichts verschieben (REQ-21,
 * ROADMAP-Erfolgskriterium 2) — das wird unten in der Selbstverifikation (Schritt 5)
 * maschinell geprüft, nicht nur behauptet.
 *
 * ERSATZDATUM-KETTE (D5): `validFrom = hireDate`, sofern wohlgeformt (`JJJJ-MM-TT`,
 * geprüft per Regex, dieselbe Form wie das GLOB-CHECK der Tabelle aus Migration 008).
 * Fehlt ein brauchbares `hireDate`, greift das früheste `time_entries.date` des Nutzers.
 * Fehlt auch das, greift `FALLBACK_PROJECT_START`. Kein Fall fällt still auf ein frei
 * erfundenes Epoch-Datum zurück — jede Wahl, die nicht `hireDate` ist, wird über
 * `logger.info` einzeln mit
 * `userId`, gewähltem Datum und Grund protokolliert (T-10-10) und landet zusätzlich in
 * der `note`-Spalte der jeweiligen Zeile.
 *
 * ALLE NUTZER, auch die mit `deletedAt` gesetzt oder `status = 'inactive'`: Ihre
 * Zeiteinträge liegen weiterhin in `time_entries` und müssen in Phase 11 auflösbar
 * bleiben (D5, zweiter Absatz). Das ist kein Versehen und darf nicht später als „Bug"
 * korrigiert werden, der Weg über `WHERE deletedAt IS NULL` wäre falsch. Nutzer mit
 * `endDate` in der Vergangenheit bekommen ebenfalls eine Periode; `validTo` bleibt
 * trotzdem `NULL`, weil das Beschäftigungsende bereits über `users.endDate` abgebildet
 * ist und nicht über die Arbeitszeitperiode (D5, dritter Absatz).
 *
 * D4: Diese Migration LIEST `users`, sie ändert `users` nicht. Kein ALTER, kein UPDATE,
 * kein DELETE auf `users` — dadurch bleibt REQ-21 mechanisch garantiert statt nur
 * behauptet, exakt wie schon in Migration 008.
 *
 * D7 (Idempotenz): Vor jedem Insert wird geprüft, ob der Nutzer bereits mindestens eine
 * Periode hat. Ist das der Fall, wird er übersprungen — seine vorhandene Periode bleibt
 * unangetastet. Ein zweiter Lauf dieser Migration erzeugt daher keine zweite Periode.
 * Der partielle UNIQUE-Index aus Migration 008 (höchstens eine offene Periode je Nutzer)
 * ist der zweite, datenbankseitige Riegel dafür (T-10-09).
 *
 * SCOPE: Genau eine Periode je Nutzer. Keine Historie aus vergangenen Stundenänderungen
 * wird rekonstruiert — die ist nirgends aufgezeichnet und wäre erfunden.
 *
 * Kontext: .planning/phases/10-perioden-fundament/10-CONTEXT.md (D1–D7),
 * .planning/phases/10-perioden-fundament/10-03-PLAN.md (verbindlicher Ablauf)
 */

import Database from 'better-sqlite3';
import logger from '../../utils/logger.js';

/**
 * Ersatzdatum letzter Instanz (D5, dritte Stufe). Gemessen am 22.08.2026 gegen
 * `server/database/development.db`: frühester `time_entries.date`-Wert im Bestand ist
 * 2025-07-01, frühestes `hireDate` ist 2025-11-13. Ein Periodenbeginn am 01.01.2025
 * deckt damit jede vorhandene Buchung ab, ohne auf ein frei erfundenes Epoch-Datum
 * zurückzufallen.
 */
export const FALLBACK_PROJECT_START = '2025-01-01';

/** Dieselbe Formprüfung wie das GLOB-CHECK von `user_work_periods.validFrom` (Migration 008). */
const HIRE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ValidFromSource = 'hireDate' | 'earliestTimeEntry' | 'projectStart';

/**
 * Reine Funktion ohne Datenbankzugriff und ohne jede Umwandlung über ein Date-Objekt —
 * löst die Ersatzdatum-Kette aus D5 ausschließlich auf Zeichenketten auf.
 *
 * `hireDate` wird nur akzeptiert, wenn es dem Muster `JJJJ-MM-TT` entspricht. Ein
 * leerer, fehlender oder anders formatierter Wert (z. B. `2026-1-1` oder `01.01.2026`)
 * fällt auf `earliestEntryDate` zurück; ist auch das fehlend oder leer, fällt es auf
 * `FALLBACK_PROJECT_START`. Die zurückgegebene `source` ist die Grundlage des
 * Protokolls, das D5 verlangt.
 */
export function resolveValidFrom(
  hireDate: string | null,
  earliestEntryDate: string | null
): { validFrom: string; source: ValidFromSource } {
  if (hireDate !== null && HIRE_DATE_PATTERN.test(hireDate)) {
    return { validFrom: hireDate, source: 'hireDate' };
  }

  if (earliestEntryDate !== null && earliestEntryDate !== '') {
    return { validFrom: earliestEntryDate, source: 'earliestTimeEntry' };
  }

  return { validFrom: FALLBACK_PROJECT_START, source: 'projectStart' };
}

interface UserRow {
  id: number;
  hireDate: string | null;
  weeklyHours: number | null;
  workSchedule: string | null;
  endDate: string | null;
  status: string | null;
  deletedAt: string | null;
}

export default {
  up(db: Database.Database): void {
    logger.info('🚀 Migration 009: Backfilling user_work_periods (Bestandsüberführung)...');

    // Step 0: Zieltabelle muss existieren (Migration 008 muss vorher gelaufen sein).
    const tableExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_work_periods'`)
      .get();

    if (!tableExists) {
      throw new Error(
        'Migration 009 fehlgeschlagen: Tabelle user_work_periods existiert nicht. ' +
        'Migration 008 (008_create_user_work_periods) muss zuerst laufen.'
      );
    }

    // Step 1: Alle Nutzer laden — ausdrücklich AUCH die mit deletedAt gesetzt oder
    // status='inactive' (D5, zweiter Absatz). Kein WHERE-Filter hier, absichtlich.
    const users = db
      .prepare(`
        SELECT id, hireDate, weeklyHours, workSchedule, endDate, status, deletedAt
        FROM users
        ORDER BY id
      `)
      .all() as UserRow[];

    const findEarliestEntry = db.prepare(
      `SELECT MIN(date) as minDate FROM time_entries WHERE userId = ?`
    );

    const hasExistingPeriod = db.prepare(
      `SELECT 1 FROM user_work_periods WHERE userId = ? LIMIT 1`
    );

    const insertPeriod = db.prepare(`
      INSERT INTO user_work_periods
        (userId, validFrom, validTo, weeklyHours, workSchedule, note, createdAt, createdBy)
      VALUES
        (?, ?, NULL, ?, ?, ?, datetime('now'), NULL)
    `);

    let insertedCount = 0;
    let skippedCount = 0;
    const fallbackChoices: Array<{ userId: number; validFrom: string; source: ValidFromSource }> = [];

    for (const user of users) {
      // Step 2 (D7): bereits vorhandene Periode -> überspringen, unangetastet lassen.
      if (hasExistingPeriod.get(user.id)) {
        skippedCount += 1;
        continue;
      }

      // Step 3: weeklyHours ist Pflicht — ein geratener Standardwert wäre eine stille
      // Datenänderung, deshalb wirft die Migration statt zu raten.
      if (user.weeklyHours === null || user.weeklyHours === undefined) {
        throw new Error(
          `Migration 009 fehlgeschlagen: users.weeklyHours ist NULL für userId ${user.id}. ` +
          'Migration wird NICHT als angewendet markiert.'
        );
      }

      // Step 4: Ersatzdatum nur bei Bedarf ermitteln — die Abfrage auf time_entries
      // entfällt, wenn hireDate bereits wohlgeformt ist.
      let earliestEntryDate: string | null = null;
      if (!(user.hireDate !== null && HIRE_DATE_PATTERN.test(user.hireDate))) {
        const row = findEarliestEntry.get(user.id) as { minDate: string | null };
        earliestEntryDate = row.minDate;
      }

      const { validFrom, source } = resolveValidFrom(user.hireDate, earliestEntryDate);

      if (source !== 'hireDate') {
        fallbackChoices.push({ userId: user.id, validFrom, source });
      }

      // Step 5: Einfügen mit EINER Anweisung, die weeklyHours und workSchedule
      // gemeinsam aus derselben users-Zeile schreibt (D2). workSchedule wird als
      // Zeichenkette unverändert übernommen, nicht geparst und neu serialisiert.
      insertPeriod.run(
        user.id,
        validFrom,
        user.weeklyHours,
        user.workSchedule,
        `[MIGRATION-009] Bestandsüberführung, Quelle: ${source}`
      );
      insertedCount += 1;
    }

    // Step 6: Selbstverifikation — jeweils throw bei Abweichung, damit der
    // migrationRunner die Migration NICHT als angewendet bucht (Lehre aus Migration 003).
    const usersWithoutPeriod = (
      db.prepare(`
        SELECT COUNT(*) as count FROM users u
        WHERE NOT EXISTS (SELECT 1 FROM user_work_periods p WHERE p.userId = u.id)
      `).get() as { count: number }
    ).count;

    if (usersWithoutPeriod > 0) {
      throw new Error(
        `Migration 009 unvollständig: ${usersWithoutPeriod} Nutzer ohne Periode nach dem ` +
        'Lauf. Migration wird NICHT als angewendet markiert.'
      );
    }

    const usersWithMultiplePeriods = (
      db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT userId FROM user_work_periods GROUP BY userId HAVING COUNT(*) > 1
        )
      `).get() as { count: number }
    ).count;

    if (usersWithMultiplePeriods > 0) {
      throw new Error(
        `Migration 009 unvollständig: ${usersWithMultiplePeriods} Nutzer mit mehr als ` +
        'einer Periode nach dem Lauf. Migration wird NICHT als angewendet markiert.'
      );
    }

    // Erfolgskriterium 2 der ROADMAP, maschinell geprüft: jede Periode entspricht exakt
    // der aktuellen users-Zeile (weeklyHours gleich, workSchedule zeichengleich per
    // IS-Vergleich, damit NULL gegen NULL gleich ist, validTo ist NULL).
    const mismatchCount = (
      db.prepare(`
        SELECT COUNT(*) as count
        FROM users u
        JOIN user_work_periods p ON p.userId = u.id
        WHERE p.weeklyHours <> u.weeklyHours
           OR p.workSchedule IS NOT u.workSchedule
           OR p.validTo IS NOT NULL
      `).get() as { count: number }
    ).count;

    if (mismatchCount > 0) {
      throw new Error(
        `Migration 009 unvollständig: ${mismatchCount} Periode(n) weichen von den ` +
        'aktuellen users-Werten ab (weeklyHours, workSchedule oder validTo). ' +
        'Migration wird NICHT als angewendet markiert.'
      );
    }

    // Step 7: Protokoll (D5, T-10-10) — jede Zeile mit source !== 'hireDate' einzeln.
    for (const choice of fallbackChoices) {
      logger.info(
        { userId: choice.userId, validFrom: choice.validFrom, source: choice.source },
        `ℹ️ Migration 009: Ersatzdatum verwendet für userId ${choice.userId} (Quelle: ${choice.source})`
      );
    }

    logger.info(
      { inserted: insertedCount, skipped: skippedCount, fallbacks: fallbackChoices.length },
      `✅ Migration 009 verified: ${insertedCount} Periode(n) eingefügt, ${skippedCount} ` +
      'Nutzer bereits versorgt übersprungen, users unangetastet'
    );
  },
};
