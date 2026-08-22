---
phase: 10-perioden-fundament
plan: 06
subsystem: database
tags: [sqlite, better-sqlite3, migrations, triggers, vitest, typescript]

requires:
  - phase: 10-perioden-fundament (10-01 bis 10-05)
    provides: user_work_periods-Tabelle, Migrationen 008/009, Service-Schicht, Nullwirkungs-Nachweis
provides:
  - migrationRunner.ts mit korrekter Fehlerpropagierung (CR-01 geschlossen)
  - DELETE-Riegel gegen das Leerlaufen der Periodenkette (WR-01 geschlossen), nachgerüstet über Migration 010
  - typisierter snapshotBalances.ts ohne any (WR-02 geschlossen)
  - automatisierte Tests für assertNotProduction() (WR-03 geschlossen)
affects: [11-datumsabh-ngige-berechnung, 13-korrigieren-und-r-ckg-ngig-machen, 14-absicherung-und-auslieferung]

tech-stack:
  added: []
  patterns:
    - "Migration.up: void | Promise<void> (ehrlicher Vertrag statt behauptetem void)"
    - "applyMigration(): zwei ausdrücklich getrennte Ausführungspfade nach migration.up.constructor.name === 'AsyncFunction', synchroner Regelfall in db.transaction(), async-Ausnahme (nur 001) außerhalb jeder Transaktion mit logger.warn"
    - "Gemeinsam genutzte Trigger-SQL als exportierte Konstante (DELETE_GUARD_TRIGGER_SQL), Nachrüstmigrationen importieren statt zu kopieren"

key-files:
  created:
    - server/src/database/migrationRunner.failure.test.ts
    - server/src/database/migrations/010_fix_user_work_periods_delete_guard.ts
    - server/src/scripts/productionGuard.test.ts
    - .planning/phases/10-perioden-fundament/10-NACHWEIS-RUNNER-FIX.md
  modified:
    - server/src/database/migrationRunner.ts
    - server/src/database/migrations/002_extend_transaction_types.ts
    - server/src/database/migrations/003_add_pending_to_vacation_balance.ts
    - server/src/database/migrations/006_add_time_entry_transaction_type.ts
    - server/src/database/migrations/007_create_vacation_transactions.ts
    - server/src/database/migrations/008_create_user_work_periods.ts
    - server/src/database/migrations/009_backfill_user_work_periods.ts
    - server/src/database/migrations/008_create_user_work_periods.test.ts
    - server/src/database/migrations/009_backfill_user_work_periods.test.ts
    - server/src/database/schema.ts
    - server/src/database/userWorkPeriods.constraints.test.ts
    - server/src/scripts/snapshotBalances.ts

key-decisions:
  - "Migration 001 bleibt bewusst async — sie enthält das einzige echte await (ensureDailyOvertimeTransactions lädt Feiertage per Netzabruf) und läuft auf jedem Erststart (db:reset, neues Dev-Setup, per pkg gebauter Desktop-Server). Ein pauschales Abweisen von async up() hätte diesen Pfad zerstört."
  - "applyMigration() bekommt zwei Pfade statt eines universellen await-Fixes: der async-Pfad für 001 bekommt korrekte Fehlerpropagierung (recordMigration läuft nie vor up()), aber ausdrücklich KEINE Atomaritätszusage — ein manuelles BEGIN/COMMIT um das await hielte eine Schreibsperre über einen Netzabruf offen."
  - "Migration 010 statt reiner Änderung an 008: 008 ist auf development.db und lokalen Kopien bereits verbucht und läuft dort nie erneut. DROP TRIGGER IF EXISTS + Neuerstellung aus derselben DELETE_GUARD_TRIGGER_SQL-Konstante, die 008 selbst nutzt — eine SQL-Quelle, keine dritte Kopie."
  - "Phase-13-Abstimmung (WR-01): der DELETE-Riegel verweigert nur das Leerlaufen auf null Perioden, nicht das Löschen der ersten von mehreren Perioden — das bleibt laut 13-CONTEXT.md D3 Sache der Ersetzungslogik in Phase 13."

patterns-established:
  - "Bei async-Funktionen, die synchron in db.transaction() eingebettet werden: throw wird zur rejected Promise, nicht zum synchronen Wurf — jeder künftige migrationRunner-ähnliche Wrapper muss das up()-Ergebnis awaiten oder up() synchron erzwingen."

requirements-completed: [REQ-20, REQ-21, REQ-22]

duration: ~30min
completed: 2026-08-22
---

