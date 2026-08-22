---
phase: 10-perioden-fundament
plan: 02
subsystem: database
tags: [sqlite, better-sqlite3, triggers, migrations, cli, production-guard]

# Dependency graph
requires:
  - phase: 10-perioden-fundament/10-01
    provides: Migration 008 (Tabelle user_work_periods, drei Trigger, partieller UNIQUE-Index)
provides:
  - Verhaltensmatrix der Trigger/Constraints als ausführbarer Test (19 Fälle)
  - productionGuard.ts (assertNotProduction, wiederverwendbar)
  - applyMigrationsToCopy.ts / npm run migrate:copy (CLI für Phase 11 und Phase 14)
  - Protokollierter Migrationslauf gegen eine Kopie mit integrity_check: ok
affects: [10-05, phase-11-datumsabhaengige-berechnung, phase-14-produktionslauf]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-vor-Import: assertNotProduction() synchron auf Modulebene bzw. als erster
      Aufruf in main(), bevor irgendein schreibendes Modul importiert oder new Database()
      aufgerufen wird — Muster aus compareOvertimePaths.ts (Phase 9), jetzt als eigenes
      importsicheres Modul extrahiert"
    - "CLI mit Pflichtargument ohne Fallback auf getDatabasePath() — verhindert den
      Fehlerklasse aus db-stabilisierung-20260818.md"
    - "Vorher/Nachher-Protokoll (Pfad, Größe, Nutzerzahl, Migrationsdiff, integrity_check,
      foreign_key_check) als Repudiation-Schutz (T-10-07)"

key-files:
  created:
    - server/src/database/userWorkPeriods.constraints.test.ts
    - server/src/scripts/productionGuard.ts
    - server/src/scripts/applyMigrationsToCopy.ts
  modified:
    - server/package.json

key-decisions:
  - "Identisches validFrom wirft in der Praxis \"Überlappung\", nicht \"UNIQUE constraint
    failed\" — der BEFORE-INSERT-Trigger läuft vor der Constraint-Prüfung, und zwei am
    selben Tag beginnende halboffene Intervalle überlappen unter D1 immer. Empirisch
    geprüft (siehe unten); Test entsprechend auf /Überlappung/ statt /UNIQUE/ angepasst.
    Der UNIQUE-Index bleibt Verteidigung in der Tiefe: ohne den Insert-Trigger greift bei
    identischem validFrom weiterhin \"UNIQUE constraint failed\"."
  - "Das geforderte Experiment \"Insert-Trigger versuchsweise entfernen\" wurde zweifach
    durchgeführt: (a) als dauerhafte, automatisierte Testgruppe in
    userWorkPeriods.constraints.test.ts, die die Tabelle lokal ohne den Trigger nachbaut
    (Migration 008 selbst bleibt unverändert); (b) zusätzlich einmalig manuell an der
    echten Migrationsdatei (Trigger-Body durch SELECT 1 WHERE 0 ersetzt, vier Tests fielen
    aus, danach per erneuter Bearbeitung zurückgenommen, nicht per git checkout — MD5 vor
    und nach dem Experiment identisch: 4399e80dc81048f2f0a45f7828424d6e)."
  - "Migration 009 aus dem parallel laufenden Plan 10-03 war zum Zeitpunkt des
    Migrationslaufs bereits in server/database/development.db zusammengeführt (der lokale
    Dev-Server wendet neue Migrationen bei jedem Start automatisch an). Die Kopie enthielt
    deshalb bereits 008 und 009 angewendet und user_work_periods mit 20 Zeilen (ein Nutzer
    = eine Periode ab hireDate laut D5) statt 0 — im Plan als erwarteter Fall dokumentiert,
    nicht als Fehlschlag gewertet."
  - "Zusätzlich zum dokumentierten Pflichtlauf wurde eine synthetische Vor-008-Kopie gebaut
    (migrations-Zeilen für 008/009 gelöscht, user_work_periods-Tabelle gedroppt), um zu
    belegen, dass applyMigrationsToCopy.ts tatsächlich neue Migrationen anwendet und nicht
    nur eine bereits vollständige Datenbank bestätigt. Nicht committet (*.db gitignored)."

requirements-completed: [REQ-22, REQ-20]

# Metrics
duration: ~55min
completed: 2026-08-22
---

