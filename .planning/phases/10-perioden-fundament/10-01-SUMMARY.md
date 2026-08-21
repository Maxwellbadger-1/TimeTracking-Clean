---
phase: 10-perioden-fundament
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, migrations, triggers, typescript]

# Dependency graph
requires:
  - phase: 09-ein-ma-stab-ein-weg
    provides: einen konsolidierten, geprüften Überstunden-Rechenweg als stabile Basis
provides:
  - Tabelle user_work_periods (Migration 008) mit halboffenem Gültigkeitsintervall
  - Zwei Indizes (idx_user_work_periods_user_from, partieller UNIQUE-Index idx_user_work_periods_one_open)
  - Drei Trigger (insert/update/delete guard) gegen Überlappung und Lücke
  - Spiegel der DDL in schema.ts, maschinell abgesichert durch schemaMigrationParity.test.ts
  - Typen UserWorkPeriod und UserWorkPeriodRow in server/src/types/index.ts
affects: [10-02, 10-03, 10-04, 10-05, phase-11-datumsabhaengige-berechnung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration mit Selbstverifikation (PRAGMA table_info/index_list, sqlite_master) und throw statt stillem Erfolg — Fortsetzung des seit Migration 007 etablierten Musters"
    - "schema.ts-Block mit 'MUSS identisch bleiben mit migrations/...'-Warnkommentar, jetzt zusätzlich durch einen Gleichheitstest statt nur einem Kommentar abgesichert"
    - "Halboffene Intervalle [validFrom, validTo) mit GLOB-Formatprüfung statt SQL-Datumsfunktionen gegen die Zeitzonenfalle aus Phase 9"

key-files:
  created:
    - server/src/database/migrations/008_create_user_work_periods.ts
    - server/src/database/migrations/008_create_user_work_periods.test.ts
    - server/src/database/schemaMigrationParity.test.ts
  modified:
    - server/src/database/schema.ts
    - server/src/types/index.ts

key-decisions:
  - "DDL wörtlich aus dem im Plan verankerten <ddl_contract> übernommen, ohne eigene Änderungen"
  - "PRAGMA index_list(user_work_periods) liefert 3 Einträge (2 benannte Indizes + 1 von SQLite automatisch angelegter Index für UNIQUE(userId, validFrom)) — Tests prüfen auf die benannten Indizes, nicht auf eine feste Gesamtzahl"
  - "schemaMigrationParity.test.ts nutzt Dateien in os.tmpdir(), nicht :memory: — initializeDatabase() erzwingt WAL-Modus und wirft bei einer Speicherdatenbank"

patterns-established:
  - "Gleichheitstest schema.ts <-> Migration per normalisiertem sqlite_master-Vergleich statt reinem Kommentar-Vertrauen"

requirements-completed: [REQ-20, REQ-22]

# Metrics
duration: 45min
completed: 2026-08-22
---

# Phase 10 Plan 01: Migration 008 — Tabelle user_work_periods Summary

**Tabelle `user_work_periods` mit halboffenem Gültigkeitsintervall, Überlappungs-/Lücken-Triggern und partiellem UNIQUE-Index gegen zwei offene Perioden; schema.ts-Spiegel maschinell gegen die Migration abgesichert — `users.weeklyHours`/`users.workSchedule` mechanisch unangetastet.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-22T01:40:00Z (lokale Zeit; UTC-Äquivalent siehe Commits)
- **Completed:** 2026-08-22T01:49:00Z
- **Tasks:** 2/2
- **Files modified:** 5 (2 neu in Task 1, 1 neu + 2 geändert in Task 2)

## Accomplishments
- Migration 008 legt `user_work_periods` mit allen neun Spalten, zwei Indizes und drei
  Triggern an, verifiziert ihr eigenes Ergebnis (analog Migration 007) und ist zweimal
  ausführbar (D7) — 14 eigene Tests decken alle im `<ddl_contract>` bereits durchgespielten
  Fälle ab (Überlappung, Lücke, zweite offene Periode, Formatverstoß, Stichtagswechsel,
  UPDATE-Verlängerung über die Nachbarperiode hinaus, Kaskaden-DELETE mit drei verketteten
  Perioden, direktes Löschen einer mittleren Periode).
- `schema.ts` spiegelt dieselbe DDL zeichengleich; `schemaMigrationParity.test.ts` beweist
  das maschinell statt es nur zu behaupten, inklusive der beiden geforderten Gegenproben
  (Leerzeichen-Toleranz bleibt grün, geänderte Spaltendefinition wird rot).
- `UserWorkPeriod` (mit `WorkSchedule | null`) und `UserWorkPeriodRow` (rohe DB-Zeile,
  `workSchedule: string | null`) ohne `any` in `server/src/types/index.ts`.
- `users.weeklyHours`/`users.workSchedule` mechanisch unangetastet: `grep -c "ALTER TABLE
  users\|DROP TABLE users\|UPDATE users"` in beiden geänderten/neuen Dateien ergibt `0`,
  `git diff` an `schema.ts` über beide Commits zeigt keine Änderung an der
  `CREATE TABLE IF NOT EXISTS users`-Definition.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 008 — Tabelle, Constraints, Indizes, Trigger** - `ac13496` (feat)
2. **Task 2: Spiegel in schema.ts, Typ UserWorkPeriod, Gleichheitstest** - `7315436` (feat)

_Keine TDD-Tasks in diesem Plan; beide Tasks sind `type="auto"` ohne `tdd="true"`._

## Files Created/Modified
- `server/src/database/migrations/008_create_user_work_periods.ts` - Tabelle, zwei Indizes,
  drei Trigger, Selbstverifikation über PRAGMA table_info/index_list und sqlite_master
- `server/src/database/migrations/008_create_user_work_periods.test.ts` - 14 Tests auf
  `:memory:`, u. a. Idempotenz (D7) und alle neun im DDL-Vertrag geprüften Trigger-Fälle
- `server/src/database/schema.ts` - `user_work_periods`-Block (Tabelle + drei Trigger)
  hinter `vacation_transactions`, zwei Indizes im gesammelten Index-Block,
  Abschlussmeldung von „All 14" auf „All 19 tables created" korrigiert
- `server/src/database/schemaMigrationParity.test.ts` - Gleichheitstest über zwei
  Datenbanken in `os.tmpdir()` (schema.ts-Pfad vs. Migrations-Pfad), normalisierter
  `sqlite_master`-Vergleich, zwei Gegenproben
- `server/src/types/index.ts` - `UserWorkPeriod` und `UserWorkPeriodRow` ergänzt

## Objektliste aus sqlite_master nach dem Migrationslauf (Nachweis)

`SELECT type, name FROM sqlite_master WHERE tbl_name = 'user_work_periods' ORDER BY type, name`
gegen eine frische `:memory:`-Datenbank nach `migration.up(db)`:

```json
[
  {"type":"index","name":"idx_user_work_periods_one_open"},
  {"type":"index","name":"idx_user_work_periods_user_from"},
  {"type":"index","name":"sqlite_autoindex_user_work_periods_1"},
  {"type":"table","name":"user_work_periods"},
  {"type":"trigger","name":"trg_user_work_periods_delete_guard"},
  {"type":"trigger","name":"trg_user_work_periods_insert_guard"},
  {"type":"trigger","name":"trg_user_work_periods_update_guard"}
]
```

Sieben Objekte: eine Tabelle, drei Indizes (zwei explizit benannte plus der von SQLite
automatisch für `UNIQUE(userId, validFrom)` angelegte `sqlite_autoindex_user_work_periods_1`),
drei Trigger. Diese Liste wird von `schemaMigrationParity.test.ts` gegen dieselbe Liste aus
dem `schema.ts`-Pfad (`initializeDatabase()`) verglichen — der Test ist grün, beide Pfade
erzeugen identische Objekte.

## Ergebnis des Gleichheitstests inklusive der beiden Gegenproben

`npx vitest run src/database/schemaMigrationParity.test.ts` — 3/3 Tests grün:

1. **„erzeugt identische Objektlisten"** — `objectsA` (aus `initializeDatabase()`, Datenbank A
   in `os.tmpdir()`) und `objectsB` (aus `migration008.up(db)` auf einer minimalen
   `users`-Tabelle, Datenbank B in `os.tmpdir()`) sind über `toEqual` identisch, jeweils
   normalisiert (`sql.replace(/\s+/g, ' ').trim()`).
