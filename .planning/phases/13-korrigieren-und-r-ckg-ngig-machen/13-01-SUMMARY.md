---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, migrations, soft-delete, triggers, overtime-transactions]

# Dependency graph
requires:
  - phase: 10-perioden-fundament
    provides: user_work_periods Tabelle, Trigger, Migration-008-DDL
  - phase: 12-stundenwechsel-bedienen
    provides: overtime_transactions.type='model_change'/referenceType='work_period' (Migration 011/012), overtimeTransactionManager.createTransaction()
provides:
  - "Migration 013: deletedAt/deletedBy auf user_work_periods, deletedAt-bewusste Trigger, aussetzbarer Kettenriegel (work_period_chain_guard)"
  - "Migration 014: reversalOf-Selbstreferenz auf overtime_transactions"
  - "schema.ts in Parität zu beiden Migrationen (frische Installation == migrierte Bestandsdatenbank)"
  - "overtimeTransactionManager.createTransaction() akzeptiert reversalOf"
affects: [13-02, 13-03, 13-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabellen-Neubau mit Zeilenzahlvergleich vor DROP (wortgleich Migration 012) für Constraint-Änderungen, die SQLite nicht per ALTER kann"
    - "Aussetzbarer Trigger-Riegel über eine einzeilige Steuertabelle (work_period_chain_guard), gebunden an eine einzige db.transaction()-Klammer"
    - "schema.ts-Indizes, die von einer noch nicht gelaufenen Migration hinzugefügte Spalten referenzieren, einzeln in try/catch außerhalb des kombinierten db.exec()-Blocks — initializeDatabase() läuft immer vor runMigrations()"

key-files:
  created:
    - server/src/database/migrations/013_soft_delete_user_work_periods.ts
    - server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.ts
    - server/src/database/migrations/013_soft_delete_user_work_periods.test.ts
    - server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.test.ts
  modified:
    - server/src/database/schema.ts
    - server/src/services/overtimeTransactionManager.ts
    - server/src/database/schemaMigrationParity.test.ts

key-decisions:
  - "schemaMigrationParity.test.ts erweitert (migration013.up() zusätzlich zu migration008.up()) und Quoting-Normalisierung ergänzt — ohne das wäre der bestehende Test durch die Tabellen-Neubau-Technik (ALTER TABLE...RENAME TO quotiert den Tabellennamen) neu rot geworden"
  - "Die drei deletedAt-abhängigen Indizes auf user_work_periods und der reversalOf-Index auf overtime_transactions stehen außerhalb des kombinierten db.exec()-Indexblocks, einzeln try/catch-abgesichert — initializeDatabase() läuft vor runMigrations(), auf einer Bestandsdatenbank ohne die neue Spalte würde ein ungeschützter Fehlschlag sonst den gesamten restlichen Indexblock abbrechen"
  - "Migration 013 und 014 gegen die tatsächliche lokale Arbeitsdatenbank server/database/development.db ausgeführt (nicht nur gegen eine Kopie) — Tests laufen projektweit gegen dieselbe development.db (vitest.config.ts), ohne den echten Migrationslauf hätten Bestandstabellen die neuen Spalten nicht getragen und mehrere Tests wären neu rot geworden"

requirements-completed: [REQ-31]

# Metrics
duration: ~55min
completed: 2026-08-22
---

# Phase 13 Plan 01: Datenmodell für Korrigieren/Löschen Summary

**Zwei Migrationen (013, 014) legen das Soft-Delete- und Storno-Fundament: deletedAt/deletedBy plus aussetzbarer Kettenriegel auf user_work_periods, reversalOf-Selbstreferenz auf overtime_transactions — beide gegen die lokale Arbeitsdatenbank ausgeführt und mit Verhaltenstests belegt.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files modified:** 7 (4 neu, 3 geändert)

## Accomplishments

- Migration 013: `user_work_periods` per Tabellen-Neubau um `deletedAt`/`deletedBy` erweitert, `UNIQUE(userId, validFrom)` durch einen partiellen Index (`WHERE deletedAt IS NULL`) ersetzt, alle drei Trigger ignorieren weggenommene Perioden, INSERT-/UPDATE-Riegel über `work_period_chain_guard` innerhalb einer Transaktion aussetzbar, DELETE-Riegel bleibt absolut
- Migration 014: `overtime_transactions.reversalOf` als eindeutiger Paarbezug zwischen Buchung und Gegenbuchung (referenceId bleibt der Bezug zur auslösenden Periode)
- `schema.ts` auf Parität zu beiden Migrationen gebracht — frische Installation und migrierte Bestandsdatenbank erzeugen dasselbe Schema (maschinell nachgewiesen über `schemaMigrationParity.test.ts`)
- `overtimeTransactionManager.createTransaction()` schreibt `reversalOf`, Idempotenzprüfung bewusst unverändert
- Neun neue Verhaltenstests (6 für Migration 013, 3 für Migration 014); Gesamtlauf 427 grün / 3 rot (Baseline 418/3 unverändert)
- Beide Migrationen gegen `server/database/development.db` ausgeführt und gegen eine Kopie noch einmal verifiziert (`integrity_check: ok`, `foreign_key_check` leer, Zeilenbestand unverändert: 30 Perioden, 2721 Buchungen)

## Task Commits

1. **Task 1: Migration 013 — Soft-Delete-Fundament auf user_work_periods, plus Parität in schema.ts** - `54d502f` (feat)
2. **Task 2: Migration 014 — reversalOf auf overtime_transactions, Parität und Schreibweg** - `53e6142` (feat)
3. **Task 3: Migrationstests — Riegelverhalten und Parität nachweisen** - `2183de7` (test)

## Files Created/Modified

- `server/src/database/migrations/013_soft_delete_user_work_periods.ts` - Tabellen-Neubau, work_period_chain_guard, deletedAt-bewusste Trigger
- `server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.ts` - ALTER TABLE ADD COLUMN reversalOf, Teilindex
- `server/src/database/migrations/013_soft_delete_user_work_periods.test.ts` - 6 Verhaltenstests (Soft-Delete, Lückenschluss, Wiedereröffnung, validFrom-Wiederverwendung, Überlappungsschutz, aussetzbarer Riegel)
- `server/src/database/migrations/014_add_reversal_of_to_overtime_transactions.test.ts` - 3 Tests (reversalOf schreiben/lesen, Idempotenz trotz Vorzeichenumkehr, FK-Verletzung)
- `server/src/database/schema.ts` - deletedAt/deletedBy + work_period_chain_guard + 4 Indizes (user_work_periods), reversalOf + Teilindex (overtime_transactions)
- `server/src/services/overtimeTransactionManager.ts` - `TransactionParams.reversalOf`, INSERT-Spaltenliste erweitert
- `server/src/database/schemaMigrationParity.test.ts` - migration013.up() ergänzt, Quoting-Normalisierung für ALTER TABLE...RENAME TO

## Decisions Made

- schemaMigrationParity.test.ts musste erweitert werden (nicht im ursprünglichen files_modified der Planung), da schema.ts sonst mehr Objekte als der reine migration008-Pfad erzeugt hätte — Rule 1 (Bugfix zur Vermeidung einer neuen Testregression)
- Die vier neuen/geänderten Indizes (3× user_work_periods, 1× overtime_transactions) stehen bewusst außerhalb der kombinierten `db.exec()`-Indexblöcke, einzeln in try/catch — empirisch entdeckt beim ersten Testlauf gegen die reale, noch nicht migrierte development.db (Rule 1)
- Migrationen 013/014 wurden direkt gegen `server/database/development.db` ausgeführt (mit vorherigem Backup unter `database/development.db.backup.pre-migration01{3,4}_*`), weil alle Service-/Migrationstests laut `vitest.config.ts` gegen dieselbe Arbeitsdatenbank laufen — ohne den echten Lauf wären Bestandstabellen ohne die neuen Spalten geblieben

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] schemaMigrationParity.test.ts wäre durch die neuen Migrationen regressionsrot geworden**
- **Found during:** Task 1 (nach Vollendung des Codes, vor dem Commit)
- **Issue:** `schema.ts` trägt nach der Parität-Erweiterung mehr Spalten/Indizes als der reine `migration008.up()`-Pfad; der bestehende Test verglich beide Pfade wortgleich und wäre neu rot geworden
- **Fix:** `migration013.up(dbB)` nach `migration008.up(dbB)` ergänzt; zusätzlich `normalizeSql()` um eine Quoting-Normalisierung erweitert, weil SQLite den Tabellennamen nach `ALTER TABLE ... RENAME TO` automatisch in doppelte Anführungszeichen setzt (Migration-Pfad), schema.ts aber unquotiert bleibt (kein RENAME) — rein syntaktischer Unterschied, keine Verhaltensänderung
- **Files modified:** server/src/database/schemaMigrationParity.test.ts
- **Verification:** Test läuft grün, Gegenproben (Leerzeichen-Normalisierung, geänderte Spaltendefinition) bleiben unverändert wirksam
- **Committed in:** 54d502f (Task 1 commit)

