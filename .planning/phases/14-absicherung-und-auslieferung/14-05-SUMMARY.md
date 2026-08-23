---
phase: 14-absicherung-und-auslieferung
plan: 05
subsystem: database
tags: [sqlite, better-sqlite3, cli-script, production-copy, req-33, generalprobe, work-time-change]

# Dependency graph
requires:
  - phase: 14-absicherung-und-auslieferung
    provides: "14-04 (server/database/14-generalprobe.db — migrierte Arbeitskopie mit vollstaendig angewendeter Migrationsfolge 008-015; --asOf-Wert 2026-08-21)"
provides:
  - "server/src/scripts/applyModelChange.ts — Zwei-Stufen-Skript (D3) fuer EINEN Arbeitszeitmodellwechsel gegen eine ausdruecklich benannte Datenbank, ruft ausschliesslich applyWorkTimeChange() auf"
  - "Erwartungspruefung (T-14-22): --expectUser/--expectCurrentWeeklyHours verhindern, dass eine vertippte --userId einen falschen Menschen trifft — geprueft VOR jedem Schreibversuch, Gegenprobe mit falschem Wert durchgefuehrt"
  - "--allow-production als einzige, protokollierte Umgehung des Produktionsschutzes fuer den spaeteren realen Lauf (Plan 14-09)"
  - "Vollstaendig gefahrene Generalprobe gegen 14-generalprobe.db: Trockenlauf ohne Schreibwirkung, Schreiblauf mit integrity_check ok, Kettenpruefung ok"
  - "D5-Nachweis (14-VORHER-NACHHER.md): maschineller Diff zweier Salden-Snapshots zeigt genau EINEN bewegten Nutzer (den Generalprobenfall), alle anderen inkl. der drei benannten Rauschquellen unveraendert"