2. **Gegenprobe 1 (Leerzeichen-Toleranz):** `'CREATE TABLE  foo (id  INTEGER)'` und
   `'CREATE TABLE foo (id INTEGER)'` normalisieren auf denselben String — bestätigt grün,
   ein zusätzliches Leerzeichen macht den Test nicht rot.
3. **Gegenprobe 2 (Spaltenabweichung erkannt):** `'CREATE TABLE foo (id INTEGER, weeklyHours
   REAL NOT NULL)'` gegen dieselbe Definition ohne `NOT NULL` — normalisierte Strings sind
   ungleich, bestätigt, dass eine geänderte Spaltendefinition den Test tatsächlich rot machen
   würde.

`:memory:` wurde bewusst NICHT für die beiden Hauptdatenbanken des Parity-Tests verwendet:
`initializeDatabase()` prüft `journal_mode = WAL` per `PRAGMA` und wirft, wenn das fehlschlägt
— eine Speicherdatenbank kann keinen WAL-Modus erreichen. Beide Datenbanken sind stattdessen
eindeutig benannte Dateien in `os.tmpdir()`, die in `afterAll` inklusive `-wal`/`-shm` gelöscht
werden.

## Bestätigung: git diff an users unverändert

```
git diff HEAD~2 HEAD -- server/src/database/schema.ts | grep -n "CREATE TABLE IF NOT EXISTS users"
```
liefert keinen Treffer — die `users`-Tabellendefinition wurde in keinem der beiden
Task-Commits berührt. Zusätzlich:
- `grep -c "ALTER TABLE users\|DROP TABLE users\|UPDATE users"` in
  `008_create_user_work_periods.ts` → `0`