**2. [Rule 1 - Bug] Neue deletedAt-/reversalOf-abhängige Indizes hätten den Serverstart auf der Bestandsdatenbank blockiert**
- **Found during:** Task 1/2 (beim ersten Testlauf von workPeriodService.test.ts gegen die reale development.db)
- **Issue:** `initializeDatabase()` läuft bei jedem Start VOR `runMigrations()` (server.ts:212-215). Auf einer Datenbank, die bereits bis Migration 012 lief, existiert `deletedAt` (bzw. später `reversalOf`) zu diesem Zeitpunkt noch nicht — `CREATE TABLE IF NOT EXISTS` ist auf der bestehenden Tabelle ein No-Op, die neuen `CREATE INDEX ... WHERE deletedAt IS NULL`-Anweisungen scheiterten mit `no such column: deletedAt` und rissen dabei den gesamten kombinierten `db.exec()`-Indexblock ab (alle nachfolgenden Indizes, nicht nur die drei neuen)
- **Fix:** Die drei user_work_periods-Indizes und der eine overtime_transactions-Index wurden aus dem kombinierten Block herausgelöst und stehen jetzt in eigenen, einzeln try/catch-abgesicherten `db.exec()`-Aufrufen — schlägt die Erstellung fehl (Spalte fehlt noch), wird gewarnt statt geworfen, und `runMigrations()` holt Spalte+Index kurz danach nach
- **Files modified:** server/src/database/schema.ts
- **Verification:** `npx vitest run` (voller Lauf) zeigt wieder 418/3 (vor Task 3) bzw. 427/3 (nach Task 3) statt kollateraler Fehlschläge in unbeteiligten Testdateien; Migrationslauf gegen die reale development.db erfolgreich
- **Committed in:** 54d502f (Task 1, die drei user_work_periods-Indizes), 53e6142 (Task 2, der reversalOf-Index)