# Phase 10 Plan 02: Verhaltensmatrix, Produktionsschutz und Migrations-CLI Summary

**Verhaltensmatrix der Trigger/Constraints (19 Tests) belegt maschinell, dass die Datenbank Überlappungen und Lücken abweist (REQ-22, D3); `productionGuard.ts` + `applyMigrationsToCopy.ts` schaffen den bislang fehlenden CLI-Weg für `runMigrations()` und beweisen mit einem Lauf gegen eine `VACUUM INTO`-Kopie von `database/development.db`, dass `integrity_check: ok` liefert.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-22T01:55:00Z (lokale Zeit)
- **Completed:** 2026-08-22T02:10:00Z
- **Tasks:** 2/2
- **Files modified:** 4 (3 neu, 1 geändert)

## Accomplishments

- 19 Tests in `userWorkPeriods.constraints.test.ts` decken die vollständige, im Vorfeld
  zweifach verifizierte Verhaltensmatrix ab: sieben erlaubte Fälle (erste Periode,
  Anschlussperiode, zweistufiger Stichtagswechsel, reines Stunden-UPDATE, DELETE der
  letzten Periode, Kaskaden-DELETE über drei verkettete Perioden, zwei verschiedene Nutzer
  mit überlappenden Perioden) und zehn abgewiesene Fälle (Überlappung, zweite offene
  Periode, Lücke per INSERT, Lücke per UPDATE, mittlere Periode löschen, Nullperiode,
  drei Formatverstöße, identisches validFrom) plus zwei Tests, die das Fehlen des
  Insert-Triggers reproduzieren und dessen Notwendigkeit belegen.
- `productionGuard.ts` zieht `assertNotProduction()` als eigenes, nur `path` und
  `config/database.js` importierendes Modul aus `compareOvertimePaths.ts`, mit optionalem
  Pfad-Parameter für ausdrücklich benannte `--db`-Argumente. Die vier bestehenden
  Phase-9-Werkzeuge bleiben unangetastet.
- `applyMigrationsToCopy.ts` (`npm run migrate:copy`) fährt `runMigrations()` gegen eine
  per Pflichtargument `--db` benannte Kopie, ohne jemals auf `getDatabasePath()`
  zurückzufallen. Guard läuft synchron vor `new Database(...)`. Vor und nach dem Lauf
  werden Pfad, Dateigröße, Nutzerzahl, Migrationsdiff, `integrity_check` und
  `foreign_key_check` ausgegeben (T-10-07).
- Drei protokollierte CLI-Läufe mit den geforderten Exitcodes: kein `--db` → Exit 2,
  Kanarienpfad `/home/ubuntu/databases/production.db` → Exit 2 ohne angelegtes Verzeichnis,
  echter Lauf gegen die Kopie → Exit 0 mit `integrity_check: ok`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Verhaltensmatrix der Trigger und Constraints** - `6bb9a2f` (test)
2. **Task 2: Produktionsschutz-Modul, Migrations-CLI und Lauf gegen eine Kopie** - `d32d3d6` (feat)