# Phase 10 Plan 06: Lückenschluss Summary

**migrationRunner propagiert Migrationsfehler jetzt korrekt (CR-01), ein DELETE-Riegel verweigert das Leerlaufen der Periodenkette (WR-01, nachgerüstet über Migration 010), snapshotBalances.ts ist frei von `any` (WR-02), und `assertNotProduction()` hat vier automatisierte Testfälle (WR-03).**

## Performance

- **Duration:** ~30 min (Recherche + vier Tasks)
- **Started:** 2026-08-22T06:45:07+02:00 (erster Commit)
- **Completed:** 2026-08-22T06:54:26+02:00 (letzter Commit)
- **Tasks:** 4/4
- **Files modified:** 16 (4 neu, 12 geändert)

## Accomplishments

- **CR-01 (Blocker) geschlossen:** Der Fehlerpfad-Nachweis war zuerst nachweislich ROT gegen
  den unveränderten Läufer (siehe Abschnitt „ROT-Nachweis" unten) — genau der in
  `10-REVIEW.md` beschriebene Fehler (`recordMigration` läuft trotz Wurf einer async-Migration).
  Nach dem Fix propagiert `applyMigration()` einen Wurf in beiden Pfaden korrekt, bevor
  `recordMigration` erreicht wird.
- **WR-01 geschlossen und über Migration 010 auf bereits migrierten Datenbanken nachgerüstet** —
  belegt gegen eine echte Kopie mit vorbestehenden 008/009-Daten (`10-NACHWEIS-RUNNER-FIX.md`
  Schritt 4): der alte Trigger ließ das Löschen der letzten Periode zu, der neue verweigert es
  mit der wörtlichen Meldung „ohne jede Periode".
- **WR-02 und WR-03 geschlossen:** kein `any` mehr in `snapshotBalances.ts`,
  `assertNotProduction()` hat vier unabhängige Testfälle (drei Auslöser + Gegenprobe).
- **Ende-zu-Ende-Nachweis gegen eine Kopie, die exakt die Phase-14-Produktionsausgangslage
  abbildet** (Migrationen 001–007, weder 008 noch 009) — nicht nur gegen Testfixtures.

## Task Commits

1. **Task 1 (RED): Fehlerpfad-Nachweis für CR-01** - `650ac7d` (test)
2. **Task 1 (GREEN): migrationRunner repariert** - `fff1fe7` (feat)
3. **Task 2: WR-01 — DELETE-Riegel gegen das Leerlaufen** - `5ef2acf` (fix)
4. **Task 3: WR-02/WR-03 — any entfernt, Produktionsschutz getestet** - `bab728f` (fix)
5. **Task 4: Nachweis gegen frische Kopie** - `482ea77` (docs)

_Task 1 war als TDD-Task markiert: RED-Commit (Extraktion von `applyMigration`/
`ensureMigrationsTable`, noch ohne Fix, plus die fünf Testfälle) gefolgt von GREEN-Commit
(Zwei-Pfad-Fix, sechs Migrationen synchron gemacht, drei Testaufrufstellen angepasst)._

## ROT-Nachweis (Task 1, Pflichtangabe laut Plan)

Der Fehlerpfad-Test wurde zuerst gegen den unveränderten Läufer (nach der reinen, noch
unfixierten Extraktion von `applyMigration`) ausgeführt. Wörtliche Ausgabe:

```
$ cd server && npx vitest run src/database/migrationRunner.failure.test.ts

 ❯ src/database/migrationRunner.failure.test.ts (5 tests | 1 failed) 37ms
   ✓ synchron: eine werfende Migration wird NICHT verbucht, ihr Schreibvorgang wird zurückgerollt 12ms
   × async: eine werfende Migration wird NICHT verbucht (kein Rollback-Anspruch für den async-Pfad, siehe Objective) 7ms
   ✓ synchron: Erfolgsfall wird verbucht, Schreibvorgang vorhanden 5ms
   ✓ async: Erfolgsfall wird verbucht, Schreibvorgang vorhanden 5ms
   ✓ Gegenprobe: doppeltes Verbuchen desselben Namens scheitert am UNIQUE der migrations-Tabelle 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

FAIL src/database/migrationRunner.failure.test.ts > migrationRunner: Fehlerpfad-Nachweis (CR-01, 10-REVIEW.md) > async: eine werfende Migration wird NICHT verbucht (kein Rollback-Anspruch für den async-Pfad, siehe Objective)
AssertionError: promise resolved "undefined" instead of rejecting

- Expected:
Error {
  "message": "rejected promise",
}

+ Received:
undefined

 ❯ src/database/migrationRunner.failure.test.ts:83:47

⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

Vitest caught 1 unhandled error during the test run.

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: absichtlicher Fehler (async)
 ❯ Object.up src/database/migrationRunner.failure.test.ts:79:15
 ❯ src/database/migrationRunner.ts:83:15
 ❯ sqliteTransaction ../node_modules/better-sqlite3/lib/methods/transaction.js:65:24
 ❯ applyMigration src/database/migrationRunner.ts:87:3
 ❯ src/database/migrationRunner.failure.test.ts:83:18

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
     Errors  1 error
```

Das ist exakt der in `10-REVIEW.md` (CR-01) reproduzierte Mechanismus: `migration.up(db)`
(async, wirft nach einem INSERT) gibt eine rejected Promise zurück, die vom umschließenden
`db.transaction()`-Callback nie awaitet wird. Die Transaktion committet trotzdem — die
Erwartung „`applyMigration` lehnt ab" schlägt fehl, weil die zurückgegebene Promise tatsächlich
auflöst, und der Wurf taucht nur als unbeobachtete „Unhandled Rejection" auf. Nach dem GREEN-Fix
(Commit `fff1fe7`) hält derselbe Test grün — alle 39 Tests der vier Verifikationsdateien aus
Task 1 laufen durch.

## Begründung: Migration 001 bleibt async, kein pauschales Abweisen von `async up()`

Migration 001 (`001_backfill_overtime_transactions.ts:77`) ruft
`await ensureDailyOvertimeTransactions(...)` auf — eine echte asynchrone Operation
(`overtimeService.ts:802` lädt über `ensureYearCoverage` Feiertage per Netzabruf nach). Diese
Migration läuft auf jeder frischen Datenbank: `npm run db:reset`, ein neues Entwickler-Setup
und, entscheidend, der per `pkg` gebaute Desktop-Server bei seinem Erststart mit leerer
Datenbank. Ein hartes `throw` bei jeder `AsyncFunction` hätte diesen Erststart-Pfad zerstört.

Stattdessen bekommt `applyMigration()` zwei ausdrücklich getrennte Pfade
(`migrationRunner.ts:81-124`): der synchrone Regelfall (alle Migrationen außer 001) bleibt in
`db.transaction()`, propagiert einen Wurf jetzt korrekt synchron und rollt zurück. Der
async-Pfad (nur 001) awaitet `migration.up(db)` außerhalb jeder Transaktion — bewusst ohne
manuelles `BEGIN`/`COMMIT` darum, weil das eine Schreibsperre über den Feiertags-Netzabruf
offen hielte. Ein Fehlschlag verbucht die Migration nicht, sie läuft beim nächsten Start
erneut; Migration 001 ist laut eigenem Kopfkommentar idempotent, das trägt diesen fehlenden
Atomaritätsanspruch. `logger.warn` macht das beim Lauf sichtbar.

## Übergabepunkt an Phase 13: Löschen der ersten von mehreren Perioden

Der neue DELETE-Riegel (Migration 008/010, `DELETE_GUARD_TRIGGER_SQL`) verweigert das
Löschen der **letzten verbleibenden** Periode eines noch existierenden Nutzers — unabhängig
davon, ob sie offen oder geschlossen ist. Er verweigert **nicht** das Löschen der **ersten von
mehreren** Perioden eines Nutzers (bei zwei oder mehr Perioden bleibt die erste weiterhin
löschbar, solange danach mindestens eine übrig bleibt). Das ist bewusst so belassen:
`13-CONTEXT.md` D3 verlangt für genau diesen Fall eine Ersetzungslogik (die Vorperiode schließt
die entstehende Lücke), die dieser Plan nicht vorwegnehmen soll — Phase 13 bringt sie mit. Der
Testblock in `userWorkPeriods.constraints.test.ts` hält diesen offenen Fall per Kommentar fest.

## Files Created/Modified

- `server/src/database/migrationRunner.ts` - `applyMigration()` exportiert, zwei Pfade (sync/async), ehrlicher `Migration.up`-Vertrag
- `server/src/database/migrationRunner.failure.test.ts` - fünf Testfälle, RED-Beleg für CR-01
- `server/src/database/migrations/002_extend_transaction_types.ts` - `async up` → `up(): void`
- `server/src/database/migrations/003_add_pending_to_vacation_balance.ts` - `async up` → `up(): void`
- `server/src/database/migrations/006_add_time_entry_transaction_type.ts` - `async up` → `up(): void`
- `server/src/database/migrations/007_create_vacation_transactions.ts` - `async up` → `up(): void`
- `server/src/database/migrations/008_create_user_work_periods.ts` - `async up` → `up(): void`; `DELETE_GUARD_TRIGGER_SQL` als exportierte Konstante mit zweiter RAISE-Klausel (WR-01)
- `server/src/database/migrations/009_backfill_user_work_periods.ts` - `async up` → `up(): void`
- `server/src/database/migrations/008_create_user_work_periods.test.ts` - `.resolves` → synchrones `expect(() => ...)`
- `server/src/database/migrations/009_backfill_user_work_periods.test.ts` - `.resolves`/`.rejects` → synchrone `expect(() => ...)`
- `server/src/database/migrations/010_fix_user_work_periods_delete_guard.ts` (neu) - DROP+CREATE des Triggers aus `DELETE_GUARD_TRIGGER_SQL`, Selbstverifikation
- `server/src/database/schema.ts` - DELETE-Trigger-Spiegel mit derselben WR-01-Klausel
- `server/src/database/userWorkPeriods.constraints.test.ts` - Erlaubt-Fall umgekehrt zu Abgewiesen, zwei neue Fälle, Kommentar zu Phase-13-Übergabe
- `server/src/scripts/snapshotBalances.ts` - `collectUser()` typisiert (`import type`), kein `any` mehr
- `server/src/scripts/productionGuard.test.ts` (neu) - vier Testfälle für `assertNotProduction()`
- `.planning/phases/10-perioden-fundament/10-NACHWEIS-RUNNER-FIX.md` (neu) - Nachweis gegen echte Daten

## Decisions Made

Siehe `key-decisions` in der Frontmatter — vier Entscheidungen, alle inhaltlich im Plan
vorgezeichnet (Zwei-Pfad-Lösung, Migration 010 statt reiner 008-Änderung, Phase-13-Abstimmung).
Keine davon wich vom Plan ab.

## Deviations from Plan

None - plan exakt wie geschrieben ausgeführt. Alle Aktionen, Abnahmekriterien und die im Plan
vorgegebene Zwei-Pfad-Begründung wurden wörtlich umgesetzt.

## Beobachtung ohne Handlungsbedarf (kein Fund dieses Plans)

Während Task 4 wurde beobachtet, dass `loadMigrations()` beim dynamischen Import von
`001_backfill_overtime_transactions.ts` transitiv `overtimeService.js` → `connection.js` lädt,
was `server/database/development.db` öffnet und `initializeDatabase()` darauf ausführt
(sichtbar an zusätzlichen Log-Zeilen während `npm run migrate:copy`). Das ist seit Migration
001 (Milestone v2.0) so, nicht durch diesen Plan verändert (Migration 001 blieb unangetastet,
siehe Abnahmekriterium `grep -c "await"` unverändert), und folgenlos, weil
`initializeDatabase()` ausschließlich `CREATE ... IF NOT EXISTS` verwendet. Außerhalb des
Scopes dieses Plans (Rule: nur Befunde, die direkt durch die eigenen Änderungen verursacht
werden, sind auto-fixbar) — dokumentiert in `10-NACHWEIS-RUNNER-FIX.md`, Schritt 2, für künftige
Phasen (insbesondere Phase 14).

## Issues Encountered

None.

## User Setup Required

None - keine externe Service-Konfiguration nötig.

## Next Phase Readiness

- Alle vier Befunde aus `10-REVIEW.md` (CR-01, WR-01, WR-02, WR-03) geschlossen und einzeln
  nachgewiesen (Test, Migration, Ende-zu-Ende-Lauf gegen echte Daten).
- Phase 14 kann sich jetzt auf die in Migration 008/009 zugesicherte Selbstverifikation
  verlassen — sie greift nachweislich über den echten Serverstart-Pfad, nicht nur im Test.
- Phase 13 hat einen dokumentierten Übergabepunkt: Löschen der ersten von mehreren Perioden
  bleibt datenbankseitig erlaubt, braucht dort die Ersetzungslogik aus D3.
- Keine offenen Blocker für Phase 10 insgesamt.

---
*Phase: 10-perioden-fundament*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle acht referenzierten Dateien (vier neu, vier geändert/zentral) gefunden; alle fünf
Task-Commit-Hashes (`650ac7d`, `fff1fe7`, `5ef2acf`, `bab728f`, `482ea77`) im Repository
verifiziert.