affects: [14-06, 14-07, 14-08, 14-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI-Skript mit isMainModule-Wächter (pathToFileURL(process.argv[1]).href === import.meta.url) — main() läuft nur bei direktem Aufruf, parseArgs()/assertExpectationsMatch() bleiben für vitest importierbar, ohne DATABASE_PATH/process.exit auszulösen"
    - "Erwartungsargumente (--expectX) als Pflichtparameter vor jedem produktionsnahen Einzel-Schreibvorgang — Schutzmuster gegen vertippte IDs, wiederverwendbar für Plan 14-09"

key-files:
  created:
    - server/src/scripts/applyModelChange.ts
    - server/src/scripts/applyModelChange.test.ts
    - .planning/phases/14-absicherung-und-auslieferung/14-VORHER-NACHHER.md
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-VORHER.json
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-VORHER.users.json
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-NACHHER.json
    - .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-NACHHER.users.json
  modified:
    - server/package.json

key-decisions:
  - "DATABASE_PATH-Pruefung laeuft in main() VOR parseArgs() (nicht wie im Plantext als 'Argumentauswertung; danach DATABASE_PATH' beschrieben) — noetig, damit ein Aufruf ganz ohne Argumente UND ohne DATABASE_PATH exakt die DATABASE_PATH-Fehlermeldung zeigt (Abnahmekriterium wörtlich verlangt das), nicht eine Pflichtargument-Fehlermeldung"
  - "Generalprobenfall (Task 2) ist userId 2 (Karin Jochem, aktuell 5h/Woche) — kleinste id, die die vier Auswahlbedingungen erfuellt; userId 1 (System-Administrator) faellt raus (0 Zeiteintraege in den letzten 12 Monaten vor --asOf)"
  - "Stichtag 2026-06-01 (zwei Monate vor dem --asOf-Monat 2026-08), Zielwert 3 h/Woche (Math.round(5/2)=3, >= 1) — beide Werte hergeleitet, nicht geschaetzt"
  - "createdBy=1 (System Administrator) — kleinste users.id mit role='admin' AND deletedAt IS NULL in der Kopie"

patterns-established:
  - "Vergleichsfeld für den D5-Diff ist overtimePeriod.overtime (Gesamtzeitraum-Saldo aus unifiedOvertimeService.calculatePeriodOvertime) — stimmt exakt mit dem im Skript selbst gedruckten balanceDelta überein, zwei unabhängige Lesepfade bestätigen sich gegenseitig"

requirements-completed: [REQ-33]

# Metrics
duration: ~25min
completed: 2026-08-23
---

# Phase 14 Plan 05: Generalprobe gegen die migrierte Produktionskopie Summary

**Zwei-Stufen-Skript `applyModelChange.ts` mit Erwartungsprüfung gegen vertippte `--userId` gebaut, vollständig gegen `14-generalprobe.db` gefahren (Trockenlauf, Gegenprobe, Schreiblauf) und mit einem maschinellen Vorher/Nachher-Diff belegt: genau ein Nutzer bewegt sich — der ausgewählte Generalprobenfall, nicht der noch unbekannte D6-Fall.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-23T00:22:00Z (nach Abschluss Plan 14-04, Commit e3e570e)
- **Completed:** 2026-08-23T00:35:05Z
- **Tasks:** 3 (je ein eigener Commit)
- **Files modified:** 7 (2 neu im Server, 5 unter `.planning/`)

## Accomplishments
- `applyModelChange.ts` gebaut: Zwei-Stufen-Ablauf (D3), ruft ausschließlich
  `applyWorkTimeChange()` auf (keine eigene Schreiblogik, per grep verifiziert), schützt gegen
  Produktionsschreibzugriff über `assertNotProduction()` mit `--allow-production` als einzige,
  protokollierte Umgehung für den späteren realen Lauf (Plan 14-09)
- Erwartungsprüfung (T-14-22) implementiert und mit einer echten Gegenprobe verifiziert: ein
  bewusst falsches `--expectUser` endet mit Exit 2, ohne dass `applyWorkTimeChange()` erreicht
  wird
- 14 Vitest-Tests für `parseArgs()`/`assertExpectationsMatch()` als reine Funktionen (kein
  Datenbankzugriff), Muster aus `productionGuard.test.ts`
- Generalprobe vollständig gegen `14-generalprobe.db` gefahren: Snapshot vorher → Trockenlauf
  (Zeilenzahlen `user_work_periods`/`overtime_transactions` unverändert) → Gegenprobe (Exit 2)
  → Schreiblauf (Exit 0, `integrity_check` ok, Saldo 6h → 29,6h) → Snapshot nachher →
  Kettenprüfung (Exit 0, keine Befunde)
- D5-Nachweis: maschineller Diff der beiden `*.users.json`-Dateien zeigt **genau einen**
  Nutzer mit Differenz ungleich null (userId 2, Karin Jochem, +19,6 h) — identisch mit dem vom
  Skript selbst gedruckten `balanceDelta`. Die drei vorab benannten Rauschquellen (User 30
  „Test Urlaub", User 31 „UAT", Antrag 73) sind einzeln geprüft und **byteidentisch**
  zwischen beiden Snapshots
- `14-produktionskopie.db` und `server/database/development.db` nachweislich unangetastet;
  laufender Dev-Server (PID 39860) und Tauri-Prozess (PID 26124) durchgehend unberührt
- Alle vier Pflichtgates grün bzw. auf der unveränderten 3-rot-Baseline: Server-`tsc` Exit 0,
  Desktop-`tsc` Exit 0, `vitest run` 3 rot/507 grün (dieselben drei Titel wie
  `11-AUSGANGSZUSTAND.md`, +14 additive neue Tests), Desktop `check:rules` Exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Zwei-Stufen-Skript applyModelChange.ts mit Erwartungsprüfung bauen** - `a2b1325` (feat)
2. **Task 2: Generalprobe gegen die migrierte Produktionskopie fahren** - `cab6e88` (docs)
3. **Task 3: Den Vorher/Nachher-Vergleich auswerten und als D5-Nachweis festhalten** - `4ae9b05` (docs)

## Files Created/Modified
- `server/src/scripts/applyModelChange.ts` - Zwei-Stufen-CLI-Skript für einen Arbeitszeitmodellwechsel gegen eine benannte Datenbank
- `server/src/scripts/applyModelChange.test.ts` - 14 Tests für `parseArgs()`/`assertExpectationsMatch()` als reine Funktionen
- `server/package.json` - neuer Eintrag `"apply:model-change": "tsx src/scripts/applyModelChange.ts"`
- `.planning/phases/14-absicherung-und-auslieferung/14-VORHER-NACHHER.md` - vollständiges D5-Nachweisprotokoll: Auswahlregel, Trockenlauf, Gegenprobe, Schreiblauf, Diff-Auswertung, Rauschprüfung, D6-Abgrenzung, Pflichtgates
- `.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-{VORHER,NACHHER}.json` und `.users.json` - Salden-Snapshots vor/nach dem Generalprobenlauf (D5-Vergleichsgrundlage)

## Decisions Made
- DATABASE_PATH-Prüfung läuft vor `parseArgs()` in `main()`, damit ein Aufruf ohne jedes
  Argument und ohne `DATABASE_PATH` exakt die geforderte `DATABASE_PATH`-Fehlermeldung zeigt
  (wörtliches Abnahmekriterium)
- Generalprobenfall: userId 2 (Karin Jochem) — kleinste `id`, die alle vier
  Auswahlbedingungen erfüllt; userId 1 fällt wegen 0 Zeiteinträgen in den letzten 12 Monaten
  vor `--asOf` raus
- Stichtag 2026-06-01, Zielwert 3 h/Woche, createdBy=1 — alle drei Werte mit Herleitung in
  `14-VORHER-NACHHER.md` dokumentiert, keiner geschätzt

## Deviations from Plan

None - plan executed exactly as written. Eine Klarstellung: Der Plantext beschreibt die
Reihenfolge „Argumentauswertung; danach DATABASE_PATH-Pflichtprüfung" in der
Interfaces-Prosa, während das konkrete, wörtlich verlangte Abnahmekriterium („ohne
DATABASE_PATH, ohne Argumente → exakt die DATABASE_PATH-Fehlermeldung") die umgekehrte
Laufzeitreihenfolge erzwingt. Beide Vorgaben stammen aus demselben Plan; die Implementierung
folgt dem konkreten, prüfbaren Kriterium. Kein Rule-1-4-Fall (keine Bug-/Sicherheits-/
Blockadefrage), sondern eine Auflösung einer internen Uneindeutigkeit des Plantexts zugunsten
des explizit messbaren Kriteriums — hier dokumentiert statt stillschweigend entschieden.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REQ-33 (Generalprobe auf Produktionskopie, Zwei-Stufen-Ablauf) vollständig erfüllt und
  maschinell mit D5-Diff belegt
- `applyModelChange.ts` ist bereit für Plan 14-09 (realer Umstellungsfall) — derselbe Code,
  `--allow-production` als vorbereitete, protokollierte Umgehung des Guards, die vier
  D6-Werte bleiben bis zur ausdrücklichen Anwenderfreigabe Pflichtargumente ohne
  Kandidatenliste
- `server/database/14-generalprobe.db` trägt jetzt zusätzlich den Generalprobe-Modellwechsel
  von userId 2 (Testartefakt der Arbeitskopie, kein Produktionsdatensatz) — für nachfolgende
  Pläne, die erneut gegen dieselbe Kopie arbeiten, relevant
- Kein Blocker gefunden — Plan 14-06 kann ohne Wartezeit anschließen

---
*Phase: 14-absicherung-und-auslieferung*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: server/src/scripts/applyModelChange.ts
- FOUND: server/src/scripts/applyModelChange.test.ts
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-VORHER-NACHHER.md
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-VORHER.json
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-NACHHER.json
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-05-SUMMARY.md
- FOUND: a2b1325, cab6e88, 4ae9b05 (all three task commits present in git log)
