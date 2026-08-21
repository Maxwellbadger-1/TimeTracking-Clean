---
phase: 06-buchungen-bei-jedem-vorgang
plan: 06
subsystem: vacation-balance
tags: [sqlite, better-sqlite3, typescript, vacation, carryover]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: recordVacationTransaction()-Journal (06-01/06-02/06-03), previewYearEndRollover()/bulkInitializeVacationBalances() (06-VERIFICATION.md Gap 1/Gap 2)
provides:
  - "calculateCarryover(previousBalance) in vacationBalanceService.ts als einzige Berechnungsquelle der Übertragsregel (unbegrenzt, kein Verfall)"
  - "Alle fünf Server-Aufrufstellen (upsertVacationBalance, updateVacationBalance, bulkInitializeVacationBalances, absenceService.initializeVacationBalance, yearEndRolloverService.previewYearEndRollover) nutzen ausschließlich diese Funktion"
  - "Regressionstest, der alle vier Buchungspfade und die Admin-Vorschau direkt gegen die tatsächliche Buchung vergleicht"
  - "Admin-Korrekturformular (Desktop) validiert dieselbe Regel wie der Server (keine feste Obergrenze mehr)"
affects: ["06-04", "06-05"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["single-source-of-truth calculation function statt an fünf Stellen dupliziertem Business-Logic-Fragment"]

key-files:
  created:
    - server/src/services/vacationCarryoverCalculation.test.ts
    - .planning/phases/06-buchungen-bei-jedem-vorgang/deferred-items.md
  modified:
    - server/src/services/vacationBalanceService.ts
    - server/src/services/absenceService.ts
    - server/src/services/yearEndRolloverService.ts
    - desktop/src/components/vacation/VacationBalanceEditModal.tsx

key-decisions:
  - "Anwenderentscheidung (bindend): Übertrag ins Folgejahr ist unbegrenzt, kein Verfall — bulkInitializeVacationBalances() war bereits die fachlich korrekte Referenz, die anderen vier Stellen wurden darauf angeglichen"
  - "Frontend-Obergrenze (max=10) im Admin-Korrekturformular entfernt, um Widerspruch zwischen Oberfläche und Server zu vermeiden"

patterns-established:
  - "Business-Regeln, die an mehreren Stellen unabhängig implementiert werden können, gehören in eine einzige exportierte, testbare Funktion — Duplikation ist die eigentliche Fehlerquelle, nicht die einzelne fehlerhafte Formel"

requirements-completed: ["REQ-07"]

# Metrics
duration: 55min
completed: 2026-08-21
---

# Phase 06 Plan 06: calculateCarryover() als einzige Übertragsquelle Summary

**calculateCarryover(previousBalance) vereinheitlicht fünf zuvor widersprüchliche Übertragsberechnungen (drei gedeckelt auf 5 Tage, eine unbegrenzt, eine unbegrenzt ohne Untergrenze) zu einer einzigen, unbegrenzten Regel ohne Verfall — inklusive direktem Vergleich Admin-Vorschau vs. tatsächliche Jahreswechsel-Buchung.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-21T~16:25:00Z
- **Completed:** 2026-08-21T17:18:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 4 (+ 1 neue Testdatei, + 1 deferred-items.md)

## Accomplishments
- Neue Funktion `calculateCarryover(previousBalance)` in `vacationBalanceService.ts` — einzige Stelle, die die Übertragsregel kennt (unbegrenzt, Untergrenze 0)
- Alle fünf betroffenen Aufrufstellen umgestellt: `upsertVacationBalance()`, `updateVacationBalance()`, `bulkInitializeVacationBalances()` (alle in `vacationBalanceService.ts`), `absenceService.initializeVacationBalance()`, `yearEndRolloverService.previewYearEndRollover()` (fünfte Stelle, vom Plan-Checker nachträglich gefunden)
- Feste 10-Tage-Hartgrenze in `upsertVacationBalance()`/`updateVacationBalance()` entfernt; alle falschen "German law"/"Max 5 days"-Kommentare und Fehlertexte entfernt
- Neuer Regressionstest (`vacationCarryoverCalculation.test.ts`, 6 Tests): 5 Unit-Tests für `calculateCarryover()`, 1 Konsistenztest, der vier Buchungspfade UND den direkten Vergleich Admin-Vorschau vs. tatsächliche Buchung für denselben Nutzer/dasselbe Jahr prüft (20-Tage-Fall, über der alten 5-Tage-Deckelung)
- Admin-Korrekturformular (`VacationBalanceEditModal.tsx`) validiert nur noch die Untergrenze (≥ 0), keine feste Obergrenze mehr — Oberfläche und Server widersprechen sich nicht mehr

## Task Commits

1. **Task 1: calculateCarryover() einführen, alle fünf Aufrufstellen umstellen** - `63a3292` (fix)
2. **Task 2: Regressionstest über alle fünf Pfade + Admin-Vorschau vs. Buchung** - `2749f2b` (test)
3. **Task 3: Frontend-Validierungsgrenze angleichen** - `854ffe6` (fix)

_Keine separate Plan-Metadaten-Commit — SUMMARY.md wird in diesem Worktree-Lauf zusammen mit den Task-Commits committet (Worktree-Modus, STATE.md/ROADMAP.md werden vom Orchestrator nach der Welle aktualisiert)._

## Files Created/Modified
- `server/src/services/vacationBalanceService.ts` - `calculateCarryover()` neu; `upsertVacationBalance()`, `updateVacationBalance()`, `bulkInitializeVacationBalances()` nutzen sie
- `server/src/services/absenceService.ts` - `initializeVacationBalance()` importiert und nutzt `calculateCarryover()`
- `server/src/services/yearEndRolloverService.ts` - `previewYearEndRollover()` nutzt `getVacationBalance()` + `calculateCarryover()` statt roher, ungekappter Differenz ohne Untergrenze
- `server/src/services/vacationCarryoverCalculation.test.ts` - neu, 6 Regressionstests
- `desktop/src/components/vacation/VacationBalanceEditModal.tsx` - Validierung und Input-Attribute an die serverseitige Regel angeglichen
- `.planning/phases/06-buchungen-bei-jedem-vorgang/deferred-items.md` - neu, dokumentiert vorbestehende, nicht durch diesen Plan verursachte Testfehlschläge

## Decisions Made
- Übertrag ins Folgejahr ist unbegrenzt, kein Verfall (Anwenderentscheidung, bindend für diesen Plan) — `bulkInitializeVacationBalances()` war bereits die fachlich korrekte Referenz
- Die feste 10-Tage-Grenze im Admin-Korrekturformular wurde entfernt statt an die neue Serverregel angepasst, da die einzig verbleibende sinnvolle clientseitige Grenze die tatsächliche Vorjahres-Restsumme ist (nicht clientseitig bekannt) — die Untergrenze (≥ 0) bleibt die einzige clientseitige Prüfung, die Durchsetzung bleibt serverseitig

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Testlage-Diskrepanz gegenüber Koordinator-Baseline (kein durch diesen Plan verursachter Regressionsfall, aber dokumentationswürdig):**

Beim Ausführen von `cd server && npx vitest run` (Standard-Parallelmodus) traten deutlich mehr
Fehlschläge auf als die vom Koordinator dokumentierten 3 bekannten Fälle. Ursachenanalyse:

1. **Paralleler Testlauf ist nichtdeterministisch:** `server/vitest.config.ts` konfiguriert keinen
   `pool`/`fileParallelism` — mehrere Testdateien schreiben parallel gegen dieselbe SQLite-Datei
   (`server/database/development.db`) und erzeugen sporadisch `SqliteError: database is locked`.
   Mit `--no-file-parallelism` verschwindet dieses Rauschen vollständig und der Testlauf wird
   deterministisch.
2. **18 zusätzliche, vorbestehende Fehlschläge** (`balanceTracking.test.ts`,
   `overtimeTransactionCentralization.test.ts`, `unifiedOvertimeService.test.ts`,
   `workingDays.test.ts`) wurden **empirisch verifiziert** als bereits am Basis-Commit
   (`130ffbf2`) vorhanden: die drei von diesem Plan geänderten Dateien wurden gezielt per
   `git checkout 130ffbf2 -- <3 Dateien>` auf den Vorzustand zurückgesetzt, die betroffenen
   Testdateien liefen — identische 18 Fehlschläge, exakt dieselbe Menge (per `diff` verglichen).
   Danach wurden die drei Dateien per `git checkout HEAD -- <3 Dateien>` wiederhergestellt
   (verifiziert: `git diff --stat HEAD` leer, `npx tsc --noEmit` erneut fehlerfrei).
   Root Causes: `overtime_transactions` fehlen die in `schema.ts` nicht definierten Spalten
   `balanceBefore`/`balanceAfter` (7+3 Tests), lokale `holidays`-Daten für 2026 fehlen offenbar
   teilweise (7 Tests in `workingDays.test.ts`). Beide Ursachen liegen in Dateien, die dieser Plan
   nicht anfasst (`schema.ts`, `overtimeTransactionService.ts`, `workingDays.ts`).
   Details in `deferred-items.md`.

**Endergebnis (sequentiell, `--no-file-parallelism`, nach allen drei Tasks dieses Plans):**
18 failed / 164 passed von 182 Tests gesamt (176 vorbestehende + 6 neue aus diesem Plan) —
exakt dieselben 18 Fehlschläge wie am Basis-Commit, keiner neu hinzugekommen. Die 6 neuen Tests
aus Task 2 sind alle grün.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `calculateCarryover()` ist bereit als Referenzfunktion für 06-04 und 06-05 (Welle 2), die von
  diesem Plan abhängen (`depends_on: ["06-06"]`) — beide Pläne verweisen auf Funktionsnamen/
  Grep-Muster statt fester Zeilennummern, da sich die Zeilennummern in `vacationBalanceService.ts`
  und `absenceService.ts` durch diesen Plan verschoben haben.
- Bestehender, gedeckelter 5-Tage-Übertrag von `userId=1`, Jahr 2026 (Phase-7-Backfill) bleibt
  unverändert — diese Korrektur ist laut Plan explizit nicht Teil dieses Gap-Closures und eine
  separate, offene Entscheidung beim Anwender.
- `deferred-items.md` dokumentiert 18 vorbestehende, umgebungsbedingte Testfehlschläge außerhalb
  des Scope dieses Plans — keine Blockade für 06-04/06-05, aber relevant für eine spätere,
  eigene Bereinigung (Schema-Fix `overtime_transactions.balanceAfter`, Feiertagsdaten 2026).

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: server/src/services/vacationCarryoverCalculation.test.ts
- FOUND: .planning/phases/06-buchungen-bei-jedem-vorgang/deferred-items.md
- FOUND: commit 63a3292 (Task 1)
- FOUND: commit 2749f2b (Task 2)
- FOUND: commit 854ffe6 (Task 3)