_Task 1 hat `tdd="true"` im Frontmatter, ist aber nicht als klassischer RED/GREEN-Zyklus
ausgeführt: Migration 008 (das Produktionsverhalten) lag aus Plan 10-01 bereits fertig vor,
Task 1 schreibt die dazugehörige Verhaltensmatrix nach — alle 19 Tests waren beim ersten
Lauf bereits grün. Das entspricht der Vorgabe im Plankopf ("Du sollst diese Matrix als
ausführbaren Test festschreiben, nicht neu erforschen")._

## Files Created/Modified

- `server/src/database/userWorkPeriods.constraints.test.ts` - 19 Tests, drei describe-
  Gruppen (Erlaubt, Abgewiesen, Insert-Trigger versuchsweise entfernt), Kopfkommentar
  dokumentiert D3/REQ-22 und den Fund zu identischem validFrom
- `server/src/scripts/productionGuard.ts` - `assertNotProduction(explicitPath?)`,
  importsicher (nur `path`, `../config/database.js`)
- `server/src/scripts/applyMigrationsToCopy.ts` - CLI, Pflichtargument `--db`, kein
  Fallback, Guard vor `new Database()`, Vorher/Nachher-Protokoll, `--expect-migration`
- `server/package.json` - Eintrag `"migrate:copy": "tsx src/scripts/applyMigrationsToCopy.ts"`

## Verhaltensmatrix: welcher Riegel bei identischem validFrom greift

Empirisch geprüft am 22.08.2026 gegen `better-sqlite3` (Node v24.14.1, better-sqlite3
^12.4.1), zweimal: einmal mit dem regulären Insert-Trigger, einmal ohne.

**Mit Insert-Trigger (Normalfall):**
```
identical validFrom overlap -> THROW: user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers
second open period -> THROW: user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers
validTo <= validFrom -> THROW: CHECK constraint failed: validTo IS NULL OR validTo > validFrom
format 2026-1-1 -> THROW: CHECK constraint failed: validFrom GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
format 01.01.2026 -> THROW: CHECK constraint failed: validFrom GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
format iso timestamp -> THROW: CHECK constraint failed: validFrom GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
gap via update validFrom forward -> THROW: user_work_periods: Lücke zur bestehenden Periodenkette desselben Nutzers
two different users overlap allowed -> OK (no throw)
update weeklyHours only -> OK (no throw)
```

**Ohne Insert-Trigger (Tabelle lokal ohne `trg_user_work_periods_insert_guard` nachgebaut):**
```
identical validFrom WITHOUT insert trigger -> THROW: UNIQUE constraint failed: user_work_periods.userId, user_work_periods.validFrom
overlap different validFrom WITHOUT insert trigger -> OK (no throw) -- proves trigger is what normally blocks this
```

**Schlussfolgerung:** Der BEFORE-INSERT-Trigger läuft vor der Constraint-Prüfung. Zwei
Perioden desselben Nutzers mit identischem `validFrom` überlappen unter der Definition aus
D1 zwangsläufig (ein Intervall, das an Tag X beginnt, kann nicht existieren, ohne ein
zweites am selben Tag X beginnendes zu überlappen) — deshalb wirft der reguläre Pfad
"Überlappung", nicht "UNIQUE constraint failed". Der `UNIQUE(userId, validFrom)`-Index ist
trotzdem kein Blindgänger: Er ist die Verteidigung in der Tiefe für genau diesen einen Fall,
während echte Überlappungen mit unterschiedlichem `validFrom` ohne den Trigger unbemerkt
durchgingen (siehe zweite Zeile oben — "OK (no throw)" ist der Bruch, den Migration 008
verhindert).

Für "zweite offene Periode" gilt dieselbe Erklärung: Eine zweite offene Periode
(`validTo IS NULL`, also +unendlich) überlappt jede bereits offene Periode desselben
Nutzers zwangsläufig — der Überlappungs-Trigger greift, nicht der partielle
`idx_user_work_periods_one_open`-Index. Entfernt man versuchsweise den Insert-Trigger
(separat geprüft, siehe unten), greift für diesen Fall stattdessen der partielle
UNIQUE-Index mit `UNIQUE constraint failed: user_work_periods.userId`.

## Experiment "Insert-Trigger versuchsweise entfernen" (Task-1-Abnahmekriterium)

Zweifach durchgeführt:

**(a) Dauerhaft als automatisierter Test** in
`userWorkPeriods.constraints.test.ts` — describe-Gruppe "Insert-Trigger versuchsweise
entfernt". Baut `user_work_periods` lokal ohne den Trigger nach (Migration 008 selbst
bleibt unangetastet) und beweist reproduzierbar bei jedem Testlauf, dass (1) eine echte
Überlappung ohne den Trigger unbemerkt durchgeht und (2) der UNIQUE-Index bei identischem
`validFrom` trotzdem greift.

**(b) Einmalig manuell an der echten Migrationsdatei**, wie im Plan gefordert: Der Body von
`trg_user_work_periods_insert_guard` in
`server/src/database/migrations/008_create_user_work_periods.ts` wurde testweise durch
`SELECT 1 WHERE 0;` ersetzt (Trigger existiert weiter, tut aber nichts). Danach
`npx vitest run src/database/userWorkPeriods.constraints.test.ts` erneut ausgeführt:

```
Test Files  1 failed (1)
     Tests  4 failed | 15 passed (19)

FAIL ... > Abgewiesen > weist eine Periode ab, die eine bestehende überlappt
FAIL ... > Abgewiesen > weist eine zweite offene Periode desselben Nutzers ab
  AssertionError: expected [Function] to throw error matching /Überlappung/ but got
  'UNIQUE constraint failed: user_work_p…' ("user_work_periods.userId")
FAIL ... > Abgewiesen > weist eine Periode ab, die eine Lücke zur bestehenden Kette lässt
FAIL ... > Abgewiesen > weist zwei Perioden ... mit identischem validFrom ab
  AssertionError: expected [Function] to throw error matching /Überlappung/ but got
  'UNIQUE constraint failed: user_work_p…' ("user_work_periods.userId, ...validFrom")
```

Vier Tests schlugen fehl — genau die vier, die auf den Insert-Trigger angewiesen sind
(zwei sogar noch fehlerhaft statt richtig, weil der partielle UNIQUE-Index bzw. der
`UNIQUE(userId, validFrom)`-Constraint teilweise als Rückfall greift, aber mit der falschen
Meldung). Die beiden neuen "ohne Trigger"-Tests blieben grün, weil sie genau dieses
Verhalten erwarten. Danach wurde `008_create_user_work_periods.ts` durch erneutes
Bearbeiten (nicht per `git checkout`) auf den ursprünglichen Trigger-Body zurückgesetzt;
MD5-Summe vor und nach dem Experiment identisch: `4399e80dc81048f2f0a45f7828424d6e`. Beide
Test-Suiten (`userWorkPeriods.constraints.test.ts`, `008_create_user_work_periods.test.ts`)
liefen danach wieder 33/33 grün — Nachweis unten unter "Verifikation".

## Vollständige CLI-Ausgaben

### Lauf 1: ohne `--db` (erwartet Exit 2)

```
$ npx tsx src/scripts/applyMigrationsToCopy.ts
FEHLER: --db=<pfad> fehlt.
Nutzung:
  npm run migrate:copy -- --db=<pfad-zu-einer-kopie> [--expect-migration=<name>]

  --db ist Pflicht und fällt NIEMALS auf die Arbeits- oder Produktionsdatenbank zurück.
$ echo $?
2
```

### Lauf 2: Kanarienprobe mit `/home/ubuntu/databases/production.db` (erwartet Exit 2)

```
$ npx tsx src/scripts/applyMigrationsToCopy.ts --db=/home/ubuntu/databases/production.db
FEHLER: Produktionsschreibzugriff verweigert (T-10-04, 10-02-PLAN.md; D5, 09-CONTEXT.md).
  Aufgelöster Datenbankpfad: C:\Program Files\Git\home\ubuntu\databases\production.db
  NODE_ENV: (nicht gesetzt)
  Phase 10 fasst die Produktionsdatenbank ausdrücklich nicht an — der Produktionslauf ist Phase 14.
  Nutze --db=<pfad> mit einer ausdrücklich benannten, lokalen Kopie.
$ echo $?
2
```

Vor und nach diesem Aufruf geprüft: `C:\Program Files\Git\home\ubuntu` und `/home/ubuntu`
existieren auf diesem Rechner nicht — der Guard bricht ab, **bevor** irgendetwas geöffnet
oder ein Verzeichnis angelegt wird (Task-2-Abnahmekriterium, analog zur Kanarienprobe aus
Phase 9 bei `compareOvertimePaths.ts`).

### Lauf 3: gegen `./database/10-02-migrationslauf.db` (VACUUM INTO von
`database/development.db`, Produktionsstand vom 20.08.2026, 20 Nutzer)

```
$ npm run migrate:copy -- --db=./database/10-02-migrationslauf.db --expect-migration=008_create_user_work_periods
=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: <repo>\server\database\10-02-migrationslauf.db
Dateigröße: 1306624 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (12): 004_drop_overtime_unique_index, 005_add_balance_tracking_columns,
  001_backfill_overtime_transactions, 002_extend_transaction_types, 003_add_pending_to_vacation_balance,
  20260208_add_position_column, 20260208_add_time_entry_type.sql, 20260208_add_position_column.sql,
  006_add_time_entry_transaction_type, 007_create_vacation_transactions, 008_create_user_work_periods,
  009_backfill_user_work_periods

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (0): (keine)
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
$ echo $?
0
```

