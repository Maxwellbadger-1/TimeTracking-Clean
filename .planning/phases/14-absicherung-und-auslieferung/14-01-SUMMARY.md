---
phase: 14-absicherung-und-auslieferung
plan: 01
subsystem: testing
tags: [vitest, workPeriodChangeService, workPeriodDeletionService, req-32, overtime]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    provides: applyWorkTimeChange() mit rueckwirkendem/kuenftigem Stichtag, Vorschau/Speichern
  - phase: 13-korrigieren-und-r-ckg-ngig-machen
    provides: deleteWorkPeriod() mit Doppelzaehlungs-Nachweis (Zusicherungen A-D)
provides:
  - Namentliche Nachweisliste der fuenf REQ-32-Faelle mit Einzeltestlauf je Fall
  - Neuer it-Block fuer "Erhoehung mit rueckwirkendem Stichtag" (Basis 20h -> 40h)
  - Bestaetigung: die drei bekannten roten Tests bleiben unveraendert, keine Regression
affects: [14-02, 14-03, uat-sammlung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "REQ-Nachweis als Tabelle mit Fundstelle + wortgetreuem Einzeltestlauf statt Sammelbehauptung 'Tests gruen'"

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-REQ32-NACHWEIS.md
  modified:
    - server/src/services/workPeriodChangeService.test.ts

key-decisions:
  - "Kein Codefix noetig: applyWorkTimeChange() behandelt Erhoehung und Reduzierung bereits symmetrisch (Vorzeichen von balanceDelta kehrt sich um) — die REQ-32-Luecke war reine Testabdeckung, kein Bug"

patterns-established:
  - "Fuenf-Faelle-Nachweistabelle (Datei, it-Titel, Zeile, woertlicher vitest-Ausgabe-Ausschnitt) als Muster fuer kuenftige Requirement-Abschluesse"

requirements-completed: [REQ-32]

# Metrics
duration: ~20min
completed: 2026-08-23
---

# Phase 14 Plan 01: REQ-32-Absicherung Summary

**REQ-32 fünf Wechselfälle einzeln nachgewiesen; einziger fehlender Fall (Erhöhung mit rückwirkendem Stichtag, Basis 20h→40h) durch neuen `it`-Block geschlossen — ohne Codeänderung, da `applyWorkTimeChange()` Erhöhung/Reduzierung bereits symmetrisch behandelt.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-23T01:26:21Z (nach vorherigem Commit 2c1c2ce)
- **Completed:** 2026-08-23T01:35:57Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Vier bereits existierende REQ-32-Fälle (Reduzierung/Zukunft, Stichtag mitten im Monat, Jahreswechsel, Löschen-und-neu-rechnen) einzeln per `npx vitest run -t "<Titel>"` nachgewiesen — keine Sammelbehauptung
- Fünfter Fall (Erhöhung mit rückwirkendem Stichtag) durch neuen, eigenständigen Test geschlossen: Zusicherung negativer `balanceDelta`, positiver `targetHoursDelta`, unveränderte Vergangenheit, genau eine `model_change`-Buchung
- Alle vier Pflichtgates gefahren und wörtlich protokolliert: `server` + `desktop` `tsc --noEmit` (Exit 0), `server` `vitest run` (genau 3 rote Tests, unverändert), `desktop` `check:rules` (Exit 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: Nachweisliste anlegen und vier vorhandene Fälle einzeln laufen lassen** - `af74db0` (docs)
2. **Task 2: Fehlenden Fall schließen — Erhöhung mit rückwirkendem Stichtag** - `02d06e0` (test)
3. **Task 3: Gates fahren und Nachweisliste schließen** - `4f522d6` (docs)

_Hinweis: Task 2 trug `tdd="true"`, blieb aber ein einziger Commit — der Test lief beim ersten Lauf bereits grün (keine Implementierungslücke, nur Testlücke), daher kein separater GREEN-Commit nötig._

## Files Created/Modified
- `.planning/phases/14-absicherung-und-auslieferung/14-REQ32-NACHWEIS.md` - Nachweistabelle der fünf REQ-32-Fälle mit Fundstelle, Titel und Einzeltestlauf-Protokoll, plus Gates-Abschnitt
- `server/src/services/workPeriodChangeService.test.ts` - neuer `it`-Block „REQ-32: Eine Erhoehung der Wochenstunden mit rueckwirkendem Stichtag …" (Zeile 284)

## Decisions Made
- Kein Codefix in `workPeriodChangeService.ts` nötig — die Erhöhungsfall-Logik funktionierte bereits korrekt (symmetrisches Vorzeichen von `balanceDelta`), der Plan-Befund („nirgends geschrieben, nirgends geprüft") bezog sich ausschließlich auf fehlende Testabdeckung, nicht auf einen Bug

## Deviations from Plan

None - plan executed exactly as written. Task 2 lief im ersten Lauf bereits grün (kein RED-Zustand), was dem in `<befund_aus_der_planung>` beschriebenen Befund entspricht: der Code behandelt Erhöhung/Reduzierung bereits generisch, nur der Test fehlte.

## Issues Encountered
- Der im Plan vorgesehene Verify-Befehl `npx vitest run 2>&1 | grep -E "Tests +[0-9]+ failed"` liefert wegen ANSI-Escape-Codes in der vitest-Ausgabe keinen Treffer (kosmetisches Problem des grep-Musters, nicht des Testergebnisses). Das tatsächliche Ergebnis wurde stattdessen über `grep -a "Tests"` verifiziert: `3 failed | 492 passed (495)` — exakt wie erwartet.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REQ-32 vollständig geschlossen, alle fünf Fälle einzeln nachgewiesen und dokumentiert
- Testbaseline unverändert: weiterhin exakt 3 pre-existing rote Tests (`unifiedOvertimeService.test.ts:285`, `:340`, `vacationBackfillService.test.ts:138`), grüne Zahl von 491 auf 492 gestiegen
- Bereit für Plan 14-02 (REQ-33, Generalprobe auf Produktionskopie)

---
*Phase: 14-absicherung-und-auslieferung*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-REQ32-NACHWEIS.md
- FOUND: server/src/services/workPeriodChangeService.test.ts
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-01-SUMMARY.md
- FOUND: af74db0, 02d06e0, 4f522d6, 94f8476 (all commits present in git log)
