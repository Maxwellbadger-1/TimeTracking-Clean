---
phase: 10-perioden-fundament
plan: 03
subsystem: database
tags: [sqlite, better-sqlite3, migrations, backfill, typescript]

# Dependency graph
requires:
  - phase: 10-perioden-fundament
    plan: 01
    provides: Tabelle user_work_periods (Migration 008) mit Triggern und partiellem UNIQUE-Index
provides:
  - Migration 009 — Bestandsüberführung, jeder Nutzer erhält genau eine offene Periode ab hireDate
  - Exportierte reine Funktion resolveValidFrom + Konstante FALLBACK_PROJECT_START (D5-Ersatzdatum-Kette)
  - Selbstverifikation innerhalb der Migration (keine Periode fehlt, keine Doppelperiode, Wertgleichheit zu users)
affects: [10-05, phase-11-datumsabhaengige-berechnung, phase-14-absicherung-und-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ersatzdatum-Kette als reine Funktion (resolveValidFrom) ohne Datenbankzugriff und ohne Date-Objekt — testbar ohne :memory:-Datenbank"
    - "Selbstverifikation vergleicht jede übernommene Zeile per JOIN gegen die aktuelle users-Zeile (IS-Vergleich für workSchedule, damit NULL gegen NULL gleich ist) und wirft bei Abweichung, statt die Migration als erledigt zu buchen"
    - "Idempotenz per Vorab-Prüfung (SELECT 1 ... LIMIT 1) je Nutzer, zusätzlich abgesichert durch den partiellen UNIQUE-Index aus Migration 008"

key-files:
  created:
    - server/src/database/migrations/009_backfill_user_work_periods.ts
    - server/src/database/migrations/009_backfill_user_work_periods.test.ts
  modified: []

key-decisions:
  - "FALLBACK_PROJECT_START = '2025-01-01': gemessen am 22.08.2026 gegen server/database/development.db ist der früheste time_entries.date-Wert 2025-07-01 und das früheste hireDate 2025-11-13 — ein Periodenbeginn am 01.01.2025 deckt jede vorhandene Buchung ab, ohne ein frei erfundenes Epoch-Datum zu verwenden"
  - "Kommentare im Produktions- und Testcode vermeiden absichtlich die Literalmuster '1970-01-01', 'new Date(' und 'toISOString' — auch als Erklärung, was NICHT verwendet wird, hätten sie die grep-basierten Akzeptanzkriterien des Plans (D5/Zeitzonen-Riegel) verletzt"
  - "Selbstverifikation vergleicht ALLE Perioden gegen die aktuellen users-Werte, nicht nur die in diesem Lauf neu eingefügten — im Skip-Test (D7) musste die manuell vorab eingefügte Periode deshalb bewusst dieselben weeklyHours/workSchedule wie der Nutzer tragen (nur validFrom weicht ab), sonst hätte die Migration die eigene Selbstverifikation ausgelöst"

requirements-completed: [REQ-21, REQ-20]

# Metrics
duration: ~35min
completed: 2026-08-22
---

# Phase 10 Plan 03: Migration 009 — Bestandsüberführung Summary

**Migration 009 überführt den heutigen Stand jedes Nutzers (auch soft-gelöschte/inaktive) in genau eine offene `user_work_periods`-Periode ab `hireDate`, mit einer dreistufigen, protokollierten Ersatzdatum-Kette (`hireDate` → frühester `time_entries`-Eintrag → `FALLBACK_PROJECT_START` 2025-01-01) und einer Selbstverifikation, die bei jeder Wertabweichung zu `users` die Transaktion zurückrollt.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2
- **Files modified:** 2 (beide neu)

## Accomplishments

- Migration 009 (`009_backfill_user_work_periods.ts`) liest `users` (ausdrücklich inklusive
  `deletedAt`-gesetzter und `status='inactive'`-Nutzer, D5) und schreibt für jeden Nutzer
  ohne vorhandene Periode eine einzige `INSERT`-Anweisung, die `weeklyHours` und
  `workSchedule` gemeinsam aus derselben `users`-Zeile übernimmt (D2/REQ-20).
  `workSchedule` wird zeichengleich kopiert, nicht neu serialisiert.
- Ersatzdatum-Kette (D5) als reine, exportierte Funktion `resolveValidFrom(hireDate,
  earliestEntryDate)` implementiert: wohlgeformtes `hireDate` (Regex `^\d{4}-\d{2}-\d{2}$`,
  dieselbe Form wie das GLOB-CHECK aus Migration 008) gewinnt immer; sonst der früheste
  `time_entries.date` des Nutzers; sonst `FALLBACK_PROJECT_START = '2025-01-01'`. Jede
  Nicht-`hireDate`-Wahl wird einzeln über `logger.info` mit `userId`, gewähltem Datum und
  Quelle protokolliert und steht zusätzlich in der `note`-Spalte der jeweiligen Zeile
  (`[MIGRATION-009] Bestandsüberführung, Quelle: <source>`) — T-10-10 aus dem Threat
  Model.
- Idempotenz (D7): Vorab-Prüfung `SELECT 1 FROM user_work_periods WHERE userId = ? LIMIT 1`
  überspringt bereits versorgte Nutzer; ihre vorhandene Periode bleibt unangetastet. Der
  partielle UNIQUE-Index `idx_user_work_periods_one_open` aus Migration 008 ist der zweite,
  datenbankseitige Riegel (T-10-09).
- Selbstverifikation (Schritt 6/7 der Migration) wirft bei drei möglichen Abweichungen und
  verhindert dadurch, dass der `migrationRunner` die Migration fälschlich als erledigt
  bucht (Lehre aus Migration 003, siehe Kopfkommentar von Migration 007/008):
  1. Nutzer ohne Periode nach dem Lauf.
  2. Nutzer mit mehr als einer Periode.
  3. Eine Periode, deren `weeklyHours`, `workSchedule` (IS-Vergleich) oder `validTo`
     von der aktuellen `users`-Zeile abweicht — das ist ROADMAP-Erfolgskriterium 2,
     maschinell in der Migration selbst geprüft, nicht nur behauptet.
- `weeklyHours = NULL` wirft mit der `userId` in der Fehlermeldung statt einen Standardwert
  zu raten (Riegel gegen eine künftige Schemaänderung — die echte Tabelle führt die Spalte
  als `NOT NULL DEFAULT 40`, schema.ts:43).
- `009_backfill_user_work_periods.test.ts`: 17 Tests, ausschließlich auf `new
  Database(':memory:')`, kein Import des zentralen Verbindungsmoduls und keine Referenz auf
  die lokale Arbeitsdatenbank-Datei. Deckt ab: die reine `resolveValidFrom`-Funktion (7
  Fälle inkl. „liefert nie ein Epoch-Datum"), sechs Grenzfall-Nutzer (workSchedule
  ja/nein, `weeklyHours` 0 und 2.5, soft-gelöscht/inaktiv, `endDate` in der
  Vergangenheit — je genau eine Periode, `validTo` bleibt bei allen `NULL`), zweiter Lauf
  ohne zusätzliche Zeile (idempotent), eine bereits manuell vorhandene Periode bleibt beim
  erneuten Lauf unverändert, `weeklyHours = NULL` wirft mit `userId`, und ein Nutzer ohne
  `hireDate` mit Zeiteinträgen bekommt `validFrom` = frühester Zeiteintrag mit der Quelle in
  der `note`-Spalte.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 009 — Bestandsüberführung mit Selbstverifikation** - `8e1dacd` (feat)
2. **Task 2: Grenzfälle der Bestandsüberführung** - `61c24a0` (test)

_Task 2 trägt `tdd="true"` im Plan; da die Implementierung (Task 1) laut Plan-Reihenfolge
vor der Testdatei liegt, entfällt eine eigene RED-Phase — alle 17 Tests waren beim ersten
Lauf grün (siehe „TDD Gate Compliance" unten)._

## Files Created/Modified

- `server/src/database/migrations/009_backfill_user_work_periods.ts` - Bestandsüberführung,
  `resolveValidFrom`, `FALLBACK_PROJECT_START`, Selbstverifikation
- `server/src/database/migrations/009_backfill_user_work_periods.test.ts` - 17 Tests auf
  `:memory:`, deckt Ersatzdatum-Kette, sechs Grenzfall-Nutzer, Idempotenz und Fehlerfall ab

## Ersatzdatum in den Tests (D5-Nachweis)

Im Testlauf löst genau ein Fall den Ersatzdatum-Zweig aus: der Nutzer im Test „Ersatzdatum
bei fehlendem hireDate" (eigener, isolierter `:memory:`-Fall in
`009_backfill_user_work_periods.test.ts`) hat `hireDate = NULL` und drei
`time_entries`-Zeilen (`2025-09-15`, `2025-07-01`, `2025-08-01`). Die Migration wählt
`validFrom = '2025-07-01'` (frühester Eintrag), Quelle `earliestTimeEntry`, protokolliert
über `logger.info({userId, validFrom, source})` und in der `note`-Spalte
(`[MIGRATION-009] Bestandsüberführung, Quelle: earliestTimeEntry`).

Alle sechs Grenzfall-Nutzer im Hauptszenario (a–f) haben ein wohlgeformtes `hireDate` und
lösen deshalb `source = 'hireDate'` aus — deckt sich mit der `<measured_facts>`-Angabe im
Plan, dass der Ersatzdatum-Zweig auf dem aktuellen Produktionsbestand voraussichtlich nie
betreten wird, aber gebaut und getestet sein muss, weil sich die Produktionsdatenbank bis
Phase 14 ändern kann.

Der `FALLBACK_PROJECT_START`-Zweig (dritte Stufe, weder `hireDate` noch Zeiteintrag) ist
über die reine Funktion `resolveValidFrom(null, null)` direkt getestet (kein
Datenbanklauf nötig) und liefert `{ validFrom: '2025-01-01', source: 'projectStart' }`.

## Bestätigung: development-Datenbank unberührt

```
node -e "... SELECT COUNT(*) FROM user_work_periods ..." gegen server/database/development.db
→ Zeilen in user_work_periods: 0
```

Alle 17 Tests dieser Plan-Datei sowie die 14 Tests aus Migration 008 laufen ausschließlich
gegen `new Database(':memory:')`. `git status` zeigt für diesen Plan ausschließlich die
zwei neu angelegten Dateien — keine Änderung an `server/database/development.db` oder einer
ihrer Begleitdateien (`-wal`/`-shm`).

## Verifikation

- `cd server && npx tsc --noEmit` — grün, keine Fehler.
- `cd server && npx vitest run src/database/migrations/` — 2 Dateien, 31/31 Tests grün
  (14 aus Migration 008 + 17 aus Migration 009).
- `cd server && npx vitest run` (Gesamtsuite) — 252/255 grün, 3 Fehlschläge, alle drei
  vorbestehend und unabhängig von diesem Plan: zwei in
  `src/services/unifiedOvertimeService.test.ts` (Regression-Tests „User hired on 1st of
  month"/verwandter Fall, `targetHours` erwartet 10, erhält 40) und einer in
  `src/services/vacationBackfillService.test.ts` (`hasExistingBackfill` erwartet `false`,
  erhält `true`). Keine dieser drei Dateien wurde von diesem Plan berührt; deckt sich mit
  dem im Plankopf genannten Ausgangsstand „235/238, drei bekannte vorbestehende" (die
  Gesamtzahl ist seither durch parallel laufende Pläne der Welle 2 gewachsen, die
  Fehlschlagszahl blieb bei drei).
- Akzeptanzkriterien Task 1 (grep-basiert): `UPDATE users|ALTER TABLE users|DELETE FROM
  users` → 0, `toISOString|new Date(` → 0, `1970-01-01` → 0, benannte Exporte
  `FALLBACK_PROJECT_START`/`resolveValidFrom` vorhanden.
- Akzeptanzkriterien Task 2: Testdatei enthält weder eine Referenz auf die lokale
  Arbeitsdatenbank-Datei noch auf das zentrale Verbindungsmodul (`grep -c
  "development.db\|connection.js"` → 0); mindestens ein Testname enthält „idempotent"
  (`zweiter Lauf (idempotent, D7): ...`), mindestens einer „Ersatzdatum" bzw. „ohne
  hireDate" (`... fällt auf den frühesten Zeiteintrag zurück (Ersatzdatum, ohne
  hireDate)` und `Nutzer ohne hireDate, aber mit Zeiteinträgen: ...`).

## TDD Gate Compliance

Task 2 trägt `tdd="true"`, folgt aber nicht dem klassischen RED→GREEN-Muster über zwei
Commits: Der Plan ordnet Task 1 (Implementierung inkl. Selbstverifikation) explizit vor
Task 2 (Testdatei) an — die Migration existierte bereits vollständig, bevor die
Testdatei geschrieben wurde. Alle 17 Tests waren beim allerersten Lauf grün, es gab keine
RED-Phase im Sinn eines fehlschlagenden Tests vor der Implementierung. Das ist keine
Abweichung vom Plan, sondern folgt der im Plan selbst verankerten Aufgabenreihenfolge
(Task 1: Migration mit Selbstverifikation; Task 2: „Grenzfälle der
Bestandsüberführung" als nachgelagerte Verifikationsschicht). Kein `feat(...)`-Commit
nach einem `test(...)`-Commit wie im klassischen GREEN-Gate — stattdessen `feat` (Task 1,
`8e1dacd`) vor `test` (Task 2, `61c24a0`).

## Decisions Made

- `FALLBACK_PROJECT_START = '2025-01-01'` — Begründung siehe `key-decisions` oben und
  Kopfkommentar der Migration.
- Literalmuster `1970-01-01`, `new Date(` und `toISOString` wurden auch aus erklärenden
  Kommentaren entfernt (nicht nur aus Code), weil die grep-basierten Akzeptanzkriterien
  des Plans keinen Unterschied zwischen Code und Kommentar machen — dokumentiert unten
  unter „Deviations".
- Die Selbstverifikation vergleicht **alle** Perioden gegen die aktuellen `users`-Werte,
  nicht nur die in diesem Lauf neu eingefügten. Für den Idempotenz-Test mit einer
  manuell vorab eingefügten Periode (D7) musste diese deshalb bewusst dieselben
  `weeklyHours`/`workSchedule` wie der Nutzer tragen (nur `validFrom` weicht ab, um den
  Skip-Pfad zu belegen) — sonst hätte der zweite Migrationslauf die eigene
  Selbstverifikation ausgelöst und geworfen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literalmuster in erklärenden Kommentaren verletzten die eigenen grep-Akzeptanzkriterien**
- **Found during:** Task 1, erster Lauf der grep-Prüfungen aus `<acceptance_criteria>`
- **Issue:** Der Kopfkommentar erklärte die D5-Ersatzdatum-Kette u. a. mit den Sätzen
  „fällt still auf `1970-01-01` zurück" und „ohne `new Date()`, ohne `toISOString()`" —
  als Erklärung, was die Migration NICHT tut. Die Akzeptanzkriterien prüfen aber per
  `grep -c` auf reine Zeichenkettenvorkommen, unabhängig vom Kontext (Code vs.
  Kommentar). `grep -c "1970-01-01"` ergab dadurch `2` statt der geforderten `0`,
  `grep -c "toISOString\|new Date("` ergab `1` statt `0`.
- **Fix:** Beide Kommentarstellen umformuliert, ohne die Literalmuster zu verwenden
  („ein frei erfundenes Epoch-Datum" statt `1970-01-01`, „ohne jede Umwandlung über ein
  Date-Objekt" statt `new Date()`/`toISOString()`). Dieselbe Anpassung vorsorglich auch
  in der Testdatei für `development.db`/`connection.js` vorgenommen, deren
  Akzeptanzkriterium dieselbe grep-Form hat.
- **Files modified:** `server/src/database/migrations/009_backfill_user_work_periods.ts`,
  `server/src/database/migrations/009_backfill_user_work_periods.test.ts`
- **Verification:** Alle vier grep-Prüfungen liefern `0`; `npx tsc --noEmit` und beide
  Vitest-Läufe bleiben grün.
- **Committed in:** `8e1dacd` (Migration) und `61c24a0` (Testdatei) — jeweils bereits in
  der finalen Fassung committet, keine separate Korrektur-Commits nötig.

---

**Total deviations:** 1 auto-fixed (Formulierungsanpassung in Kommentaren, keine
Verhaltensänderung an Migration oder Tests).
**Impact on plan:** Keine Auswirkung auf Logik oder Testabdeckung — reine
Kommentar-Umformulierung, um die eigenen grep-basierten Akzeptanzkriterien zu erfüllen.

## Issues Encountered

Keine.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich. Migration 009 wendet sich beim
nächsten `runMigrations()`-Aufruf (nächster Serverstart mit der lokalen
Entwicklungsdatenbank) automatisch an, sobald Migration 008 bereits gelaufen ist. Kein
Produktionslauf in dieser Phase (der ist laut ROADMAP Phase 14 vorbehalten).

## Next Phase Readiness

- `user_work_periods` ist nach dem nächsten lokalen Serverstart für alle 20 echten Nutzer
  befüllt — Plan 10-04 (Service-Schicht) und Plan 10-05 (Nullwirkungsmessung) können
  darauf aufbauen.
- `resolveValidFrom`/`FALLBACK_PROJECT_START` stehen benannt exportiert zur Verfügung,
  falls Plan 10-05 oder Phase 14 dieselbe Ersatzdatum-Logik für die
  Vorher/Nachher-Verifikation wiederverwenden wollen.
- Kein `git push`, kein Deployment ausgeführt.

---
*Phase: 10-perioden-fundament*
*Completed: 2026-08-22*

## Self-Check: PASSED

Beide referenzierten Dateien (`server/src/database/migrations/009_backfill_user_work_periods.ts`,
`server/src/database/migrations/009_backfill_user_work_periods.test.ts`) und beide
Commit-Hashes (`8e1dacd`, `61c24a0`) wurden gegen das Dateisystem bzw.
`git log --oneline --all` verifiziert und gefunden. Keine fehlenden Artefakte.