---

**Total deviations:** 2 auto-fixed (beide Rule 1 — Bugfix zur Vermeidung neuer Testregressionen)
**Impact on plan:** Beide Fixes waren notwendig, um die geforderte Nichtregression (höchstens 3 rote Tests) einzuhalten. Kein Scope-Creep — beide Änderungen bleiben innerhalb der von Task 1/2 berührten Dateien (schema.ts, schemaMigrationParity.test.ts).

## Issues Encountered

None über die oben dokumentierten Deviations hinaus.

## User Setup Required

None - keine externen Dienste, keine neuen Abhängigkeiten.

## Next Phase Readiness

- Plan 13-02 (Soft-Delete-Schreibweg) kann auf `deletedAt`/`deletedBy` und den aussetzbaren Kettenriegel aufbauen; die Zusage aus DD-2 (Service muss `checkPeriodChain()` innerhalb derselben `db.transaction()`-Klammer aufrufen, nachdem er den Riegel ausgesetzt hat) ist von diesem Plan noch NICHT eingelöst — das ist Aufgabe von Plan 13-03.
- Plan 13-06 (Kontoauszug-Lesepfad) kann `reversalOf` für den Selbst-Join (reversedBy/reversedAt/reversedByName) verwenden.
- Kein Code-Pfad im Bestand liest oder schreibt `deletedAt`/`deletedBy`/`reversalOf` bisher aktiv (reiner Schema-Plan) — bestehende Lesepfade (`workPeriodService.getWorkPeriods()` etc.) bleiben unverändert unberührt, da sie explizite Spaltenlisten statt `SELECT *` verwenden.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

All created files verified present (013/014 migrations + tests). All three task commit hashes (54d502f, 53e6142, 2183de7) verified present in `git log --oneline --all`.