**Abweichung vom im Plankopf genannten Erfolgskriterium "0 Zeilen":** Migration 009 aus dem
parallel laufenden Plan 10-03 war zum Zeitpunkt dieses Laufs bereits in
`server/database/development.db` zusammengeführt — der lokale Dev-Server wendet neue
Migrationsdateien bei jedem Start automatisch an (`server.ts:210`), und seit Plan 10-01
abgeschlossen wurde, lief der Dev-Server mindestens einmal neu. Die Quelle für die Kopie
enthielt deshalb bereits 008 UND 009, `user_work_periods` also 20 Zeilen (ein Nutzer = eine
Periode ab `hireDate`, D5) statt 0. Das ist exakt der im Plan dokumentierte Konditionalfall
("Falls Plan 10-03 bereits zusammengeführt ist und Migration 009 mitläuft, halte das im
SUMMARY fest") — kein Fehlschlag.

### Lauf 4: derselbe Befehl ein zweites Mal (Idempotenz, D7)

```
$ npm run migrate:copy -- --db=./database/10-02-migrationslauf.db --expect-migration=008_create_user_work_periods
=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: <repo>\server\database\10-02-migrationslauf.db
Dateigröße: 1306624 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (12): [identisch zu Lauf 3]

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (0): (keine)
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
$ echo $?
0
```

Zweiter Lauf meldet null neu angewendete Migrationen, wie vom Plan gefordert.

### Zusatzverifikation (nicht im Plan gefordert, aber zur Absicherung durchgeführt): Lauf
gegen eine synthetische Vor-008-Kopie

Weil der reguläre Lauf oben 0 neu angewendete Migrationen zeigte (008/009 bereits vorhanden),
wurde zusätzlich eine synthetische Kopie gebaut (`VACUUM INTO` von
`10-02-migrationslauf.db`, danach `DELETE FROM migrations WHERE name IN
('008_create_user_work_periods', '009_backfill_user_work_periods')` und `DROP TABLE
user_work_periods`), um zu belegen, dass die CLI tatsächlich neue Migrationen anwendet und
nicht nur eine bereits vollständige Datenbank bestätigt:

```
=== applyMigrationsToCopy: vor dem Lauf ===
Nutzerzahl (users): 20
Bereits angewendete Migrationen (10): [ohne 008/009]

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (2): 008_create_user_work_periods, 009_backfill_user_work_periods
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
$ echo $?
0
```

Diese synthetische Datei wurde nach der Verifikation gelöscht (nicht committet, `*.db`
projektweit in `.gitignore`).

## Verifikation

- `cd server && npx tsc --noEmit` — grün, keine Fehler.
- `cd server && npx vitest run src/database/userWorkPeriods.constraints.test.ts` —
  19/19 grün.
- `cd server && npx vitest run src/database/migrations/008_create_user_work_periods.test.ts src/database/userWorkPeriods.constraints.test.ts` —
  33/33 grün (nach Rücknahme des Trigger-Experiments).
- `cd server && npx vitest run` (volle Suite) — 299/302 grün, 3 Fehlschläge, alle drei
  vorbestehend und unverändert gegenüber dem dokumentierten Ausgangsstand (Ausgangsstand
  war 235/238 bei 3 bekannten Fehlschlägen; die Gesamtzahl ist durch die parallel
  gelaufenen Pläne 10-01/10-03/10-04 gestiegen, die Fehlerzahl blieb bei 3):
  - `unifiedOvertimeService.test.ts` → "should respect hire date and not include
    pre-employment months" und "REGRESSION: User hired on 1st of month should calculate
    correctly" (targetHours-Erwartung stimmt nicht mit tatsächlichem Wert überein)
  - `vacationBackfillService.test.ts` → "erkennt einen bereits gelaufenen Backfill"
    (erwartet `false`, erhält `true`)
  Keine der drei Dateien wurde von diesem Plan berührt; keine neue Regression eingeführt.
- `grep -c "connection.js" server/src/scripts/applyMigrationsToCopy.ts` → `0`.
- `grep -n "assertNotProduction" server/src/scripts/applyMigrationsToCopy.ts` zeigt den
  Aufruf in Zeile 116, `new Database(` in Zeile 128 — Guard vor dem ersten
  Datenbankzugriff.
- `grep -c "toThrow" server/src/database/userWorkPeriods.constraints.test.ts` → `19`
  (≥ 8 gefordert).
- `grep -c "development.db"` und `grep -c "connection.js"` in
  `userWorkPeriods.constraints.test.ts` → jeweils `0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testerwartung für "identisches validFrom" an tatsächliches
SQLite-Verhalten angepasst (Trigger vor Constraint)**
- **Found during:** Task 1, erster Testlauf gegen die reale Migration 008.
- **Issue:** Der Plantext beschreibt für zwei Perioden mit identischem `validFrom` einen
  "UNIQUE-Verstoß". Empirisch (siehe oben) wirft die reale Migration in diesem Fall
  "Überlappung", weil der BEFORE-INSERT-Trigger vor der Constraint-Prüfung läuft und zwei
  am selben Tag beginnende halboffene Intervalle unter D1 zwangsläufig überlappen.
- **Fix:** Testassertion auf `/Überlappung/` gesetzt statt `/UNIQUE/`; der Fund
  (Trigger-vor-Constraint, UNIQUE-Index als Verteidigung in der Tiefe) ausführlich im
  Kopfkommentar der Testdatei und in diesem SUMMARY dokumentiert, inklusive des
  Gegenbeweises ohne Insert-Trigger.
- **Files modified:** `server/src/database/userWorkPeriods.constraints.test.ts`
- **Verification:** Test grün; Gegenprobe ohne Insert-Trigger bestätigt `UNIQUE constraint
  failed` als tatsächliche Meldung des unbewachten Pfads.
- **Committed in:** `6bb9a2f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Testerwartung an gemessenes SQLite-Verhalten
angepasst, keine Änderung an Produktionscode/Migration).
**Impact on plan:** Keine Auswirkung auf die Abnahmekriterien — beide Fälle
("zweite offene Periode" und "identisches validFrom") werden weiterhin zuverlässig
abgewiesen; nur die zitierte Fehlermeldung im Test wurde an die real beobachtete
angepasst, mit vollständiger Herleitung dokumentiert.