- `git diff server/src/database/schema.ts` (Task 2) zeigt genau eine Löschzeile
  (`- logger.info('✅ All 14 tables created');`, ersetzt durch die korrigierte Tabellenzahl),
  der Rest ausschließlich Hinzufügungen — keine Zeile der `users`-Definition betroffen.

## Decisions Made
- DDL wörtlich aus dem im Plan verankerten `<ddl_contract>` übernommen, keine eigene
  „Verbesserung" — wie in den Ausführungsanweisungen verlangt.
- `PRAGMA index_list(user_work_periods)` liefert nach dem `UNIQUE(userId, validFrom)`-
  Constraint zusätzlich einen von SQLite automatisch benannten Index
  (`sqlite_autoindex_user_work_periods_1`). Der ursprüngliche Testentwurf prüfte auf eine
  feste Indexanzahl (`2`) und schlug deshalb beim ersten Lauf fehl (`expected 3 to be 2`).
  Kein Bug in der Migration — korrigiert durch Prüfung auf die beiden benannten Indizes
  statt auf eine Gesamtzahl (dokumentiert unten unter „Deviations").
- Abschlussmeldung in `schema.ts` von „All 14 tables created" auf „All 19 tables created"
  korrigiert — `grep -c "CREATE TABLE IF NOT EXISTS"` ergibt nach der Ergänzung tatsächlich
  19 (die „14" war schon vor diesem Plan veraltet, wie vom Plan verlangt jetzt richtig
  gestellt).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testassertion an tatsächliches SQLite-Verhalten angepasst (Auto-Index bei UNIQUE-Constraint)**
- **Found during:** Task 1, erster Testlauf von `008_create_user_work_periods.test.ts`
- **Issue:** Der Idempotenz-Test prüfte `expect(indexes.length).toBe(2)` gegen
  `PRAGMA index_list(user_work_periods)`. SQLite legt für `UNIQUE(userId, validFrom)` in der
  `CREATE TABLE`-Anweisung automatisch einen dritten, intern benannten Index
  (`sqlite_autoindex_user_work_periods_1`) an — `index_list` enthält deshalb real 3 Einträge,
  nicht 2. Das ist korrektes, im DDL-Vertrag vorgesehenes SQLite-Verhalten, kein Fehler der
  Migration.
- **Fix:** Testassertion auf `expect(indexNames).toContain(...)` für die beiden benannten
  Indizes umgestellt statt einer festen Gesamtzahl.
- **Files modified:** `server/src/database/migrations/008_create_user_work_periods.test.ts`
- **Verification:** `npx vitest run src/database/migrations/008_create_user_work_periods.test.ts`
  — 14/14 grün.
- **Committed in:** `ac13496` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Bug in einer Testerwartung, nicht in Produktionscode)
**Impact on plan:** Keine Auswirkung auf die DDL oder das Verhalten der Migration. Reine
Testkorrektur; die Migration selbst entspricht wörtlich dem `<ddl_contract>`.

## Issues Encountered
- Ein direkter `tsx`-Probe-Aufruf zum Ausdrucken der `sqlite_master`-Objektliste (außerhalb
  von vitest) lief in einen Timeout — vermutlich ein Auflösungsproblem des relativen
  `logger.js`-Imports der Migration bei einem Skript außerhalb des `server`-Workspace-Kontexts.
  Umgangen durch eine temporäre, nicht committete Probe-Testdatei innerhalb von `vitest`
  (`src/database/_tmp_probe.test.ts`), die nach dem Auslesen der Objektliste wieder gelöscht
  wurde — kein Rest im Arbeitsverzeichnis, `git status` bestätigt.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich. Diese Migration schreibt keine
Daten und wird beim nächsten `runMigrations()`-Aufruf (nächster Serverstart mit der lokalen
Entwicklungsdatenbank) automatisch angewendet.

## Next Phase Readiness

- Migration 008 und der `schema.ts`-Spiegel liegen bereit für Plan 10-02 (vermutlich Service-
  Schicht: Periode lesen/schreiben/zum Datum auflösen, laut 10-CONTEXT.md).
- `UserWorkPeriod`/`UserWorkPeriodRow` stehen für die Umwandlung der rohen `workSchedule`-
  TEXT-Spalte im Service bereit (Plan 10-04 laut `<action>`-Hinweis in Task 2).
- Kein Datensatz existiert noch in `user_work_periods` — die Bestandsüberführung
  (`validFrom = hireDate`, D5) ist laut Plankopf explizit Migration 009 (Plan 10-03) und noch
  nicht Teil dieses Plans.
- Kein `git push`, kein Deployment ausgeführt — bleibt lokal, wie von der ROADMAP für Phase 10
  gefordert (Produktionslauf ist Phase 14).

---
*Phase: 10-perioden-fundament*
*Completed: 2026-08-22*
