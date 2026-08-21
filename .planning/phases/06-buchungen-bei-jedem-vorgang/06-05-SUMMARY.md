---
phase: 06-buchungen-bei-jedem-vorgang
plan: 05
subsystem: vacation-balance
tags: [sqlite, better-sqlite3, typescript, vacation, carryover, year-end-rollover]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: "calculateCarryover(previousBalance) als einzige Übertragsberechnungsquelle (06-06, Welle 1) — unbegrenzt, kein Verfall"
provides:
  - "bulkInitializeVacationBalances() trägt bei bereits existierenden Konten einen fehlenden Übertrag nach, statt sie blind zu überspringen (CR-03 / Gap 2 aus 06-VERIFICATION.md geschlossen)"
  - "Idempotenzschutz per COUNT(*) ... type = 'carryover' — kein doppelter Anspruch, keine doppelte Übertragsbuchung bei zweitem Lauf"
  - "Regressionstests: Nachbuchung + Idempotenz (Test 7) und Interaktion mit bereits vorhandener, historisch abweichender carryover-Buchung (Test 8)"
affects: ["06-07"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Existenzprüfung als reiner Doppelbuchungsschutz, der nie einen bereits gebuchten historischen Wert überschreibt — Nachbuchung nur bei Abwesenheit einer type='carryover'-Buchung, niemals bei Wertabweichung"]

key-files:
  created: []
  modified:
    - server/src/services/vacationBalanceService.ts
    - server/src/services/vacationEntitlementBooking.test.ts

key-decisions:
  - "Existenzprüfung (COUNT auf type='carryover') bleibt bewusst ein reiner Doppelbuchungsschutz — sie korrigiert keinen bereits gebuchten, historisch falschen Wert (z. B. den gedeckelten Phase-7-Backfill-Datensatz von userId=1). Diese Korrektur bleibt eine separate, offene Anwenderentscheidung (siehe Welle 3 / 06-07)."
  - "Berechnung von hireDate/previousBalance/carryover vor die if(existing)-Prüfung gezogen, damit beide Zweige (neu/bereits vorhanden) dieselben Werte aus derselben Quelle (calculateCarryover) nutzen."

patterns-established:
  - "Nachbuchung bei bereits existierendem Datensatz: atomar in db.transaction() (UPDATE + recordVacationTransaction), abgesichert durch COUNT-Existenzprüfung auf den Buchungstyp, nicht auf den Kontostand."

requirements-completed: ["REQ-07"]

# Metrics
duration: 35min
completed: 2026-08-21
---

# Phase 06 Plan 05: Übertrag-Nachbuchung bei bestehenden Urlaubskonten (CR-03 / Gap 2) Summary

**bulkInitializeVacationBalances() bucht bei jedem bereits vorab angelegten Folgejahreskonto den fehlenden Übertrag nach, statt Resturlaub beim Jahreswechsel ersatzlos verfallen zu lassen — idempotent und ohne bereits gebuchte historische Werte zu überschreiben.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-21T19:10:00Z
- **Completed:** 2026-08-21T19:28:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- `bulkInitializeVacationBalances()` bucht bei bereits existierenden Konten (typischerweise durch `initializeVacationAccountsForNewUser` bei der Nutzeranlage vorab angelegt) den fehlenden Übertrag nach — Kontostand (`vacation_balance.carryover`) und Journal (`carryover`-Buchung) atomar in einer `db.transaction()`
- Idempotenzschutz per `COUNT(*) FROM vacation_transactions WHERE userId = ? AND year = ? AND type = 'carryover'` — ein zweiter Lauf bucht nicht doppelt
- Existenzprüfung überschreibt niemals einen bereits gebuchten, historisch abweichenden Wert (z. B. den auf 5 Tage gedeckelten Phase-7-Backfill-Datensatz) — durch Test 8 explizit abgesichert
- Docstring korrigiert: beschreibt jetzt den Nachbuchungs-Zweig statt "if (existing) continue" fälschlich als vollständiges Idempotenz-Feature zu deklarieren
- Zwei neue Regressionstests in `vacationEntitlementBooking.test.ts` (Test 7: Nachbuchung + Idempotenz; Test 8: Interaktion mit bereits vorhandener carryover-Buchung, vom Plan-Checker verlangt)

## Task Commits

1. **Task 1: bulkInitializeVacationBalances trägt fehlenden Übertrag bei bestehenden Konten nach (CR-03 / Gap 2)** - `2d9db1a` (fix)
2. **Task 2: Regressionstests für CR-03 (Nachbuchung, Idempotenz, Interaktion mit vorhandener carryover-Buchung)** - `c2d57ba` (test)

_Keine separate Plan-Metadaten-Commit — SUMMARY.md wird in diesem Worktree-Lauf zusammen mit den Task-Commits committet (Worktree-Modus, STATE.md/ROADMAP.md werden vom Orchestrator nach der Welle aktualisiert)._

## Files Created/Modified
- `server/src/services/vacationBalanceService.ts` - `bulkInitializeVacationBalances()`: Berechnung von `hireDate`/`previousBalance`/`carryover` vor die `if (existing)`-Prüfung gezogen; existing-Zweig bucht bei `carryover > 0` und fehlender `carryover`-Buchung atomar nach statt blind zu überspringen; Docstring korrigiert
- `server/src/services/vacationEntitlementBooking.test.ts` - Import von `recordVacationTransaction` ergänzt; Test 7 (Nachbuchung bei vorab angelegtem Konto + Idempotenz bei zweitem Lauf) und Test 8 (Interaktion mit bereits vorhandener, historisch abweichender `carryover`-Buchung) ergänzt; Kommentar in Test 4 präzisiert

## Decisions Made
- Die Existenzprüfung bleibt bewusst ein reiner Doppelbuchungsschutz und korrigiert keine bereits gebuchten, historisch falschen Werte — diese Korrektur ist laut Plan explizit außerhalb des Scopes dieses Plans und bleibt eine separate Entscheidung (Welle 3 / 06-07 behandelt die Bestandsdaten von Karin Jochem und Christine Glas)
- `hireDate`/`previousBalance`/`carryover`-Berechnung wird jetzt vor der `existing`-Prüfung durchgeführt, damit neuer und bestehender Zweig identisch aus `calculateCarryover()` lesen (keine doppelte Logik)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Testlage-Verifikation gegen Orchestrator-Baseline (kein durch diesen Plan verursachter Fehlschlag):**

`cd server && npx vitest run` (Standard-Modus, `fileParallelism: false` aus Welle 1 bereits gesetzt)
zeigte nach meinen Änderungen 18 Fehlschläge (nicht die vom Orchestrator genannten 3) — alle in
Dateien, die dieser Plan nicht anfasst (`balanceTracking.test.ts`, `overtimeTransactionCentralization.test.ts`,
`unifiedOvertimeService.test.ts`, `workingDays.test.ts`). Per Zero-Hallucination-Policy empirisch
verifiziert statt vermutet: Beide betroffenen Dateien (`vacationBalanceService.ts`,
`vacationEntitlementBooking.test.ts`) wurden per `git checkout 68a47e7 -- <2 Dateien>` auf den
Vorzustand (Basis-Commit dieses Plans) zurückgesetzt, die volle Suite erneut ausgeführt:
identische 18 Fehlschläge, exakt dieselbe Menge (166 passed → 164 passed, Differenz = genau die
2 neuen Tests aus Task 2). Danach per `git checkout HEAD -- <2 Dateien>` wiederhergestellt
(verifiziert: `git diff --stat HEAD` leer, `npx tsc --noEmit` erneut fehlerfrei, 8/8 Tests in
`vacationEntitlementBooking.test.ts` erneut grün). Diese 18 Fehlschläge sind bereits in
`06-06-SUMMARY.md`/`deferred-items.md` als vorbestehend (Basis-Commit `130ffbf2`, vor Welle 1)
dokumentiert — Root Causes: fehlende Spalten `overtime_transactions.balanceBefore/balanceAfter`
(10 Tests) und fehlende Feiertagsdaten 2026 in der lokalen `holidays`-Tabelle (8 Tests, inkl.
2 `unifiedOvertimeService`-Fälle). Kein neuer Fehlschlag durch diesen Plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-03 / Gap 2 aus `06-VERIFICATION.md` ist geschlossen: der nächste reale Aufruf von
  `bulkInitializeVacationBalances()`/`performYearEndRollover()` für jedes betroffene Jahr bucht
  den fehlenden Übertrag korrekt nach, unabhängig davon, ob das Konto durch Massenanlage selbst
  oder bereits vorher durch Nutzeranlage entstand.
- Bestandsdaten (gedeckelter 5-Tage-Übertrag von `userId=1`, Jahr 2026) bleiben unverändert —
  wie geplant nicht Teil dieses Gap-Closures; Welle 3 (06-07) behandelt die betroffenen
  2025er-Konten separat.
- 18 vorbestehende, umgebungsbedingte Testfehlschläge außerhalb des Scope dieses Plans bleiben
  unverändert bestehen (dokumentiert in `deferred-items.md` seit Welle 1) — keine Blockade für
  Welle 3.

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: commit 2d9db1a (Task 1)
- FOUND: commit c2d57ba (Task 2)
- FOUND: server/src/services/vacationBalanceService.ts (modified, existing file)
- FOUND: server/src/services/vacationEntitlementBooking.test.ts (modified, existing file, 8 tests passing)