## Issues Encountered

- `git status` in diesem Repository zeigte während der Ausführung parallel laufende
  Änderungen der Pläne 10-01/10-03/10-04 (ROADMAP.md, STATE.md, 10-03-SUMMARY.md) — gemäß
  Anweisung unberührt gelassen, nur eigene Dateien einzeln gestaged und committet.
- Der reguläre Migrationslauf (Lauf 3/4) zeigte 0 neu angewendete Migrationen, weil
  Migration 009 aus Plan 10-03 bereits über den lokalen Dev-Server in
  `development.db` gelandet war, bevor die Kopie gezogen wurde. Um trotzdem zu belegen,
  dass die CLI tatsächlich neue Migrationen anwendet, wurde zusätzlich eine synthetische
  Vor-008-Kopie gebaut und verifiziert (siehe oben) — nicht committet.

## User Setup Required

None — keine externe Service-Konfiguration erforderlich. `npm run migrate:copy` ist ab
sofort für Phase 11 und Phase 14 nutzbar; `server/database/10-02-migrationslauf.db` bleibt
als Artefakt lokal liegen (gitignored, laut T-10-06 nach Phasenabschluss löschbar).

## Next Phase Readiness

- Die Verhaltensmatrix (REQ-22, D3) ist maschinell belegt und deckt sich mit den bereits
  verifizierten Fällen aus Plan 10-01.
- `migrate:copy` steht als allgemeines, abgesichertes Werkzeug für Phase 11 (Salden-
  Vergleich vor/nach Umbau, D6) und Phase 14 (Produktionslauf) bereit.
- Kein `git push`, kein Deployment ausgeführt.

---
*Phase: 10-perioden-fundament*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle drei referenzierten Dateien (`server/src/database/userWorkPeriods.constraints.test.ts`,
`server/src/scripts/productionGuard.ts`, `server/src/scripts/applyMigrationsToCopy.ts`),
der `migrate:copy`-Skripteintrag in `server/package.json` und beide Commit-Hashes
(`6bb9a2f`, `d32d3d6`) wurden gegen das Dateisystem bzw. `git log --oneline --all`
verifiziert und gefunden. Keine fehlenden Artefakte.
